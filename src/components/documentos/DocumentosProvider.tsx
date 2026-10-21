"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { prefixosDocumento, type DocumentoEmitido, type TipoDocumento } from "@/lib/operacao";
import { UTILIZADOR_ACTUAL } from "@/lib/servicos";
import { hojeISO } from "@/lib/format";

type Ctx = {
  documentos: DocumentoEmitido[];
  carregado: boolean;
  emitir: (tipo: TipoDocumento, refId: string) => DocumentoEmitido;
};

const DocumentosContext = createContext<Ctx | null>(null);
const CHAVE = "galedos.documentos.v1";

export function DocumentosProvider({ children }: { children: React.ReactNode }) {
  const [documentos, setDocumentos] = useState<DocumentoEmitido[]>([]);
  const [carregado, setCarregado] = useState(false);
  const registo = useRef<DocumentoEmitido[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHAVE);
      if (raw) {
        registo.current = JSON.parse(raw) as DocumentoEmitido[];
        setDocumentos(registo.current);
      }
    } catch {
      /* ignora */
    }
    setCarregado(true);
  }, []);

  useEffect(() => {
    if (!carregado) return;
    try {
      localStorage.setItem(CHAVE, JSON.stringify(documentos));
    } catch {
      /* ignora */
    }
  }, [documentos, carregado]);

  // Idempotente: o mesmo documento (tipo + referência) mantém sempre o mesmo número.
  const emitir = useCallback((tipo: TipoDocumento, refId: string): DocumentoEmitido => {
    const existente = registo.current.find((d) => d.tipo === tipo && d.refId === refId);
    if (existente) return existente;
    const ano = new Date().getFullYear();
    const prefixo = `${prefixosDocumento[tipo]}-${ano}-`;
    const maior = registo.current.reduce((max, d) => {
      if (!d.numero.startsWith(prefixo)) return max;
      const n = parseInt(d.numero.slice(prefixo.length), 10);
      return Number.isNaN(n) ? max : Math.max(max, n);
    }, 0);
    const novo: DocumentoEmitido = {
      id: "doc" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      tipo,
      refId,
      numero: prefixo + String(maior + 1).padStart(4, "0"),
      dataEmissao: hojeISO(),
      utilizador: UTILIZADOR_ACTUAL,
    };
    registo.current = [...registo.current, novo];
    setDocumentos(registo.current);
    return novo;
  }, []);

  const valor = useMemo(() => ({ documentos, carregado, emitir }), [documentos, carregado, emitir]);
  return <DocumentosContext.Provider value={valor}>{children}</DocumentosContext.Provider>;
}

export function useDocumentos() {
  const ctx = useContext(DocumentosContext);
  if (!ctx) throw new Error("useDocumentos deve ser usado dentro de DocumentosProvider");
  return ctx;
}