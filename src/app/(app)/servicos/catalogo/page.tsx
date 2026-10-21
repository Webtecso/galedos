"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { useServicos, type Resultado } from "@/components/servicos/ServicosProvider";
import { formatDuracao } from "@/lib/servicos";
import { formatKz } from "@/lib/format";

const campo =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

type F = { nome: string; descricao: string; unidade: string; preco: string; duracao: string };
const vazio: F = { nome: "", descricao: "", unidade: "unidade", preco: "", duracao: "60" };

export default function CatalogoPage() {
  const { catalogo, adicionarCatalogo, actualizarCatalogo, alternarCatalogo } = useServicos();
  const [aberto, setAberto] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [f, setF] = useState<F>(vazio);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const aGuardar = useRef(false);

  function novo() {
    setEditId(null);
    setF(vazio);
    setErro("");
    setAviso("");
    setAberto(true);
  }

  function editar(id: string) {
    const c = catalogo.find((x) => x.id === id);
    if (!c) return;
    setEditId(id);
    setF({ nome: c.nome, descricao: c.descricao, unidade: c.unidade, preco: String(c.preco), duracao: String(c.duracaoMin) });
    setErro("");
    setAviso("");
    setAberto(true);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (aGuardar.current) return;
    const preco = Number(f.preco.replace(",", "."));
    const duracao = Math.round(Number(f.duracao));
    if (!f.nome.trim()) return setErro("Indique o nome do serviço.");
    if (f.preco.trim() === "" || Number.isNaN(preco) || preco < 0) return setErro("Indique um preço de referência válido.");
    if (!(duracao > 0)) return setErro("Indique a duração estimada em minutos.");
    const dados = {
      nome: f.nome.trim(), descricao: f.descricao.trim(), unidade: f.unidade.trim() || "unidade",
      preco, duracaoMin: duracao, activo: true,
    };
    aGuardar.current = true;
    let r: Resultado;
    if (editId) {
      const actual = catalogo.find((x) => x.id === editId);
      r = await actualizarCatalogo(editId, { ...dados, activo: actual ? actual.activo : true });
    } else {
      r = await adicionarCatalogo(dados);
    }
    aGuardar.current = false;
    if (!r.ok) return setErro(r.erro ?? "Erro.");
    setAberto(false);
    setEditId(null);
    setF(vazio);
    setErro("");
  }

  async function alternar(id: string) {
    setAviso("");
    const r = await alternarCatalogo(id);
    if (!r.ok) setAviso(r.erro ?? "Erro.");
  }

  return (
    <>
      <Link href="/servicos" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Serviços
      </Link>

      <PageHeader
        title="Catálogo de serviços"
        description="Os preços de referência não alteram ordens de serviço já criadas. Só a administração edita o catálogo."
        action={
          <button onClick={novo} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" /> Novo serviço
          </button>
        }
      />

      {aviso && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{aviso}</p>}

      {aberto && (
        <form onSubmit={guardar} noValidate className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-900">{editId ? "Editar serviço" : "Novo serviço"}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Nome *</label>
              <input className={campo} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Descrição</label>
              <input className={campo} value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Unidade de cobrança</label>
              <input className={campo} value={f.unidade} onChange={(e) => setF({ ...f, unidade: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Preço de referência (Kz) *</label>
              <input className={campo} inputMode="decimal" value={f.preco} onChange={(e) => setF({ ...f, preco: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Duração estimada (min) *</label>
              <input className={campo} inputMode="numeric" value={f.duracao} onChange={(e) => setF({ ...f, duracao: e.target.value })} />
            </div>
          </div>
          {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}
          <div className="mt-4 flex justify-end gap-3">
            <button type="button" onClick={() => setAberto(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancelar</button>
            <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Guardar</button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Código</th>
                <th className="px-5 py-3 font-medium">Nome</th>
                <th className="px-5 py-3 font-medium">Unidade</th>
                <th className="px-5 py-3 font-medium">Preço de referência</th>
                <th className="px-5 py-3 font-medium">Duração</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Acções</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {catalogo.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-5 py-3 font-medium text-slate-900">{c.codigo}</td>
                  <td className="px-5 py-3">
                    {c.nome}
                    {c.descricao && <p className="text-xs text-slate-500">{c.descricao}</p>}
                  </td>
                  <td className="px-5 py-3">{c.unidade}</td>
                  <td className="whitespace-nowrap px-5 py-3">{formatKz(c.preco)}</td>
                  <td className="whitespace-nowrap px-5 py-3">{formatDuracao(c.duracaoMin)}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${c.activo ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>
                      {c.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3">
                    <button onClick={() => editar(c.id)} className="mr-3 text-sm font-medium text-brand-700 hover:underline">Editar</button>
                    <button onClick={() => alternar(c.id)} className="text-sm font-medium text-slate-600 hover:underline">
                      {c.activo ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {catalogo.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Catálogo vazio.</p>}
      </div>
    </>
  );
}