"use client";

import { Download } from "lucide-react";
import { exportarCsv } from "@/lib/csv";
import { formatKz } from "@/lib/format";

export type Cel = string | number;
export type Col = { titulo: string; tipo?: "kz" | "num" | "pct" };

const fmtNum = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 1 });

function mostrar(v: Cel, tipo?: Col["tipo"]): string {
  if (typeof v === "string") return v;
  if (tipo === "kz") return formatKz(Math.round(v));
  if (tipo === "pct") return `${fmtNum.format(v)}%`;
  return fmtNum.format(v);
}

export default function TabelaRelatorio({
  titulo, colunas, linhas, ficheiro, nota,
}: {
  titulo: string;
  colunas: Col[];
  linhas: Cel[][];
  ficheiro: string;
  nota?: string;
}) {
  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
        <h2 className="font-semibold text-slate-900">{titulo}</h2>
        <button
          disabled={linhas.length === 0}
          onClick={() => exportarCsv(ficheiro, colunas.map((c) => c.titulo), linhas)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:text-slate-300"
        >
          <Download className="h-4 w-4" /> CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>{colunas.map((c) => <th key={c.titulo} className="px-5 py-3 font-medium">{c.titulo}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {linhas.map((l, i) => (
              <tr key={i} className="hover:bg-slate-50">
                {l.map((v, j) => <td key={j} className="whitespace-nowrap px-5 py-3">{mostrar(v, colunas[j]?.tipo)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {linhas.length === 0 && <p className="p-6 text-center text-sm text-slate-500">Sem dados neste período.</p>}
      {nota && <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">{nota}</p>}
    </div>
  );
}