"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Despesa } from "@/lib/types";
import type { Resultado } from "@/components/servicos/ServicosProvider";
import { getSupabase } from "@/lib/supabase/client";
import { buscarTudo } from "@/lib/supabase/buscar";
import { useAuth } from "@/components/auth/AuthProvider";
import { traduzirErro } from "@/lib/erros";

export type DespesaDados = Omit<Despesa, "id" | "codigo" | "motivoAnulacao" | "historico">;

type Linha = {
  id: string; codigo: string; data: string; categoria: string; descricao: string; valor: number;
  fornecedor: string; meio: Despesa["meio"]; referencia: string; estado: Despesa["estado"];
  observacoes: string; motivo_anulacao: string;
};

function deLinha(l: Linha): Despesa {
  return {
    id: l.id, codigo: l.codigo, data: l.data, categoria: l.categoria, descricao: l.descricao,
    valor: Number(l.valor), fornecedor: l.fornecedor, meio: l.meio, referencia: l.referencia,
    estado: l.estado, observacoes: l.observacoes, motivoAnulacao: l.motivo_anulacao, historico: [],
  };
}

type Ctx = {
  despesas: Despesa[];
  categorias: string[];
  carregado: boolean;
  erro: string;
  criar: (dados: DespesaDados) => Promise<Resultado>;
  marcarPago: (id: string) => Promise<Resultado>;
  anular: (id: string, motivo: string) => Promise<Resultado>;
  adicionarCategoria: (nome: string) => Promise<Resultado>;
};

const DespesasContext = createContext<Ctx | null>(null);
const OCUPADO: Resultado = { ok: false, erro: "Operação em curso. Aguarde." };

export function DespesasProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState("");
  const emCurso = useRef(false);

  const recarregar = useCallback(async () => {
    const [d, c] = await Promise.all([
      buscarTudo<Linha>("despesas", "data"),
      buscarTudo<{ nome: string }>("categorias_despesa", "nome"),
    ]);
    if (d.error || c.error) {
      setErro("Não foi possível carregar as despesas: " + (d.error ?? c.error));
      return;
    }
    setErro("");
    setDespesas(d.data.map(deLinha));
    setCategorias(c.data.map((x) => x.nome));
  }, []);

  useEffect(() => {
    let activo = true;
    (async () => {
      await recarregar();
      if (activo) setCarregado(true);
    })();
    return () => {
      activo = false;
    };
  }, [userId, recarregar]);

  async function protegido(fn: () => Promise<Resultado>): Promise<Resultado> {
    if (emCurso.current) return OCUPADO;
    emCurso.current = true;
    try {
      return await fn();
    } finally {
      emCurso.current = false;
    }
  }

  const criar = useCallback(
    (dados: DespesaDados) =>
      protegido(async () => {
        if (!(dados.valor > 0)) return { ok: false, erro: "Indique um valor superior a zero." };
        if (!dados.descricao.trim()) return { ok: false, erro: "Indique a descrição da despesa." };
        if (!dados.categoria) return { ok: false, erro: "Seleccione a categoria." };
        if (!dados.data) return { ok: false, erro: "Indique a data." };
        const { error } = await getSupabase().from("despesas").insert({
          data: dados.data,
          categoria: dados.categoria,
          descricao: dados.descricao.trim(),
          valor: dados.valor,
          fornecedor: dados.fornecedor,
          meio: dados.meio,
          referencia: dados.referencia,
          estado: dados.estado,
          observacoes: dados.observacoes,
        });
        if (error) return { ok: false, erro: traduzirErro(error) };
        await recarregar();
        return { ok: true };
      }),
    [recarregar]
  );

  const marcarPago = useCallback(
    (id: string) =>
      protegido(async () => {
        const { data, error } = await getSupabase().from("despesas").update({ estado: "Pago" }).eq("id", id).select("id");
        if (error) return { ok: false, erro: traduzirErro(error) };
        if (!data || data.length === 0) return { ok: false, erro: "Sem permissão para esta operação, ou a despesa já não existe." };
        await recarregar();
        return { ok: true };
      }),
    [recarregar]
  );

  const anular = useCallback(
    (id: string, motivo: string) =>
      protegido(async () => {
        if (!motivo.trim()) return { ok: false, erro: "O motivo da anulação é obrigatório." };
        const { data, error } = await getSupabase()
          .from("despesas")
          .update({ estado: "Anulada", motivo_anulacao: motivo.trim() })
          .eq("id", id)
          .select("id");
        if (error) return { ok: false, erro: traduzirErro(error) };
        if (!data || data.length === 0) return { ok: false, erro: "Sem permissão para esta operação, ou a despesa já não existe." };
        await recarregar();
        return { ok: true };
      }),
    [recarregar]
  );

  const adicionarCategoria = useCallback(
    (nome: string) =>
      protegido(async () => {
        const n = nome.trim();
        if (!n) return { ok: false, erro: "Indique o nome da categoria." };
        if (categorias.some((c) => c.toLowerCase() === n.toLowerCase())) return { ok: false, erro: "Essa categoria já existe." };
        const { error } = await getSupabase().from("categorias_despesa").insert({ nome: n });
        if (error) return { ok: false, erro: traduzirErro(error) };
        await recarregar();
        return { ok: true };
      }),
    [categorias, recarregar]
  );

  const valor = useMemo(
    () => ({ despesas, categorias, carregado, erro, criar, marcarPago, anular, adicionarCategoria }),
    [despesas, categorias, carregado, erro, criar, marcarPago, anular, adicionarCategoria]
  );

  return (
    <DespesasContext.Provider value={valor}>
      {erro && <div className="fixed inset-x-0 top-0 z-50 bg-red-600 p-2 text-center text-sm text-white">{erro}</div>}
      {children}
    </DespesasContext.Provider>
  );
}

export function useDespesas() {
  const ctx = useContext(DespesasContext);
  if (!ctx) throw new Error("useDespesas deve ser usado dentro de DespesasProvider");
  return ctx;
}