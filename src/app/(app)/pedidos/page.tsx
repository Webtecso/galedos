"use client";

import { useCallback, useEffect, useState } from "react";
import { Send } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Etiqueta from "@/components/ui/Etiqueta";
import { useAuth } from "@/components/auth/AuthProvider";
import { getSupabase } from "@/lib/supabase/client";
import { traduzirErro } from "@/lib/erros";
import { dataLuanda } from "@/lib/presenca";
import { formatData, formatKz } from "@/lib/format";

type TipoPedido = "Adiantamento" | "Material" | "Justificação";
type EstadoPedido = "Pendente" | "Aprovado" | "Recusado" | "Cancelado";
type Tom = "verde" | "azul" | "ambar" | "vermelho" | "cinza";
type Pedido = {
  id: string; codigo: string; colaborador_id: string; tipo: TipoPedido; valor: number | null;
  data_referencia: string | null; descricao: string; estado: EstadoPedido; resposta: string;
  respondido_por: string; criado_em: string; colaboradores: { nome: string } | null;
};
type Msg = { tipo: "ok" | "erro"; texto: string } | null;

const tons: Record<EstadoPedido, Tom> = { Pendente: "ambar", Aprovado: "verde", Recusado: "vermelho", Cancelado: "cinza" };
const campo =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
const botao = "rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50";

function lerValor(s: string): number {
  const t = s.replace(/\s/g, "");
  return t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t.replace(/\./g, ""));
}

export default function PedidosPage() {
  const { perfil } = useAuth();
  const cid = perfil.colaboradorId;
  const eGestao = perfil.perfil !== "operacional";
  const eAdmin = perfil.perfil === "administrador";
  const [lista, setLista] = useState<Pedido[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [ocupado, setOcupado] = useState(false);
  const [form, setForm] = useState<{ tipo: TipoPedido; valor: string; data: string; descricao: string }>({
    tipo: "Adiantamento", valor: "", data: "", descricao: "",
  });
  const [filtro, setFiltro] = useState<"Todos" | EstadoPedido>("Pendente");
  const [recusando, setRecusando] = useState("");
  const [motivo, setMotivo] = useState("");

  const carregar = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from("pedidos_colaborador")
      .select("*, colaboradores(nome)")
      .order("criado_em", { ascending: false })
      .limit(300);
    if (error) setMsg({ tipo: "erro", texto: traduzirErro(error) });
    else setLista((data ?? []) as unknown as Pedido[]);
    setCarregado(true);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function chamar(fn: string, args: Record<string, unknown>, ok: string): Promise<boolean> {
    if (ocupado) return false;
    setOcupado(true);
    setMsg(null);
    try {
      const { error } = await getSupabase().rpc(fn, args);
      if (error) {
        setMsg({ tipo: "erro", texto: traduzirErro(error) });
        return false;
      }
      setMsg({ tipo: "ok", texto: ok });
      await carregar();
      return true;
    } finally {
      setOcupado(false);
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const descricao = form.descricao.trim();
    if (!descricao) {
      setMsg({ tipo: "erro", texto: "Descreva o pedido." });
      return;
    }
    let valor: number | null = null;
    if (form.tipo === "Adiantamento") {
      const n = lerValor(form.valor);
      if (!(n > 0)) {
        setMsg({ tipo: "erro", texto: "Indique o valor do adiantamento em Kz." });
        return;
      }
      valor = n;
    }
    if (form.tipo === "Justificação" && !form.data) {
      setMsg({ tipo: "erro", texto: "Indique a data a que se refere a justificação." });
      return;
    }
    const ok = await chamar(
      "criar_pedido",
      { p: { tipo: form.tipo, valor, data_referencia: form.tipo === "Justificação" ? form.data : null, descricao } },
      "Pedido enviado à administração."
    );
    if (ok) setForm({ ...form, valor: "", data: "", descricao: "" });
  }

  async function aprovar(p: Pedido) {
    if (!window.confirm(`Aprovar o pedido ${p.codigo}?`)) return;
    await chamar("responder_pedido", { p_id: p.id, p_aprovar: true, p_motivo: "" }, "Pedido aprovado.");
  }

  async function recusar() {
    const ok = await chamar("responder_pedido", { p_id: recusando, p_aprovar: false, p_motivo: motivo }, "Pedido recusado.");
    if (ok) {
      setRecusando("");
      setMotivo("");
    }
  }

  async function cancelar(p: Pedido) {
    if (!window.confirm(`Cancelar o pedido ${p.codigo}?`)) return;
    await chamar("cancelar_pedido", { p_id: p.id }, "Pedido cancelado.");
  }

  if (!carregado) return <p className="text-sm text-slate-500">A carregar...</p>;

  const hoje = dataLuanda(new Date().toISOString());
  const meus = lista.filter((p) => p.colaborador_id === cid);
  const equipa = lista.filter((p) => p.colaborador_id !== cid && (filtro === "Todos" || p.estado === filtro));

  function detalhe(p: Pedido) {
    return (
      <div className="mt-2 space-y-1 text-sm text-slate-700">
        {p.valor !== null && <p>Valor pedido: <strong>{formatKz(p.valor)}</strong></p>}
        {p.data_referencia && <p>Data a justificar: <strong>{formatData(p.data_referencia)}</strong></p>}
        <p>{p.descricao}</p>
        {p.resposta && <p className="text-slate-500">Resposta{p.respondido_por ? ` de ${p.respondido_por}` : ""}: {p.resposta}</p>}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Pedidos"
        description={eGestao ? "Pedidos da equipa e os seus próprios pedidos." : "Peça um adiantamento ou material, ou justifique um atraso ou falta."}
      />

      {msg && (
        <div className={`mb-4 rounded-lg border p-3 text-sm ${msg.tipo === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{msg.texto}</div>
      )}

      {cid && (
        <form onSubmit={enviar} noValidate className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-slate-900">Novo pedido</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700">Tipo *</label>
              <select className={campo} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoPedido })}>
                <option value="Adiantamento">Adiantamento</option>
                <option value="Material">Material</option>
                <option value="Justificação">Justificação de atraso ou falta</option>
              </select>
            </div>
            {form.tipo === "Adiantamento" && (
              <div>
                <label className="text-sm font-medium text-slate-700">Valor (Kz) *</label>
                <input className={campo} inputMode="numeric" placeholder="Ex.: 15000" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
              </div>
            )}
            {form.tipo === "Justificação" && (
              <div>
                <label className="text-sm font-medium text-slate-700">Data a justificar *</label>
                <input type="date" className={campo} max={hoje} value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">
                {form.tipo === "Material" ? "Material necessário e quantidade *" : form.tipo === "Justificação" ? "Motivo *" : "Motivo do adiantamento *"}
              </label>
              <textarea className={campo} rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            A aprovação de um pedido não paga nem desconta nada automaticamente: a administração regista o pagamento ou o movimento de stock em separado.
          </p>
          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={ocupado} className={`${botao} inline-flex items-center gap-2 bg-brand-600 text-white hover:bg-brand-700`}>
              <Send className="h-4 w-4" /> Enviar pedido
            </button>
          </div>
        </form>
      )}

      {cid && (
        <>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Os meus pedidos</h2>
          <div className="mb-8 space-y-3">
            {meus.map((p) => (
              <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-slate-500">{p.codigo} · {formatData(p.criado_em.slice(0, 10))}</p>
                    <p className="text-base font-semibold text-slate-900">{p.tipo}</p>
                  </div>
                  <Etiqueta texto={p.estado} tom={tons[p.estado]} />
                </div>
                {detalhe(p)}
                {p.estado === "Pendente" && (
                  <button disabled={ocupado} onClick={() => cancelar(p)} className={`${botao} mt-3 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>
                    Cancelar pedido
                  </button>
                )}
              </div>
            ))}
            {meus.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">Ainda sem pedidos.</p>}
          </div>
        </>
      )}

      {eGestao && (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Pedidos da equipa</h2>
            <select className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700" value={filtro} onChange={(e) => setFiltro(e.target.value as "Todos" | EstadoPedido)}>
              <option value="Pendente">Pendentes</option>
              <option value="Aprovado">Aprovados</option>
              <option value="Recusado">Recusados</option>
              <option value="Cancelado">Cancelados</option>
              <option value="Todos">Todos</option>
            </select>
          </div>
          <div className="space-y-3">
            {equipa.map((p) => (
              <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-slate-500">{p.codigo} · {formatData(p.criado_em.slice(0, 10))}</p>
                    <p className="text-base font-semibold text-slate-900">{p.tipo} · {p.colaboradores?.nome ?? p.colaborador_id}</p>
                  </div>
                  <Etiqueta texto={p.estado} tom={tons[p.estado]} />
                </div>
                {detalhe(p)}
                {p.estado === "Pendente" && (p.tipo !== "Adiantamento" || eAdmin) && (
                  recusando === p.id ? (
                    <div className="mt-3 space-y-2">
                      <label className="text-sm font-medium text-slate-700">Motivo da recusa *</label>
                      <input className={campo} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                      <div className="flex gap-2">
                        <button disabled={ocupado} onClick={recusar} className={`${botao} bg-red-600 text-white hover:bg-red-700`}>Confirmar recusa</button>
                        <button onClick={() => { setRecusando(""); setMotivo(""); }} className={`${botao} border border-slate-300 bg-white text-slate-700`}>Voltar</button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex gap-2">
                      <button disabled={ocupado} onClick={() => aprovar(p)} className={`${botao} bg-emerald-600 text-white hover:bg-emerald-700`}>Aprovar</button>
                      <button disabled={ocupado} onClick={() => { setRecusando(p.id); setMotivo(""); }} className={`${botao} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>Recusar</button>
                    </div>
                  )
                )}
                {p.estado === "Pendente" && p.tipo === "Adiantamento" && !eAdmin && (
                  <p className="mt-3 text-xs text-slate-500">Só o administrador responde a adiantamentos.</p>
                )}
              </div>
            ))}
            {equipa.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">Sem pedidos neste filtro.</p>}
          </div>
        </>
      )}
    </>
  );
}