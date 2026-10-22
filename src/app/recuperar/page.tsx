"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/ui/Logo";
import { getSupabase } from "@/lib/supabase/client";

const campo =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

// O link só pode ser usado uma vez: guarda-se a verificação para não a repetir
let verificacao: Promise<boolean> | null = null;

async function validarLink(): Promise<boolean> {
  const sb = getSupabase();
  const q = new URLSearchParams(window.location.search);
  const hash = q.get("token_hash");
  const code = q.get("code");
  if (hash) {
    const { error } = await sb.auth.verifyOtp({ type: "recovery", token_hash: hash });
    return !error;
  }
  if (code) {
    const { error } = await sb.auth.exchangeCodeForSession(code);
    return !error;
  }
  return false;
}

export default function RecuperarPage() {
  const router = useRouter();
  const [estado, setEstado] = useState<"a-validar" | "pronto" | "invalido">("a-validar");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let activo = true;
    if (!verificacao) verificacao = validarLink();
    verificacao.then((ok) => {
      if (activo) setEstado(ok ? "pronto" : "invalido");
    });
    return () => {
      activo = false;
    };
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (ocupado) return;
    if (nova.length < 8) return setErro("A palavra-passe deve ter pelo menos 8 caracteres.");
    if (nova !== confirma) return setErro("As duas palavras-passe não coincidem.");
    setOcupado(true);
    setErro("");
    try {
      const sb = getSupabase();
      const { error } = await sb.auth.updateUser({ password: nova });
      if (error) {
        setErro("Não foi possível alterar a palavra-passe: " + error.message);
        return;
      }
      await sb.rpc("concluir_mudanca_password");
      await sb.auth.signOut();
      router.replace("/login?motivo=senha-alterada");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 flex justify-center"><Logo altura={64} classe="h-16 w-auto" /></div>
        <h1 className="text-xl font-semibold text-slate-900">Definir nova palavra-passe</h1>

        {estado === "a-validar" && <p className="mt-4 text-sm text-slate-500">A validar o link...</p>}

        {estado === "invalido" && (
          <>
            <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">Este link é inválido ou já expirou. Peça um novo link no ecrã de entrada, ou peça à administração para repor a palavra-passe.</p>
            <a href="/login" className="mt-4 inline-block text-sm font-medium text-brand-700 hover:underline">Voltar ao início de sessão</a>
          </>
        )}

        {estado === "pronto" && (
          <form onSubmit={guardar} noValidate className="mt-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Nova palavra-passe (mín. 8 caracteres)</label>
              <input type="password" autoComplete="new-password" className={campo} value={nova} onChange={(e) => setNova(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Repita a nova palavra-passe</label>
              <input type="password" autoComplete="new-password" className={campo} value={confirma} onChange={(e) => setConfirma(e.target.value)} />
            </div>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <button type="submit" disabled={ocupado} className="h-12 w-full rounded-xl bg-brand-600 text-base font-semibold text-white hover:bg-brand-700 disabled:bg-slate-300">
              {ocupado ? "A guardar..." : "Guardar palavra-passe"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}