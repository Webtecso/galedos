"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { useClientes } from "@/components/clientes/ClientesProvider";
import { useServicos } from "@/components/servicos/ServicosProvider";
import {
  estadoFinanceiro, formatDataHora, formatDuracao, meiosPagamento, saldoPendente, totalRecebido, transicoes,
} from "@/lib/servicos";
import type { EstadoOperacional, MeioPagamento } from "@/lib/types";
import { formatData, formatKz } from "@/lib/format";

const campo =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export default function DetalheServicoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { obterServico, colaboradores, mudarEstado, registarPagamento, carregado } = useServicos();
  const { obter } = useClientes();
  const servico = obterServico(id);

  const [erroEstado, setErroEstado] = useState("");
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [valorPag, setValorPag] = useState("");
  const [meio, setMeio] = useState<MeioPagamento>("Dinheiro");
  const [referencia, setReferencia] = useState("");
  const [erroPag, setErroPag] = useState("");

  if (!carregado) return <p className="text-sm text-slate-500">A carregar...</p>;

  if (!servico) {
    return (
      <>
        <PageHeader title="Serviço não encontrado" />
        <Link href="/servicos" className="text-sm font-medium text-brand-700 hover:underline">Voltar aos serviços</Link>
      </>
    );
  }

  const cliente = obter(servico.clienteId);
  const recebido = totalRecebido(servico);
  const saldo = saldoPendente(servico);
  const proximos = transicoes[servico.estadoOperacional];
  const editavel = servico.estadoOperacional !== "Concluído" && servico.estadoOperacional !== "Cancelado";
  const equipa = servico.colaboradorIds.map((cid) => colaboradores.find((c) => c.id === cid)?.nome ?? cid);

  async function transitar(novo: EstadoOperacional) {
    if (!servico) return;
    if (novo === "Cancelado") {
      setCancelando(true);
      setErroEstado("");
      return;
    }
    const r = await mudarEstado(servico.id, novo);
    setErroEstado(r.ok ? "" : r.erro ?? "Erro.");
  }

  async function confirmarCancelamento() {
    if (!servico) return;
    const r = await mudarEstado(servico.id, "Cancelado", motivo);
    if (r.ok) {
      setCancelando(false);
      setMotivo("");
      setErroEstado("");
    } else {
      setErroEstado(r.erro ?? "Erro.");
    }
  }

  async function guardarPagamento(e: React.FormEvent) {
    e.preventDefault();
    if (!servico) return;
    const valor = Number(valorPag.replace(",", "."));
    const r = await registarPagamento(servico.id, { valor, meio, referencia });
    if (r.ok) {
      setValorPag("");
      setReferencia("");
      setErroPag("");
    } else {
      setErroPag(r.erro ?? "Erro.");
    }
  }

  return (
    <>
      <Link href="/servicos" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Serviços
      </Link>

      <PageHeader
        title={servico.codigo}
        description={`${servico.tipoServico} · criado em ${formatData(servico.dataCriacao.slice(0, 10))}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={servico.estadoOperacional} />
            <StatusBadge status={estadoFinanceiro(servico)} />
            {editavel && (
              <Link href={`/servicos/${servico.id}/editar`} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
                <Pencil className="h-4 w-4" /> Editar
              </Link>
            )}
          </div>
        }
      />

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-4 font-semibold text-slate-900">Dados do serviço</h2>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">Cliente</dt>
              <dd>
                {cliente ? (
                  <Link href={`/clientes/${cliente.id}`} className="font-medium text-brand-700 hover:underline">{cliente.nome}</Link>
                ) : "—"}
              </dd>
            </div>
            <div><dt className="text-xs text-slate-500">Telefone</dt><dd>{cliente?.telefone ?? "—"}</dd></div>
            <div>
              <dt className="text-xs text-slate-500">Data e hora</dt>
              <dd>{servico.data ? `${formatData(servico.data)} às ${servico.hora}` : "Por agendar"} · {formatDuracao(servico.duracaoMin)}</dd>
            </div>
            <div><dt className="text-xs text-slate-500">Local</dt><dd>{servico.local || "—"}</dd></div>
            <div><dt className="text-xs text-slate-500">Quantidade</dt><dd>{servico.quantidade}</dd></div>
            <div><dt className="text-xs text-slate-500">Preço unitário</dt><dd>{formatKz(servico.precoUnitario)}</dd></div>
            <div><dt className="text-xs text-slate-500">Desconto</dt><dd>{formatKz(servico.desconto)}</dd></div>
            <div><dt className="text-xs text-slate-500">Valor total</dt><dd className="font-semibold">{formatKz(servico.total)}</dd></div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-slate-500">Equipa</dt>
              <dd>{equipa.length ? equipa.join(", ") : "Sem equipa atribuída"}</dd>
              {servico.excepcaoConflito && <p className="mt-1 text-xs text-amber-700">Excepção de conflito de horário autorizada.</p>}
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-slate-500">Descrição</dt>
              <dd>{servico.descricao || "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-slate-500">Observações</dt>
              <dd>{servico.observacoes || "—"}</dd>
            </div>
            {servico.estadoOperacional === "Cancelado" && (
              <div className="sm:col-span-2 rounded-lg bg-red-50 p-3 text-red-800">
                <dt className="text-xs">Motivo do cancelamento</dt>
                <dd>{servico.motivoCancelamento}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-semibold text-slate-900">Estado do serviço</h2>
            {proximos.length === 0 ? (
              <p className="text-sm text-slate-500">Este serviço está num estado final.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {proximos.map((p) => (
                  <button
                    key={p}
                    onClick={() => transitar(p)}
                    className={`rounded-lg px-3 py-2 text-left text-sm font-medium ${
                      p === "Cancelado"
                        ? "border border-red-300 text-red-700 hover:bg-red-50"
                        : "bg-brand-600 text-white hover:bg-brand-700"
                    }`}
                  >
                    {p === "Cancelado" ? "Cancelar serviço" : `Passar a "${p}"`}
                  </button>
                ))}
              </div>
            )}
            {cancelando && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
                <label className="text-sm font-medium text-red-800">Motivo do cancelamento *</label>
                <textarea className={campo} rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                <div className="mt-2 flex gap-2">
                  <button onClick={confirmarCancelamento} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">Confirmar cancelamento</button>
                  <button onClick={() => { setCancelando(false); setErroEstado(""); }} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700">Voltar</button>
                </div>
              </div>
            )}
            {erroEstado && <p className="mt-3 text-sm text-red-600">{erroEstado}</p>}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-semibold text-slate-900">Financeiro</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Valor total</span><span className="font-medium">{formatKz(servico.total)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Recebido</span><span className="font-medium text-emerald-700">{formatKz(recebido)}</span></div>
              <div className="flex justify-between border-t border-slate-100 pt-3">
                <span className="text-slate-500">Saldo pendente</span>
                <span className={`font-semibold ${saldo > 0 ? "text-amber-700" : "text-slate-900"}`}>{formatKz(saldo)}</span>
              </div>
              {servico.estadoOperacional === "Cancelado" && recebido > 0 && (
                <p className="rounded-lg bg-red-50 p-2 text-xs text-red-800">
                  Serviço cancelado com {formatKz(recebido)} recebidos: reembolso pendente.
                </p>
              )}
            </div>

            {saldo > 0 && (
              <form onSubmit={guardarPagamento} noValidate className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                <p className="text-sm font-medium text-slate-700">Registar recebimento</p>
                <input className={campo} inputMode="decimal" placeholder={`Valor (máx. ${formatKz(saldo)})`} value={valorPag} onChange={(e) => setValorPag(e.target.value)} />
                <select className={campo} value={meio} onChange={(e) => setMeio(e.target.value as MeioPagamento)}>
                  {meiosPagamento.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <input className={campo} placeholder="Referência (opcional)" value={referencia} onChange={(e) => setReferencia(e.target.value)} />
                {erroPag && <p className="text-sm text-red-600">{erroPag}</p>}
                <button type="submit" className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700">Registar recebimento</button>
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Recebimentos</h2></div>
        {servico.recebimentos.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">Ainda não foram registados recebimentos.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Data</th>
                  <th className="px-5 py-3 font-medium">Valor</th>
                  <th className="px-5 py-3 font-medium">Meio</th>
                  <th className="px-5 py-3 font-medium">Referência</th>
                  <th className="px-5 py-3 font-medium">Registado por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {servico.recebimentos.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap px-5 py-3">{formatData(r.data)}</td>
                    <td className="whitespace-nowrap px-5 py-3 font-medium">{formatKz(r.valor)}</td>
                    <td className="px-5 py-3">{r.meio}</td>
                    <td className="px-5 py-3">{r.referencia || "—"}</td>
                    <td className="px-5 py-3">{r.utilizador}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Histórico de alterações</h2></div>
        <ul className="divide-y divide-slate-100">
          {[...servico.historico].reverse().map((h) => (
            <li key={h.id} className="px-5 py-3 text-sm">
              <p className="text-slate-900">{h.accao}</p>
              <p className="text-xs text-slate-500">{formatDataHora(h.data)} · {h.utilizador}</p>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}