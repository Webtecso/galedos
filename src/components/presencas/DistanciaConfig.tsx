"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { traduzirErro } from "@/lib/erros";

const campo =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export default function DistanciaConfig() {
  const [valor, setValor] = useState("500");
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let activo = true;
    (async () => {
      const { data } = await getSupabase().from("config_presenca").select("distancia_max_m").eq("id", 1).maybeSingle();
      if (activo && data) setValor(String((data as unknown as { distancia_max_m: number }).distancia_max_m));
    })();
    return () => {
      activo = false;
    };
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (ocupado) return;
    setOcupado(true);
    setMsg(null);
    try {
      const { error } = await getSupabase().rpc("alterar_distancia_max", { p_metros: Math.round(Number(valor)) });
      setMsg(error ? { tipo: "erro", texto: traduzirErro(error) } : { tipo: "ok", texto: "Distância guardada." });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={guardar} noValidate className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-1 font-semibold text-slate-900">Distância ao local do cliente</h2>
      <p className="mb-4 text-xs text-slate-500">
        Acima desta distância (em metros), o início do serviço é assinalado como "longe do local". Não bloqueia o colaborador. Só funciona nos clientes com coordenadas guardadas.
      </p>
      <label className="text-sm font-medium text-slate-700">Distância máxima (50 a 5000 m)</label>
      <input className={campo} inputMode="numeric" value={valor} onChange={(e) => setValor(e.target.value)} />
      {msg && <p className={`mt-2 text-sm ${msg.tipo === "ok" ? "text-emerald-700" : "text-red-600"}`}>{msg.texto}</p>}
      <div className="mt-4 flex justify-end">
        <button type="submit" disabled={ocupado} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:bg-slate-300">Guardar</button>
      </div>
    </form>
  );
}