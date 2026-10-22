"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";

const CHAVE = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

type Estado = "a-verificar" | "indisponivel" | "pedir" | "activo" | "negado" | "ios-instalar";

function paraUint8(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const bruto = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const saida = new Uint8Array(new ArrayBuffer(bruto.length));
  for (let i = 0; i < bruto.length; i++) saida[i] = bruto.charCodeAt(i);
  return saida;
}

export default function AtivarNotificacoes() {
  const [estado, setEstado] = useState<Estado>("a-verificar");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  const subscrever = useCallback(async (): Promise<boolean> => {
    try {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
      ]);
      if (!reg) return false;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: paraUint8(CHAVE) });
      const j = sub.toJSON();
      const p256dh = j.keys?.p256dh;
      const auth = j.keys?.auth;
      if (!j.endpoint || !p256dh || !auth) return false;
      const { error } = await getSupabase().rpc("guardar_subscricao", { p_endpoint: j.endpoint, p_p256dh: p256dh, p_auth: auth });
      return !error;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let activo = true;
    (async () => {
      const definir = (e: Estado) => { if (activo) setEstado(e); };
      if (!CHAVE) return definir("indisponivel");
      const eIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const nav = navigator as Navigator & { standalone?: boolean };
      const instalada = window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return definir(eIos && !instalada ? "ios-instalar" : "indisponivel");
      }
      if (Notification.permission === "denied") return definir("negado");
      if (Notification.permission === "granted") {
        const ok = await subscrever();
        return definir(ok ? "activo" : "pedir");
      }
      definir("pedir");
    })();
    return () => {
      activo = false;
    };
  }, [subscrever]);

  async function activar() {
    setOcupado(true);
    setErro("");
    try {
      const p = await Notification.requestPermission();
      if (p !== "granted") {
        setEstado(p === "denied" ? "negado" : "pedir");
        return;
      }
      const ok = await subscrever();
      if (ok) setEstado("activo");
      else setErro("Não foi possível activar agora. Tente de novo mais tarde.");
    } finally {
      setOcupado(false);
    }
  }

  if (estado === "pedir") {
    return (
      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="flex items-center gap-2 text-sm font-medium text-slate-900"><BellRing className="h-4 w-4 text-brand-700" /> Receber avisos no telemóvel</p>
        <p className="mt-1 text-xs text-slate-500">Receba os avisos da administração mesmo com a aplicação fechada.</p>
        {erro && <p className="mt-2 text-xs text-red-700">{erro}</p>}
        <button disabled={ocupado} onClick={activar} className="mt-3 h-12 w-full rounded-xl bg-brand-600 px-4 text-base font-semibold text-white hover:bg-brand-700 disabled:opacity-50 sm:w-auto">
          {ocupado ? "A activar..." : "Activar notificações"}
        </button>
      </section>
    );
  }
  if (estado === "ios-instalar") {
    return <p className="mb-6 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600 shadow-sm">Para receber notificações no iPhone, adicione primeiro a aplicação ao ecrã principal (Partilhar, depois &quot;Adicionar ao ecrã principal&quot;) e abra-a a partir de lá.</p>;
  }
  if (estado === "negado") {
    return <p className="mb-6 text-xs text-slate-500">As notificações estão bloqueadas neste telemóvel. Pode permiti-las nas definições do navegador.</p>;
  }
  return null;
}