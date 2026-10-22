"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { EventoHistorico } from "@/lib/types";
import type { Equipamento, EstadoEquipamento, MovimentoStock, Produto, TipoMovimento } from "@/lib/operacao";
import type { Resultado } from "@/components/servicos/ServicosProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { getSupabase } from "@/lib/supabase/client";
import { traduzirErro } from "@/lib/erros";

export type ProdutoDados = {
  nome: string; categoria: string; unidade: string; quantidade: number;
  minimo: number; fornecedor: string; custo: number;
};
export type EquipamentoDados = { nome: string; categoria: string; dataAquisicao: string; observacoes: string };

type LinhaProduto = {
  id: string; codigo: string; nome: string; categoria: string; unidade: string; quantidade: number; minimo: number;
  fornecedor: string; custo: number; estado: "Activo" | "Inactivo"; ultima_entrada: string | null;
};
type LinhaMov = {
  id: number | string; produto_id: string; tipo: TipoMovimento; variacao: number; saldo_apos: number;
  data: string; responsavel: string; motivo: string;
};
type LinhaManut = { id: string; data: string; descricao: string; custo: number; criado_em: string };
type LinhaHist = { id: number | string; data: string; utilizador_nome: string; accao: string };
type LinhaEquip = {
  id: string; codigo: string; nome: string; categoria: string; estado: EstadoEquipamento;
  data_aquisicao: string | null; responsavel_id: string | null; observacoes: string;
  manutencoes_equipamento: LinhaManut[] | null; equipamento_historico: LinhaHist[] | null;
};

function deProduto(l: LinhaProduto): Produto {
  return {
    id: l.id, codigo: l.codigo, nome: l.nome, categoria: l.categoria, unidade: l.unidade,
    quantidade: Number(l.quantidade), minimo: Number(l.minimo), fornecedor: l.fornecedor,
    custo: Number(l.custo), estado: l.estado, ultimaEntrada: l.ultima_entrada ?? "",
  };
}

function deMovimento(l: LinhaMov): MovimentoStock {
  return {
    id: String(l.id), produtoId: l.produto_id, tipo: l.tipo, variacao: Number(l.variacao),
    saldoApos: Number(l.saldo_apos), data: l.data, responsavel: l.responsavel, motivo: l.motivo,
  };
}

function deEquipamento(l: LinhaEquip): Equipamento {
  const historico: EventoHistorico[] = [...(l.equipamento_historico ?? [])]
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map((h) => ({ id: "eh" + h.id, data: h.data, utilizador: h.utilizador_nome, accao: h.accao }));
  const manutencoes = [...(l.manutencoes_equipamento ?? [])]
    .sort((a, b) => a.data.localeCompare(b.data) || a.criado_em.localeCompare(b.criado_em))
    .map((m) => ({ id: m.id, data: m.data, descricao: m.descricao, custo: Number(m.custo) }));
  return {
    id: l.id, codigo: l.codigo, nome: l.nome, categoria: l.categoria, estado: l.estado,
    dataAquisicao: l.data_aquisicao ?? "", responsavelId: l.responsavel_id ?? "",
    observacoes: l.observacoes, manutencoes, historico,
  };
}

type Ctx = {
  produtos: Produto[];
  movimentos: MovimentoStock[];
  equipamentos: Equipamento[];
  carregado: boolean;
  adicionarProduto: (d: ProdutoDados) => Promise<Resultado>;
  alternarProduto: (id: string) => Promise<Resultado>;
  movimentar: (produtoId: string, tipo: TipoMovimento, valor: number, motivo: string) => Promise<Resultado>;
  adicionarEquipamento: (d: EquipamentoDados) => Promise<Resultado>;
  alterarEstadoEquipamento: (id: string, estado: EstadoEquipamento) => Promise<Resultado>;
  atribuirEquipamento: (id: string, colaboradorId: string, nome: string) => Promise<Resultado>;
  registarManutencao: (id: string, descricao: string, custo: number) => Promise<Resultado>;
};

const StockContext = createContext<Ctx | null>(null);

export function StockProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [movimentos, setMovimentos] = useState<MovimentoStock[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState("");
  const emCurso = useRef(false);

  const carregar = useCallback(async () => {
    const sb = getSupabase();
    const [p, m, e] = await Promise.all([
      sb.from("produtos").select("*").order("codigo"),
      sb.from("movimentos_stock").select("*").order("id", { ascending: false }).limit(1000),
      sb.from("equipamentos").select("*, manutencoes_equipamento(*), equipamento_historico(*)").order("codigo"),
    ]);
    const falha = p.error ?? m.error ?? e.error;
    if (falha) {
      setErro("Não foi possível carregar o stock: " + falha.message);
      return;
    }
    setErro("");
    setProdutos((p.data as unknown as LinhaProduto[]).map(deProduto));
    setMovimentos((m.data as unknown as LinhaMov[]).map(deMovimento).reverse());
    setEquipamentos((e.data as unknown as LinhaEquip[]).map(deEquipamento));
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

  const chamar = useCallback(
    async (fn: string, args: Record<string, unknown>): Promise<Resultado> => {
      if (emCurso.current) return { ok: false, erro: "Operação em curso. Aguarde." };
      emCurso.current = true;
      try {
        const { error } = await getSupabase().rpc(fn, args);
        if (error) return { ok: false, erro: traduzirErro(error) };
        await carregar();
        return { ok: true };
      } finally {
        emCurso.current = false;
      }
    },
    [carregar]
  );

  const adicionarProduto = useCallback(
    (d: ProdutoDados) =>
      chamar("criar_produto", {
        p: {
          nome: d.nome, categoria: d.categoria, unidade: d.unidade, quantidade: d.quantidade,
          minimo: d.minimo, fornecedor: d.fornecedor, custo: d.custo,
        },
      }),
    [chamar]
  );

  const alternarProduto = useCallback((id: string) => chamar("alternar_produto", { p_id: id }), [chamar]);

  const movimentar = useCallback(
    (produtoId: string, tipo: TipoMovimento, valor: number, motivo: string) =>
      chamar("movimentar_stock", { p_produto: produtoId, p_tipo: tipo, p_valor: valor, p_motivo: motivo }),
    [chamar]
  );

  const adicionarEquipamento = useCallback(
    (d: EquipamentoDados) =>
      chamar("criar_equipamento", {
        p: { nome: d.nome, categoria: d.categoria, data_aquisicao: d.dataAquisicao || null, observacoes: d.observacoes },
      }),
    [chamar]
  );

  const alterarEstadoEquipamento = useCallback(
    (id: string, estado: EstadoEquipamento) => chamar("alterar_estado_equipamento", { p_id: id, p_estado: estado }),
    [chamar]
  );

  const atribuirEquipamento = useCallback(
    (id: string, colaboradorId: string, _nome: string) =>
      chamar("atribuir_equipamento", { p_id: id, p_colaborador: colaboradorId }),
    [chamar]
  );

  const registarManutencao = useCallback(
    (id: string, descricao: string, custo: number) =>
      chamar("registar_manutencao", { p_id: id, p_descricao: descricao, p_custo: custo }),
    [chamar]
  );

  const valor = useMemo(
    () => ({
      produtos, movimentos, equipamentos, carregado,
      adicionarProduto, alternarProduto, movimentar, adicionarEquipamento,
      alterarEstadoEquipamento, atribuirEquipamento, registarManutencao,
    }),
    [produtos, movimentos, equipamentos, carregado, adicionarProduto, alternarProduto, movimentar, adicionarEquipamento, alterarEstadoEquipamento, atribuirEquipamento, registarManutencao]
  );

  return (
    <StockContext.Provider value={valor}>
      {erro && <div className="fixed inset-x-0 top-0 z-50 bg-red-600 p-2 text-center text-sm text-white">{erro}</div>}
      {children}
    </StockContext.Provider>
  );
}

export function useStock() {
  const ctx = useContext(StockContext);
  if (!ctx) throw new Error("useStock deve ser usado dentro de StockProvider");
  return ctx;
}