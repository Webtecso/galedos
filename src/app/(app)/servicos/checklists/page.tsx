"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Etiqueta from "@/components/ui/Etiqueta";
import { useAuth } from "@/components/auth/AuthProvider";
import { useServicos } from "@/components/servicos/ServicosProvider";
import { getSupabase } from "@/lib/supabase/client";
import { traduzirErro } from "@/lib/erros";

type Item = { id: string; catalogo_id: string; texto: string; ordem: number; activo: boolean };
type Msg = { tipo: "ok" | "erro"; texto: string } | null;

const campo =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export default function ChecklistsPage() {
  const { perfil } = useAuth();
  const { catalogo, carregado } = useServicos();
  const [itens, setItens] = useState<Item[]>([]);
  const [pronto, setPronto] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [ocupado, setOcupado] = useState(false);
  const [novo, setNovo] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    const { data, error } = await getSupabase().from("checklist_itens").select("*").order("ordem");
    if (error) setMsg({ tipo: "erro", texto: traduzirErro(error) });
    else setItens((data ?? []) as unknown as Item[]);
    setPronto(true);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function chamar(fn: string, args: Record<string, unknown>, ok: string): Promise<boolean> {
    if (ocupado) return false;
    setOcupado(true);
    setMsg(null);
    try {
      const { error } = await getSupabase().rpc(fn, args);
      if (error) {
        setMsg({ tipo: "erro", texto: traduzirErro(error) });
        return false;
      }
      setMsg({ tipo: "ok", texto: ok });
      await carregar();
      return true;
    } finally {
      setOcupado(false);
    }
  }

  async function adicionar(catalogoId: string) {
    const ok = await chamar("adicionar_item_checklist", { p_catalogo: catalogoId, p_texto: novo[catalogoId] ?? "" }, "Item adicionado.");
    if (ok) setNovo({ ...novo, [catalogoId]: "" });
  }

  if (perfil.perfil !== "administrador") return <p className="text-sm text-slate-500">Sem permissão.</p>;
  if (!carregado || !pronto) return <p className="text-sm text-slate-500">A carregar...</p>;

  return (
    <>
      <Link href="/servicos/catalogo" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Catálogo de serviços
      </Link>
      <PageHeader
        title="Listas de verificação"
        description="Os passos que o colaborador confirma no telemóvel durante cada tipo de serviço. Os itens nunca se apagam: desactivam-se, e os registos antigos mantêm o texto."
      />

      {msg && (
        <div className={`mb-4 rounded-lg border p-3 text-sm ${msg.tipo === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{msg.texto}</div>
      )}

      <div className="space-y-4">
        {catalogo.map((c) => {
          const meus = itens.filter((i) => i.catalogo_id === c.id).sort((a, b) => a.ordem - b.ordem);
          return (
            <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-900">{c.codigo} · {c.nome}</h2>
              <ul className="mt-3 divide-y divide-slate-100">
                {meus.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className={i.activo ? "text-slate-800" : "text-slate-400 line-through"}>{i.ordem}. {i.texto}</span>
                    <span className="flex items-center gap-3">
                      <Etiqueta texto={i.activo ? "Activo" : "Inactivo"} tom={i.activo ? "verde" : "cinza"} />
                      <button disabled={ocupado} onClick={() => chamar("alternar_item_checklist", { p_id: i.id }, i.activo ? "Item desactivado." : "Item activado.")}
                        className="text-xs font-medium text-slate-600 hover:underline">{i.activo ? "Desactivar" : "Activar"}</button>
                    </span>
                  </li>
                ))}
                {meus.length === 0 && <li className="py-2 text-sm text-slate-500">Sem itens. O colaborador não verá lista neste serviço.</li>}
              </ul>
              <div className="mt-3 flex gap-2">
                <input className={campo} placeholder="Novo item" value={novo[c.id] ?? ""} onChange={(e) => setNovo({ ...novo, [c.id]: e.target.value })} />
                <button disabled={ocupado || !(novo[c.id] ?? "").trim()} onClick={() => adicionar(c.id)}
                  className="mt-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:bg-slate-300">Adicionar</button>
              </div>
            </div>
          );
        })}
        {catalogo.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Catálogo vazio.</p>}
      </div>
    </>
  );
}