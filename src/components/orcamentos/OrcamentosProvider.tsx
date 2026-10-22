"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { EstadoOrcamento, Orcamento } from "@/lib/orcamentos";
import type { Resultado } from "@/components/servicos/ServicosProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { useDocumentos } from "@/components/documentos/DocumentosProvider";
import { getSupabase } from "@/lib/supabase/client";
import { traduzirErro } from "@/lib/erros";

type Linha = {
  id: string; servico_id: string; numero: string; valor: number; data_envio: string; estado: EstadoOrcamento;
  data_resposta: string | null; motivo: string; utilizador_nome: string;
};

function deLinha(l: Linha): Orcamento {
  return {
    id: l.id,
    servicoId: l.servico_id,
    numero: l.numero,
    valor: Number(l.valor),
    dataEnvio: l.data_envio,
    estado: l.estado,
    dataResposta: l.data_resposta ?? "",
    motivo: l.motivo,
    utilizador: l.utilizador_nome,
  };
}

type Ctx = {
  orcamentos: Orcamento[];
  carregado: boolean;
  registar: (servicoId: string) => Promise<Resultado>;
  responder: (id: string, aceite: boolean, motivo?: string) => Promise<Resultado>;
};

const OrcamentosContext = createContext<Ctx | null>(null);

export function OrcamentosProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const { recarregar: recarregarDocumentos } = useDocumentos();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [carregado, setCarregado] = useState(false);
  const emCurso = useRef(false);

  const carregar = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from("orcamentos")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(1000);
    if (error) return;
    setOrcamentos((data as unknown as Linha[]).map(deLinha));
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

  const registar = useCallback(
    async (servicoId: string): Promise<Resultado> => {
      if (!servicoId) return { ok: false, erro: "Seleccione o serviço." };
      if (emCurso.current) return { ok: false, erro: "Operação em curso. Aguarde." };
      emCurso.current = true;
      try {
        const { error } = await getSupabase().rpc("registar_orcamento", { p_servico: servicoId });
        if (error) return { ok: false, erro: traduzirErro(error) };
        await Promise.all([carregar(), recarregarDocumentos()]);
        return { ok: true };
      } finally {
        emCurso.current = false;
      }
    },
    [carregar, recarregarDocumentos]
  );

  const responder = useCallback(
    async (id: string, aceite: boolean, motivo?: string): Promise<Resultado> => {
      if (emCurso.current) return { ok: false, erro: "Operação em curso. Aguarde." };
      emCurso.current = true;
      try {
        const { error } = await getSupabase().rpc("responder_orcamento", {
          p_id: id,
          p_aceite: aceite,
          p_motivo: (motivo ?? "").trim(),
        });
        if (error) return { ok: false, erro: traduzirErro(error) };
        await carregar();
        return { ok: true };
      } finally {
        emCurso.current = false;
      }
    },
    [carregar]
  );

  const valor = useMemo(() => ({ orcamentos, carregado, registar, responder }), [orcamentos, carregado, registar, responder]);
  return <OrcamentosContext.Provider value={valor}>{children}</OrcamentosContext.Provider>;
}

export function useOrcamentos() {
  const ctx = useContext(OrcamentosContext);
  if (!ctx) throw new Error("useOrcamentos deve ser usado dentro de OrcamentosProvider");
  return ctx;
}