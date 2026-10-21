"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, BookOpen } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { useClientes } from "@/components/clientes/ClientesProvider";
import { useServicos } from "@/components/servicos/ServicosProvider";
import { estadoFinanceiro, estadosFinanceiros, estadosOperacionais, saldoPendente, totalRecebido } from "@/lib/servicos";
import { formatData, formatKz, normalizar } from "@/lib/format";

const seletor =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export default function ServicosPage() {
  const { servicos, carregado } = useServicos();
  const { obter } = useClientes();
  const [pesquisa, setPesquisa] = useState(() => (typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("q") ?? ""));
  useEffect(() => {
    const f = (e: Event) => setPesquisa((e as CustomEvent<string>).detail);
    window.addEventListener("galedos:pesquisa", f);
    return () => window.removeEventListener("galedos:pesquisa", f);
  }, []);
  const [estadoOp, setEstadoOp] = useState("todos");
  const [estadoFin, setEstadoFin] = useState("todos");

  const filtrados = useMemo(() => {
    const q = normalizar(pesquisa.trim());
    return servicos
      .filter((s) => {
        if (estadoOp !== "todos" && s.estadoOperacional !== estadoOp) return false;
        if (estadoFin !== "todos" && estadoFinanceiro(s) !== estadoFin) return false;
        if (!q) return true;
        const cliente = obter(s.clienteId)?.nome ?? "";
        return (
          normalizar(s.codigo).includes(q) ||
          normalizar(s.tipoServico).includes(q) ||
          normalizar(cliente).includes(q)
        );
      })
      .sort((a, b) => b.codigo.localeCompare(a.codigo));
  }, [servicos, pesquisa, estadoOp, estadoFin, obter]);

  const totalValor = filtrados.filter((s) => s.estadoOperacional !== "Cancelado").reduce((t, s) => t + s.total, 0);
  const totalRec = filtrados.reduce((t, s) => t + totalRecebido(s), 0);
  const totalPend = filtrados.reduce((t, s) => t + saldoPendente(s), 0);

  return (
    <>
      <PageHeader
        title="Serviços"
        description="Ordens de serviço, estados operacionais e financeiros."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/servicos/orcamentos" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Orçamentos</Link>
            <Link href="/servicos/catalogo" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <BookOpen className="h-4 w-4" /> Catálogo
            </Link>
            <Link href="/servicos/novo" className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              <Plus className="h-4 w-4" /> Nova ordem
            </Link>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={pesquisa}
            onChange={(e) => setPesquisa(e.target.value)}
            placeholder="Pesquisar por código, cliente ou serviço"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <select className={seletor} value={estadoOp} onChange={(e) => setEstadoOp(e.target.value)}>
          <option value="todos">Todos os estados</option>
          {estadosOperacionais.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select className={seletor} value={estadoFin} onChange={(e) => setEstadoFin(e.target.value)}>
          <option value="todos">Todos os pagamentos</option>
          {estadosFinanceiros.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Código</th>
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-5 py-3 font-medium">Serviço</th>
                <th className="px-5 py-3 font-medium">Data</th>
                <th className="px-5 py-3 font-medium">Total</th>
                <th className="px-5 py-3 font-medium">Recebido</th>
                <th className="px-5 py-3 font-medium">Operacional</th>
                <th className="px-5 py-3 font-medium">Financeiro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtrados.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-5 py-3">
                    <Link href={`/servicos/${s.id}`} className="font-medium text-brand-700 hover:underline">{s.codigo}</Link>
                  </td>
                  <td className="px-5 py-3">{obter(s.clienteId)?.nome ?? "—"}</td>
                  <td className="px-5 py-3">
                    {s.tipoServico}
                    <span className="text-slate-500"> (x{s.quantidade})</span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3">{s.data ? `${formatData(s.data)} ${s.hora}` : "Por agendar"}</td>
                  <td className="whitespace-nowrap px-5 py-3">{formatKz(s.total)}</td>
                  <td className="whitespace-nowrap px-5 py-3">{formatKz(totalRecebido(s))}</td>
                  <td className="px-5 py-3"><StatusBadge status={s.estadoOperacional} /></td>
                  <td className="px-5 py-3"><StatusBadge status={estadoFinanceiro(s)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {carregado && filtrados.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-500">Nenhum serviço encontrado.</p>
        )}
        <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
          <span>{filtrados.length} de {servicos.length} serviços</span>
          <span>
            Valor: {formatKz(totalValor)} · Recebido: {formatKz(totalRec)} · Por receber: {formatKz(totalPend)}
          </span>
        </div>
      </div>
    </>
  );
}