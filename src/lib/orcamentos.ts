export type EstadoOrcamento = "Enviado" | "Aceite" | "Recusado";

export type Orcamento = {
  id: string;
  servicoId: string;
  numero: string;
  valor: number;
  dataEnvio: string;
  estado: EstadoOrcamento;
  dataResposta: string;
  motivo: string;
  utilizador: string;
};

export const estadosPreExecucao = [
  "Pedido recebido",
  "A aguardar orçamento",
  "Orçamento enviado",
  "A aguardar confirmação",
] as const;