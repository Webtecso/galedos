"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { EstadoOcorrencia, Ocorrencia } from "@/lib/operacao";
import type { Resultado } from "@/components/servicos/ServicosProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { getSupabase } from "@/lib/supabase/client";
import { traduzirErro } from "@/lib/erros";

export type OcorrenciaDados = Omit<Ocorrencia, "id" | "codigo" | "estado" | "historico">;

type LinhaHist = { id: number | string; data: string; utilizador_nome: string; accao: string };
type Linha = {
  id: string; codigo: string; servico_id: string | null; data: string; tipo: string; descricao: string;
  pessoas: string; responsavel: string; estado: EstadoOcorrencia;
  ocorrencia_historico: LinhaHist[] | null;
};

function deLinha(l: Linha): Ocorrencia {
  const historico = [...(l.ocorrencia_historico ?? [])]
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map((h) => ({ id: "oh" + h.id, data: h.data, utilizador: h.utilizador_nome, accao: h.accao }));
  return {
    id: l.id,
    codigo: l.codigo,
    servicoId: l.servico_id ?? "",
    data: l.data,
    tipo: l.tipo,
    descricao: l.descricao,
    pessoas: l.pessoas,
    responsavel: l.responsavel,
    estado: l.estado,
    historico,
  };
}

type Ctx = {
  ocorrencias: Ocorrencia[];
  carregado: boolean;
  obter: (id: string) => Ocorrencia | undefined;
  criar: (d: OcorrenciaDados) => Promise<{ resultado: Resultado; ocorrencia?: Ocorrencia }>;
  mudarEstado: (id: string, novo: EstadoOcorrencia) => Promise<Resultado>;
  adicionarMedida: (id: string, texto: string) => Promise<Resultado>;
};

const OcorrenciasContext = createContext<Ctx | null>(null);

export function OcorrenciasProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState("");
  const emCurso = useRef(false);

  const carregar = useCallback(async (): Promise<Ocorrencia[] | null> => {
    const { data, error } = await getSupabase()
      .from("ocorrencias")
      .select("*, ocorrencia_historico(*)")
      .order("codigo", { ascending: false })
      .limit(1000);
    if (error) {
      setErro("Não foi possível carregar as ocorrências: " + error.message);
      return null;
    }
    setErro("");
    const lista = (data as unknown as Linha[]).map(deLinha);
    setOcorrencias(lista);
    return lista;
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

  const obter = useCallback((id: string) => ocorrencias.find((o) => o.id === id), [ocorrencias]);

  const chamar = useCallback(
    async (fn: string, args: Record<string, unknown>): Promise<{ resultado: Resultado; data?: unknown }> => {
      if (emCurso.current) return { resultado: { ok: false, erro: "Operação em curso. Aguarde." } };
      emCurso.current = true;
      try {
        const { data, error } = await getSupabase().rpc(fn, args);
        if (error) return { resultado: { ok: false, erro: traduzirErro(error) } };
        await carregar();
        return { resultado: { ok: true }, data };
      } finally {
        emCurso.current = false;
      }
    },
    [carregar]
  );

  const criar = useCallback(
    async (d: OcorrenciaDados) => {
      const r = await chamar("criar_ocorrencia", {
        p: {
          servico_id: d.servicoId || null,
          data: d.data,
          tipo: d.tipo,
          descricao: d.descricao,
          pessoas: d.pessoas,
          responsavel: d.responsavel,
        },
      });
      return { resultado: r.resultado, ocorrencia: undefined as Ocorrencia | undefined };
    },
    [chamar]
  );

  const mudarEstado = useCallback(
    async (id: string, novo: EstadoOcorrencia): Promise<Resultado> =>
      (await chamar("mudar_estado_ocorrencia", { p_id: id, p_novo: novo })).resultado,
    [chamar]
  );

  const adicionarMedida = useCallback(
    async (id: string, texto: string): Promise<Resultado> =>
      (await chamar("adicionar_medida_ocorrencia", { p_id: id, p_texto: texto })).resultado,
    [chamar]
  );

  const valor = useMemo(
    () => ({ ocorrencias, carregado, obter, criar, mudarEstado, adicionarMedida }),
    [ocorrencias, carregado, obter, criar, mudarEstado, adicionarMedida]
  );
  return (
    <OcorrenciasContext.Provider value={valor}>
      {erro && <div className="fixed inset-x-0 top-0 z-50 bg-red-600 p-2 text-center text-sm text-white">{erro}</div>}
      {children}
    </OcorrenciasContext.Provider>
  );
}

export function useOcorrencias() {
  const ctx = useContext(OcorrenciasContext);
  if (!ctx) throw new Error("useOcorrencias deve ser usado dentro de OcorrenciasProvider");
  return ctx;
}