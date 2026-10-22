"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { DocumentoEmitido, TipoDocumento } from "@/lib/operacao";
import { useAuth } from "@/components/auth/AuthProvider";
import { getSupabase } from "@/lib/supabase/client";

type Linha = {
  id: string; tipo: TipoDocumento; ref_id: string; numero: string; data_emissao: string; utilizador_nome: string;
};

function deLinha(l: Linha): DocumentoEmitido {
  return { id: l.id, tipo: l.tipo, refId: l.ref_id, numero: l.numero, dataEmissao: l.data_emissao, utilizador: l.utilizador_nome };
}

type Ctx = {
  documentos: DocumentoEmitido[];
  carregado: boolean;
  emitir: (tipo: TipoDocumento, refId: string) => Promise<DocumentoEmitido | null>;
  recarregar: () => Promise<void>;
};

const DocumentosContext = createContext<Ctx | null>(null);

export function DocumentosProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const [documentos, setDocumentos] = useState<DocumentoEmitido[]>([]);
  const [carregado, setCarregado] = useState(false);
  const registo = useRef<DocumentoEmitido[]>([]);
  const pendentes = useRef(new Map<string, Promise<DocumentoEmitido | null>>());

  const recarregar = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from("documentos_emitidos")
      .select("*")
      .order("numero", { ascending: false })
      .limit(1000);
    if (error) return;
    registo.current = (data as unknown as Linha[]).map(deLinha);
    setDocumentos(registo.current);
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

  // Idempotente: o mesmo documento (tipo + referência) mantém sempre o mesmo número.
  const emitir = useCallback((tipo: TipoDocumento, refId: string): Promise<DocumentoEmitido | null> => {
    const existente = registo.current.find((d) => d.tipo === tipo && d.refId === refId);
    if (existente) return Promise.resolve(existente);
    const chave = tipo + ":" + refId;
    const emCurso = pendentes.current.get(chave);
    if (emCurso) return emCurso;
    const p = (async (): Promise<DocumentoEmitido | null> => {
      try {
        const { data, error } = await getSupabase().rpc("emitir_documento", { p_tipo: tipo, p_ref: refId });
        if (error || !data) return null;
        const novo = deLinha(data as unknown as Linha);
        if (!registo.current.some((d) => d.id === novo.id)) {
          registo.current = [...registo.current, novo];
          setDocumentos(registo.current);
        }
        return novo;
      } finally {
        pendentes.current.delete(chave);
      }
    })();
    pendentes.current.set(chave, p);
    return p;
  }, []);

  const valor = useMemo(() => ({ documentos, carregado, emitir, recarregar }), [documentos, carregado, emitir, recarregar]);
  return <DocumentosContext.Provider value={valor}>{children}</DocumentosContext.Provider>;
}

export function useDocumentos() {
  const ctx = useContext(DocumentosContext);
  if (!ctx) throw new Error("useDocumentos deve ser usado dentro de DocumentosProvider");
  return ctx;
}