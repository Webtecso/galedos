"use client";

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Etiqueta from "@/components/ui/Etiqueta";
import { useColaboradores } from "@/components/colaboradores/ColaboradoresProvider";
import { getSupabase } from "@/lib/supabase/client";
import { traduzirErro } from "@/lib/erros";
import { dataLuanda } from "@/lib/presenca";
import { formatData } from "@/lib/format";

type Aviso = { id: string; titulo: string; texto: string; colaborador_id: string | null; activo: boolean; criado_por_nome: string; criado_em: string };
type Lido = { aviso_id: string; colaborador_id: string };
type Msg = { tipo: "ok" | "erro"; texto: string } | null;

const campo =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
const btn = "rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:bg-slate-300";

export default function AvisosPage() {
  const co = useColaboradores();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [lidos, setLidos] = useState<Lido[]>([]);
  const [pronto, setPronto] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [ocupado, setOcupado] = useState(false);
  const [form, setForm] = useState({ titulo: "", texto: "", para: "" });

  const carregar = useCallback(async () => {
    const sb = getSupabase();
    const [a, l] = await Promise.all([
      sb.from("avisos").select("*").order("criado_em", { ascending: false }).limit(100),
      sb.from("avisos_lidos").select("aviso_id,colaborador_id").limit(5000),
    ]);
    const falha = a.error ?? l.error;
    if (falha) setMsg({ tipo: "erro", texto: traduzirErro(falha) });
    else {
      setAvisos((a.data ?? []) as unknown as Aviso[]);
      setLidos((l.data ?? []) as unknown as Lido[]);
    }
    setPronto(true);
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

  async function publicar(e: React.FormEvent) {
    e.preventDefault();
    if (form.titulo.trim().length < 3) return setMsg({ tipo: "erro", texto: "Escreva o título do aviso." });
    if (form.texto.trim().length < 3) return setMsg({ tipo: "erro", texto: "Escreva o texto do aviso." });
    const ok = await chamar("criar_aviso", { p_titulo: form.titulo, p_texto: form.texto, p_colaborador: form.para || null }, "Aviso publicado.");
    if (ok) setForm({ titulo: "", texto: "", para: "" });
  }

  if (!pronto || !co.carregado) return <p className="text-sm text-slate-500">A carregar...</p>;

  const activos = co.colaboradores.filter((c) => c.estado === "Activo");

  return (
    <>
      <PageHeader title="Avisos" description="Mensagens para os colaboradores. Aparecem no ecrã Hoje até serem marcadas como lidas." />

      {msg && (
        <div className={`mb-4 rounded-lg border p-3 text-sm ${msg.tipo === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{msg.texto}</div>
      )}

      <form onSubmit={publicar} noValidate className="mb-6 max-w-3xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-slate-900">Novo aviso</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-700">Para *</label>
            <select className={campo} value={form.para} onChange={(e) => setForm({ ...form, para: e.target.value })}>
              <option value="">Todos os colaboradores</option>
              {activos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Título *</label>
            <input className={campo} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-700">Texto *</label>
            <textarea className={campo} rows={3} value={form.texto} onChange={(e) => setForm({ ...form, texto: e.target.value })} />
          </div>
        </div>
        <div className="mt-4 flex justify-end"><button type="submit" disabled={ocupado} className={btn}>Publicar aviso</button></div>
      </form>

      <div className="space-y-3">
        {avisos.map((a) => {
          const alvo = a.colaborador_id ? activos.filter((c) => c.id === a.colaborador_id) : activos;
          const leram = alvo.filter((c) => lidos.some((l) => l.aviso_id === a.id && l.colaborador_id === c.id));
          const faltam = alvo.filter((c) => !leram.includes(c));
          return (
            <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-slate-500">{formatData(dataLuanda(a.criado_em))} · {a.criado_por_nome} · para {a.colaborador_id ? (co.obter(a.colaborador_id)?.nome ?? "colaborador") : "todos"}</p>
                  <p className="text-base font-semibold text-slate-900">{a.titulo}</p>
                </div>
                <Etiqueta texto={a.activo ? "Activo" : "Arquivado"} tom={a.activo ? "verde" : "cinza"} />
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{a.texto}</p>
              <p className="mt-2 text-xs text-slate-500">
                Lido por {leram.length} de {alvo.length}{faltam.length > 0 && faltam.length <= 6 ? `. Faltam: ${faltam.map((c) => c.nome).join(", ")}` : ""}
              </p>
              {a.activo && (
                <button disabled={ocupado} onClick={() => { if (window.confirm("Arquivar este aviso? Deixa de aparecer aos colaboradores.")) chamar("arquivar_aviso", { p_id: a.id }, "Aviso arquivado."); }}
                  className="mt-2 text-sm font-medium text-slate-600 hover:underline">Arquivar</button>
              )}
            </div>
          );
        })}
        {avisos.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Ainda sem avisos.</p>}
      </div>
    </>
  );
}