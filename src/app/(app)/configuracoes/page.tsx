"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import { useEmpresa } from "@/components/configuracoes/EmpresaProvider";

const campo =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export default function ConfiguracoesPage() {
  const { empresa, guardar, carregado } = useEmpresa();
  const [f, setF] = useState(empresa);
  const [ok, setOk] = useState(false);
  const [erroEmp, setErroEmp] = useState("");

  useEffect(() => { setF(empresa); }, [empresa]);

  if (!carregado) return <p className="text-sm text-slate-500">A carregar...</p>;

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    const r = await guardar({ ...f, nome: f.nome.trim() || "Grupo Galedos" });
    if (!r.ok) { setErroEmp(r.erro ?? "Erro."); return; }
    setErroEmp("");
    setOk(true);
    setTimeout(() => setOk(false), 3000);
  }

  return (
    <>
      <PageHeader title="Configurações" description="Dados institucionais usados nos documentos emitidos." />

      <form onSubmit={submeter} noValidate className="mb-6 max-w-3xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-4 font-semibold text-slate-900">Dados da empresa</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="text-sm font-medium text-slate-700">Nome da empresa</label><input className={campo} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></div>
          <div><label className="text-sm font-medium text-slate-700">NIF</label><input className={campo} value={f.nif} onChange={(e) => setF({ ...f, nif: e.target.value })} /></div>
          <div><label className="text-sm font-medium text-slate-700">Telefone</label><input className={campo} value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="text-sm font-medium text-slate-700">Morada</label><input className={campo} value={f.morada} onChange={(e) => setF({ ...f, morada: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="text-sm font-medium text-slate-700">Correio electrónico</label><input className={campo} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="text-sm font-medium text-slate-700">Condições (orçamentos e ordens de serviço)</label><textarea className={campo} rows={3} value={f.condicoes} onChange={(e) => setF({ ...f, condicoes: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="text-sm font-medium text-slate-700">Rodapé dos documentos</label><input className={campo} value={f.rodape} onChange={(e) => setF({ ...f, rodape: e.target.value })} /></div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
          {ok && <span className="text-sm text-emerald-700">Guardado.</span>}
          {erroEmp && <span className="text-sm text-red-600">{erroEmp}</span>}
          <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Guardar</button>
        </div>
      </form>

      <div className="max-w-3xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-slate-900">Outras configurações</h2>
        <ul className="space-y-2 text-sm">
          <li><Link href="/remuneracoes" className="font-medium text-brand-700 hover:underline">Percentagens e regras de remuneração</Link></li>
          <li><Link href="/servicos/catalogo" className="font-medium text-brand-700 hover:underline">Catálogo de serviços e preços de referência</Link></li>
          <li><Link href="/financas" className="font-medium text-brand-700 hover:underline">Categorias de despesas (ao criar uma despesa)</Link></li>
        </ul>
        <p className="mt-4 rounded-lg bg-slate-100 p-3 text-xs text-slate-600">
          A gestão de utilizadores, perfis e permissões será feita com o backend (autenticação real e regras de acesso na base de dados).
        </p>
      </div>
    </>
  );
}