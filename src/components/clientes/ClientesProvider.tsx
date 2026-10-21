"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Cliente } from "@/lib/types";
import { getSupabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";

export type ClienteDados = Omit<Cliente, "id" | "codigo" | "dataRegisto">;
export type ResultadoCliente = { ok: boolean; erro?: string; cliente?: Cliente };

type Linha = {
  id: string; codigo: string; nome: string; tipo: Cliente["tipo"]; telefone: string; email: string;
  endereco: string; localizacao: string; nif: string; data_registo: string; observacoes: string;
  estado: Cliente["estado"];
};

function deLinha(l: Linha): Cliente {
  return {
    id: l.id, codigo: l.codigo, nome: l.nome, tipo: l.tipo, telefone: l.telefone, email: l.email,
    endereco: l.endereco, localizacao: l.localizacao, nif: l.nif, dataRegisto: l.data_registo,
    observacoes: l.observacoes, estado: l.estado,
  };
}

function paraLinha(d: ClienteDados) {
  return {
    nome: d.nome, tipo: d.tipo, telefone: d.telefone, email: d.email, endereco: d.endereco,
    localizacao: d.localizacao, nif: d.nif, observacoes: d.observacoes, estado: d.estado,
  };
}

function traduzir(msg?: string): string {
  if (!msg) return "Não foi possível concluir a operação.";
  if (msg.includes("row-level security") || msg.includes("no) rows") || msg.includes("0 rows"))
    return "Sem permissão para esta operação, ou o cliente já não existe.";
  if (msg.includes("check constraint")) return "Dados inválidos. Verifique o nome, o telefone e o NIF (empresas).";
  return "Não foi possível guardar: " + msg;
}

type Ctx = {
  clientes: Cliente[];
  carregado: boolean;
  erro: string;
  obter: (id: string) => Cliente | undefined;
  adicionar: (dados: ClienteDados) => Promise<ResultadoCliente>;
  actualizar: (id: string, dados: ClienteDados) => Promise<ResultadoCliente>;
  alternarEstado: (id: string) => Promise<ResultadoCliente>;
};

const ClientesContext = createContext<Ctx | null>(null);

export function ClientesProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let activo = true;
    (async () => {
      const { data, error } = await getSupabase().from("clientes").select("*").order("codigo", { ascending: false });
      if (!activo) return;
      if (error) {
        setErro("Não foi possível carregar os clientes: " + error.message);
      } else {
        setClientes((data as Linha[]).map(deLinha));
        setErro("");
      }
      setCarregado(true);
    })();
    return () => {
      activo = false;
    };
  }, [userId]);

  const obter = useCallback((id: string) => clientes.find((c) => c.id === id), [clientes]);

  const adicionar = useCallback(async (dados: ClienteDados): Promise<ResultadoCliente> => {
    const { data, error } = await getSupabase().from("clientes").insert(paraLinha(dados)).select("*").single();
    if (error || !data) return { ok: false, erro: traduzir(error?.message) };
    const novo = deLinha(data as Linha);
    setClientes((l) => [novo, ...l.filter((c) => c.id !== novo.id)]);
    return { ok: true, cliente: novo };
  }, []);

  const actualizar = useCallback(async (id: string, dados: ClienteDados): Promise<ResultadoCliente> => {
    const { data, error } = await getSupabase().from("clientes").update(paraLinha(dados)).eq("id", id).select("*").single();
    if (error || !data) return { ok: false, erro: traduzir(error?.message) };
    const c = deLinha(data as Linha);
    setClientes((l) => l.map((x) => (x.id === id ? c : x)));
    return { ok: true, cliente: c };
  }, []);

  const alternarEstado = useCallback(
    async (id: string): Promise<ResultadoCliente> => {
      const actual = clientes.find((c) => c.id === id);
      if (!actual) return { ok: false, erro: "Cliente não encontrado." };
      const novo = actual.estado === "Activo" ? "Inactivo" : "Activo";
      const { data, error } = await getSupabase().from("clientes").update({ estado: novo }).eq("id", id).select("*").single();
      if (error || !data) return { ok: false, erro: traduzir(error?.message) };
      const c = deLinha(data as Linha);
      setClientes((l) => l.map((x) => (x.id === id ? c : x)));
      return { ok: true, cliente: c };
    },
    [clientes]
  );

  const valor = useMemo(
    () => ({ clientes, carregado, erro, obter, adicionar, actualizar, alternarEstado }),
    [clientes, carregado, erro, obter, adicionar, actualizar, alternarEstado]
  );

  return (
    <ClientesContext.Provider value={valor}>
      {erro && <div className="fixed inset-x-0 top-0 z-50 bg-red-600 p-2 text-center text-sm text-white">{erro}</div>}
      {children}
    </ClientesContext.Provider>
  );
}

export function useClientes() {
  const ctx = useContext(ClientesContext);
  if (!ctx) throw new Error("useClientes deve ser usado dentro de ClientesProvider");
  return ctx;
}