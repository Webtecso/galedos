"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { useServicos } from "@/components/servicos/ServicosProvider";
import { useColaboradores } from "@/components/colaboradores/ColaboradoresProvider";
import { useRemuneracoes } from "@/components/remuneracoes/RemuneracoesProvider";
import { useClientes } from "@/components/clientes/ClientesProvider";
import { formatData } from "@/lib/format";

const campo =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export default function QuotasPage() {
  const sv = useServicos();
  const co = useColaboradores();
  const rm = useRemuneracoes();
  const cl = useClientes();
  const [sel, setSel] = useState("");
  const [vals, setVals] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  if (!(sv.carregado && co.carregado && rm.carregado && cl.carregado)) return <p className="text-sm text-slate-500">A carregar...</p>;

  const elegiveis = sv.servicos
    .filter((s) => s.estadoOperacional !== "Cancelado" && s.colaboradorIds.length > 0)
    .sort((a, b) => b.codigo.localeCompare(a.codigo));
  const servico = sv.servicos.find((s) => s.id === sel);
  const apurado = !!servico && rm.remuneracoes.some((r) => r.servicoId === servico.id && r.tipo === "Serviço");
  const num = (v: string) => (v.trim() === "" ? NaN : Number(v.replace(",", ".")));
  const soma = servico ? servico.colaboradorIds.reduce((t, id) => t + (num(vals[id] ?? "") || 0), 0) : 0;
  const nome = (id: string) => co.obter(id)?.nome ?? id;
  const modalidadeActiva = rm.config.modalidade === "Quotas por serviço";

  function escolher(id: string) {
    setSel(id);
    setMsg(null);
    const s = sv.servicos.find((x) => x.id === id);
    if (!s) {
      setVals({});
      return;
    }
    const q = rm.quotas[id]?.quotas;
    const n = s.colaboradorIds.length;
    const base = Math.floor(10000 / n) / 100;
    const v: Record<string, string> = {};
    s.colaboradorIds.forEach((cid, i) => {
      if (q && q[cid] !== undefined) v[cid] = String(q[cid]);
      else v[cid] = String(i === n - 1 ? Math.round((100 - base * (n - 1)) * 100) / 100 : base);
    });
    setVals(v);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!servico) return;
    const q: Record<string, number> = {};
    servico.colaboradorIds.forEach((id) => { q[id] = num(vals[id] ?? ""); });
    const r = await rm.definirQuotas(servico.id, q);
    setMsg(r.ok ? { tipo: "ok", texto: "Quotas guardadas." } : { tipo: "erro", texto: r.erro ?? "Erro." });
  }

  return (
    <>
      <Link href="/remuneracoes" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Remunerações
      </Link>
      <PageHeader
        title="Quotas por serviço"
        description="Modalidade C: define como a parte da equipa é repartida em cada ordem de serviço. As quotas somam 100% da parte da equipa."
      />

      {!modalidadeActiva && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          A modalidade em vigor é "{rm.config.modalidade}". As quotas só são usadas quando a modalidade for "Quotas por serviço" (altere em Remunerações &gt; Regras). Pode defini-las antecipadamente.
        </div>
      )}
      {msg && (
        <div className={`mb-4 rounded-lg border p-3 text-sm ${msg.tipo === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{msg.texto}</div>
      )}

      <form onSubmit={guardar} noValidate className="mb-6 max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="text-sm font-medium text-slate-700">Serviço</label>
        <select className={campo} value={sel} onChange={(e) => escolher(e.target.value)}>
          <option value="">Seleccione</option>
          {elegiveis.map((s) => <option key={s.id} value={s.id}>{s.codigo} · {cl.obter(s.clienteId)?.nome ?? ""} · {s.estadoOperacional}</option>)}
        </select>

        {servico && (
          <div className="mt-4 space-y-3">
            {servico.colaboradorIds.map((id) => {
              const q = num(vals[id] ?? "");
              return (
                <div key={id} className="grid items-center gap-3 sm:grid-cols-3">
                  <span className="text-sm text-slate-800">{nome(id)}</span>
                  <input className={campo + " mt-0"} inputMode="decimal" disabled={apurado} value={vals[id] ?? ""} onChange={(e) => setVals({ ...vals, [id]: e.target.value })} />
                  <span className="text-xs text-slate-500">
                    {Number.isNaN(q) ? "—" : `= ${Math.round(((rm.config.percentagemEquipa * q) / 100) * 100) / 100}% do valor recebido`}
                  </span>
                </div>
              );
            })}
            <p className={`text-sm font-medium ${Math.abs(soma - 100) <= 0.01 ? "text-emerald-700" : "text-red-700"}`}>
              Soma das quotas: {Math.round(soma * 100) / 100}% (deve ser 100%)
            </p>
            {apurado && <p className="rounded-lg bg-slate-100 p-3 text-xs text-slate-600">Este serviço já tem remunerações apuradas. As quotas estão bloqueadas; correcções fazem-se por ajuste autorizado.</p>}
            <div className="flex justify-end">
              <button type="submit" disabled={apurado} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:bg-slate-300">Guardar quotas</button>
            </div>
          </div>
        )}
      </form>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Quotas definidas</h2></div>
        {Object.keys(rm.quotas).length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">Ainda não foram definidas quotas.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {Object.entries(rm.quotas).map(([servicoId, q]) => (
              <li key={servicoId} className="px-5 py-3 text-sm">
                <p className="font-medium text-slate-900">{sv.servicos.find((s) => s.id === servicoId)?.codigo ?? servicoId}</p>
                <p className="text-slate-600">{Object.entries(q.quotas).map(([cid, v]) => `${nome(cid)}: ${v}%`).join(" · ")}</p>
                <p className="text-xs text-slate-500">{formatData(q.data)} · {q.utilizador}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}