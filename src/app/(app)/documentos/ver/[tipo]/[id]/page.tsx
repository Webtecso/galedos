"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import DocumentoLayout, { Campo } from "@/components/documentos/DocumentoLayout";
import { useDocumentos } from "@/components/documentos/DocumentosProvider";
import { useEmpresa } from "@/components/configuracoes/EmpresaProvider";
import { useClientes } from "@/components/clientes/ClientesProvider";
import { useColaboradores } from "@/components/colaboradores/ColaboradoresProvider";
import { useServicos } from "@/components/servicos/ServicosProvider";
import { useRemuneracoes } from "@/components/remuneracoes/RemuneracoesProvider";
import { useDespesas } from "@/components/financas/DespesasProvider";
import { useStock } from "@/components/stock/StockProvider";
import { nomesDocumento, tiposDocumento, type TipoDocumento } from "@/lib/operacao";
import { formatDuracao, saldoPendente, totalRecebido } from "@/lib/servicos";
import { saldoColaborador } from "@/lib/remuneracoes";
import { dentro } from "@/lib/periodos";
import { formatData, formatKz, formatPeriodo } from "@/lib/format";

type Res = { titulo: string; corpo: React.ReactNode; assinaturas: string[] } | { erro: string };

const th = "border-b border-slate-300 px-2 py-1.5 text-left text-xs uppercase text-slate-500";
const td = "border-b border-slate-100 px-2 py-1.5 text-sm";

export default function VerDocumentoPage({ params }: { params: Promise<{ tipo: string; id: string }> }) {
  const { tipo, id } = use(params);
  const cl = useClientes();
  const co = useColaboradores();
  const sv = useServicos();
  const rm = useRemuneracoes();
  const dp = useDespesas();
  const st = useStock();
  const em = useEmpresa();
  const doc = useDocumentos();
  const [numero, setNumero] = useState("");
  const [emitido, setEmitido] = useState("");

  const pronto = cl.carregado && co.carregado && sv.carregado && rm.carregado && dp.carregado && st.carregado && em.carregado && doc.carregado;

  function construir(): Res {
    if (!(tiposDocumento as string[]).includes(tipo)) return { erro: "Tipo de documento desconhecido." };

    if (tipo === "orcamento" || tipo === "ordem" || tipo === "ficha") {
      const s = sv.obterServico(id);
      if (!s) return { erro: "Serviço não encontrado." };
      if (tipo === "ficha" && s.estadoOperacional !== "Concluído")
        return { erro: "A ficha de serviço concluído só está disponível para serviços concluídos." };
      const c = cl.obter(s.clienteId);
      const equipa = s.colaboradorIds.map((cid) => co.obter(cid)?.nome ?? cid).join(", ") || "Por atribuir";
      const quando = s.data ? `${formatData(s.data)} às ${s.hora} (${formatDuracao(s.duracaoMin)})` : "Por agendar";

      const identificacao = (
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Serviço (código)">{s.codigo}</Campo>
          <Campo label="Cliente">{c?.nome ?? "—"}</Campo>
          <Campo label="Telefone">{c?.telefone ?? "—"}</Campo>
          {c?.tipo === "Empresa" && <Campo label="NIF do cliente">{c.nif || "—"}</Campo>}
          <Campo label="Local">{s.local || "—"}</Campo>
          <Campo label="Data e hora">{quando}</Campo>
        </div>
      );

      const tabela = (
        <table className="w-full border-collapse">
          <thead><tr><th className={th}>Descrição</th><th className={th}>Qtd.</th><th className={th}>Preço unit.</th><th className={th}>Desconto</th><th className={th}>Total</th></tr></thead>
          <tbody>
            <tr>
              <td className={td}>{s.tipoServico}{s.descricao && <span className="block text-xs text-slate-500">{s.descricao}</span>}</td>
              <td className={td}>{s.quantidade}</td>
              <td className={td}>{formatKz(s.precoUnitario)}</td>
              <td className={td}>{formatKz(s.desconto)}</td>
              <td className={`${td} font-semibold`}>{formatKz(s.total)}</td>
            </tr>
          </tbody>
        </table>
      );

      const condicoes = (
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Condições</p>
          <p className="text-sm text-slate-800">{em.empresa.condicoes}</p>
        </div>
      );

      if (tipo === "orcamento") {
        return {
          titulo: nomesDocumento.orcamento,
          assinaturas: ["Pelo Grupo Galedos", "Aceitação do cliente"],
          corpo: (<>{identificacao}{tabela}<p className="text-right text-lg font-semibold">Total: {formatKz(s.total)}</p>{condicoes}</>),
        };
      }
      if (tipo === "ordem") {
        return {
          titulo: nomesDocumento.ordem,
          assinaturas: ["Responsável da equipa (confirmação da execução)", "Cliente (confirmação)"],
          corpo: (
            <>
              {identificacao}
              <Campo label="Colaboradores atribuídos">{equipa}</Campo>
              <Campo label="Descrição do trabalho">{s.descricao || "—"}</Campo>
              <Campo label="Observações técnicas">{s.observacoes || "—"}</Campo>
              {tabela}
              <p className="text-right text-lg font-semibold">Preço acordado: {formatKz(s.total)}</p>
              {condicoes}
            </>
          ),
        };
      }
      return {
        titulo: nomesDocumento.ficha,
        assinaturas: ["Responsável da equipa", "Cliente"],
        corpo: (
          <>
            {identificacao}
            <Campo label="Equipa que executou">{equipa}</Campo>
            {tabela}
            <div className="grid grid-cols-3 gap-4">
              <Campo label="Valor total">{formatKz(s.total)}</Campo>
              <Campo label="Recebido">{formatKz(totalRecebido(s))}</Campo>
              <Campo label="Saldo pendente">{formatKz(saldoPendente(s))}</Campo>
            </div>
            <Campo label="Observações e ocorrências">{s.observacoes || "Sem observações."}</Campo>
          </>
        ),
      };
    }

    if (tipo === "mapa") {
      if (!/^\d{4}-\d{2}$/.test(id)) return { erro: "Período inválido." };
      const regs = rm.remuneracoes.filter((r) => r.periodo === id);
      const pags = rm.pagamentos.filter((p) => p.data.startsWith(id));
      const ids = Array.from(new Set([...regs.map((r) => r.colaboradorId), ...pags.map((p) => p.colaboradorId)]));
      if (ids.length === 0) return { erro: "Não há remunerações nem pagamentos neste período." };
      const fechado = rm.periodosFechados.includes(id);
      return {
        titulo: `${nomesDocumento.mapa} · ${formatPeriodo(id)}`,
        assinaturas: ["Administração", "Conferido por"],
        corpo: (
          <>
            <Campo label="Estado do período">{fechado ? "Fechado" : "Aberto (valores ainda sujeitos a alteração)"}</Campo>
            {ids.map((cid) => {
              const lista = regs.filter((r) => r.colaboradorId === cid);
              const total = lista.reduce((t, r) => t + r.valor, 0);
              const pagoPeriodo = pags.filter((p) => p.colaboradorId === cid).reduce((t, p) => t + p.valor, 0);
              const s = saldoColaborador(cid, rm.remuneracoes, rm.pagamentos);
              return (
                <div key={cid} className="break-inside-avoid">
                  <p className="mb-1 font-semibold text-slate-900">{co.obter(cid)?.nome ?? cid}</p>
                  <table className="w-full border-collapse">
                    <thead><tr><th className={th}>Serviço</th><th className={th}>Regra</th><th className={th}>Valor elegível</th><th className={th}>Valor</th></tr></thead>
                    <tbody>
                      {lista.map((r) => (
                        <tr key={r.id}>
                          <td className={td}>{r.servicoCodigo}</td>
                          <td className={td}>{r.tipo === "Serviço" ? `${r.regra}` : `Ajuste: ${r.motivo}`}</td>
                          <td className={td}>{r.tipo === "Serviço" ? formatKz(r.valorElegivel) : "—"}</td>
                          <td className={td}>{formatKz(r.valor)}</td>
                        </tr>
                      ))}
                      {lista.length === 0 && <tr><td className={td} colSpan={4}>Sem remunerações apuradas neste período.</td></tr>}
                    </tbody>
                  </table>
                  <div className="mt-1 grid grid-cols-3 gap-3 text-sm">
                    <Campo label="Total do período">{formatKz(total)}</Campo>
                    <Campo label="Pago no período">{formatKz(pagoPeriodo)}</Campo>
                    <Campo label="Saldo devido (acumulado)">{formatKz(s.saldo)}</Campo>
                  </div>
                </div>
              );
            })}
          </>
        ),
      };
    }

    if (tipo === "recibo") {
      const p = rm.pagamentos.find((x) => x.id === id);
      if (!p) return { erro: "Pagamento não encontrado." };
      const c = co.obter(p.colaboradorId);
      return {
        titulo: nomesDocumento.recibo,
        assinaturas: ["O colaborador (recebi)", "Pelo Grupo Galedos"],
        corpo: (
          <>
            <p className="text-sm text-slate-800">
              Declara-se que <strong>{c?.nome ?? p.colaboradorId}</strong> recebeu do {em.empresa.nome} a quantia de <strong>{formatKz(p.valor)}</strong>,
              a título de <strong>{p.tipo.toLowerCase()}</strong> de remuneração por serviços.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Campo label="Colaborador">{c ? `${c.codigo} · ${c.nome}` : "—"}</Campo>
              <Campo label="Data do pagamento">{formatData(p.data)}</Campo>
              <Campo label="Meio de pagamento">{p.meio}</Campo>
              <Campo label="Referência">{p.referencia || "—"}</Campo>
              <Campo label="Registado por">{p.utilizador}</Campo>
            </div>
          </>
        ),
      };
    }

    if (tipo === "termo") {
      const eq = st.equipamentos.find((x) => x.id === id);
      if (!eq) return { erro: "Equipamento não encontrado." };
      const r = co.obter(eq.responsavelId);
      if (!r) return { erro: "Atribua primeiro um responsável ao equipamento (em Stock e equipamentos)." };
      return {
        titulo: nomesDocumento.termo,
        assinaturas: [`${r.nome} (responsável)`, "Pelo Grupo Galedos"],
        corpo: (
          <>
            <p className="text-sm text-slate-800">
              O colaborador identificado abaixo recebe o equipamento descrito, comprometendo-se a utilizá-lo adequadamente e a comunicar qualquer avaria ou dano.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Campo label="Equipamento">{eq.codigo} · {eq.nome}</Campo>
              <Campo label="Categoria">{eq.categoria}</Campo>
              <Campo label="Estado actual">{eq.estado}</Campo>
              <Campo label="Data de aquisição">{eq.dataAquisicao ? formatData(eq.dataAquisicao) : "—"}</Campo>
              <Campo label="Responsável">{r.codigo} · {r.nome}</Campo>
              <Campo label="Observações">{eq.observacoes || "—"}</Campo>
            </div>
          </>
        ),
      };
    }

    // financeiro
    const [de, ate] = id.split("_");
    if (!de || !ate) return { erro: "Período inválido." };
    const iv = { de, ate };
    const todo = de === "0000-01-01";
    const receitas = sv.servicos.flatMap((s) => s.recebimentos).filter((r) => dentro(r.data, iv)).reduce((t, r) => t + r.valor, 0);
    const despPagas = dp.despesas.filter((d) => d.estado === "Pago" && dentro(d.data, iv)).reduce((t, d) => t + d.valor, 0);
    const remPagas = rm.pagamentos.filter((p) => dentro(p.data, iv)).reduce((t, p) => t + p.valor, 0);
    const porReceber = sv.servicos.reduce((t, s) => t + saldoPendente(s), 0);
    const despPorPagar = dp.despesas.filter((d) => d.estado === "Por pagar").reduce((t, d) => t + d.valor, 0);
    const remPorPagar = co.colaboradores.reduce((t, c) => t + Math.max(0, saldoColaborador(c.id, rm.remuneracoes, rm.pagamentos).saldo), 0);
    const porCat: Record<string, number> = {};
    dp.despesas.filter((d) => d.estado === "Pago" && dentro(d.data, iv)).forEach((d) => { porCat[d.categoria] = (porCat[d.categoria] ?? 0) + d.valor; });
    return {
      titulo: nomesDocumento.financeiro,
      assinaturas: ["Administração"],
      corpo: (
        <>
          <Campo label="Período">{todo ? "Todo o histórico" : `${formatData(de)} a ${formatData(ate)}`}</Campo>
          <table className="w-full border-collapse">
            <thead><tr><th className={th}>No período</th><th className={th}>Valor</th></tr></thead>
            <tbody>
              <tr><td className={td}>Receitas efectivamente recebidas</td><td className={td}>{formatKz(receitas)}</td></tr>
              <tr><td className={td}>Despesas pagas</td><td className={td}>{formatKz(despPagas)}</td></tr>
              <tr><td className={td}>Remunerações pagas (inclui adiantamentos)</td><td className={td}>{formatKz(remPagas)}</td></tr>
              <tr><td className={`${td} font-semibold`}>Saldo financeiro estimado</td><td className={`${td} font-semibold`}>{formatKz(receitas - despPagas - remPagas)}</td></tr>
            </tbody>
          </table>
          <table className="w-full border-collapse">
            <thead><tr><th className={th}>Situação actual</th><th className={th}>Valor</th></tr></thead>
            <tbody>
              <tr><td className={td}>Por receber de clientes</td><td className={td}>{formatKz(porReceber)}</td></tr>
              <tr><td className={td}>Despesas por pagar</td><td className={td}>{formatKz(despPorPagar)}</td></tr>
              <tr><td className={td}>Remunerações por pagar</td><td className={td}>{formatKz(remPorPagar)}</td></tr>
            </tbody>
          </table>
          {Object.keys(porCat).length > 0 && (
            <table className="w-full border-collapse">
              <thead><tr><th className={th}>Despesas pagas por categoria</th><th className={th}>Valor</th></tr></thead>
              <tbody>{Object.entries(porCat).map(([k, v]) => <tr key={k}><td className={td}>{k}</td><td className={td}>{formatKz(v)}</td></tr>)}</tbody>
            </table>
          )}
          <p className="text-xs text-slate-500">O saldo estimado não é lucro contabilístico: não considera impostos, obrigações nem outros movimentos.</p>
        </>
      ),
    };
  }

  const res = pronto ? construir() : null;
  const valido = !!res && !("erro" in res);

  useEffect(() => {
    if (!valido) return;
    const d = doc.emitir(tipo as TipoDocumento, id);
    setNumero(d.numero);
    setEmitido(d.dataEmissao);
  }, [valido, tipo, id, doc.emitir]);

  if (!pronto || !res) return <p className="text-sm text-slate-500">A carregar...</p>;

  if ("erro" in res) {
    return (
      <>
        <PageHeader title="Documento indisponível" description={res.erro} />
        <Link href="/documentos" className="text-sm font-medium text-brand-700 hover:underline">Voltar aos documentos</Link>
      </>
    );
  }

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/documentos" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" /> Documentos
        </Link>
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          <Printer className="h-4 w-4" /> Imprimir / Guardar PDF
        </button>
      </div>
      <p className="no-print mb-4 text-xs text-slate-500">No ecrã de impressão, escolha "Guardar como PDF" como destino.</p>
      <DocumentoLayout titulo={res.titulo} numero={numero || "A gerar..."} dataEmissao={emitido || new Date().toISOString().slice(0, 10)} assinaturas={res.assinaturas}>
        {res.corpo}
      </DocumentoLayout>
    </>
  );
}