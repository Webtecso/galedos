"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";

export type PerfilUtilizador = "administrador" | "gestao" | "operacional";
export type Perfil = {
  id: string;
  email: string;
  nome: string;
  perfil: PerfilUtilizador;
  activo: boolean;
  colaboradorId: string | null;
  deveMudarPassword: boolean;
  privacidadeAceite: boolean;
};

type Ctx = { userId: string; perfil: Perfil; sair: () => Promise<void>; recarregar: () => Promise<void> };

type LinhaPerfil = {
  id: string; email: string; nome: string; perfil: PerfilUtilizador; activo: boolean; colaborador_id: string | null;
  deve_mudar_password: boolean; privacidade_aceite_em: string | null;
};

const AuthContext = createContext<Ctx | null>(null);

async function lerPerfil(userId: string): Promise<Perfil | null> {
  const { data, error } = await getSupabase()
    .from("perfis")
    .select("id,email,nome,perfil,activo,colaborador_id,deve_mudar_password,privacidade_aceite_em")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data || !data.activo) return null;
  const p = data as unknown as LinhaPerfil;
  return {
    id: p.id, email: p.email, nome: p.nome, perfil: p.perfil, activo: p.activo,
    colaboradorId: p.colaborador_id,
    deveMudarPassword: p.deve_mudar_password,
    privacidadeAceite: !!p.privacidade_aceite_em,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [perfil, setPerfil] = useState<Perfil | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    let activo = true;

    async function resolver(userId: string | null) {
      if (!userId) {
        if (activo) {
          setPerfil(null);
          router.replace("/login");
        }
        return;
      }
      const p = await lerPerfil(userId);
      if (!activo) return;
      if (!p) {
        await sb.auth.signOut();
        router.replace("/login?motivo=sem-acesso");
        return;
      }
      setPerfil(p);
    }

    (async () => {
      const { data } = await sb.auth.getSession();
      await resolver(data.session?.user.id ?? null);
    })();

    const { data: sub } = sb.auth.onAuthStateChange((evento: string) => {
      if (evento === "SIGNED_OUT") {
        setPerfil(null);
        router.replace("/login");
      }
    });

    return () => {
      activo = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  const sair = useCallback(async () => {
    await getSupabase().auth.signOut();
    router.replace("/login");
  }, [router]);

  const recarregar = useCallback(async () => {
    const { data } = await getSupabase().auth.getSession();
    const id = data.session?.user.id;
    if (!id) return;
    const p = await lerPerfil(id);
    if (p) setPerfil(p);
  }, []);

  const valor = useMemo(() => (perfil ? { userId: perfil.id, perfil, sair, recarregar } : null), [perfil, sair, recarregar]);

  if (!valor) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-500">A verificar sessão...</p>
      </div>
    );
  }

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}