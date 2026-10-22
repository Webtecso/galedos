"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BarChart3, CalendarCheck, CalendarDays, CheckCircle2, HandCoins, Landmark, Plus, Receipt,
  Scale, Sparkles, UserPlus, Users, Wallet, Wrench, type LucideIcon,
} from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import StatusBadge from "@/components/ui/StatusBadge";
import GraficoReceitas from "@/components/painel/GraficoReceitas";
import DonutServicos, { type Fatia } from "@/components/painel/DonutServicos";
import { useAuth } from "@/components/auth/AuthProvider";
import { useClientes } from "@/components/clientes/ClientesProvider";
import { useColaboradores } from "@/components/colaboradores/ColaboradoresProvider";
import { useServicos } from "@/components/servicos/ServicosProvider";
import { useRemuneracoes } from "@/components/remuneracoes/RemuneracoesProvider";
import { useDespesas } from "@/components/financas/DespesasProvider";
import { saldoPendente } from "@/lib/servicos";
import { saldoColaborador } from "@/lib/remuneracoes";
import { dentro, intervaloDe, periodosOpcoes, type PeriodoChave } from "@/lib/periodos";
import { formatData, formatKz, hojeISO } from "@/lib/format";

const seletor =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

type Accao = { label: string; href: string; icone: LucideIcon };

export default function PainelPage() {
  const { perfil } = useAuth();
  const cl = useClientes();
  const co = useColaboradores();
  const sv = useServicos();
  const rm = useRemuneracoes();
  const dp = useDespesas();
  const [periodo, setPeriodo] = useState<PeriodoChave>("mes");

  if (!(cl.carregado && co.carregado && sv.carregado && rm.carregado && dp.carregado)) {
    return <p className="text-sm text-slate-500">A carregar...</p>;
  }

  const podeGerir = perfil.perfil !== "operacional";
  const eAdmin = perfil.perfil === "administrador";
  const hoje = hojeISO();
  const ano = hoje.slice(0, 4);
  const iv = intervaloDe(periodo);
  const dataServ = (s: (typeof sv.servicos)[number]) => s.data || s.dataCriacao.slice(0, 10);
  const doPeriodo = sv.servicos.filter((s) => dentro(dataServ(s), iv));

  const agendadosHoje = sv.servicos.filter((s) => s.data === hoje && s.estadoOperacional === "Agendado").length;
  const emExecucao = sv.servicos.filter((s) => s.estadoOperacional === "Em execução").length;
  const concluidos = doPeriodo.filter((s) => s.estadoOperacional === "Concluído").length;
  const novosClientes = cl.clientes.filter((c) => dentro(c.dataRegisto, iv)).length;

  const recebido = sv.servicos.flatMap((s) => s.recebimentos).filter((r) => dentro(r.data, iv)).reduce((t, r) => t + r.valor, 0);
  const porReceber = sv.servicos.reduce((t, s) => t + saldoPendente(s), 0);
  const despPagas = dp.despesas.filter((d) => d.estado === "Pago" && dentro(d.data, iv)).reduce((t, d) => t + d.valor, 0);
  const remPagas = rm.pagamentos.filter((p) => dentro(p.data, iv)).reduce((t, p) => t + p.valor, 0);
  const remPorPagar = co.colaboradores.reduce((t, c) => t + Math.max(0, saldoColaborador(c.id, rm.remuneracoes, rm.pagamentos).saldo), 0);
  const resultado = recebido - despPagas - remPagas;

  const receitasMes = Array.from({ length: 12 }, () => 0);
  sv.servicos.flatMap((s) => s.recebimentos).forEach((r) => {
    if (r.data.startsWith(ano)) receitasMes[Number(r.data.slice(5, 7)) - 1] += r.valor;
  });
  const despesasMes = Array.from({ length: 12 }, () => 0);
  dp.despesas.forEach((d) => {
    if (d.estado === "Pago" && d.data.startsWith(ano)) despesasMes[Number(d.data.slice(5, 7)) - 1] += d.valor;
  });

  const contagem: Record<string, number> = {};
  doPeriodo.filter((s) => s.estadoOperacional !== "Cancelado").forEach((s) => {
    contagem[s.tipoServico] = (contagem[s.tipoServico] ?? 0) + 1;
  });
  const ordenadas = Object.entries(contagem).sort((a, b) => b[1] - a[1]);
  const fatias: Fatia[] = ordenadas.slice(0, 5).map(([nome, valor]) => ({ nome, valor }));
  const resto = ordenadas.slice(5).reduce((t, [, v]) => t + v, 0);
  if (resto > 0) fatias.push({ nome: "Outros", valor: resto });

  const ultimos = [...sv.servicos].sort((a, b) => b.codigo.localeCompare(a.codigo)).slice(0, 6);

  const accoes: Accao[] = podeGerir
    ? [
        { label: "Novo Serviço", href: "/servicos/novo", icone: Plus },
        { label: "Novo Cliente", href: "/clientes/novo", icone: UserPlus },
        { label: "Registar Despesa", href: "/financas", icone: Receipt },
        { label: "Ver Relatórios", href: "/relatorios", icone: BarChart3 },
      ]
    : [
        { label: "Ver Serviços", href: "/servicos", icone: Sparkles },
        { label: "Ver Agendamento", href: "/agenda", icone: CalendarDays },
      ];

  const nome = (perfil.nome || perfil.email.split("@")[0]).trim();
  const data = new Date().toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Olá, {nome}!</h1>
          <p className="mt-1 text-sm text-slate-500">Aqui está um resumo da actividade do Grupo Galedos.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-block text-sm text-slate-500 first-letter:uppercase">{data}</span>
          <select className={seletor} value={periodo} onChange={(e) => setPeriodo(e.target.value as PeriodoChave)}>
            {periodosOpcoes.map((p) => <option key={p.chave} value={p.chave}>{p.label}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {podeGerir && <StatCard label="Clientes" value={String(cl.clientes.length)} icon={Users} tom="azul" hint={`+${novosClientes} no período`} />}
        <StatCard label="Serviços realizados" value={String(concluidos)} icon={CheckCircle2} tom="roxo" hint="Concluídos no período" />
        {podeGerir && <StatCard label="Receita do período" value={formatKz(recebido)} icon={HandCoins} tom="verde" hint="Dinheiro efectivamente recebido" />}
        {eAdmin && <StatCard label="Remunerações por pagar" value={formatKz(remPorPagar)} icon={Wallet} tom="dourado" hint="Aprovadas e ainda não liquidadas" />}
        <StatCard label="Agendados hoje" value={String(agendadosHoje)} icon={CalendarCheck} tom="azul" />
        <StatCard label="Em execução" value={String(emExecucao)} icon={Wrench} tom="ambar" />
        {podeGerir && <StatCard label="Por receber (total)" value={formatKz(porReceber)} icon={Landmark} tom="vermelho" />}
        {eAdmin && <StatCard label="Resultado estimado" value={formatKz(resultado)} icon={Scale} tom="dourado" hint="Não é lucro contabilístico" />}
      </div>

      {eAdmin && (
        <div className="mb-6 grid gap-6 lg:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-3">
            <h2 className="mb-3 font-semibold text-slate-900">Receita e Despesas ({ano})</h2>
            <GraficoReceitas receitas={receitasMes} despesas={despesasMes} />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="mb-4 font-semibold text-slate-900">Serviços por Tipo</h2>
            <DonutServicos fatias={fatias} />
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold text-slate-900">Últimos Serviços</h2>
            <Link href="/servicos" className="text-sm font-medium text-brand-700 hover:underline">Ver todos</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Nº OS</th>
                  <th className="px-5 py-3 font-medium">Cliente</th>
                  <th className="px-5 py-3 font-medium">Tipo de serviço</th>
                  <th className="px-5 py-3 font-medium">Data</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3 font-medium">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ultimos.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-5 py-3"><Link href={`/servicos/${s.id}`} className="font-medium text-brand-700 hover:underline">{s.codigo}</Link></td>
                    <td className="px-5 py-3">{cl.obter(s.clienteId)?.nome ?? "—"}</td>
                    <td className="px-5 py-3">{s.tipoServico}</td>
                    <td className="whitespace-nowrap px-5 py-3">{s.data ? formatData(s.data) : "Por agendar"}</td>
                    <td className="px-5 py-3"><StatusBadge status={s.estadoOperacional} /></td>
                    <td className="whitespace-nowrap px-5 py-3">{formatKz(s.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ultimos.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Ainda não há serviços.</p>}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-900">Ações Rápidas</h2>
          <div className="space-y-2">
            {accoes.map((a) => (
              <Link key={a.href + a.label} href={a.href} className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:border-brand-500 hover:bg-brand-50">
                <a.icone className="h-4 w-4 text-brand-600" />
                {a.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}