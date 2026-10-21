"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { estadosPreExecucao, type Orcamento } from "@/lib/orcamentos";
import { useServicos, type Resultado } from "@/components/servicos/ServicosProvider";
import { useDocumentos } from "@/components/documentos/DocumentosProvider";
import { UTILIZADOR_ACTUAL } from "@/lib/servicos";
import { hojeISO } from "@/lib/format";

type Ctx = {
  orcamentos: Orcamento[];
  carregado: boolean;
  registar: (servicoId: string) => Resultado;
  responder: (id: string, aceite: boolean, motivo?: string) => Resultado;
};

const OrcamentosContext = createContext<Ctx | null>(null);
const CHAVE = "galedos.orcamentos.v1";

export function OrcamentosProvider({ children }: { children: React.ReactNode }) {
  const { servicos } = useServicos();
  const { emitir } = useDocumentos();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHAVE);
      if (raw) setOrcamentos(JSON.parse(raw) as Orcamento[]);
    } catch {
      /* ignora */
    }
    setCarregado(true);
  }, []);

  useEffect(() => {
    if (!carregado) return;
    try {
      localStorage.setItem(CHAVE, JSON.stringify(orcamentos));
    } catch {
      /* ignora */
    }
  }, [orcamentos, carregado]);

  const registar = useCallback(
    (servicoId: string): Resultado => {
      const s = servicos.find((x) => x.id === servicoId);
      if (!s) return { ok: false, erro: "Seleccione o serviço." };
      if (!(estadosPreExecucao as readonly string[]).includes(s.estadoOperacional))
        return { ok: false, erro: "Só é possível registar orçamento antes de o serviço ser agendado." };
      if (orcamentos.some((o) => o.servicoId === servicoId))
        return { ok: false, erro: "Este serviço já tem um orçamento registado." };
      if (!(s.total > 0)) return { ok: false, erro: "O serviço tem valor total zero." };
      const doc = emitir("orcamento", servicoId);
      const novo: Orcamento = {
        id: "orc" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        servicoId,
        numero: doc.numero,
        valor: s.total,
        dataEnvio: hojeISO(),
        estado: "Enviado",
        dataResposta: "",
        motivo: "",
        utilizador: UTILIZADOR_ACTUAL,
      };
      setOrcamentos((l) => [novo, ...l]);
      return { ok: true };
    },
    [servicos, orcamentos, emitir]
  );

  const responder = useCallback(
    (id: string, aceite: boolean, motivo?: string): Resultado => {
      const o = orcamentos.find((x) => x.id === id);
      if (!o) return { ok: false, erro: "Orçamento não encontrado." };
      if (o.estado !== "Enviado") return { ok: false, erro: "Este orçamento já foi respondido." };
      setOrcamentos((l) =>
        l.map((x) =>
          x.id === id
            ? { ...x, estado: aceite ? "Aceite" : "Recusado", dataResposta: hojeISO(), motivo: (motivo ?? "").trim() }
            : x
        )
      );
      return { ok: true };
    },
    [orcamentos]
  );

  const valor = useMemo(() => ({ orcamentos, carregado, registar, responder }), [orcamentos, carregado, registar, responder]);
  return <OrcamentosContext.Provider value={valor}>{children}</OrcamentosContext.Provider>;
}

export function useOrcamentos() {
  const ctx = useContext(OrcamentosContext);
  if (!ctx) throw new Error("useOrcamentos deve ser usado dentro de OrcamentosProvider");
  return ctx;
}