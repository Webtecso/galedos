"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Empresa } from "@/lib/operacao";

type Ctx = { empresa: Empresa; carregado: boolean; guardar: (e: Empresa) => void };

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
const CHAVE = "galedos.empresa.v1";

export function EmpresaProvider({ children }: { children: React.ReactNode }) {
  const [empresa, setEmpresa] = useState<Empresa>(padrao);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHAVE);
      if (raw) setEmpresa({ ...padrao, ...(JSON.parse(raw) as Empresa) });
    } catch {
      /* ignora */
    }
    setCarregado(true);
  }, []);

  useEffect(() => {
    if (!carregado) return;
    try {
      localStorage.setItem(CHAVE, JSON.stringify(empresa));
    } catch {
      /* ignora */
    }
  }, [empresa, carregado]);

  const guardar = useCallback((e: Empresa) => setEmpresa(e), []);
  const valor = useMemo(() => ({ empresa, carregado, guardar }), [empresa, carregado, guardar]);
  return <EmpresaContext.Provider value={valor}>{children}</EmpresaContext.Provider>;
}

export function useEmpresa() {
  const ctx = useContext(EmpresaContext);
  if (!ctx) throw new Error("useEmpresa deve ser usado dentro de EmpresaProvider");
  return ctx;
}