"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, Phone, Briefcase, CalendarDays, FileText } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import EstadoColabBadge from "@/components/colaboradores/EstadoColabBadge";
import { useColaboradores } from "@/components/colaboradores/ColaboradoresProvider";
import { useServicos } from "@/components/servicos/ServicosProvider";
import { useRemuneracoes } from "@/components/remuneracoes/RemuneracoesProvider";
import { saldoColaborador } from "@/lib/remuneracoes";
import { formatData, formatKz } from "@/lib/format";
import type { EstadoColaborador } from "@/lib/types";

export default function FichaColaboradorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { obter, alterarEstado, carregado } = useColaboradores();
  const { servicos } = useServicos();
  const { remuneracoes, pagamentos } = useRemuneracoes();
  const c = obter(id);

  if (!carregado) return <p className="text-sm text-slate-500">A carregar...</p>;
  if (!c) {
    return (
      <>
        <PageHeader title="Colaborador não encontrado" />
        <Link href="/colaboradores" className="text-sm font-medium text-brand-700 hover:underline">Voltar à lista</Link>
      </>
    );
  }

  const s = saldoColaborador(c.id, remuneracoes, pagamentos);
  const meus = servicos.filter((x) => x.colaboradorIds.includes(c.id)).sort((a, b) => b.codigo.localeCompare(a.codigo));
  const meusPagamentos = pagamentos.filter((p) => p.colaboradorId === c.id).sort((a, b) => b.data.localeCompare(a.data));
  const estados: EstadoColaborador[] = ["Activo", "Inactivo", "Suspenso"];

  return (
    <>
      <Link href="/colaboradores" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Colaboradores
      </Link>
      <PageHeader
        title={c.nome}
        description={`${c.codigo} · ${c.funcao}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <EstadoColabBadge estado={c.estado} />
            <Link href={`/colaboradores/${c.id}/editar`} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
              <Pencil className="h-4 w-4" /> Editar
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-4 font-semibold text-slate-900">Dados do colaborador</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex items-start gap-3"><Phone className="mt-0.5 h-4 w-4 text-slate-400" /><div><dt className="text-xs text-slate-500">Telefone</dt><dd>{c.telefone}</dd></div></div>
            <div className="flex items-start gap-3"><Briefcase className="mt-0.5 h-4 w-4 text-slate-400" /><div><dt className="text-xs text-slate-500">Modalidade</dt><dd>{c.modalidade}</dd></div></div>
            <div className="flex items-start gap-3"><FileText className="mt-0.5 h-4 w-4 text-slate-400" /><div><dt className="text-xs text-slate-500">Referência do contrato</dt><dd>{c.contrato || "—"}</dd></div></div>
            <div className="flex items-start gap-3"><CalendarDays className="mt-0.5 h-4 w-4 text-slate-400" /><div><dt className="text-xs text-slate-500">Início da relação</dt><dd>{c.dataInicio ? formatData(c.dataInicio) : "—"}</dd></div></div>
            <div className="border-t border-slate-100 pt-3"><dt className="text-xs text-slate-500">Percentagem individual</dt><dd>{c.percentagem}%</dd></div>
            <div><dt className="text-xs text-slate-500">Observações</dt><dd>{c.observacoes || "Sem observações."}</dd></div>
          </dl>
          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="mb-2 text-xs text-slate-500">Alterar estado (o histórico nunca é apagado)</p>
            <div className="flex flex-wrap gap-2">
              {estados.map((e) => (
                <button key={e} disabled={c.estado === e} onClick={async () => { const r = await alterarEstado(c.id, e); if (!r.ok) alert(r.erro); }}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400">
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-900">Remuneração</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Total apurado</span><span className="font-medium">{formatKz(s.apurado)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Aprovado</span><span className="font-medium">{formatKz(s.aprovado)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Já pago</span><span className="font-medium text-emerald-700">{formatKz(s.pago)}</span></div>
            <div className="flex justify-between border-t border-slate-100 pt-3">
              <span className="text-slate-500">Saldo devido</span>
              <span className={`font-semibold ${s.saldo > 0 ? "text-amber-700" : "text-slate-900"}`}>{formatKz(s.saldo)}</span>
            </div>
          </div>
          <Link href="/remuneracoes" className="mt-4 inline-block text-sm font-medium text-brand-700 hover:underline">Ir para Remunerações</Link>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Histórico de serviços</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Código</th>
                <th className="px-5 py-3 font-medium">Serviço</th>
                <th className="px-5 py-3 font-medium">Data</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Remuneração apurada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {meus.map((x) => (
                <tr key={x.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-5 py-3"><Link href={`/servicos/${x.id}`} className="font-medium text-brand-700 hover:underline">{x.codigo}</Link></td>
                  <td className="px-5 py-3">{x.tipoServico}</td>
                  <td className="whitespace-nowrap px-5 py-3">{x.data ? formatData(x.data) : "—"}</td>
                  <td className="px-5 py-3"><StatusBadge status={x.estadoOperacional} /></td>
                  <td className="whitespace-nowrap px-5 py-3">{formatKz(remuneracoes.filter((r) => r.colaboradorId === c.id && r.servicoId === x.id).reduce((t, r) => t + r.valor, 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {meus.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Ainda sem serviços atribuídos.</p>}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Pagamentos recebidos da empresa</h2></div>
        {meusPagamentos.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">Ainda sem pagamentos registados.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {meusPagamentos.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2 px-5 py-3 text-sm">
                <span>{formatData(p.data)} · {p.tipo} · {p.meio}{p.referencia ? ` · ${p.referencia}` : ""}</span>
                <span className="font-medium">{formatKz(p.valor)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}