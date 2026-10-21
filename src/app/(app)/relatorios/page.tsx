"use client";

import { useState } from "react";
import Link from "next/link";
import { Banknote, CheckCircle2, HandCoins, Percent, Repeat, TrendingUp, Users } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import TabelaRelatorio, { type Cel } from "@/components/relatorios/TabelaRelatorio";
import { useClientes } from "@/components/clientes/ClientesProvider";
import { useColaboradores } from "@/components/colaboradores/ColaboradoresProvider";
import { useServicos } from "@/components/servicos/ServicosProvider";
import { useRemuneracoes } from "@/components/remuneracoes/RemuneracoesProvider";
import { useDespesas } from "@/components/financas/DespesasProvider";
import { useOcorrencias } from "@/components/ocorrencias/OcorrenciasProvider";
import { useOrcamentos } from "@/components/orcamentos/OrcamentosProvider";
import { saldoPendente, totalRecebido } from "@/lib/servicos";
import { saldoColaborador } from "@/lib/remuneracoes";
import { dentro, intervaloDe, periodosOpcoes, type Intervalo, type PeriodoChave } from "@/lib/periodos";
import { paraData, somarDias } from "@/lib/datas";
import { formatData, formatKz } from "@/lib/format";
import type { Servico } from "@/lib/types";

const seletor =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

function anterior(iv: Intervalo): Intervalo | null {
  if (iv.de === "0000-01-01") return null;
  const dias = Math.round((paraData(iv.ate).getTime() - paraData(iv.de).getTime()) / 86400000) + 1;
  return { de: somarDias(iv.de, -dias), ate: somarDias(iv.de, -1) };
}

function variacao(atual: number, ant: number): Cel {
  if (ant === 0) return "—";
  return ((atual - ant) / Math.abs(ant)) * 100;
}

function agrupar<T>(itens: T[], chave: (x: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const i of itens) {
    const k = chave(i);
    if (!out[k]) out[k] = [];
    out[k].push(i);
  }
  return out;
}

function pct(v: number | null): string {
  return v === null ? "—" : `${(Math.round(v * 10) / 10).toString().replace(".", ",")}%`;
}

export default function RelatoriosPage() {
  const cl = useClientes();
  const co = useColaboradores();
  const sv = useServicos();
  const rm = useRemuneracoes();
  const dp = useDespesas();
  const oc = useOcorrencias();
  const orc = useOrcamentos();
  const [periodo, setPeriodo] = useState<PeriodoChave>("mes");
  const [fColab, setFColab] = useState("todos");
  const [fCat, setFCat] = useState("todos");

  const pronto = cl.carregado && co.carregado && sv.carregado && rm.carregado && dp.carregado && oc.carregado && orc.carregado;
  if (!pronto) return <p className="text-sm text-slate-500">A carregar...</p>;

  const iv = intervaloDe(periodo);
  const ant = anterior(iv);
  const dataServ = (s: Servico) => s.data || s.dataCriacao.slice(0, 10);
  const passa = (s: Servico) => fColab === "todos" || s.colaboradorIds.includes(fColab);
  const nomeCliente = (id: string) => cl.obter(id)?.nome ?? "—";

  const servPer = sv.servicos.filter((s) => passa(s) && dentro(dataServ(s), iv));
  const validos = servPer.filter((s) => s.estadoOperacional !== "Cancelado");
  const concluidos = servPer.filter((s) => s.estadoOperacional === "Concluído");
  const cancelados = servPer.filter((s) => s.estadoOperacional === "Cancelado");
  const pendentes = servPer.filter((s) => s.estadoOperacional !== "Concluído" && s.estadoOperacional !== "Cancelado");

  function recebimentos(i: Intervalo) {
    return sv.servicos.filter(passa).flatMap((s) => s.recebimentos.filter((r) => dentro(r.data, i)).map((r) => ({ r, s })));
  }
  const despPagas = (i: Intervalo) =>
    dp.despesas.filter((d) => d.estado === "Pago" && dentro(d.data, i) && (fCat === "todos" || d.categoria === fCat)).reduce((t, d) => t + d.valor, 0);
  const remPagas = (i: Intervalo) =>
    rm.pagamentos.filter((p) => dentro(p.data, i) && (fColab === "todos" || p.colaboradorId === fColab)).reduce((t, p) => t + p.valor, 0);

  const recAtual = recebimentos(iv);
  const receita = recAtual.reduce((t, x) => t + x.r.valor, 0);
  const nServRec = new Set(recAtual.map((x) => x.s.id)).size;
  const receitaMedia = nServRec ? receita / nServRec : 0;
  const ticket = validos.length ? validos.reduce((t, s) => t + s.total, 0) / validos.length : 0;
  const despAtual = despPagas(iv);
  const remAtual = remPagas(iv);
  const saldo = receita - despAtual - remAtual;

  const orcPer = orc.orcamentos.filter((o) => dentro(o.dataEnvio, iv));
  const aceites = orcPer.filter((o) => o.estado === "Aceite").length;
  const recusados = orcPer.filter((o) => o.estado === "Recusado").length;
  const aguardam = orcPer.filter((o) => o.estado === "Enviado").length;
  const conversao = orcPer.length ? (aceites / orcPer.length) * 100 : null;

  const clientesPer = Array.from(new Set(validos.map((s) => s.clienteId)));
  const recorrentes = clientesPer.filter((id) => {
    const antes = sv.servicos.some((x) => x.clienteId === id && x.estadoOperacional !== "Cancelado" && dataServ(x) < iv.de);
    return antes || validos.filter((x) => x.clienteId === id).length > 1;
  }).length;
  const taxaRec = clientesPer.length ? (recorrentes / clientesPer.length) * 100 : null;
  const novos = cl.clientes.filter((c) => dentro(c.dataRegisto, iv)).length;

  const colabsVisiveis = co.colaboradores.filter((c) => fColab === "todos" || c.id === fColab);

  const porTipo = agrupar(validos, (s) => s.tipoServico);
  const linhasTipo: Cel[][] = Object.entries(porTipo)
    .map(([tipo, l]): Cel[] => [tipo, l.length, l.filter((s) => s.estadoOperacional === "Concluído").length, l.reduce((t, s) => t + s.total, 0)])
    .sort((a, b) => (b[3] as number) - (a[3] as number));

  const linhasColab: Cel[][] = colabsVisiveis.map((c): Cel[] => {
    const part = validos.filter((s) => s.colaboradorIds.includes(c.id));
    const concl = part.filter((s) => s.estadoOperacional === "Concluído");
    return [c.nome, part.length, concl.length, concl.reduce((t, s) => t + s.total, 0)];
  });

  const linhasPend: Cel[][] = [...pendentes, ...cancelados]
    .sort((a, b) => dataServ(a).localeCompare(dataServ(b)))
    .map((s): Cel[] => [s.codigo, nomeCliente(s.clienteId), s.tipoServico, s.estadoOperacional, formatData(dataServ(s)), s.total]);

  const ocPer = oc.ocorrencias.filter((o) => dentro(o.data, iv));
  const linhasOc: Cel[][] = Object.entries(agrupar(ocPer, (o) => o.tipo)).map(([tipo, l]): Cel[] => [
    tipo, l.length, l.filter((o) => o.estado !== "Resolvida" && o.estado !== "Encerrada").length,
  ]);

  const porTipoRec = agrupar(recAtual, (x) => x.s.tipoServico);
  const linhasRecTipo: Cel[][] = Object.entries(porTipoRec)
    .map(([tipo, l]): Cel[] => [tipo, l.length, l.reduce((t, x) => t + x.r.valor, 0)])
    .sort((a, b) => (b[2] as number) - (a[2] as number));

  const recIds = new Set(recAtual.map((x) => x.r.id));
  const remPorRec: Record<string, number> = {};
  rm.remuneracoes.forEach((r) => {
    if (r.recebimentoId && recIds.has(r.recebimentoId)) remPorRec[r.recebimentoId] = (remPorRec[r.recebimentoId] ?? 0) + r.valor;
  });
  const linhasMargem: Cel[][] = Object.entries(porTipoRec).map(([tipo, l]): Cel[] => {
    const rec = l.reduce((t, x) => t + x.r.valor, 0);
    const rem = l.reduce((t, x) => t + (remPorRec[x.r.id] ?? 0), 0);
    return [tipo, rec, rem, rec - rem, rec ? ((rec - rem) / rec) * 100 : 0];
  });

  const despPeriodo = dp.despesas.filter((d) => d.estado !== "Anulada" && dentro(d.data, iv) && (fCat === "todos" || d.categoria === fCat));
  const linhasDesp: Cel[][] = Array.from(new Set(despPeriodo.map((d) => d.categoria))).map((c): Cel[] => [
    c,
    despPeriodo.filter((d) => d.categoria === c && d.estado === "Pago").reduce((t, d) => t + d.valor, 0),
    despPeriodo.filter((d) => d.categoria === c && d.estado === "Por pagar").reduce((t, d) => t + d.valor, 0),
  ]);

  const linhasPendClientes: Cel[][] = sv.servicos
    .filter((s) => passa(s) && saldoPendente(s) > 0)
    .sort((a, b) => saldoPendente(b) - saldoPendente(a))
    .map((s): Cel[] => [s.codigo, nomeCliente(s.clienteId), s.total, totalRecebido(s), saldoPendente(s)]);

  const linhasRem: Cel[][] = colabsVisiveis.map((c): Cel[] => {
    const apur = rm.remuneracoes.filter((r) => r.colaboradorId === c.id && dentro(r.data, iv)).reduce((t, r) => t + r.valor, 0);
    const pago = rm.pagamentos.filter((p) => p.colaboradorId === c.id && dentro(p.data, iv)).reduce((t, p) => t + p.valor, 0);
    return [c.nome, apur, pago, saldoColaborador(c.id, rm.remuneracoes, rm.pagamentos).saldo];
  });

  const recAnt = ant ? recebimentos(ant).reduce((t, x) => t + x.r.valor, 0) : 0;
  const despAnt = ant ? despPagas(ant) : 0;
  const remAnt = ant ? remPagas(ant) : 0;
  const saldoAnt = recAnt - despAnt - remAnt;
  const linhasComp: Cel[][] = [
    ["Receitas recebidas", receita, recAnt, variacao(receita, recAnt)],
    ["Despesas pagas", despAtual, despAnt, variacao(despAtual, despAnt)],
    ["Remunerações pagas", remAtual, remAnt, variacao(remAtual, remAnt)],
    ["Saldo estimado", saldo, saldoAnt, variacao(saldo, saldoAnt)],
  ];

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Indicadores e análises. Um maior número de serviços, por si só, não significa maior rentabilidade."
        action={
          <Link href={`/documentos/ver/financeiro/${iv.de}_${iv.ate}`} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Relatório financeiro (PDF)
          </Link>
        }
      />

      <div className="mb-6 flex flex-wrap gap-3">
        <select className={seletor} value={periodo} onChange={(e) => setPeriodo(e.target.value as PeriodoChave)}>
          {periodosOpcoes.map((p) => <option key={p.chave} value={p.chave}>{p.label}</option>)}
        </select>
        <select className={seletor} value={fColab} onChange={(e) => setFColab(e.target.value)}>
          <option value="todos">Todos os colaboradores</option>
          {co.colaboradores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select className={seletor} value={fCat} onChange={(e) => setFCat(e.target.value)}>
          <option value="todos">Todas as categorias de despesa</option>
          {dp.categorias.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <p className="mb-6 text-xs text-slate-500">
        O filtro de colaborador aplica-se aos serviços, receitas e remunerações; o de categoria, às despesas. Os orçamentos e clientes novos não dependem do colaborador.
      </p>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Indicadores de desempenho</h2>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ticket médio" value={formatKz(Math.round(ticket))} icon={Banknote} hint={`${validos.length} serviços (sem cancelados)`} />
        <StatCard label="Receita média por serviço" value={formatKz(Math.round(receitaMedia))} icon={HandCoins} hint={`${nServRec} serviços com recebimentos`} />
        <StatCard label="Taxa de conversão" value={pct(conversao)} icon={Percent} hint={`${aceites} aceites · ${recusados} recusados · ${aguardam} a aguardar`} />
        <StatCard label="Taxa de recorrência" value={pct(taxaRec)} icon={Repeat} hint={`${recorrentes} de ${clientesPer.length} clientes`} />
        <StatCard label="Serviços concluídos" value={String(concluidos.length)} icon={CheckCircle2} hint={`${cancelados.length} cancelados · ${pendentes.length} pendentes`} />
        <StatCard label="Clientes novos" value={String(novos)} icon={Users} hint={`${recorrentes} clientes recorrentes`} />
        <StatCard label="Receitas recebidas" value={formatKz(receita)} icon={HandCoins} />
        <StatCard label="Saldo estimado" value={formatKz(saldo)} icon={TrendingUp} hint="Não é lucro contabilístico" />
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Relatórios operacionais</h2>
      <TabelaRelatorio titulo="Serviços por tipo" ficheiro="servicos-por-tipo"
        colunas={[{ titulo: "Tipo de serviço" }, { titulo: "Serviços", tipo: "num" }, { titulo: "Concluídos", tipo: "num" }, { titulo: "Valor total", tipo: "kz" }]}
        linhas={linhasTipo} />
      <TabelaRelatorio titulo="Serviços por colaborador (produtividade)" ficheiro="servicos-por-colaborador"
        colunas={[{ titulo: "Colaborador" }, { titulo: "Participações", tipo: "num" }, { titulo: "Concluídos", tipo: "num" }, { titulo: "Valor dos concluídos", tipo: "kz" }]}
        linhas={linhasColab} nota="O valor de um serviço com equipa aparece em cada colaborador que participou; não some esta coluna." />
      <TabelaRelatorio titulo="Serviços pendentes e cancelados" ficheiro="servicos-pendentes-cancelados"
        colunas={[{ titulo: "Código" }, { titulo: "Cliente" }, { titulo: "Serviço" }, { titulo: "Estado" }, { titulo: "Data" }, { titulo: "Valor", tipo: "kz" }]}
        linhas={linhasPend} />
      <TabelaRelatorio titulo="Ocorrências por tipo" ficheiro="ocorrencias-por-tipo"
        colunas={[{ titulo: "Tipo" }, { titulo: "Registadas", tipo: "num" }, { titulo: "Por resolver", tipo: "num" }]}
        linhas={linhasOc} />

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">Relatórios financeiros</h2>
      <TabelaRelatorio
        titulo={ant ? `Comparação com o período anterior (${formatData(ant.de)} a ${formatData(ant.ate)})` : "Comparação entre períodos"}
        ficheiro="comparacao-periodos"
        colunas={[{ titulo: "Indicador" }, { titulo: "Período actual", tipo: "kz" }, { titulo: "Período anterior", tipo: "kz" }, { titulo: "Variação", tipo: "pct" }]}
        linhas={ant ? linhasComp : []}
        nota={ant ? undefined : "Não há período anterior para o filtro Todo o histórico."} />
      <TabelaRelatorio titulo="Receitas por tipo de serviço" ficheiro="receitas-por-tipo"
        colunas={[{ titulo: "Tipo de serviço" }, { titulo: "Recebimentos", tipo: "num" }, { titulo: "Recebido", tipo: "kz" }]}
        linhas={linhasRecTipo} />
      <TabelaRelatorio titulo="Margem estimada por tipo de serviço" ficheiro="margem-por-tipo"
        colunas={[{ titulo: "Tipo de serviço" }, { titulo: "Recebido", tipo: "kz" }, { titulo: "Remunerações apuradas", tipo: "kz" }, { titulo: "Margem", tipo: "kz" }, { titulo: "Margem %", tipo: "pct" }]}
        linhas={linhasMargem}
        nota="Considera só as remunerações já apuradas e não inclui materiais nem despesas gerais; é uma estimativa, não lucro." />
      <TabelaRelatorio titulo="Despesas por categoria" ficheiro="despesas-por-categoria"
        colunas={[{ titulo: "Categoria" }, { titulo: "Pagas", tipo: "kz" }, { titulo: "Por pagar", tipo: "kz" }]}
        linhas={linhasDesp} />
      <TabelaRelatorio titulo="Valores pendentes de clientes (situação actual)" ficheiro="pendentes-clientes"
        colunas={[{ titulo: "Serviço" }, { titulo: "Cliente" }, { titulo: "Total", tipo: "kz" }, { titulo: "Recebido", tipo: "kz" }, { titulo: "Saldo", tipo: "kz" }]}
        linhas={linhasPendClientes} />
      <TabelaRelatorio titulo="Remunerações por colaborador" ficheiro="remuneracoes-por-colaborador"
        colunas={[{ titulo: "Colaborador" }, { titulo: "Apurado no período", tipo: "kz" }, { titulo: "Pago no período", tipo: "kz" }, { titulo: "Saldo devido (actual)", tipo: "kz" }]}
        linhas={linhasRem} />
    </>
  );
}