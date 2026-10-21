"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ColaboradorCompleto, EstadoColaborador } from "@/lib/types";
import { getSupabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { traduzirErro } from "@/lib/erros";

export type ColaboradorDados = Omit<ColaboradorCompleto, "id" | "codigo" | "activo">;
export type ResultadoColab = { ok: boolean; erro?: string; colaborador?: ColaboradorCompleto };

type Linha = {
  id: string; codigo: string; nome: string; funcao: string; telefone: string; data_inicio: string | null;
  modalidade: ColaboradorCompleto["modalidade"]; contrato: string; percentagem: number;
  estado: EstadoColaborador; observacoes: string;
};

function deLinha(l: Linha): ColaboradorCompleto {
  return {
    id: l.id, codigo: l.codigo, nome: l.nome, funcao: l.funcao, activo: l.estado === "Activo",
    telefone: l.telefone, dataInicio: l.data_inicio ?? "", modalidade: l.modalidade, contrato: l.contrato,
    percentagem: Number(l.percentagem), estado: l.estado, observacoes: l.observacoes,
  };
}

function paraLinha(d: ColaboradorDados) {
  return {
    nome: d.nome, funcao: d.funcao, telefone: d.telefone, data_inicio: d.dataInicio || null,
    modalidade: d.modalidade, contrato: d.contrato, percentagem: d.percentagem,
    estado: d.estado, observacoes: d.observacoes,
  };
}

type Ctx = {
  colaboradores: ColaboradorCompleto[];
  carregado: boolean;
  erro: string;
  obter: (id: string) => ColaboradorCompleto | undefined;
  adicionar: (dados: ColaboradorDados) => Promise<ResultadoColab>;
  actualizar: (id: string, dados: ColaboradorDados) => Promise<ResultadoColab>;
  alterarEstado: (id: string, estado: EstadoColaborador) => Promise<ResultadoColab>;
};

const ColaboradoresContext = createContext<Ctx | null>(null);

export function ColaboradoresProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const [colaboradores, setColaboradores] = useState<ColaboradorCompleto[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let activo = true;
    (async () => {
      const { data, error } = await getSupabase().from("colaboradores").select("*").order("codigo");
      if (!activo) return;
      if (error) setErro("Não foi possível carregar os colaboradores: " + error.message);
      else {
        setColaboradores((data as unknown as Linha[]).map(deLinha));
        setErro("");
      }
      setCarregado(true);
    })();
    return () => {
      activo = false;
    };
  }, [userId]);

  const obter = useCallback((id: string) => colaboradores.find((c) => c.id === id), [colaboradores]);

  const adicionar = useCallback(async (dados: ColaboradorDados): Promise<ResultadoColab> => {
    const { data, error } = await getSupabase().from("colaboradores").insert(paraLinha(dados)).select("*").single();
    if (error || !data) return { ok: false, erro: traduzirErro(error) };
    const novo = deLinha(data as unknown as Linha);
    setColaboradores((l) => [...l.filter((c) => c.id !== novo.id), novo].sort((a, b) => a.codigo.localeCompare(b.codigo)));
    return { ok: true, colaborador: novo };
  }, []);

  const actualizar = useCallback(async (id: string, dados: ColaboradorDados): Promise<ResultadoColab> => {
    const { data, error } = await getSupabase().from("colaboradores").update(paraLinha(dados)).eq("id", id).select("*").single();
    if (error || !data) return { ok: false, erro: traduzirErro(error) };
    const c = deLinha(data as unknown as Linha);
    setColaboradores((l) => l.map((x) => (x.id === id ? c : x)));
    return { ok: true, colaborador: c };
  }, []);

  const alterarEstado = useCallback(async (id: string, estado: EstadoColaborador): Promise<ResultadoColab> => {
    const { data, error } = await getSupabase().from("colaboradores").update({ estado }).eq("id", id).select("*").single();
    if (error || !data) return { ok: false, erro: traduzirErro(error) };
    const c = deLinha(data as unknown as Linha);
    setColaboradores((l) => l.map((x) => (x.id === id ? c : x)));
    return { ok: true, colaborador: c };
  }, []);

  const valor = useMemo(
    () => ({ colaboradores, carregado, erro, obter, adicionar, actualizar, alterarEstado }),
    [colaboradores, carregado, erro, obter, adicionar, actualizar, alterarEstado]
  );

  return (
    <ColaboradoresContext.Provider value={valor}>
      {erro && <div className="fixed inset-x-0 top-0 z-50 bg-red-600 p-2 text-center text-sm text-white">{erro}</div>}
      {children}
    </ColaboradoresContext.Provider>
  );
}

export function useColaboradores() {
  const ctx = useContext(ColaboradoresContext);
  if (!ctx) throw new Error("useColaboradores deve ser usado dentro de ColaboradoresProvider");
  return ctx;
}