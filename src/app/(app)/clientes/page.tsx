"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import EstadoClienteBadge from "@/components/clientes/EstadoClienteBadge";
import { useClientes } from "@/components/clientes/ClientesProvider";
import { formatData, normalizar } from "@/lib/format";

const seletor =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export default function ClientesPage() {
  const { clientes, carregado } = useClientes();
  const [pesquisa, setPesquisa] = useState(() => (typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("q") ?? ""));
  useEffect(() => {
    const f = (e: Event) => setPesquisa((e as CustomEvent<string>).detail);
    window.addEventListener("galedos:pesquisa", f);
    return () => window.removeEventListener("galedos:pesquisa", f);
  }, []);
  const [tipo, setTipo] = useState("todos");
  const [estado, setEstado] = useState("todos");

  const filtrados = useMemo(() => {
    const q = normalizar(pesquisa.trim());
    const qDigitos = pesquisa.replace(/\D/g, "");
    return clientes.filter((c) => {
      if (tipo !== "todos" && c.tipo !== tipo) return false;
      if (estado !== "todos" && c.estado !== estado) return false;
      if (!q) return true;
      return (
        normalizar(c.nome).includes(q) ||
        normalizar(c.codigo).includes(q) ||
        (qDigitos.length > 0 && c.telefone.replace(/\D/g, "").includes(qDigitos))
      );
    });
  }, [clientes, pesquisa, tipo, estado]);

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Base de dados e histórico dos clientes."
        action={
          <Link href="/clientes/novo" className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" /> Novo cliente
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={pesquisa}
            onChange={(e) => setPesquisa(e.target.value)}
            placeholder="Pesquisar por nome, telefone ou código"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <select className={seletor} value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="todos">Todos os tipos</option>
          <option value="Particular">Particular</option>
          <option value="Empresa">Empresa</option>
        </select>
        <select className={seletor} value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="todos">Todos os estados</option>
          <option value="Activo">Activo</option>
          <option value="Inactivo">Inactivo</option>
        </select>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Código</th>
                <th className="px-5 py-3 font-medium">Nome</th>
                <th className="px-5 py-3 font-medium">Tipo</th>
                <th className="px-5 py-3 font-medium">Telefone</th>
                <th className="px-5 py-3 font-medium">Localização</th>
                <th className="px-5 py-3 font-medium">Registo</th>
                <th className="px-5 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtrados.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-5 py-3 font-medium text-slate-900">{c.codigo}</td>
                  <td className="px-5 py-3">
                    <Link href={`/clientes/${c.id}`} className="font-medium text-brand-700 hover:underline">
                      {c.nome}
                    </Link>
                  </td>
                  <td className="px-5 py-3">{c.tipo}</td>
                  <td className="whitespace-nowrap px-5 py-3">{c.telefone}</td>
                  <td className="px-5 py-3">{c.localizacao || "—"}</td>
                  <td className="whitespace-nowrap px-5 py-3">{formatData(c.dataRegisto)}</td>
                  <td className="px-5 py-3"><EstadoClienteBadge estado={c.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {carregado && filtrados.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-500">Nenhum cliente encontrado.</p>
        )}
        <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
          {filtrados.length} de {clientes.length} clientes
        </div>
      </div>
    </>
  );
}