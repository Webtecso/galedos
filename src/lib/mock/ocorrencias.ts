import type { Ocorrencia } from "@/lib/operacao";

export const ocorrenciasMock: Ocorrencia[] = [
  {
    id: "o1", codigo: "OCO-0001", servicoId: "s3", data: "2026-03-02", tipo: "Reclamação do cliente",
    descricao: "Cliente referiu uma mancha que permaneceu numa das poltronas.", pessoas: "Ana Costa", responsavel: "Administrador",
    estado: "Resolvida",
    historico: [
      { id: "oh1", data: "2026-03-02T10:00:00.000Z", utilizador: "Administrador", accao: "Ocorrência registada (estado: Aberta)" },
      { id: "oh2", data: "2026-03-03T09:00:00.000Z", utilizador: "Administrador", accao: "Medida adoptada: nova limpeza da zona afectada, sem custos para o cliente." },
      { id: "oh3", data: "2026-03-04T09:00:00.000Z", utilizador: "Administrador", accao: "Estado alterado de \"Aberta\" para \"Resolvida\"" },
    ],
  },
];