"use client";

import { useState } from "react";
import Link from "next/link";
import type { ColaboradorCompleto } from "@/lib/types";
import type { ColaboradorDados } from "./ColaboradoresProvider";

const vazio: ColaboradorDados = {
  nome: "", funcao: "Técnico de limpeza", telefone: "", dataInicio: "",
  modalidade: "Prestação de serviços", contrato: "", percentagem: 0, estado: "Activo", observacoes: "",
};

function extrair(c: ColaboradorCompleto): ColaboradorDados {
  return {
    nome: c.nome, funcao: c.funcao, telefone: c.telefone, dataInicio: c.dataInicio,
    modalidade: c.modalidade, contrato: c.contrato, percentagem: c.percentagem,
    estado: c.estado, observacoes: c.observacoes,
  };
}

const campo =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export default function ColaboradorForm({
  inicial, onSubmit, textoBotao, cancelarHref,
}: {
  inicial?: ColaboradorCompleto;
  onSubmit: (dados: ColaboradorDados) => void;
  textoBotao: string;
  cancelarHref: string;
}) {
  const [d, setD] = useState<ColaboradorDados>(inicial ? extrair(inicial) : vazio);
  const [pct, setPct] = useState(inicial ? String(inicial.percentagem) : "0");
  const [erros, setErros] = useState<Record<string, string>>({});

  function mudar<K extends keyof ColaboradorDados>(k: K, v: ColaboradorDados[K]) {
    setD((x) => ({ ...x, [k]: v }));
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const n: Record<string, string> = {};
    const p = Number(pct.replace(",", "."));
    if (!d.nome.trim()) n.nome = "Indique o nome do colaborador.";
    if (!d.funcao.trim()) n.funcao = "Indique a função.";
    if (d.telefone.replace(/\D/g, "").length < 9) n.telefone = "Indique um telefone válido (mínimo 9 dígitos).";
    if (Number.isNaN(p) || p < 0 || p > 100) n.percentagem = "A percentagem deve estar entre 0 e 100.";
    setErros(n);
    if (Object.keys(n).length > 0) return;
    onSubmit({
      ...d, nome: d.nome.trim(), funcao: d.funcao.trim(), telefone: d.telefone.trim(),
      contrato: d.contrato.trim(), observacoes: d.observacoes.trim(), percentagem: p,
    });
  }

  return (
    <form onSubmit={enviar} noValidate className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-sm font-medium text-slate-700">Nome completo *</label>
          <input className={campo} value={d.nome} onChange={(e) => mudar("nome", e.target.value)} />
          {erros.nome && <p className="mt-1 text-xs text-red-600">{erros.nome}</p>}
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Função *</label>
          <input className={campo} value={d.funcao} onChange={(e) => mudar("funcao", e.target.value)} />
          {erros.funcao && <p className="mt-1 text-xs text-red-600">{erros.funcao}</p>}
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Telefone *</label>
          <input className={campo} value={d.telefone} onChange={(e) => mudar("telefone", e.target.value)} />
          {erros.telefone && <p className="mt-1 text-xs text-red-600">{erros.telefone}</p>}
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Data de início</label>
          <input type="date" className={campo} value={d.dataInicio} onChange={(e) => mudar("dataInicio", e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Estado</label>
          <select className={campo} value={d.estado} onChange={(e) => mudar("estado", e.target.value as ColaboradorDados["estado"])}>
            <option value="Activo">Activo</option>
            <option value="Inactivo">Inactivo</option>
            <option value="Suspenso">Suspenso</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Modalidade contratual</label>
          <select className={campo} value={d.modalidade} onChange={(e) => mudar("modalidade", e.target.value as ColaboradorDados["modalidade"])}>
            <option value="Contrato de trabalho">Contrato de trabalho</option>
            <option value="Prestação de serviços">Prestação de serviços</option>
            <option value="Colaboração ocasional">Colaboração ocasional</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Referência do contrato</label>
          <input className={campo} value={d.contrato} onChange={(e) => mudar("contrato", e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="text-sm font-medium text-slate-700">Percentagem individual (%)</label>
          <input className={campo} inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} />
          <p className="mt-1 text-xs text-slate-500">Só é usada quando a modalidade de distribuição é "Percentagens individuais" (ver Remunerações).</p>
          {erros.percentagem && <p className="mt-1 text-xs text-red-600">{erros.percentagem}</p>}
        </div>
        <div className="sm:col-span-2">
          <label className="text-sm font-medium text-slate-700">Observações</label>
          <textarea className={campo} rows={3} value={d.observacoes} onChange={(e) => mudar("observacoes", e.target.value)} />
        </div>
      </div>
      <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
        <Link href={cancelarHref} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancelar</Link>
        <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">{textoBotao}</button>
      </div>
    </form>
  );
}