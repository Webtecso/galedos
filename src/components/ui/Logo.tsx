"use client";

import { useEffect, useState } from "react";

export default function Logo({ altura = 40, mostrarTexto = true }: { altura?: number; mostrarTexto?: boolean }) {
  const [estado, setEstado] = useState<"a-testar" | "ok" | "falhou">("a-testar");

  useEffect(() => {
    const img = new Image();
    img.onload = () => setEstado("ok");
    img.onerror = () => setEstado("falhou");
    img.src = "/logo.png";
  }, []);

  if (estado === "ok") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src="/logo.png" alt="Grupo Galedos" style={{ height: altura, width: "auto" }} />
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div
        className="flex items-center justify-center rounded-lg bg-linear-to-br from-brand-200 to-brand-600 font-bold text-navy-900"
        style={{ height: altura, width: altura, fontSize: altura * 0.55 }}
      >
        G
      </div>
      {mostrarTexto && (
        <div className="leading-tight">
          <p className="text-sm font-bold tracking-wide text-white">
            GALEDOS<span className="ml-1 text-[10px] font-semibold text-brand-200">LDA.</span>
          </p>
          <p className="text-[10px] text-slate-400">Criamos caminhos, construímos futuro.</p>
        </div>
      )}
    </div>
  );
}