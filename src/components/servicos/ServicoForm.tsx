"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Servico } from "@/lib/types";
import { useClientes } from "@/components/clientes/ClientesProvider";
import { useServicos, type ServicoDados } from "./ServicosProvider";
import { calcularTotal, detectarConflitos, formatDuracao, totalRecebido } from "@/lib/servicos";
import { formatData, formatKz } from "@/lib/format";

type Form = {
  clienteId: string;
  catalogoId: string;
  tipoServico: string;
  descricao: string;
  quantidade: string;
  precoUnitario: string;
  desconto: string;
  data: string;
  hora: string;
  duracao: string;
  local: string;
  colaboradorIds: string[];
  estadoInicial: "Pedido recebido" | "Agendado";
  observacoes: string;
  excepcao: boolean;
};

function inicializar(s?: Servico): Form {
  if (!s) {
    return {
      clienteId: "", catalogoId: "", tipoServico: "", descricao: "", quantidade: "1",
      precoUnitario: "", desconto: "0", data: "", hora: "", duracao: "60", local: "",
      colaboradorIds: [], estadoInicial: "Pedido recebido", observacoes: "", excepcao: false,
    };
  }
  return {
    clienteId: s.clienteId, catalogoId: s.catalogoId, tipoServico: s.tipoServico, descricao: s.descricao,
    quantidade: String(s.quantidade), precoUnitario: String(s.precoUnitario), desconto: String(s.desconto),
    data: s.data, hora: s.hora, duracao: String(s.duracaoMin), local: s.local,
    colaboradorIds: s.colaboradorIds, estadoInicial: "Pedido recebido", observacoes: s.observacoes,
    excepcao: s.excepcaoConflito,
  };
}

const num = (v: string) => Number(v.replace(",", "."));

const campo =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export default function ServicoForm({
  inicial,
  onSubmit,
  textoBotao,
  cancelarHref,
}: {
  inicial?: Servico;
  onSubmit: (dados: ServicoDados) => void;
  textoBotao: string;
  cancelarHref: string;
}) {
  const { clientes } = useClientes();
  const { catalogo, colaboradores, servicos } = useServicos();
  const [f, setF] = useState<Form>(inicializar(inicial));
  const [erros, setErros] = useState<Record<string, string>>({});

  function mudar<K extends keyof Form>(chave: K, valor: Form[K]) {
    setF((d) => ({ ...d, [chave]: valor }));
  }

  function escolherCliente(id: string) {
    const c = clientes.find((x) => x.id === id);
    setF((d) => ({ ...d, clienteId: id, local: d.local || (c ? c.endereco : "") }));
  }

  function escolherCatalogo(id: string) {
    if (!id) {
      setF((d) => ({ ...d, catalogoId: "" }));
      return;
    }
    const c = catalogo.find((x) => x.id === id);
    if (!c) return;
    setF((d) => ({
      ...d, catalogoId: id, tipoServico: c.nome,
      precoUnitario: String(c.preco), duracao: String(c.duracaoMin),
    }));
  }

  function alternarColab(id: string) {
    setF((d) => ({
      ...d,
      colaboradorIds: d.colaboradorIds.includes(id)
        ? d.colaboradorIds.filter((x) => x !== id)
        : [...d.colaboradorIds, id],
    }));
  }

  const total = calcularTotal(num(f.quantidade), num(f.precoUnitario), num(f.desconto));
  const duracaoMin = Math.round(num(f.duracao));

  const conflitos = useMemo(() => {
    if (!f.data || !f.hora || f.colaboradorIds.length === 0 || !(duracaoMin > 0)) return [];
    return detectarConflitos(
      { id: inicial?.id, data: f.data, hora: f.hora, duracaoMin, colaboradorIds: f.colaboradorIds },
      servicos
    );
  }, [f.data, f.hora, f.colaboradorIds, duracaoMin, servicos, inicial?.id]);

  const estadoFinal = inicial ? inicial.estadoOperacional : f.estadoInicial;
  const exigeAgenda = estadoFinal === "Agendado" || estadoFinal === "Em execução";

  function nomesEquipa(ids: string[]) {
    return ids.map((id) => colaboradores.find((c) => c.id === id)?.nome ?? id).join(", ");
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const n: Record<string, string> = {};
    const qtd = num(f.quantidade);
    const preco = num(f.precoUnitario);
    const desc = num(f.desconto);

    if (!f.clienteId) n.clienteId = "Seleccione o cliente.";
    if (!f.tipoServico.trim()) n.tipoServico = "Indique o tipo de serviço.";
    if (!(qtd > 0)) n.quantidade = "A quantidade deve ser superior a zero.";
    if (f.precoUnitario.trim() === "" || Number.isNaN(preco) || preco < 0) n.precoUnitario = "Indique um preço válido.";
    if (Number.isNaN(desc) || desc < 0) n.desconto = "Desconto inválido.";
    else if (qtd > 0 && preco >= 0 && desc > qtd * preco) n.desconto = "O desconto não pode ser superior ao valor bruto.";
    if (!(duracaoMin > 0)) n.duracao = "Indique a duração estimada em minutos.";
    if ((f.data && !f.hora) || (!f.data && f.hora)) n.data = "Indique a data e a hora em conjunto.";
    if (exigeAgenda && (!f.data || !f.hora)) n.data = "Indique a data e a hora do serviço.";
    if (exigeAgenda && f.colaboradorIds.length === 0) n.equipa = "Atribua pelo menos um colaborador.";
    if (inicial && total < totalRecebido(inicial))
      n.precoUnitario = `O total não pode ficar abaixo do valor já recebido (${formatKz(totalRecebido(inicial))}).`;
    if (conflitos.length > 0 && !f.excepcao) n.excepcao = "Existe conflito de horário. Altere a equipa/horário ou autorize a excepção.";

    setErros(n);
    if (Object.keys(n).length > 0) return;

    onSubmit({
      clienteId: f.clienteId,
      catalogoId: f.catalogoId,
      tipoServico: f.tipoServico.trim(),
      descricao: f.descricao.trim(),
      quantidade: qtd,
      precoUnitario: preco,
      desconto: desc,
      total,
      data: f.data,
      hora: f.hora,
      duracaoMin,
      local: f.local.trim(),
      colaboradorIds: f.colaboradorIds,
      estadoOperacional: estadoFinal,
      observacoes: f.observacoes.trim(),
      excepcaoConflito: conflitos.length > 0 && f.excepcao,
    });
  }

  const clientesOpcoes = clientes.filter((c) => c.estado === "Activo" || c.id === f.clienteId);
  const catalogoOpcoes = catalogo.filter((c) => c.activo || c.id === f.catalogoId);
  const colabsOpcoes = colaboradores.filter((c) => c.activo || f.colaboradorIds.includes(c.id));

  return (
    <form onSubmit={enviar} noValidate className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-4 font-semibold text-slate-900">Serviço</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-700">Cliente *</label>
            <select className={campo} value={f.clienteId} onChange={(e) => escolherCliente(e.target.value)}>
              <option value="">Seleccione um cliente</option>
              {clientesOpcoes.map((c) => (
                <option key={c.id} value={c.id}>{c.codigo} · {c.nome}</option>
              ))}
            </select>
            {erros.clienteId && <p className="mt-1 text-xs text-red-600">{erros.clienteId}</p>}
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Serviço do catálogo</label>
            <select className={campo} value={f.catalogoId} onChange={(e) => escolherCatalogo(e.target.value)}>
              <option value="">Serviço personalizado</option>
              {catalogoOpcoes.map((c) => (
                <option key={c.id} value={c.id}>{c.nome} ({formatKz(c.preco)})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Tipo de serviço *</label>
            <input className={campo} value={f.tipoServico} onChange={(e) => mudar("tipoServico", e.target.value)} />
            {erros.tipoServico && <p className="mt-1 text-xs text-red-600">{erros.tipoServico}</p>}
          </div>

          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-700">Descrição detalhada</label>
            <textarea className={campo} rows={3} value={f.descricao} onChange={(e) => mudar("descricao", e.target.value)} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-4 font-semibold text-slate-900">Preço</h2>
        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <label className="text-sm font-medium text-slate-700">Quantidade de peças *</label>
            <input className={campo} inputMode="decimal" value={f.quantidade} onChange={(e) => mudar("quantidade", e.target.value)} />
            {erros.quantidade && <p className="mt-1 text-xs text-red-600">{erros.quantidade}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Preço unitário (Kz) *</label>
            <input className={campo} inputMode="decimal" value={f.precoUnitario} onChange={(e) => mudar("precoUnitario", e.target.value)} />
            {erros.precoUnitario && <p className="mt-1 text-xs text-red-600">{erros.precoUnitario}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Desconto (Kz)</label>
            <input className={campo} inputMode="decimal" value={f.desconto} onChange={(e) => mudar("desconto", e.target.value)} />
            {erros.desconto && <p className="mt-1 text-xs text-red-600">{erros.desconto}</p>}
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
          <span className="text-sm text-slate-500">Valor total</span>
          <span className="text-lg font-semibold text-slate-900">{formatKz(total)}</span>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-4 font-semibold text-slate-900">Agendamento e equipa</h2>
        <div className="grid gap-5 sm:grid-cols-3">
          {!inicial && (
            <div className="sm:col-span-3">
              <label className="text-sm font-medium text-slate-700">Estado inicial</label>
              <select className={campo} value={f.estadoInicial} onChange={(e) => mudar("estadoInicial", e.target.value as Form["estadoInicial"])}>
                <option value="Pedido recebido">Pedido recebido (ainda sem agendamento)</option>
                <option value="Agendado">Agendado (exige data, hora e equipa)</option>
              </select>
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-slate-700">Data</label>
            <input type="date" className={campo} value={f.data} onChange={(e) => mudar("data", e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Hora</label>
            <input type="time" className={campo} value={f.hora} onChange={(e) => mudar("hora", e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Duração estimada (min) *</label>
            <input className={campo} inputMode="numeric" value={f.duracao} onChange={(e) => mudar("duracao", e.target.value)} />
            {duracaoMin > 0 && <p className="mt-1 text-xs text-slate-500">{formatDuracao(duracaoMin)}</p>}
            {erros.duracao && <p className="mt-1 text-xs text-red-600">{erros.duracao}</p>}
          </div>
          {erros.data && <p className="text-xs text-red-600 sm:col-span-3">{erros.data}</p>}

          <div className="sm:col-span-3">
            <label className="text-sm font-medium text-slate-700">Local de execução</label>
            <input className={campo} value={f.local} onChange={(e) => mudar("local", e.target.value)} />
          </div>

          <div className="sm:col-span-3">
            <p className="text-sm font-medium text-slate-700">Colaboradores atribuídos</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {colabsOpcoes.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
                  <input type="checkbox" checked={f.colaboradorIds.includes(c.id)} onChange={() => alternarColab(c.id)} className="h-4 w-4" />
                  <span>{c.nome} <span className="text-xs text-slate-500">· {c.funcao}</span></span>
                </label>
              ))}
            </div>
            {erros.equipa && <p className="mt-1 text-xs text-red-600">{erros.equipa}</p>}
          </div>

          {conflitos.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 sm:col-span-3">
              <p className="font-semibold">Conflito de horário</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {conflitos.map((c) => (
                  <li key={c.id}>
                    {c.codigo} · {formatData(c.data)} às {c.hora} ({formatDuracao(c.duracaoMin)}) · {nomesEquipa(c.colaboradorIds)}
                  </li>
                ))}
              </ul>
              <label className="mt-3 flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={f.excepcao} onChange={(e) => mudar("excepcao", e.target.checked)} className="h-4 w-4" />
                Autorizo esta excepção (ficará registada no histórico)
              </label>
              {erros.excepcao && <p className="mt-2 text-xs text-red-700">{erros.excepcao}</p>}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <label className="text-sm font-medium text-slate-700">Observações</label>
        <textarea className={campo} rows={3} value={f.observacoes} onChange={(e) => mudar("observacoes", e.target.value)} />
      </section>

      <div className="flex flex-wrap justify-end gap-3">
        <Link href={cancelarHref} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Cancelar
        </Link>
        <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          {textoBotao}
        </button>
      </div>
    </form>
  );
}