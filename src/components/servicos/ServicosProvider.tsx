"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type {
  CatalogoServico, ColaboradorCompleto, EstadoOperacional, MeioPagamento, Servico,
} from "@/lib/types";
import { getSupabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useColaboradores } from "@/components/colaboradores/ColaboradoresProvider";
import { saldoPendente, transicoes } from "@/lib/servicos";
import { formatKz } from "@/lib/format";
import { traduzirErro } from "@/lib/erros";

export type ServicoDados = Omit<
  Servico,
  "id" | "codigo" | "dataCriacao" | "recebimentos" | "historico" | "motivoCancelamento"
>;
export type CatalogoDados = Omit<CatalogoServico, "id" | "codigo">;
export type Resultado = { ok: boolean; erro?: string };
export type ResultadoServico = Resultado & { servico?: Servico };
export type PagamentoDados = { valor: number; meio: MeioPagamento; referencia: string };

type LinhaRec = { id: string; data: string; valor: number; meio: MeioPagamento; referencia: string; utilizador_nome: string };
type LinhaHist = { id: number | string; data: string; utilizador_nome: string; accao: string };
type LinhaServico = {
  id: string; codigo: string; cliente_id: string; catalogo_id: string | null; tipo_servico: string;
  descricao: string; quantidade: number; preco_unitario: number; desconto: number; total: number;
  data: string | null; hora: string | null; duracao_min: number; local_execucao: string;
  estado_operacional: EstadoOperacional; motivo_cancelamento: string; observacoes: string;
  excepcao_conflito: boolean; criado_em: string;
  servico_colaboradores: { colaborador_id: string }[] | null;
  recebimentos: LinhaRec[] | null;
  servico_historico: LinhaHist[] | null;
};
type LinhaCat = {
  id: string; codigo: string; nome: string; descricao: string; unidade: string;
  preco: number; duracao_min: number; activo: boolean;
};

const SELECT_SERVICOS = "*, servico_colaboradores(colaborador_id), recebimentos(*), servico_historico(*)";

function deLinha(l: LinhaServico): Servico {
  const historico = [...(l.servico_historico ?? [])]
    .sort((a, b) => a.data.localeCompare(b.data) || Number(a.id) - Number(b.id))
    .map((h) => ({ id: "h" + h.id, data: h.data, utilizador: h.utilizador_nome, accao: h.accao }));
  const recebimentos = [...(l.recebimentos ?? [])]
    .sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id))
    .map((r) => ({ id: r.id, data: r.data, valor: Number(r.valor), meio: r.meio, referencia: r.referencia, utilizador: r.utilizador_nome }));
  return {
    id: l.id,
    codigo: l.codigo,
    clienteId: l.cliente_id,
    dataCriacao: l.criado_em,
    catalogoId: l.catalogo_id ?? "",
    tipoServico: l.tipo_servico,
    descricao: l.descricao,
    quantidade: Number(l.quantidade),
    precoUnitario: Number(l.preco_unitario),
    desconto: Number(l.desconto),
    total: Number(l.total),
    data: l.data ?? "",
    hora: (l.hora ?? "").slice(0, 5),
    duracaoMin: l.duracao_min,
    local: l.local_execucao,
    colaboradorIds: (l.servico_colaboradores ?? []).map((x) => x.colaborador_id).sort(),
    estadoOperacional: l.estado_operacional,
    motivoCancelamento: l.motivo_cancelamento,
    recebimentos,
    observacoes: l.observacoes,
    excepcaoConflito: l.excepcao_conflito,
    historico,
  };
}

function deLinhaCat(l: LinhaCat): CatalogoServico {
  return {
    id: l.id, codigo: l.codigo, nome: l.nome, descricao: l.descricao, unidade: l.unidade,
    preco: Number(l.preco), duracaoMin: l.duracao_min, activo: l.activo,
  };
}

function paraPayload(d: ServicoDados) {
  return {
    cliente_id: d.clienteId,
    catalogo_id: d.catalogoId || null,
    tipo_servico: d.tipoServico,
    descricao: d.descricao,
    quantidade: d.quantidade,
    preco_unitario: d.precoUnitario,
    desconto: d.desconto,
    data: d.data || null,
    hora: d.hora || null,
    duracao_min: d.duracaoMin,
    local_execucao: d.local,
    estado_operacional: d.estadoOperacional,
    observacoes: d.observacoes,
    excepcao_conflito: d.excepcaoConflito,
  };
}

type Ctx = {
  servicos: Servico[];
  catalogo: CatalogoServico[];
  colaboradores: ColaboradorCompleto[];
  carregado: boolean;
  erro: string;
  obterServico: (id: string) => Servico | undefined;
  criar: (dados: ServicoDados) => Promise<ResultadoServico>;
  actualizar: (id: string, dados: ServicoDados) => Promise<ResultadoServico>;
  mudarEstado: (id: string, novo: EstadoOperacional, motivo?: string) => Promise<Resultado>;
  registarPagamento: (id: string, dados: PagamentoDados) => Promise<Resultado>;
  adicionarCatalogo: (dados: CatalogoDados) => Promise<Resultado>;
  actualizarCatalogo: (id: string, dados: CatalogoDados) => Promise<Resultado>;
  alternarCatalogo: (id: string) => Promise<Resultado>;
};

const ServicosContext = createContext<Ctx | null>(null);

export function ServicosProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const { colaboradores } = useColaboradores();
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [catalogo, setCatalogo] = useState<CatalogoServico[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState("");
  const emCurso = useRef<Set<string>>(new Set());

  const carregarServicos = useCallback(async (): Promise<Servico[] | null> => {
    const { data, error } = await getSupabase()
      .from("servicos")
      .select(SELECT_SERVICOS)
      .order("codigo", { ascending: false });
    if (error) {
      setErro("Não foi possível carregar os serviços: " + error.message);
      return null;
    }
    const lista = (data as unknown as LinhaServico[]).map(deLinha);
    setServicos(lista);
    return lista;
  }, []);

  const carregarCatalogo = useCallback(async (): Promise<void> => {
    const { data, error } = await getSupabase().from("catalogo_servicos").select("*").order("codigo");
    if (error) {
      setErro("Não foi possível carregar o catálogo: " + error.message);
      return;
    }
    setCatalogo((data as unknown as LinhaCat[]).map(deLinhaCat));
  }, []);

  useEffect(() => {
    let activo = true;
    setErro("");
    (async () => {
      await Promise.all([carregarServicos(), carregarCatalogo()]);
      if (activo) setCarregado(true);
    })();
    return () => {
      activo = false;
    };
  }, [userId, carregarServicos, carregarCatalogo]);

  const obterServico = useCallback((id: string) => servicos.find((s) => s.id === id), [servicos]);

  const criar = useCallback(
    async (dados: ServicoDados): Promise<ResultadoServico> => {
      const { data, error } = await getSupabase().rpc("guardar_servico", {
        p_id: null,
        p: paraPayload(dados),
        p_equipa: dados.colaboradorIds,
      });
      if (error || !data) return { ok: false, erro: traduzirErro(error) };
      const lista = await carregarServicos();
      return { ok: true, servico: lista?.find((s) => s.id === (data as unknown as string)) };
    },
    [carregarServicos]
  );

  const actualizar = useCallback(
    async (id: string, dados: ServicoDados): Promise<ResultadoServico> => {
      const { data, error } = await getSupabase().rpc("guardar_servico", {
        p_id: id,
        p: paraPayload(dados),
        p_equipa: dados.colaboradorIds,
      });
      if (error || !data) return { ok: false, erro: traduzirErro(error) };
      const lista = await carregarServicos();
      return { ok: true, servico: lista?.find((s) => s.id === id) };
    },
    [carregarServicos]
  );

  const mudarEstado = useCallback(
    async (id: string, novo: EstadoOperacional, motivo?: string): Promise<Resultado> => {
      const s = servicos.find((x) => x.id === id);
      if (!s) return { ok: false, erro: "Serviço não encontrado." };
      if (!transicoes[s.estadoOperacional].includes(novo))
        return { ok: false, erro: `Não é possível passar de "${s.estadoOperacional}" para "${novo}".` };
      if (novo === "Cancelado" && !(motivo && motivo.trim()))
        return { ok: false, erro: "Indique o motivo do cancelamento." };
      if (novo === "Agendado" && (!s.data || !s.hora || s.colaboradorIds.length === 0))
        return { ok: false, erro: "Para agendar, defina primeiro a data, a hora e a equipa (botão Editar)." };

      const chave = "estado:" + id;
      if (emCurso.current.has(chave)) return { ok: false, erro: "Operação em curso. Aguarde." };
      emCurso.current.add(chave);
      try {
        const { data, error } = await getSupabase()
          .from("servicos")
          .update({
            estado_operacional: novo,
            motivo_cancelamento: novo === "Cancelado" ? (motivo ?? "").trim() : s.motivoCancelamento,
          })
          .eq("id", id)
          .select("id");
        if (error) return { ok: false, erro: traduzirErro(error) };
        if (!data || data.length === 0) return { ok: false, erro: "Sem permissão para esta operação, ou o serviço já não existe." };
        await carregarServicos();
        return { ok: true };
      } finally {
        emCurso.current.delete(chave);
      }
    },
    [servicos, carregarServicos]
  );

  const registarPagamento = useCallback(
    async (id: string, dados: PagamentoDados): Promise<Resultado> => {
      const s = servicos.find((x) => x.id === id);
      if (!s) return { ok: false, erro: "Serviço não encontrado." };
      if (s.estadoOperacional === "Cancelado")
        return { ok: false, erro: "Não é possível registar pagamentos num serviço cancelado." };
      if (!(dados.valor > 0)) return { ok: false, erro: "Indique um valor superior a zero." };
      const saldo = saldoPendente(s);
      if (dados.valor > saldo) return { ok: false, erro: `O valor excede o saldo pendente (${formatKz(saldo)}).` };

      const chave = "pag:" + id;
      if (emCurso.current.has(chave)) return { ok: false, erro: "Operação em curso. Aguarde." };
      emCurso.current.add(chave);
      try {
        const { error } = await getSupabase().from("recebimentos").insert({
          servico_id: id,
          valor: dados.valor,
          meio: dados.meio,
          referencia: dados.referencia.trim(),
        });
        if (error) {
          await carregarServicos();
          return { ok: false, erro: traduzirErro(error) };
        }
        await carregarServicos();
        return { ok: true };
      } finally {
        emCurso.current.delete(chave);
      }
    },
    [servicos, carregarServicos]
  );

  const adicionarCatalogo = useCallback(
    async (d: CatalogoDados): Promise<Resultado> => {
      const { data, error } = await getSupabase()
        .from("catalogo_servicos")
        .insert({ nome: d.nome, descricao: d.descricao, unidade: d.unidade, preco: d.preco, duracao_min: d.duracaoMin, activo: d.activo })
        .select("id");
      if (error) return { ok: false, erro: traduzirErro(error) };
      if (!data || data.length === 0) return { ok: false, erro: "Sem permissão para esta operação." };
      await carregarCatalogo();
      return { ok: true };
    },
    [carregarCatalogo]
  );

  const actualizarCatalogo = useCallback(
    async (id: string, d: CatalogoDados): Promise<Resultado> => {
      const { data, error } = await getSupabase()
        .from("catalogo_servicos")
        .update({ nome: d.nome, descricao: d.descricao, unidade: d.unidade, preco: d.preco, duracao_min: d.duracaoMin, activo: d.activo })
        .eq("id", id)
        .select("id");
      if (error) return { ok: false, erro: traduzirErro(error) };
      if (!data || data.length === 0) return { ok: false, erro: "Sem permissão para esta operação." };
      await carregarCatalogo();
      return { ok: true };
    },
    [carregarCatalogo]
  );

  const alternarCatalogo = useCallback(
    async (id: string): Promise<Resultado> => {
      const c = catalogo.find((x) => x.id === id);
      if (!c) return { ok: false, erro: "Serviço do catálogo não encontrado." };
      const { data, error } = await getSupabase()
        .from("catalogo_servicos")
        .update({ activo: !c.activo })
        .eq("id", id)
        .select("id");
      if (error) return { ok: false, erro: traduzirErro(error) };
      if (!data || data.length === 0) return { ok: false, erro: "Sem permissão para esta operação." };
      await carregarCatalogo();
      return { ok: true };
    },
    [catalogo, carregarCatalogo]
  );

  const valor = useMemo(
    () => ({
      servicos, catalogo, colaboradores, carregado, erro,
      obterServico, criar, actualizar, mudarEstado, registarPagamento,
      adicionarCatalogo, actualizarCatalogo, alternarCatalogo,
    }),
    [servicos, catalogo, colaboradores, carregado, erro, obterServico, criar, actualizar, mudarEstado, registarPagamento, adicionarCatalogo, actualizarCatalogo, alternarCatalogo]
  );

  return (
    <ServicosContext.Provider value={valor}>
      {erro && <div className="fixed inset-x-0 top-0 z-50 bg-red-600 p-2 text-center text-sm text-white">{erro}</div>}
      {children}
    </ServicosContext.Provider>
  );
}

export function useServicos() {
  const ctx = useContext(ServicosContext);
  if (!ctx) throw new Error("useServicos deve ser usado dentro de ServicosProvider");
  return ctx;
}