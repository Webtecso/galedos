"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { useClientes } from "@/components/clientes/ClientesProvider";
import { useColaboradores } from "@/components/colaboradores/ColaboradoresProvider";
import { useServicos } from "@/components/servicos/ServicosProvider";
import { diasSemana, inicioSemana, nomeDia, paraData, somarDias } from "@/lib/datas";
import { formatData, formatPeriodo, hojeISO, isoLocal } from "@/lib/format";
import { formatDuracao } from "@/lib/servicos";
import type { Servico } from "@/lib/types";

type Vista = "dia" | "semana" | "mes" | "lista";
const vistas: { chave: Vista; label: string }[] = [
  { chave: "dia", label: "Dia" },
  { chave: "semana", label: "Semana" },
  { chave: "mes", label: "Mês" },
  { chave: "lista", label: "Lista" },
];

export default function AgendaPage() {
  const { servicos, carregado } = useServicos();
  const { obter } = useClientes();
  const co = useColaboradores();
  const [vista, setVista] = useState<Vista>("semana");
  const [ref, setRef] = useState(() => hojeISO());

  if (!carregado || !co.carregado) return <p className="text-sm text-slate-500">A carregar...</p>;

  const hoje = hojeISO();
  const agendados = servicos.filter((s) => s.data && s.hora && s.estadoOperacional !== "Cancelado");
  const doDia = (dia: string) => agendados.filter((s) => s.data === dia).sort((a, b) => a.hora.localeCompare(b.hora));
  const equipa = (s: Servico) =>
    s.colaboradorIds.map((id) => co.obter(id)?.nome.split(" ")[0] ?? "").filter(Boolean).join(", ") || "Sem equipa";
  const cliente = (s: Servico) => obter(s.clienteId)?.nome ?? "—";

  function mover(sinal: number) {
    if (vista === "dia") setRef(somarDias(ref, sinal));
    else if (vista === "semana") setRef(somarDias(ref, 7 * sinal));
    else {
      const d = paraData(ref);
      setRef(isoLocal(new Date(d.getFullYear(), d.getMonth() + sinal, 1)));
    }
  }

  function titulo() {
    if (vista === "dia") return nomeDia(ref);
    if (vista === "semana") {
      const ini = inicioSemana(ref);
      return `${formatData(ini)} a ${formatData(somarDias(ini, 6))}`;
    }
    if (vista === "mes") return formatPeriodo(ref.slice(0, 7));
    return "Serviços futuros";
  }

  function cartao(s: Servico, compacto = false) {
    return (
      <Link key={s.id} href={`/servicos/${s.id}`} className="block rounded-lg border border-slate-200 bg-white p-2.5 text-sm hover:border-brand-500">
        <p className="font-medium text-slate-900">{s.hora} · {cliente(s)}</p>
        <p className="text-xs text-slate-600">{s.tipoServico}{compacto ? "" : ` · ${formatDuracao(s.duracaoMin)}`}</p>
        <p className="text-xs text-slate-500">{equipa(s)}</p>
        {!compacto && <div className="mt-1"><StatusBadge status={s.estadoOperacional} /></div>}
      </Link>
    );
  }

  const ini = inicioSemana(ref);
  const diasSem = Array.from({ length: 7 }, (_, i) => somarDias(ini, i));
  const primeiro = ref.slice(0, 8) + "01";
  const iniMes = inicioSemana(primeiro);
  const diasMes = Array.from({ length: 42 }, (_, i) => somarDias(iniMes, i));
  const futuros = agendados
    .filter((s) => s.data >= hoje && (s.estadoOperacional === "Agendado" || s.estadoOperacional === "Em execução"))
    .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));

  return (
    <>
      <PageHeader
        title="Agenda"
        description="Distribuição dos trabalhos. O aviso de conflito é feito ao atribuir a equipa na ordem de serviço."
        action={
          <Link href="/servicos/novo" className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" /> Nova ordem
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {vistas.map((v) => (
            <button key={v.chave} onClick={() => setVista(v.chave)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${vista === v.chave ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              {v.label}
            </button>
          ))}
        </div>
        {vista !== "lista" && (
          <div className="flex items-center gap-2">
            <button onClick={() => mover(-1)} className="rounded-lg border border-slate-300 bg-white p-2 hover:bg-slate-50" aria-label="Anterior"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={() => setRef(hoje)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50">Hoje</button>
            <button onClick={() => mover(1)} className="rounded-lg border border-slate-300 bg-white p-2 hover:bg-slate-50" aria-label="Seguinte"><ChevronRight className="h-4 w-4" /></button>
          </div>
        )}
      </div>

      <h2 className="mb-3 text-lg font-semibold capitalize text-slate-900">{titulo()}</h2>

      {vista === "dia" && (
        <div className="space-y-2">
          {doDia(ref).map((s) => cartao(s))}
          {doDia(ref).length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Sem serviços neste dia.</p>}
        </div>
      )}

      {vista === "semana" && (
        <div className="grid gap-3 md:grid-cols-7">
          {diasSem.map((dia, i) => (
            <div key={dia} className={`rounded-xl border p-2 ${dia === hoje ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-slate-50"}`}>
              <button onClick={() => { setRef(dia); setVista("dia"); }} className="mb-2 w-full text-left text-xs font-semibold uppercase text-slate-600 hover:underline">
                {diasSemana[i]} {dia.slice(8)}
              </button>
              <div className="space-y-2">
                {doDia(dia).map((s) => cartao(s, true))}
                {doDia(dia).length === 0 && <p className="text-xs text-slate-400">Livre</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {vista === "mes" && (
        <div className="overflow-x-auto">
          <div className="grid min-w-[640px] grid-cols-7 gap-1">
            {diasSemana.map((d) => <div key={d} className="px-1 py-1 text-center text-xs font-semibold uppercase text-slate-500">{d}</div>)}
            {diasMes.map((dia) => {
              const lista = doDia(dia);
              const doMes = dia.slice(0, 7) === ref.slice(0, 7);
              return (
                <button key={dia} onClick={() => { setRef(dia); setVista("dia"); }}
                  className={`min-h-[88px] rounded-lg border p-1.5 text-left align-top hover:border-brand-500 ${dia === hoje ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-white"} ${doMes ? "" : "opacity-40"}`}>
                  <span className="text-xs font-semibold text-slate-700">{Number(dia.slice(8))}</span>
                  {lista.slice(0, 2).map((s) => (
                    <p key={s.id} className="mt-0.5 truncate text-[11px] text-slate-600">{s.hora} {cliente(s)}</p>
                  ))}
                  {lista.length > 2 && <p className="text-[11px] font-medium text-brand-700">+{lista.length - 2} mais</p>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {vista === "lista" && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Data e hora</th>
                  <th className="px-5 py-3 font-medium">Código</th>
                  <th className="px-5 py-3 font-medium">Cliente</th>
                  <th className="px-5 py-3 font-medium">Local</th>
                  <th className="px-5 py-3 font-medium">Duração</th>
                  <th className="px-5 py-3 font-medium">Equipa</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {futuros.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-5 py-3">{formatData(s.data)} {s.hora}</td>
                    <td className="whitespace-nowrap px-5 py-3"><Link href={`/servicos/${s.id}`} className="font-medium text-brand-700 hover:underline">{s.codigo}</Link></td>
                    <td className="px-5 py-3">{cliente(s)}</td>
                    <td className="px-5 py-3">{s.local || "—"}</td>
                    <td className="whitespace-nowrap px-5 py-3">{formatDuracao(s.duracaoMin)}</td>
                    <td className="px-5 py-3">{equipa(s)}</td>
                    <td className="px-5 py-3"><StatusBadge status={s.estadoOperacional} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {futuros.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Sem serviços futuros agendados.</p>}
        </div>
      )}
    </>
  );
}