"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { EventoHistorico } from "@/lib/types";
import { transicoesOcorrencia, type EstadoOcorrencia, type Ocorrencia } from "@/lib/operacao";
import { ocorrenciasMock } from "@/lib/mock/ocorrencias";
import type { Resultado } from "@/components/servicos/ServicosProvider";
import { UTILIZADOR_ACTUAL } from "@/lib/servicos";

export type OcorrenciaDados = Omit<Ocorrencia, "id" | "codigo" | "estado" | "historico">;

type Ctx = {
  ocorrencias: Ocorrencia[];
  carregado: boolean;
  obter: (id: string) => Ocorrencia | undefined;
  criar: (d: OcorrenciaDados) => { resultado: Resultado; ocorrencia?: Ocorrencia };
  mudarEstado: (id: string, novo: EstadoOcorrencia) => Resultado;
  adicionarMedida: (id: string, texto: string) => Resultado;
};

const OcorrenciasContext = createContext<Ctx | null>(null);
const CHAVE = "galedos.ocorrencias.v1";

function evento(accao: string): EventoHistorico {
  return {
    id: "oh" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    data: new Date().toISOString(),
    utilizador: UTILIZADOR_ACTUAL,
    accao,
  };
}

export function OcorrenciasProvider({ children }: { children: React.ReactNode }) {
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>(ocorrenciasMock);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHAVE);
      if (raw) setOcorrencias(JSON.parse(raw) as Ocorrencia[]);
    } catch {
      /* ignora */
    }
    setCarregado(true);
  }, []);

  useEffect(() => {
    if (!carregado) return;
    try {
      localStorage.setItem(CHAVE, JSON.stringify(ocorrencias));
    } catch {
      /* ignora */
    }
  }, [ocorrencias, carregado]);

  const obter = useCallback((id: string) => ocorrencias.find((o) => o.id === id), [ocorrencias]);

  const criar = useCallback(
    (d: OcorrenciaDados) => {
      if (!d.tipo) return { resultado: { ok: false, erro: "Seleccione o tipo de ocorrência." } };
      if (!d.descricao.trim()) return { resultado: { ok: false, erro: "Descreva a ocorrência." } };
      if (!d.data) return { resultado: { ok: false, erro: "Indique a data." } };
      const maior = ocorrencias.reduce((max, o) => {
        const n = parseInt(o.codigo.replace("OCO-", ""), 10);
        return Number.isNaN(n) ? max : Math.max(max, n);
      }, 0);
      const nova: Ocorrencia = {
        ...d,
        descricao: d.descricao.trim(),
        id: "o" + Date.now().toString(36),
        codigo: "OCO-" + String(maior + 1).padStart(4, "0"),
        estado: "Aberta",
        historico: [evento("Ocorrência registada (estado: Aberta)")],
      };
      setOcorrencias((l) => [nova, ...l]);
      return { resultado: { ok: true } as Resultado, ocorrencia: nova };
    },
    [ocorrencias]
  );

  const mudarEstado = useCallback(
    (id: string, novo: EstadoOcorrencia): Resultado => {
      const o = ocorrencias.find((x) => x.id === id);
      if (!o) return { ok: false, erro: "Ocorrência não encontrada." };
      if (!transicoesOcorrencia[o.estado].includes(novo))
        return { ok: false, erro: `Não é possível passar de "${o.estado}" para "${novo}".` };
      setOcorrencias((l) =>
        l.map((x) =>
          x.id === id
            ? { ...x, estado: novo, historico: [...x.historico, evento(`Estado alterado de "${x.estado}" para "${novo}"`)] }
            : x
        )
      );
      return { ok: true };
    },
    [ocorrencias]
  );

  const adicionarMedida = useCallback(
    (id: string, texto: string): Resultado => {
      const o = ocorrencias.find((x) => x.id === id);
      if (!o) return { ok: false, erro: "Ocorrência não encontrada." };
      if (o.estado === "Encerrada") return { ok: false, erro: "A ocorrência está encerrada." };
      if (!texto.trim()) return { ok: false, erro: "Descreva a medida ou decisão." };
      setOcorrencias((l) =>
        l.map((x) => (x.id === id ? { ...x, historico: [...x.historico, evento(`Medida adoptada: ${texto.trim()}`)] } : x))
      );
      return { ok: true };
    },
    [ocorrencias]
  );

  const valor = useMemo(
    () => ({ ocorrencias, carregado, obter, criar, mudarEstado, adicionarMedida }),
    [ocorrencias, carregado, obter, criar, mudarEstado, adicionarMedida]
  );
  return <OcorrenciasContext.Provider value={valor}>{children}</OcorrenciasContext.Provider>;
}

export function useOcorrencias() {
  const ctx = useContext(OcorrenciasContext);
  if (!ctx) throw new Error("useOcorrencias deve ser usado dentro de OcorrenciasProvider");
  return ctx;
}