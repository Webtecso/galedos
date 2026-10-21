"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import Etiqueta, { type Tom } from "@/components/ui/Etiqueta";
import { useOrcamentos } from "@/components/orcamentos/OrcamentosProvider";
import { useServicos } from "@/components/servicos/ServicosProvider";
import { useClientes } from "@/components/clientes/ClientesProvider";
import { estadosPreExecucao, type EstadoOrcamento } from "@/lib/orcamentos";
import { formatData, formatKz } from "@/lib/format";
import { FileText, Percent, Send, CheckCircle2 } from "lucide-react";

const tom: Record<EstadoOrcamento, Tom> = { Enviado: "azul", Aceite: "verde", Recusado: "vermelho" };

const campo =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export default function OrcamentosPage() {
  const orc = useOrcamentos();
  const sv = useServicos();
  const cl = useClientes();
  const [sel, setSel] = useState("");
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [recusando, setRecusando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");

  if (!(orc.carregado && sv.carregado && cl.carregado)) return <p className="text-sm text-slate-500">A carregar...</p>;

  const candidatos = sv.servicos
    .filter((s) => (estadosPreExecucao as readonly string[]).includes(s.estadoOperacional) && !orc.orcamentos.some((o) => o.servicoId === s.id))
    .sort((a, b) => b.codigo.localeCompare(a.codigo));

  const enviados = orc.orcamentos.length;
  const aceites = orc.orcamentos.filter((o) => o.estado === "Aceite").length;
  const aguardam = orc.orcamentos.filter((o) => o.estado === "Enviado").length;
  const conversao = enviados ? Math.round((aceites / enviados) * 1000) / 10 : null;

  function registar(e: React.FormEvent) {
    e.preventDefault();
    const r = orc.registar(sel);
    if (r.ok) {
      setSel("");
      setMsg({ tipo: "ok", texto: "Orçamento registado como enviado." });
    } else setMsg({ tipo: "erro", texto: r.erro ?? "Erro." });
  }

  function aceitar(id: string) {
    const r = orc.responder(id, true);
    setMsg(r.ok ? { tipo: "ok", texto: "Orçamento aceite. Pode agora agendar o serviço (botão Editar na ordem de serviço)." } : { tipo: "erro", texto: r.erro ?? "Erro." });
  }

  function recusar() {
    if (!recusando) return;
    const r = orc.responder(recusando, false, motivo);
    if (r.ok) {
      setRecusando(null);
      setMotivo("");
      setMsg({ tipo: "ok", texto: "Orçamento marcado como recusado." });
    } else setMsg({ tipo: "erro", texto: r.erro ?? "Erro." });
  }

  return (
    <>
      <Link href="/servicos" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Serviços
      </Link>
      <PageHeader title="Orçamentos" description="Registo dos orçamentos enviados e da resposta dos clientes. Alimenta a taxa de conversão dos Relatórios." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Enviados" value={String(enviados)} icon={Send} />
        <StatCard label="Aceites" value={String(aceites)} icon={CheckCircle2} />
        <StatCard label="A aguardar resposta" value={String(aguardam)} icon={FileText} />
        <StatCard label="Taxa de conversão" value={conversao === null ? "—" : `${String(conversao).replace(".", ",")}%`} icon={Percent} hint="Aceites / enviados (todo o histórico)" />
      </div>

      {msg && (
        <div className={`mb-4 rounded-lg border p-3 text-sm ${msg.tipo === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{msg.texto}</div>
      )}

      <form onSubmit={registar} noValidate className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-slate-900">Registar orçamento enviado</h2>
        <p className="mb-3 text-xs text-slate-500">O número é o mesmo do documento "Orçamento" desse serviço (em Documentos). Fica guardado o valor no momento do envio. Um orçamento por serviço.</p>
        <div className="flex flex-wrap gap-3">
          <select className={campo + " mt-0 min-w-[260px] flex-1"} value={sel} onChange={(e) => setSel(e.target.value)}>
            <option value="">Seleccione o serviço</option>
            {candidatos.map((s) => <option key={s.id} value={s.id}>{s.codigo} · {cl.obter(s.clienteId)?.nome ?? ""} · {formatKz(s.total)}</option>)}
          </select>
          <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Registar como enviado</button>
        </div>
        {candidatos.length === 0 && <p className="mt-3 text-xs text-slate-500">Não há serviços elegíveis (em fase de pedido/orçamento e sem orçamento registado).</p>}
      </form>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Número</th>
                <th className="px-5 py-3 font-medium">Serviço</th>
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-5 py-3 font-medium">Valor enviado</th>
                <th className="px-5 py-3 font-medium">Enviado em</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Acções</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orc.orcamentos.map((o) => {
                const s = sv.obterServico(o.servicoId);
                return (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-5 py-3 font-medium text-slate-900">{o.numero}</td>
                    <td className="whitespace-nowrap px-5 py-3">{s ? <Link href={`/servicos/${s.id}`} className="text-brand-700 hover:underline">{s.codigo}</Link> : "—"}</td>
                    <td className="px-5 py-3">{s ? cl.obter(s.clienteId)?.nome ?? "—" : "—"}</td>
                    <td className="whitespace-nowrap px-5 py-3">
                      {formatKz(o.valor)}
                      {s && s.total !== o.valor && <p className="text-xs text-amber-700">Valor actual do serviço: {formatKz(s.total)}</p>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">{formatData(o.dataEnvio)}</td>
                    <td className="px-5 py-3">
                      <Etiqueta texto={o.estado} tom={tom[o.estado]} />
                      {o.dataResposta && <p className="text-xs text-slate-500">{formatData(o.dataResposta)}</p>}
                      {o.motivo && <p className="text-xs text-slate-500">Motivo: {o.motivo}</p>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <Link href={`/documentos/ver/orcamento/${o.servicoId}`} className="mr-3 text-sm font-medium text-brand-700 hover:underline">Documento</Link>
                      {o.estado === "Enviado" && (
                        <>
                          <button onClick={() => aceitar(o.id)} className="mr-3 text-sm font-medium text-emerald-700 hover:underline">Aceitar</button>
                          <button onClick={() => { setRecusando(o.id); setMsg(null); }} className="text-sm font-medium text-red-700 hover:underline">Recusar</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {orc.orcamentos.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Ainda não há orçamentos registados.</p>}
      </div>

      {recusando && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
          <label className="text-sm font-medium text-red-800">Motivo da recusa (opcional)</label>
          <textarea className={campo} rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <div className="mt-2 flex gap-2">
            <button onClick={recusar} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">Confirmar recusa</button>
            <button onClick={() => { setRecusando(null); setMotivo(""); }} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700">Voltar</button>
          </div>
        </div>
      )}
    </>
  );
}