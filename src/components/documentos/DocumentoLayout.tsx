"use client";

import { useEmpresa } from "@/components/configuracoes/EmpresaProvider";
import { formatData } from "@/lib/format";

export function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <div className="text-sm text-slate-900">{children}</div>
    </div>
  );
}

export default function DocumentoLayout({
  titulo, numero, dataEmissao, children, assinaturas = [],
}: {
  titulo: string;
  numero: string;
  dataEmissao: string;
  children: React.ReactNode;
  assinaturas?: string[];
}) {
  const { empresa } = useEmpresa();
  return (
    <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
      <div className="flex items-start justify-between gap-4 border-b-2 border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-600 text-2xl font-bold text-white">{empresa.nome.charAt(0).toUpperCase()}</div>
          <div>
            <p className="text-lg font-semibold text-slate-900">{empresa.nome}</p>
            {empresa.nif && <p className="text-xs text-slate-600">NIF: {empresa.nif}</p>}
          </div>
        </div>
        <div className="text-right text-xs text-slate-600">
          {empresa.morada && <p>{empresa.morada}</p>}
          {empresa.telefone && <p>{empresa.telefone}</p>}
          {empresa.email && <p>{empresa.email}</p>}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-xl font-semibold uppercase text-slate-900">{titulo}</h1>
        <div className="text-right text-sm">
          <p className="font-semibold text-slate-900">Nº {numero}</p>
          <p className="text-slate-600">Emitido em {formatData(dataEmissao)}</p>
        </div>
      </div>

      <div className="mt-6 space-y-5">{children}</div>

      {assinaturas.length > 0 && (
        <div className="mt-12 grid gap-8 sm:grid-cols-2">
          {assinaturas.map((a) => (
            <div key={a}>
              <div className="border-b border-slate-700 pt-10" />
              <p className="mt-1 text-xs text-slate-600">{a}</p>
              <p className="text-xs text-slate-400">Data: ____ / ____ / ________</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-10 border-t border-slate-300 pt-3 text-center text-xs text-slate-500">
        <p>{empresa.rodape}</p>
        <p className="mt-1">Documento interno de gestão. Não constitui documento fiscalmente válido.</p>
      </div>
    </div>
  );
}