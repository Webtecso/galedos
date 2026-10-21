"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, Phone, Mail, MapPin, Building2, Power } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import EstadoClienteBadge from "@/components/clientes/EstadoClienteBadge";
import { useClientes } from "@/components/clientes/ClientesProvider";
import { useServicos } from "@/components/servicos/ServicosProvider";
import { totalRecebido } from "@/lib/servicos";
import { formatKz, formatData } from "@/lib/format";

function estadoFinanceiro(valor: number, recebido: number): string {
  if (recebido <= 0) return "Pendente";
  if (recebido >= valor) return "Pago";
  return "Parcialmente pago";
}

export default function FichaClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { obter, carregado, alternarEstado } = useClientes();
  const { servicos: todosServicos } = useServicos();
  const cliente = obter(id);

  if (!carregado) return <p className="text-sm text-slate-500">A carregar...</p>;

  if (!cliente) {
    return (
      <>
        <PageHeader title="Cliente não encontrado" />
        <Link href="/clientes" className="text-sm font-medium text-brand-700 hover:underline">
          Voltar à lista de clientes
        </Link>
      </>
    );
  }

  const servicos = todosServicos.filter((s) => s.clienteId === cliente.id).map((s) => ({ codigo: s.codigo, servico: s.tipoServico, data: s.data || s.dataCriacao.slice(0, 10), valor: s.total, recebido: totalRecebido(s), estadoOperacional: s.estadoOperacional }));
  const cobrado = servicos.reduce((t, s) => t + s.valor, 0);
  const recebido = servicos.reduce((t, s) => t + s.recebido, 0);
  const pendente = cobrado - recebido;

  return (
    <>
      <Link href="/clientes" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Clientes
      </Link>

      <PageHeader
        title={cliente.nome}
        description={`${cliente.codigo} · ${cliente.tipo} · Registado em ${formatData(cliente.dataRegisto)}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <EstadoClienteBadge estado={cliente.estado} />
            <button
              onClick={() => alternarEstado(cliente.id)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Power className="h-4 w-4" />
              {cliente.estado === "Activo" ? "Desactivar" : "Activar"}
            </button>
            <Link
              href={`/clientes/${cliente.id}/editar`}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Pencil className="h-4 w-4" /> Editar
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-4 font-semibold text-slate-900">Dados do cliente</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <Phone className="mt-0.5 h-4 w-4 text-slate-400" />
              <div><dt className="text-xs text-slate-500">Telefone</dt><dd>{cliente.telefone}</dd></div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-4 w-4 text-slate-400" />
              <div><dt className="text-xs text-slate-500">Correio electrónico</dt><dd>{cliente.email || "—"}</dd></div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 text-slate-400" />
              <div>
                <dt className="text-xs text-slate-500">Endereço</dt>
                <dd>{cliente.endereco || "—"}{cliente.localizacao ? ` (${cliente.localizacao})` : ""}</dd>
              </div>
            </div>
            {cliente.tipo === "Empresa" && (
              <div className="flex items-start gap-3">
                <Building2 className="mt-0.5 h-4 w-4 text-slate-400" />
                <div><dt className="text-xs text-slate-500">NIF</dt><dd>{cliente.nif || "—"}</dd></div>
              </div>
            )}
            <div className="border-t border-slate-100 pt-3">
              <dt className="text-xs text-slate-500">Observações</dt>
              <dd>{cliente.observacoes || "Sem observações."}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-900">Resumo financeiro</h2>
          <div className="space-y-4 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Valor cobrado</span><span className="font-medium">{formatKz(cobrado)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Efectivamente pago</span><span className="font-medium text-emerald-700">{formatKz(recebido)}</span></div>
            <div className="flex justify-between border-t border-slate-100 pt-3">
              <span className="text-slate-500">Valor pendente</span>
              <span className={`font-semibold ${pendente > 0 ? "text-amber-700" : "text-slate-900"}`}>{formatKz(pendente)}</span>
            </div>
            <div className="flex justify-between"><span className="text-slate-500">Serviços registados</span><span className="font-medium">{servicos.length}</span></div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Histórico de serviços</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Código</th>
                <th className="px-5 py-3 font-medium">Serviço</th>
                <th className="px-5 py-3 font-medium">Data</th>
                <th className="px-5 py-3 font-medium">Valor</th>
                <th className="px-5 py-3 font-medium">Recebido</th>
                <th className="px-5 py-3 font-medium">Operacional</th>
                <th className="px-5 py-3 font-medium">Financeiro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {servicos.map((s) => (
                <tr key={s.codigo} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-5 py-3 font-medium text-slate-900">{s.codigo}</td>
                  <td className="px-5 py-3">{s.servico}</td>
                  <td className="whitespace-nowrap px-5 py-3">{formatData(s.data)}</td>
                  <td className="whitespace-nowrap px-5 py-3">{formatKz(s.valor)}</td>
                  <td className="whitespace-nowrap px-5 py-3">{formatKz(s.recebido)}</td>
                  <td className="px-5 py-3"><StatusBadge status={s.estadoOperacional} /></td>
                  <td className="px-5 py-3"><StatusBadge status={estadoFinanceiro(s.valor, s.recebido)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {servicos.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-500">Este cliente ainda não tem serviços registados.</p>
        )}
      </div>
    </>
  );
}