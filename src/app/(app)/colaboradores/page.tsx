"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import EstadoColabBadge from "@/components/colaboradores/EstadoColabBadge";
import { useColaboradores } from "@/components/colaboradores/ColaboradoresProvider";
import { useServicos } from "@/components/servicos/ServicosProvider";
import { normalizar } from "@/lib/format";

const seletor =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export default function ColaboradoresPage() {
  const { colaboradores, carregado } = useColaboradores();
  const { servicos } = useServicos();
  const [pesquisa, setPesquisa] = useState("");
  const [estado, setEstado] = useState("todos");

  const filtrados = useMemo(() => {
    const q = normalizar(pesquisa.trim());
    return colaboradores.filter((c) => {
      if (estado !== "todos" && c.estado !== estado) return false;
      if (!q) return true;
      return normalizar(c.nome).includes(q) || normalizar(c.codigo).includes(q) || normalizar(c.funcao).includes(q);
    });
  }, [colaboradores, pesquisa, estado]);

  return (
    <>
      <PageHeader
        title="Colaboradores"
        description="Cadastro, estado e histórico dos colaboradores."
        action={
          <Link href="/colaboradores/novo" className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" /> Novo colaborador
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={pesquisa} onChange={(e) => setPesquisa(e.target.value)} placeholder="Pesquisar por nome, código ou função"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
        </div>
        <select className={seletor} value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="todos">Todos os estados</option>
          <option value="Activo">Activo</option>
          <option value="Inactivo">Inactivo</option>
          <option value="Suspenso">Suspenso</option>
        </select>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Código</th>
                <th className="px-5 py-3 font-medium">Nome</th>
                <th className="px-5 py-3 font-medium">Função</th>
                <th className="px-5 py-3 font-medium">Modalidade</th>
                <th className="px-5 py-3 font-medium">Serviços concluídos</th>
                <th className="px-5 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtrados.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-5 py-3 font-medium text-slate-900">{c.codigo}</td>
                  <td className="px-5 py-3"><Link href={`/colaboradores/${c.id}`} className="font-medium text-brand-700 hover:underline">{c.nome}</Link></td>
                  <td className="px-5 py-3">{c.funcao}</td>
                  <td className="px-5 py-3">{c.modalidade}</td>
                  <td className="px-5 py-3">{servicos.filter((s) => s.estadoOperacional === "Concluído" && s.colaboradorIds.includes(c.id)).length}</td>
                  <td className="px-5 py-3"><EstadoColabBadge estado={c.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {carregado && filtrados.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Nenhum colaborador encontrado.</p>}
        <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">{filtrados.length} de {colaboradores.length} colaboradores</div>
      </div>
    </>
  );
}