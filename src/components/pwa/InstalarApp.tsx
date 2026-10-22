"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type EventoInstalar = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const CHAVE = "galedos:instalar-dispensado";

function jaInstalada(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function dispensado(): boolean {
  try {
    return window.localStorage.getItem(CHAVE) === "1";
  } catch {
    return false;
  }
}

export default function InstalarApp() {
  const [evento, setEvento] = useState<EventoInstalar | null>(null);
  const [ios, setIos] = useState(false);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    if (jaInstalada() || dispensado()) return;

    const eIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (eIos) {
      setIos(true);
      setVisivel(true);
    }

    function antes(e: Event) {
      e.preventDefault();
      setEvento(e as EventoInstalar);
      setVisivel(true);
    }
    function instalada() {
      setVisivel(false);
    }
    window.addEventListener("beforeinstallprompt", antes);
    window.addEventListener("appinstalled", instalada);
    return () => {
      window.removeEventListener("beforeinstallprompt", antes);
      window.removeEventListener("appinstalled", instalada);
    };
  }, []);

  function dispensar() {
    setVisivel(false);
    try {
      window.localStorage.setItem(CHAVE, "1");
    } catch {
      /* sem armazenamento: o aviso volta na próxima visita */
    }
  }

  async function instalar() {
    if (!evento) return;
    await evento.prompt();
    const r = await evento.userChoice;
    setEvento(null);
    if (r.outcome === "accepted") setVisivel(false);
  }

  if (!visivel) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-slate-800">
      <Download className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
      <div className="flex-1">
        <p className="font-medium text-slate-900">Instale o Galedos Gestão no telemóvel</p>
        {ios && !evento ? (
          <p className="mt-1 text-slate-600">No Safari, toque em Partilhar e depois em &quot;Adicionar ao ecrã principal&quot;.</p>
        ) : (
          <p className="mt-1 text-slate-600">Abre em ecrã inteiro, como uma aplicação, e fica a um toque.</p>
        )}
        {evento && (
          <button onClick={instalar} className="mt-2 h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
            Instalar
          </button>
        )}
      </div>
      <button onClick={dispensar} aria-label="Fechar aviso" className="rounded-md p-1 text-slate-500 hover:bg-white/60">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}