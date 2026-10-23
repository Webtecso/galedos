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

type Leitura = { perfil: Perfil | null; motivo?: string; detalhe?: string };

const AuthContext = createContext<Ctx | null>(null);

async function lerPerfil(userId: string): Promise<Leitura> {
  const { data, error } = await getSupabase()
    .from("perfis")
    .select("id,email,nome,perfil,activo,colaborador_id,deve_mudar_password,privacidade_aceite_em")
    .eq("id", userId)
    .maybeSingle();
  if (error) return { perfil: null, motivo: "erro-perfil", detalhe: error.message };
  if (!data) return { perfil: null, motivo: "sem-perfil" };
  const p = data as unknown as LinhaPerfil;
  if (!p.activo) return { perfil: null, motivo: "conta-inactiva" };
  return {
    perfil: {
      id: p.id, email: p.email, nome: p.nome, perfil: p.perfil, activo: p.activo,
      colaboradorId: p.colaborador_id,
      deveMudarPassword: p.deve_mudar_password,
      privacidadeAceite: !!p.privacidade_aceite_em,
    },
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [perfil, setPerfil] = useState<Perfil | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    let activo = true;
    let carregado = false;
    let aResolver = false;
    let aSair = false;

    const irParaLogin = (motivo: string, detalhe?: string) => {
      if (!activo) return;
      const q = new URLSearchParams({ motivo });
      if (detalhe) q.set("detalhe", detalhe.slice(0, 200));
      router.replace("/login?" + q.toString());
    };

    async function resolver(userId: string) {
      if (aResolver || carregado) return;
      aResolver = true;
      try {
        const r = await lerPerfil(userId);
        if (!activo) return;
        if (!r.perfil) {
          console.error("[Galedos] acesso recusado:", r.motivo, r.detalhe ?? "");
          aSair = true;
          await sb.auth.signOut();
          irParaLogin(r.motivo ?? "erro-perfil", r.detalhe);
          return;
        }
        carregado = true;
        setPerfil(r.perfil);
      } catch (e) {
        console.error("[Galedos] erro ao resolver a sessao:", e);
        irParaLogin("erro-perfil", String(e));
      } finally {
        aResolver = false;
      }
    }

    async function iniciar() {
      try {
        let sessao = (await sb.auth.getSession()).data.session;
        if (!sessao) {
          // a sessão pode ainda não estar disponível no primeiro instante
          await new Promise<void>((resolve) => setTimeout(resolve, 700));
          if (!activo) return;
          sessao = (await sb.auth.getSession()).data.session;
        }
        if (!activo) return;
        if (sessao) await resolver(sessao.user.id);
        else if (!carregado && !aSair) irParaLogin("sem-sessao");
      } catch (e) {
        console.error("[Galedos] erro ao ler a sessao:", e);
        irParaLogin("erro-perfil", String(e));
      }
    }

    iniciar();

    const { data: sub } = sb.auth.onAuthStateChange((evento: string, sessao: { user: { id: string } } | null) => {
      if (evento === "SIGNED_OUT") {
        carregado = false;
        setPerfil(null);
        if (!aSair) router.replace("/login");
        return;
      }
      if (sessao && !carregado) {
        const id = sessao.user.id;
        setTimeout(() => {
          resolver(id);
        }, 0);
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
    const r = await lerPerfil(id);
    if (r.perfil) setPerfil(r.perfil);
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