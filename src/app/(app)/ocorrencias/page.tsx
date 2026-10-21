"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Etiqueta, { type Tom } from "@/components/ui/Etiqueta";
import { useOcorrencias } from "@/components/ocorrencias/OcorrenciasProvider";
import { useServicos } from "@/components/servicos/ServicosProvider";
import { useClientes } from "@/components/clientes/ClientesProvider";
import { estadosOcorrencia, tiposOcorrencia, type EstadoOcorrencia } from "@/lib/operacao";
import { formatData, hojeISO } from "@/lib/format";

export const tomOcorrencia: Record<EstadoOcorrencia, Tom> = {
  Aberta: "vermelho", "Em análise": "ambar", "Em resolução": "azul", Resolvida: "verde", Encerrada: "cinza",
};

const campo =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
const seletor =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export default function OcorrenciasPage() {
  const oc = useOcorrencias();
  const { servicos } = useServicos();
  const { obter } = useClientes();
  const [estado, setEstado] = useState("todos");
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState("");
  const [f, setF] = useState({ servicoId: "", data: "", tipo: "", descricao: "", pessoas: "", responsavel: "Administrador" });

  if (!oc.carregado) return <p className="text-sm text-slate-500">A carregar...</p>;

  const lista = oc.ocorrencias.filter((o) => estado === "todos" || o.estado === estado);
  const codServ = (id: string) => servicos.find((s) => s.id === id)?.codigo ?? "—";

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    const r = oc.criar({ ...f, pessoas: f.pessoas.trim(), responsavel: f.responsavel.trim() });
    if (r.resultado.ok) {
      setAberto(false); setErro("");
      setF({ servicoId: "", data: "", tipo: "", descricao: "", pessoas: "", responsavel: "Administrador" });
    } else setErro(r.resultado.erro ?? "Erro.");
  }

  return (
    <>
      <PageHeader
        title="Ocorrências"
        description="Reclamações, danos e problemas. Nenhuma ocorrência gera penalização ou dedução automática na remuneração."
        action={
          <button onClick={() => { setAberto(!aberto); setF((x) => ({ ...x, data: hojeISO() })); }} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" /> Nova ocorrência
          </button>
        }
      />

      {aberto && (
        <form onSubmit={guardar} noValidate className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-900">Nova ocorrência</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><label className="text-sm font-medium text-slate-700">Tipo *</label>
              <select className={campo} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
                <option value="">Seleccione</option>
                {tiposOcorrencia.map((t) => <option key={t} value={t}>{t}</option>)}
              </select></div>
            <div><label className="text-sm font-medium text-slate-700">Data *</label><input type="date" className={campo} value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></div>
            <div><label className="text-sm font-medium text-slate-700">Serviço relacionado</label>
              <select className={campo} value={f.servicoId} onChange={(e) => setF({ ...f, servicoId: e.target.value })}>
                <option value="">Nenhum</option>
                {[...servicos].sort((a, b) => b.codigo.localeCompare(a.codigo)).map((s) => <option key={s.id} value={s.id}>{s.codigo} · {obter(s.clienteId)?.nome ?? ""}</option>)}
              </select></div>
            <div className="sm:col-span-3"><label className="text-sm font-medium text-slate-700">Descrição *</label><textarea className={campo} rows={3} value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></div>
            <div className="sm:col-span-2"><label className="text-sm font-medium text-slate-700">Pessoas envolvidas</label><input className={campo} value={f.pessoas} onChange={(e) => setF({ ...f, pessoas: e.target.value })} /></div>
            <div><label className="text-sm font-medium text-slate-700">Responsável pelo acompanhamento</label><input className={campo} value={f.responsavel} onChange={(e) => setF({ ...f, responsavel: e.target.value })} /></div>
          </div>
          {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}
          <p className="mt-3 text-xs text-slate-500">O anexo de fotografias será ligado quando tivermos o armazenamento (backend).</p>
          <div className="mt-4 flex justify-end gap-3">
            <button type="button" onClick={() => setAberto(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancelar</button>
            <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Registar</button>
          </div>
        </form>
      )}

      <div className="mb-4">
        <select className={seletor} value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="todos">Todos os estados</option>
          {estadosOcorrencia.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Código</th><th className="px-5 py-3 font-medium">Data</th>
                <th className="px-5 py-3 font-medium">Tipo</th><th className="px-5 py-3 font-medium">Serviço</th>
                <th className="px-5 py-3 font-medium">Responsável</th><th className="px-5 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lista.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-5 py-3"><Link href={`/ocorrencias/${o.id}`} className="font-medium text-brand-700 hover:underline">{o.codigo}</Link></td>
                  <td className="whitespace-nowrap px-5 py-3">{formatData(o.data)}</td>
                  <td className="px-5 py-3">{o.tipo}</td>
                  <td className="whitespace-nowrap px-5 py-3">{codServ(o.servicoId)}</td>
                  <td className="px-5 py-3">{o.responsavel || "—"}</td>
                  <td className="px-5 py-3"><Etiqueta texto={o.estado} tom={tomOcorrencia[o.estado]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {lista.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Nenhuma ocorrência encontrada.</p>}
      </div>
    </>
  );
}