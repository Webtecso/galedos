"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { useDocumentos } from "@/components/documentos/DocumentosProvider";
import { useServicos } from "@/components/servicos/ServicosProvider";
import { useClientes } from "@/components/clientes/ClientesProvider";
import { useColaboradores } from "@/components/colaboradores/ColaboradoresProvider";
import { useRemuneracoes } from "@/components/remuneracoes/RemuneracoesProvider";
import { useStock } from "@/components/stock/StockProvider";
import { nomesDocumento, type TipoDocumento } from "@/lib/operacao";
import { intervaloDe, periodosOpcoes } from "@/lib/periodos";
import { formatData, formatPeriodo, hojeISO } from "@/lib/format";

const seletor =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

type Opcao = { valor: string; label: string };

function Cartao({ tipo, descricao, opcoes, vazio }: { tipo: TipoDocumento; descricao: string; opcoes: Opcao[]; vazio: string }) {
  const [v, setV] = useState("");
  const escolhido = v || opcoes[0]?.valor || "";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <FileText className="h-5 w-5 text-brand-600" />
        <h2 className="font-semibold text-slate-900">{nomesDocumento[tipo]}</h2>
      </div>
      <p className="mb-3 text-xs text-slate-500">{descricao}</p>
      {opcoes.length === 0 ? (
        <p className="text-sm text-slate-500">{vazio}</p>
      ) : (
        <div className="space-y-3">
          <select className={seletor} value={escolhido} onChange={(e) => setV(e.target.value)}>
            {opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.label}</option>)}
          </select>
          <Link href={`/documentos/ver/${tipo}/${escolhido}`} className="inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Gerar documento
          </Link>
        </div>
      )}
    </div>
  );
}

export default function DocumentosPage() {
  const doc = useDocumentos();
  const sv = useServicos();
  const cl = useClientes();
  const co = useColaboradores();
  const rm = useRemuneracoes();
  const st = useStock();

  if (!(doc.carregado && sv.carregado && cl.carregado && co.carregado && rm.carregado && st.carregado))
    return <p className="text-sm text-slate-500">A carregar...</p>;

  const servicos = [...sv.servicos].sort((a, b) => b.codigo.localeCompare(a.codigo));
  const opcServ = servicos.map((s) => ({ valor: s.id, label: `${s.codigo} · ${cl.obter(s.clienteId)?.nome ?? ""} · ${s.tipoServico}` }));
  const opcConcl = servicos.filter((s) => s.estadoOperacional === "Concluído").map((s) => ({ valor: s.id, label: `${s.codigo} · ${cl.obter(s.clienteId)?.nome ?? ""}` }));
  const periodos = Array.from(new Set([...rm.remuneracoes.map((r) => r.periodo), hojeISO().slice(0, 7)])).sort().reverse();
  const opcPer = periodos.map((p) => ({ valor: p, label: formatPeriodo(p) }));
  const opcRec = [...rm.pagamentos].reverse().map((p) => ({ valor: p.id, label: `${formatData(p.data)} · ${co.obter(p.colaboradorId)?.nome ?? ""} · ${p.valor} Kz` }));
  const opcTermo = st.equipamentos.filter((e) => e.responsavelId).map((e) => ({ valor: e.id, label: `${e.codigo} · ${e.nome} (${co.obter(e.responsavelId)?.nome ?? ""})` }));
  const opcFin = periodosOpcoes.map((p) => {
    const iv = intervaloDe(p.chave);
    return { valor: `${iv.de}_${iv.ate}`, label: p.label };
  });

  const emitidos = [...doc.documentos].sort((a, b) => b.numero.localeCompare(a.numero));

  return (
    <>
      <PageHeader title="Documentos" description="Gere documentos a partir dos dados da aplicação. Cada documento tem um número único que não se repete." />

      <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Cartao tipo="orcamento" descricao="Proposta de preço para o cliente." opcoes={opcServ} vazio="Sem serviços." />
        <Cartao tipo="ordem" descricao="Instruções de execução para a equipa." opcoes={opcServ} vazio="Sem serviços." />
        <Cartao tipo="ficha" descricao="Resumo do trabalho executado e do estado financeiro." opcoes={opcConcl} vazio="Ainda não há serviços concluídos." />
        <Cartao tipo="mapa" descricao="Remunerações por colaborador num mês." opcoes={opcPer} vazio="Sem períodos." />
        <Cartao tipo="recibo" descricao="Comprovativo de pagamento ou adiantamento." opcoes={opcRec} vazio="Ainda não há pagamentos a colaboradores." />
        <Cartao tipo="termo" descricao="Entrega de equipamento a um colaborador." opcoes={opcTermo} vazio="Atribua um responsável a um equipamento em Stock e equipamentos." />
        <Cartao tipo="financeiro" descricao="Receitas, despesas e valores pendentes." opcoes={opcFin} vazio="" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Documentos emitidos</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Número</th><th className="px-5 py-3 font-medium">Tipo</th>
                <th className="px-5 py-3 font-medium">Emitido em</th><th className="px-5 py-3 font-medium">Por</th>
                <th className="px-5 py-3 font-medium">Acção</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {emitidos.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-5 py-3 font-medium text-slate-900">{d.numero}</td>
                  <td className="px-5 py-3">{nomesDocumento[d.tipo]}</td>
                  <td className="whitespace-nowrap px-5 py-3">{formatData(d.dataEmissao)}</td>
                  <td className="px-5 py-3">{d.utilizador}</td>
                  <td className="px-5 py-3"><Link href={`/documentos/ver/${d.tipo}/${d.refId}`} className="font-medium text-brand-700 hover:underline">Abrir</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {emitidos.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Ainda não foram emitidos documentos.</p>}
      </div>
    </>
  );
}