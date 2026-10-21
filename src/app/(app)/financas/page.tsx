"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, HandCoins, Receipt, Landmark, Users, Scale, Undo2 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import StatusBadge from "@/components/ui/StatusBadge";
import { useClientes } from "@/components/clientes/ClientesProvider";
import { useServicos } from "@/components/servicos/ServicosProvider";
import { useRemuneracoes } from "@/components/remuneracoes/RemuneracoesProvider";
import { useColaboradores } from "@/components/colaboradores/ColaboradoresProvider";
import { useDespesas } from "@/components/financas/DespesasProvider";
import { meiosPagamento, saldoPendente, totalRecebido } from "@/lib/servicos";
import { saldoColaborador } from "@/lib/remuneracoes";
import { dentro, intervaloDe, periodosOpcoes, type PeriodoChave } from "@/lib/periodos";
import { formatData, formatKz, hojeISO } from "@/lib/format";
import type { EstadoDespesa, MeioPagamento } from "@/lib/types";

const campo =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
const seletor =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

type Aba = "resumo" | "receitas" | "despesas" | "receber";

const abas: { chave: Aba; label: string }[] = [
  { chave: "resumo", label: "Resumo" },
  { chave: "receitas", label: "Receitas" },
  { chave: "despesas", label: "Despesas" },
  { chave: "receber", label: "Contas a receber" },
];

export default function FinancasPage() {
  const { servicos } = useServicos();
  const { obter } = useClientes();
  const { colaboradores } = useColaboradores();
  const { remuneracoes, pagamentos } = useRemuneracoes();
  const { despesas, categorias, criar, marcarPago, anular, adicionarCategoria, carregado } = useDespesas();

  const [aba, setAba] = useState<Aba>("resumo");
  const [periodo, setPeriodo] = useState<PeriodoChave>("mes");
  const [msg, setMsg] = useState("");

  const [formAberto, setFormAberto] = useState(false);
  const [dData, setDData] = useState("");
  const [dCat, setDCat] = useState("");
  const [dDesc, setDDesc] = useState("");
  const [dValor, setDValor] = useState("");
  const [dForn, setDForn] = useState("");
  const [dMeio, setDMeio] = useState<MeioPagamento>("Dinheiro");
  const [dRef, setDRef] = useState("");
  const [dEstado, setDEstado] = useState<EstadoDespesa>("Pago");
  const [novaCat, setNovaCat] = useState("");
  const [anulando, setAnulando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");

  const intervalo = useMemo(() => intervaloDe(periodo), [periodo]);

  const receitas = useMemo(
    () =>
      servicos
        .flatMap((s) => s.recebimentos.map((r) => ({ ...r, servico: s })))
        .filter((r) => dentro(r.data, intervalo))
        .sort((a, b) => b.data.localeCompare(a.data)),
    [servicos, intervalo]
  );
  const despesasPeriodo = despesas.filter((d) => dentro(d.data, intervalo)).sort((a, b) => b.data.localeCompare(a.data));
  const pagColabPeriodo = pagamentos.filter((p) => dentro(p.data, intervalo));

  const recebido = receitas.reduce((t, r) => t + r.valor, 0);
  const despPagas = despesasPeriodo.filter((d) => d.estado === "Pago").reduce((t, d) => t + d.valor, 0);
  const remPagas = pagColabPeriodo.reduce((t, p) => t + p.valor, 0);
  const saldoEstimado = recebido - despPagas - remPagas;

  const porReceber = servicos.reduce((t, s) => t + saldoPendente(s), 0);
  const reembolsos = servicos.filter((s) => s.estadoOperacional === "Cancelado").reduce((t, s) => t + totalRecebido(s), 0);
  const despPorPagar = despesas.filter((d) => d.estado === "Por pagar").reduce((t, d) => t + d.valor, 0);
  const remPorPagar = colaboradores.reduce((t, c) => t + Math.max(0, saldoColaborador(c.id, remuneracoes, pagamentos).saldo), 0);
  const remApuradas = remuneracoes.filter((r) => !r.aprovada).reduce((t, r) => t + r.valor, 0);

  const contas = servicos
    .filter((s) => saldoPendente(s) > 0)
    .sort((a, b) => (a.data || "9999").localeCompare(b.data || "9999"));

  function abrirForm() {
    setDData(hojeISO());
    setFormAberto(true);
    setMsg("");
  }

  async function guardarDespesa(e: React.FormEvent) {
    e.preventDefault();
    const r = await criar({
      data: dData, categoria: dCat, descricao: dDesc, valor: Number(dValor.replace(",", ".")),
      fornecedor: dForn.trim(), meio: dMeio, referencia: dRef.trim(), estado: dEstado, observacoes: "",
    });
    if (r.ok) {
      setDDesc(""); setDValor(""); setDForn(""); setDRef(""); setFormAberto(false); setMsg("");
    } else {
      setMsg(r.erro ?? "Erro.");
    }
  }

  async function addCategoria() {
    const r = await adicionarCategoria(novaCat);
    if (r.ok) { setDCat(novaCat.trim()); setNovaCat(""); setMsg(""); } else { setMsg(r.erro ?? "Erro."); }
  }

  async function confirmarAnulacao() {
    if (!anulando) return;
    const r = await anular(anulando, motivo);
    if (r.ok) { setAnulando(null); setMotivo(""); setMsg(""); } else { setMsg(r.erro ?? "Erro."); }
  }

  if (!carregado) return <p className="text-sm text-slate-500">A carregar...</p>;

  return (
    <>
      <PageHeader
        title="Finanças"
        description="Controlo de entradas, saídas e valores pendentes. Apoio à gestão interna; não substitui a contabilidade oficial."
        action={
          <select className={seletor} value={periodo} onChange={(e) => setPeriodo(e.target.value as PeriodoChave)}>
            {periodosOpcoes.map((p) => <option key={p.chave} value={p.chave}>{p.label}</option>)}
          </select>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200">
        {abas.map((a) => (
          <button key={a.chave} onClick={() => setAba(a.chave)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${aba === a.chave ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-900"}`}>
            {a.label}
          </button>
        ))}
      </div>

      {aba === "resumo" && (
        <>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">No período seleccionado</h2>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Receitas recebidas" value={formatKz(recebido)} icon={HandCoins} hint="Dinheiro efectivamente recebido" />
            <StatCard label="Despesas pagas" value={formatKz(despPagas)} icon={Receipt} />
            <StatCard label="Remunerações pagas" value={formatKz(remPagas)} icon={Users} hint="Pagamentos e adiantamentos" />
            <StatCard label="Saldo estimado" value={formatKz(saldoEstimado)} icon={Scale} hint="Não é lucro contabilístico" />
          </div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Situação actual</h2>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Por receber de clientes" value={formatKz(porReceber)} icon={Landmark} />
            <StatCard label="Despesas por pagar" value={formatKz(despPorPagar)} icon={Receipt} />
            <StatCard label="Remunerações por pagar" value={formatKz(remPorPagar)} icon={Users} hint={`Apuradas por aprovar: ${formatKz(remApuradas)}`} />
            <StatCard label="Reembolsos pendentes" value={formatKz(reembolsos)} icon={Undo2} hint="Serviços cancelados com recebimentos" />
          </div>
          <p className="rounded-lg bg-slate-100 p-3 text-xs text-slate-600">
            O saldo estimado não considera impostos, obrigações nem outros movimentos. As remunerações aparecem em separado das despesas operacionais.
          </p>
        </>
      )}

      {aba === "receitas" && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Data</th>
                  <th className="px-5 py-3 font-medium">Serviço</th>
                  <th className="px-5 py-3 font-medium">Cliente</th>
                  <th className="px-5 py-3 font-medium">Valor</th>
                  <th className="px-5 py-3 font-medium">Meio</th>
                  <th className="px-5 py-3 font-medium">Referência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {receitas.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-5 py-3">{formatData(r.data)}</td>
                    <td className="whitespace-nowrap px-5 py-3"><Link href={`/servicos/${r.servico.id}`} className="font-medium text-brand-700 hover:underline">{r.servico.codigo}</Link></td>
                    <td className="px-5 py-3">{obter(r.servico.clienteId)?.nome ?? "—"}</td>
                    <td className="whitespace-nowrap px-5 py-3 font-medium">{formatKz(r.valor)}</td>
                    <td className="px-5 py-3">{r.meio}</td>
                    <td className="px-5 py-3">{r.referencia || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {receitas.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Sem recebimentos neste período.</p>}
          <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Total: {formatKz(recebido)}. Os recebimentos são registados na ordem de serviço.</div>
        </div>
      )}

      {aba === "despesas" && (
        <>
          <div className="mb-4 flex justify-end">
            <button onClick={abrirForm} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              <Plus className="h-4 w-4" /> Nova despesa
            </button>
          </div>
          {msg && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{msg}</p>}

          {formAberto && (
            <form onSubmit={guardarDespesa} noValidate className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 font-semibold text-slate-900">Nova despesa</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Data *</label>
                  <input type="date" className={campo} value={dData} onChange={(e) => setDData(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Categoria *</label>
                  <select className={campo} value={dCat} onChange={(e) => setDCat(e.target.value)}>
                    <option value="">Seleccione</option>
                    {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Valor (Kz) *</label>
                  <input className={campo} inputMode="decimal" value={dValor} onChange={(e) => setDValor(e.target.value)} />
                </div>
                <div className="sm:col-span-3">
                  <label className="text-sm font-medium text-slate-700">Descrição *</label>
                  <input className={campo} value={dDesc} onChange={(e) => setDDesc(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Fornecedor</label>
                  <input className={campo} value={dForn} onChange={(e) => setDForn(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Meio de pagamento</label>
                  <select className={campo} value={dMeio} onChange={(e) => setDMeio(e.target.value as MeioPagamento)}>
                    {meiosPagamento.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Estado de pagamento</label>
                  <select className={campo} value={dEstado} onChange={(e) => setDEstado(e.target.value as EstadoDespesa)}>
                    <option value="Pago">Pago</option>
                    <option value="Por pagar">Por pagar</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Referência do comprovativo</label>
                  <input className={campo} value={dRef} onChange={(e) => setDRef(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Nova categoria</label>
                  <div className="flex gap-2">
                    <input className={campo} value={novaCat} onChange={(e) => setNovaCat(e.target.value)} />
                    <button type="button" onClick={addCategoria} className="mt-1 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">Criar</button>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setFormAberto(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancelar</button>
                <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Guardar despesa</button>
              </div>
            </form>
          )}

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Código</th>
                    <th className="px-5 py-3 font-medium">Data</th>
                    <th className="px-5 py-3 font-medium">Categoria</th>
                    <th className="px-5 py-3 font-medium">Descrição</th>
                    <th className="px-5 py-3 font-medium">Valor</th>
                    <th className="px-5 py-3 font-medium">Estado</th>
                    <th className="px-5 py-3 font-medium">Acções</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {despesasPeriodo.map((d) => (
                    <tr key={d.id} className={d.estado === "Anulada" ? "text-slate-400" : "hover:bg-slate-50"}>
                      <td className="whitespace-nowrap px-5 py-3 font-medium">{d.codigo}</td>
                      <td className="whitespace-nowrap px-5 py-3">{formatData(d.data)}</td>
                      <td className="px-5 py-3">{d.categoria}</td>
                      <td className="px-5 py-3">
                        {d.descricao}
                        {d.fornecedor && <p className="text-xs text-slate-500">{d.fornecedor}</p>}
                        {d.estado === "Anulada" && <p className="text-xs">Motivo: {d.motivoAnulacao}</p>}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">{formatKz(d.valor)}</td>
                      <td className="px-5 py-3"><StatusBadge status={d.estado === "Por pagar" ? "Pendente" : d.estado === "Pago" ? "Pago" : "Cancelado"} /></td>
                      <td className="whitespace-nowrap px-5 py-3">
                        {d.estado === "Por pagar" && <button onClick={async () => { const r = await marcarPago(d.id); if (!r.ok) setMsg(r.erro ?? "Erro."); }} className="mr-3 text-sm font-medium text-emerald-700 hover:underline">Marcar paga</button>}
                        {d.estado !== "Anulada" && <button onClick={() => { setAnulando(d.id); setMsg(""); }} className="text-sm font-medium text-red-700 hover:underline">Anular</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {despesasPeriodo.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Sem despesas neste período.</p>}
            <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Pagas no período: {formatKz(despPagas)}. As despesas nunca são apagadas; anulam-se com motivo.</div>
          </div>

          {anulando && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
              <label className="text-sm font-medium text-red-800">Motivo da anulação *</label>
              <textarea className={campo} rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              <div className="mt-2 flex gap-2">
                <button onClick={confirmarAnulacao} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">Confirmar anulação</button>
                <button onClick={() => { setAnulando(null); setMotivo(""); }} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700">Voltar</button>
              </div>
            </div>
          )}
        </>
      )}

      {aba === "receber" && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Serviço</th>
                  <th className="px-5 py-3 font-medium">Cliente</th>
                  <th className="px-5 py-3 font-medium">Total</th>
                  <th className="px-5 py-3 font-medium">Recebido</th>
                  <th className="px-5 py-3 font-medium">Saldo</th>
                  <th className="px-5 py-3 font-medium">Último pagamento</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contas.map((s) => {
                  const ultimo = [...s.recebimentos].sort((a, b) => b.data.localeCompare(a.data))[0];
                  return (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-5 py-3"><Link href={`/servicos/${s.id}`} className="font-medium text-brand-700 hover:underline">{s.codigo}</Link></td>
                      <td className="px-5 py-3">{obter(s.clienteId)?.nome ?? "—"}</td>
                      <td className="whitespace-nowrap px-5 py-3">{formatKz(s.total)}</td>
                      <td className="whitespace-nowrap px-5 py-3">{formatKz(totalRecebido(s))}</td>
                      <td className="whitespace-nowrap px-5 py-3 font-semibold text-amber-700">{formatKz(saldoPendente(s))}</td>
                      <td className="whitespace-nowrap px-5 py-3">{ultimo ? formatData(ultimo.data) : "—"}</td>
                      <td className="px-5 py-3"><StatusBadge status={s.estadoOperacional} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {contas.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Sem valores pendentes.</p>}
          <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Total por receber: {formatKz(porReceber)}. Registe recebimentos na ordem de serviço.</div>
        </div>
      )}
    </>
  );
}