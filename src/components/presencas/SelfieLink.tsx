"use client";

import { useState } from "react";
import Etiqueta from "@/components/ui/Etiqueta";
import { getSupabase } from "@/lib/supabase/client";

export default function SelfieLink({ caminho }: { caminho: string | null }) {
  const [url, setUrl] = useState("");
  const [a, setA] = useState(false);

  if (!caminho) return <Etiqueta texto="Sem selfie" tom="cinza" />;

  async function ver() {
    setA(true);
    const r = await getSupabase().storage.from("selfies-presenca").createSignedUrl(caminho as string, 600);
    if (r.data?.signedUrl) setUrl(r.data.signedUrl);
    setA(false);
  }

  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Selfie de entrada" className="h-14 w-14 rounded-lg border border-slate-200 object-cover" />
      </a>
    );
  }
  return (
    <button onClick={ver} disabled={a} className="text-sm font-medium text-brand-700 hover:underline disabled:text-slate-400">
      {a ? "..." : "Ver"}
    </button>
  );
}