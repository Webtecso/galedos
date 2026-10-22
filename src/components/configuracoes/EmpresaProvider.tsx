"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Empresa } from "@/lib/operacao";
import type { Resultado } from "@/components/servicos/ServicosProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { getSupabase } from "@/lib/supabase/client";
import { traduzirErro } from "@/lib/erros";

type Ctx = { empresa: Empresa; carregado: boolean; guardar: (e: Empresa) => Promise<Resultado> };

const padrao: Empresa = {
  nome: "Grupo Galedos",
  nif: "",
  morada: "",
  telefone: "",
  email: "",
  rodape: "Gestão organizada. Serviços controlados. Crescimento sustentável.",
  condicoes: "O pagamento é devido nos termos acordados com o cliente. Alterações ao serviço devem ser previamente comunicadas.",
};

const EmpresaContext = createContext<Ctx | null>(null);

export function EmpresaProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const [empresa, setEmpresa] = useState<Empresa>(padrao);
  const [carregado, setCarregado] = useState(false);
  const emCurso = useRef(false);

  const carregar = useCallback(async () => {
    const { data } = await getSupabase()
      .from("empresa")
      .select("nome,nif,morada,telefone,email,rodape,condicoes")
      .eq("id", 1)
      .maybeSingle();
    if (data) setEmpresa({ ...padrao, ...(data as unknown as Empresa) });
  }, []);

  useEffect(() => {
    let activo = true;
    (async () => {
      await carregar();
      if (activo) setCarregado(true);
    })();
    return () => {
      activo = false;
    };
  }, [userId, carregar]);

  const guardar = useCallback(
    async (e: Empresa): Promise<Resultado> => {
      if (emCurso.current) return { ok: false, erro: "Operação em curso. Aguarde." };
      emCurso.current = true;
      try {
        const { error } = await getSupabase().rpc("guardar_empresa", { p: e });
        if (error) return { ok: false, erro: traduzirErro(error) };
        await carregar();
        return { ok: true };
      } finally {
        emCurso.current = false;
      }
    },
    [carregar]
  );

  const valor = useMemo(() => ({ empresa, carregado, guardar }), [empresa, carregado, guardar]);
  return <EmpresaContext.Provider value={valor}>{children}</EmpresaContext.Provider>;
}

export function useEmpresa() {
  const ctx = useContext(EmpresaContext);
  if (!ctx) throw new Error("useEmpresa deve ser usado dentro de EmpresaProvider");
  return ctx;
}