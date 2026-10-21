"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type {
  ConfigRemuneracao, MeioPagamento, ModalidadeDistribuicao, PagamentoColaborador, Remuneracao,
} from "@/lib/types";
import type { Resultado } from "@/components/servicos/ServicosProvider";
import { getSupabase } from "@/lib/supabase/client";
import { buscarTudo } from "@/lib/supabase/buscar";
import { useAuth } from "@/components/auth/AuthProvider";
import { traduzirErro } from "@/lib/erros";

export type QuotaServico = { quotas: Record<string, number>; data: string; utilizador: string };
export type ResultadoApuramento = { criadas: number; avisos: string[]; erro?: string };
export type PagamentoColabDados = {
  tipo: "Pagamento" | "Adiantamento";
  valor: number;
  meio: MeioPagamento;
  referencia: string;
};

type LinhaRem = {
  id: string; tipo: "Serviço" | "Ajuste"; servico_id: string | null; servico_codigo: string;
  recebimento_id: string | null; colaborador_id: string; valor_elegivel: number; percentagem: number;
  regra: string; valor: number; data: string; periodo: string; aprovada: boolean; motivo: string;
};
type LinhaPag = {
  id: string; colaborador_id: string; tipo: "Pagamento" | "Adiantamento"; data: string; valor: number;
  meio: MeioPagamento; referencia: string; utilizador_nome: string;
};
type LinhaCfg = {
  id: number; percentagem_equipa: number; modalidade: ModalidadeDistribuicao; entrada_em_vigor: string;
  accao: string; utilizador_nome: string; criado_em: string;
};
type LinhaQuota = { servico_id: string; colaborador_id: string; quota: number; definido_em: string; definido_por: string };
type LinhaPeriodo = { periodo: string };

type Ctx = {
  config: ConfigRemuneracao;
  remuneracoes: Remuneracao[];
  pagamentos: PagamentoColaborador[];
  periodosFechados: string[];
  quotas: Record<string, QuotaServico>;
  carregado: boolean;
  erro: string;
  apurar: () => Promise<ResultadoApuramento>;
  aprovarPeriodo: (periodo: string) => Promise<Resultado & { n?: number }>;
  fecharPeriodo: (periodo: string) => Promise<Resultado>;
  registarPagamento: (colaboradorId: string, dados: PagamentoColabDados) => Promise<Resultado>;
  registarAjuste: (colaboradorId: string, valor: number, motivo: string) => Promise<Resultado>;
  alterarConfig: (percentagem: number, modalidade: ModalidadeDistribuicao) => Promise<Resultado>;
  definirQuotas: (servicoId: string, quotas: Record<string, number>) => Promise<Resultado>;
};

const RemuneracoesContext = createContext<Ctx | null>(null);

const OCUPADO: Resultado = { ok: false, erro: "Operação em curso. Aguarde." };
const configInicial: ConfigRemuneracao = {
  percentagemEquipa: 40, modalidade: "Divisão igual", entradaEmVigor: "2026-01-01", historico: [],
};

async function comTrinco<T>(trinco: { current: boolean }, ocupado: T, fn: () => Promise<T>): Promise<T> {
  if (trinco.current) return ocupado;
  trinco.current = true;
  try {
    return await fn();
  } finally {
    trinco.current = false;
  }
}

export function RemuneracoesProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const [config, setConfig] = useState<ConfigRemuneracao>(configInicial);
  const [remuneracoes, setRemuneracoes] = useState<Remuneracao[]>([]);
  const [pagamentos, setPagamentos] = useState<PagamentoColaborador[]>([]);
  const [periodosFechados, setPeriodosFechados] = useState<string[]>([]);
  const [quotas, setQuotas] = useState<Record<string, QuotaServico>>({});
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState("");
  const emCurso = useRef(false);

  const recarregar = useCallback(async (): Promise<boolean> => {
    const [rem, pag, cfg, per, quo] = await Promise.all([
      buscarTudo<LinhaRem>("remuneracoes", "criado_em"),
      buscarTudo<LinhaPag>("pagamentos_colaboradores", "criado_em"),
      buscarTudo<LinhaCfg>("config_remuneracao", "id"),
      buscarTudo<LinhaPeriodo>("periodos_remuneracao", "periodo"),
      buscarTudo<LinhaQuota>("quotas_servico", "servico_id"),
    ]);
    const falha = [rem, pag, cfg, per, quo].find((x) => x.error);
    if (falha) {
      setErro("Não foi possível carregar as remunerações: " + falha.error);
      return false;
    }
    setErro("");

    setRemuneracoes(
      rem.data.map((l) => ({
        id: l.id, tipo: l.tipo, servicoId: l.servico_id ?? "", servicoCodigo: l.servico_codigo,
        recebimentoId: l.recebimento_id ?? "", colaboradorId: l.colaborador_id,
        valorElegivel: Number(l.valor_elegivel), percentagem: Number(l.percentagem), regra: l.regra,
        valor: Number(l.valor), data: l.data, periodo: l.periodo, aprovada: l.aprovada, motivo: l.motivo,
      }))
    );
    setPagamentos(
      pag.data.map((l) => ({
        id: l.id, colaboradorId: l.colaborador_id, tipo: l.tipo, data: l.data, valor: Number(l.valor),
        meio: l.meio, referencia: l.referencia, utilizador: l.utilizador_nome,
      }))
    );
    setPeriodosFechados(per.data.map((p) => p.periodo));

    if (cfg.data.length > 0) {
      const ultima = cfg.data[cfg.data.length - 1];
      setConfig({
        percentagemEquipa: Number(ultima.percentagem_equipa),
        modalidade: ultima.modalidade,
        entradaEmVigor: ultima.entrada_em_vigor,
        historico: cfg.data.map((c) => ({ id: "cf" + c.id, data: c.criado_em, utilizador: c.utilizador_nome, accao: c.accao })),
      });
    } else {
      setConfig(configInicial);
    }

    const mapa: Record<string, QuotaServico> = {};
    for (const q of quo.data) {
      if (!mapa[q.servico_id]) mapa[q.servico_id] = { quotas: {}, data: q.definido_em.slice(0, 10), utilizador: q.definido_por };
      mapa[q.servico_id].quotas[q.colaborador_id] = Number(q.quota);
    }
    setQuotas(mapa);
    return true;
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

  const apurar = useCallback(
    () =>
      comTrinco<ResultadoApuramento>(
        emCurso,
        { criadas: 0, avisos: [], erro: "Operação em curso. Aguarde." },
        async () => {
          const { data, error } = await getSupabase().rpc("apurar_remuneracoes");
          if (error) return { criadas: 0, avisos: [], erro: traduzirErro(error) };
          const r = data as unknown as { criadas: number; avisos: string[] | null };
          await recarregar();
          return { criadas: r.criadas, avisos: r.avisos ?? [] };
        }
      ),
    [recarregar]
  );

  const aprovarPeriodo = useCallback(
    (periodo: string) =>
      comTrinco<Resultado & { n?: number }>(emCurso, OCUPADO, async () => {
        const { data, error } = await getSupabase().rpc("aprovar_periodo", { p_periodo: periodo });
        if (error) return { ok: false, erro: traduzirErro(error) };
        await recarregar();
        return { ok: true, n: Number(data) };
      }),
    [recarregar]
  );

  const fecharPeriodo = useCallback(
    (periodo: string) =>
      comTrinco<Resultado>(emCurso, OCUPADO, async () => {
        const { error } = await getSupabase().rpc("fechar_periodo", { p_periodo: periodo });
        if (error) return { ok: false, erro: traduzirErro(error) };
        await recarregar();
        return { ok: true };
      }),
    [recarregar]
  );

  const registarPagamento = useCallback(
    (colaboradorId: string, dados: PagamentoColabDados) =>
      comTrinco<Resultado>(emCurso, OCUPADO, async () => {
        if (!colaboradorId) return { ok: false, erro: "Seleccione o colaborador." };
        if (!(dados.valor > 0)) return { ok: false, erro: "Indique um valor superior a zero." };
        const { error } = await getSupabase().rpc("registar_pagamento_colaborador", {
          p_colaborador: colaboradorId,
          p_tipo: dados.tipo,
          p_valor: dados.valor,
          p_meio: dados.meio,
          p_referencia: dados.referencia,
        });
        if (error) return { ok: false, erro: traduzirErro(error) };
        await recarregar();
        return { ok: true };
      }),
    [recarregar]
  );

  const registarAjuste = useCallback(
    (colaboradorId: string, valor: number, motivo: string) =>
      comTrinco<Resultado>(emCurso, OCUPADO, async () => {
        if (!colaboradorId) return { ok: false, erro: "Seleccione o colaborador." };
        if (!valor || Number.isNaN(valor)) return { ok: false, erro: "Indique um valor diferente de zero (negativo para deduzir)." };
        const { error } = await getSupabase().rpc("registar_ajuste", {
          p_colaborador: colaboradorId,
          p_valor: valor,
          p_motivo: motivo,
        });
        if (error) return { ok: false, erro: traduzirErro(error) };
        await recarregar();
        return { ok: true };
      }),
    [recarregar]
  );

  const alterarConfig = useCallback(
    (percentagem: number, modalidade: ModalidadeDistribuicao) =>
      comTrinco<Resultado>(emCurso, OCUPADO, async () => {
        if (Number.isNaN(percentagem) || percentagem < 0 || percentagem > 100)
          return { ok: false, erro: "A percentagem da equipa deve estar entre 0 e 100." };
        const { error } = await getSupabase().rpc("alterar_config_remuneracao", {
          p_percentagem: percentagem,
          p_modalidade: modalidade,
        });
        if (error) return { ok: false, erro: traduzirErro(error) };
        await recarregar();
        return { ok: true };
      }),
    [recarregar]
  );

  const definirQuotas = useCallback(
    (servicoId: string, q: Record<string, number>) =>
      comTrinco<Resultado>(emCurso, OCUPADO, async () => {
        if (!servicoId) return { ok: false, erro: "Seleccione o serviço." };
        for (const v of Object.values(q)) {
          if (typeof v !== "number" || Number.isNaN(v) || v < 0)
            return { ok: false, erro: "Indique uma quota válida (0 ou mais) para cada colaborador." };
        }
        const { error } = await getSupabase().rpc("definir_quotas", { p_servico: servicoId, p_quotas: q });
        if (error) return { ok: false, erro: traduzirErro(error) };
        await recarregar();
        return { ok: true };
      }),
    [recarregar]
  );

  const valor = useMemo(
    () => ({
      config, remuneracoes, pagamentos, periodosFechados, quotas, carregado, erro,
      apurar, aprovarPeriodo, fecharPeriodo, registarPagamento, registarAjuste, alterarConfig, definirQuotas,
    }),
    [config, remuneracoes, pagamentos, periodosFechados, quotas, carregado, erro, apurar, aprovarPeriodo, fecharPeriodo, registarPagamento, registarAjuste, alterarConfig, definirQuotas]
  );

  return (
    <RemuneracoesContext.Provider value={valor}>
      {erro && <div className="fixed inset-x-0 top-0 z-50 bg-red-600 p-2 text-center text-sm text-white">{erro}</div>}
      {children}
    </RemuneracoesContext.Provider>
  );
}

export function useRemuneracoes() {
  const ctx = useContext(RemuneracoesContext);
  if (!ctx) throw new Error("useRemuneracoes deve ser usado dentro de RemuneracoesProvider");
  return ctx;
}