"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { EventoHistorico } from "@/lib/types";
import type { Equipamento, EstadoEquipamento, MovimentoStock, Produto, TipoMovimento } from "@/lib/operacao";
import { equipamentosMock, produtosMock } from "@/lib/mock/stock";
import type { Resultado } from "@/components/servicos/ServicosProvider";
import { UTILIZADOR_ACTUAL } from "@/lib/servicos";
import { hojeISO } from "@/lib/format";

export type ProdutoDados = {
  nome: string; categoria: string; unidade: string; quantidade: number;
  minimo: number; fornecedor: string; custo: number;
};
export type EquipamentoDados = { nome: string; categoria: string; dataAquisicao: string; observacoes: string };

type Estado = { produtos: Produto[]; movimentos: MovimentoStock[]; equipamentos: Equipamento[] };

type Ctx = {
  produtos: Produto[];
  movimentos: MovimentoStock[];
  equipamentos: Equipamento[];
  carregado: boolean;
  adicionarProduto: (d: ProdutoDados) => Resultado;
  alternarProduto: (id: string) => void;
  movimentar: (produtoId: string, tipo: TipoMovimento, valor: number, motivo: string) => Resultado;
  adicionarEquipamento: (d: EquipamentoDados) => Resultado;
  alterarEstadoEquipamento: (id: string, estado: EstadoEquipamento) => void;
  atribuirEquipamento: (id: string, colaboradorId: string, nome: string) => void;
  registarManutencao: (id: string, descricao: string, custo: number) => Resultado;
};

const StockContext = createContext<Ctx | null>(null);
const CHAVE = "galedos.stock.v1";

function novoId(p: string) {
  return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function evento(accao: string): EventoHistorico {
  return { id: novoId("sh"), data: new Date().toISOString(), utilizador: UTILIZADOR_ACTUAL, accao };
}

function proximo(lista: { codigo: string }[], prefixo: string, largura: number) {
  const maior = lista.reduce((max, x) => {
    const n = parseInt(x.codigo.replace(prefixo, ""), 10);
    return Number.isNaN(n) ? max : Math.max(max, n);
  }, 0);
  return prefixo + String(maior + 1).padStart(largura, "0");
}

export function StockProvider({ children }: { children: React.ReactNode }) {
  const [e, setE] = useState<Estado>({ produtos: produtosMock, movimentos: [], equipamentos: equipamentosMock });
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHAVE);
      if (raw) setE(JSON.parse(raw) as Estado);
    } catch {
      /* ignora */
    }
    setCarregado(true);
  }, []);

  useEffect(() => {
    if (!carregado) return;
    try {
      localStorage.setItem(CHAVE, JSON.stringify(e));
    } catch {
      /* ignora */
    }
  }, [e, carregado]);

  const adicionarProduto = useCallback(
    (d: ProdutoDados): Resultado => {
      if (!d.nome.trim()) return { ok: false, erro: "Indique o nome do produto." };
      if (!d.categoria) return { ok: false, erro: "Seleccione a categoria." };
      if (!(d.quantidade >= 0) || !(d.minimo >= 0) || !(d.custo >= 0))
        return { ok: false, erro: "Quantidade, mínimo e custo não podem ser negativos." };
      const hoje = hojeISO();
      const prod: Produto = {
        id: novoId("p"), codigo: proximo(e.produtos, "PRD-", 4), nome: d.nome.trim(), categoria: d.categoria,
        unidade: d.unidade.trim() || "unidade", quantidade: d.quantidade, minimo: d.minimo,
        fornecedor: d.fornecedor.trim(), custo: d.custo, estado: "Activo", ultimaEntrada: d.quantidade > 0 ? hoje : "",
      };
      const movs: MovimentoStock[] =
        d.quantidade > 0
          ? [{ id: novoId("mv"), produtoId: prod.id, tipo: "Entrada por compra", variacao: d.quantidade, saldoApos: d.quantidade, data: hoje, responsavel: UTILIZADOR_ACTUAL, motivo: "Stock inicial" }]
          : [];
      setE((p) => ({ ...p, produtos: [...p.produtos, prod], movimentos: [...p.movimentos, ...movs] }));
      return { ok: true };
    },
    [e.produtos]
  );

  const alternarProduto = useCallback((id: string) => {
    setE((p) => ({
      ...p,
      produtos: p.produtos.map((x) => (x.id === id ? { ...x, estado: x.estado === "Activo" ? "Inactivo" : "Activo" } : x)),
    }));
  }, []);

  const movimentar = useCallback(
    (produtoId: string, tipo: TipoMovimento, valor: number, motivo: string): Resultado => {
      const p = e.produtos.find((x) => x.id === produtoId);
      if (!p) return { ok: false, erro: "Seleccione o produto." };
      if (p.estado === "Inactivo") return { ok: false, erro: "O produto está inactivo." };
      if (Number.isNaN(valor)) return { ok: false, erro: "Indique uma quantidade válida." };
      if (!motivo.trim()) return { ok: false, erro: "O motivo do movimento é obrigatório." };

      let variacao = 0;
      if (tipo === "Entrada por compra" || tipo === "Devolução") {
        if (!(valor > 0)) return { ok: false, erro: "A quantidade deve ser superior a zero." };
        variacao = valor;
      } else if (tipo === "Saída para utilização" || tipo === "Perda ou inutilização") {
        if (!(valor > 0)) return { ok: false, erro: "A quantidade deve ser superior a zero." };
        if (valor > p.quantidade) return { ok: false, erro: `A quantidade excede o stock disponível (${p.quantidade}).` };
        variacao = -valor;
      } else {
        if (valor < 0) return { ok: false, erro: "A quantidade contada não pode ser negativa." };
        variacao = valor - p.quantidade;
        if (variacao === 0) return { ok: false, erro: "A contagem coincide com o stock actual; não há ajuste a registar." };
      }

      const saldoApos = p.quantidade + variacao;
      const hoje = hojeISO();
      const mov: MovimentoStock = {
        id: novoId("mv"), produtoId, tipo, variacao, saldoApos, data: hoje, responsavel: UTILIZADOR_ACTUAL, motivo: motivo.trim(),
      };
      setE((s) => ({
        ...s,
        movimentos: [...s.movimentos, mov],
        produtos: s.produtos.map((x) =>
          x.id === produtoId
            ? { ...x, quantidade: saldoApos, ultimaEntrada: tipo === "Entrada por compra" ? hoje : x.ultimaEntrada }
            : x
        ),
      }));
      return { ok: true };
    },
    [e.produtos]
  );

  const adicionarEquipamento = useCallback(
    (d: EquipamentoDados): Resultado => {
      if (!d.nome.trim()) return { ok: false, erro: "Indique o nome do equipamento." };
      const eq: Equipamento = {
        id: novoId("e"), codigo: proximo(e.equipamentos, "EQP-", 4), nome: d.nome.trim(), categoria: d.categoria,
        estado: "Operacional", dataAquisicao: d.dataAquisicao, responsavelId: "", observacoes: d.observacoes.trim(),
        manutencoes: [], historico: [evento("Equipamento registado")],
      };
      setE((p) => ({ ...p, equipamentos: [...p.equipamentos, eq] }));
      return { ok: true };
    },
    [e.equipamentos]
  );

  const alterarEstadoEquipamento = useCallback((id: string, estado: EstadoEquipamento) => {
    setE((p) => ({
      ...p,
      equipamentos: p.equipamentos.map((x) =>
        x.id === id && x.estado !== estado
          ? { ...x, estado, historico: [...x.historico, evento(`Estado alterado de "${x.estado}" para "${estado}"`)] }
          : x
      ),
    }));
  }, []);

  const atribuirEquipamento = useCallback((id: string, colaboradorId: string, nome: string) => {
    setE((p) => ({
      ...p,
      equipamentos: p.equipamentos.map((x) =>
        x.id === id && x.responsavelId !== colaboradorId
          ? {
              ...x,
              responsavelId: colaboradorId,
              historico: [...x.historico, evento(colaboradorId ? `Entregue a ${nome}` : "Devolvido à empresa")],
            }
          : x
      ),
    }));
  }, []);

  const registarManutencao = useCallback((id: string, descricao: string, custo: number): Resultado => {
    if (!descricao.trim()) return { ok: false, erro: "Descreva a manutenção realizada." };
    if (Number.isNaN(custo) || custo < 0) return { ok: false, erro: "Custo inválido." };
    setE((p) => ({
      ...p,
      equipamentos: p.equipamentos.map((x) =>
        x.id === id
          ? {
              ...x,
              manutencoes: [...x.manutencoes, { id: novoId("m"), data: hojeISO(), descricao: descricao.trim(), custo }],
              historico: [...x.historico, evento(`Manutenção registada: ${descricao.trim()}`)],
            }
          : x
      ),
    }));
    return { ok: true };
  }, []);

  const valor = useMemo(
    () => ({
      produtos: e.produtos, movimentos: e.movimentos, equipamentos: e.equipamentos, carregado,
      adicionarProduto, alternarProduto, movimentar, adicionarEquipamento,
      alterarEstadoEquipamento, atribuirEquipamento, registarManutencao,
    }),
    [e, carregado, adicionarProduto, alternarProduto, movimentar, adicionarEquipamento, alterarEstadoEquipamento, atribuirEquipamento, registarManutencao]
  );

  return <StockContext.Provider value={valor}>{children}</StockContext.Provider>;
}

export function useStock() {
  const ctx = useContext(StockContext);
  if (!ctx) throw new Error("useStock deve ser usado dentro de StockProvider");
  return ctx;
}