import type { EventoHistorico } from "./types";

export type Produto = {
  id: string;
  codigo: string;
  nome: string;
  categoria: string;
  unidade: string;
  quantidade: number;
  minimo: number;
  fornecedor: string;
  custo: number;
  estado: "Activo" | "Inactivo";
  ultimaEntrada: string;
};

export const categoriasProduto = ["Detergentes", "Produtos para tecidos", "Desinfectantes", "Escovas e panos", "Outros consumíveis"];

export const tiposMovimento = [
  "Entrada por compra",
  "Saída para utilização",
  "Devolução",
  "Ajuste de inventário",
  "Perda ou inutilização",
] as const;
export type TipoMovimento = (typeof tiposMovimento)[number];

export type MovimentoStock = {
  id: string;
  produtoId: string;
  tipo: TipoMovimento;
  variacao: number;
  saldoApos: number;
  data: string;
  responsavel: string;
  motivo: string;
};

export const estadosEquipamento = ["Operacional", "Em manutenção", "Avariado", "Abatido"] as const;
export type EstadoEquipamento = (typeof estadosEquipamento)[number];

export const categoriasEquipamento = [
  "Aspirador", "Máquina de extracção", "Máquina de lavagem", "Extensão eléctrica", "Equipamento de protecção", "Outro",
];

export type Manutencao = { id: string; data: string; descricao: string; custo: number };

export type Equipamento = {
  id: string;
  codigo: string;
  nome: string;
  categoria: string;
  estado: EstadoEquipamento;
  dataAquisicao: string;
  responsavelId: string;
  observacoes: string;
  manutencoes: Manutencao[];
  historico: EventoHistorico[];
};

export const tiposOcorrencia = [
  "Reclamação do cliente", "Danos identificados", "Equipamento avariado", "Atraso no serviço",
  "Falta de material", "Problema técnico", "Necessidade de intervenção adicional",
] as const;

export const estadosOcorrencia = ["Aberta", "Em análise", "Em resolução", "Resolvida", "Encerrada"] as const;
export type EstadoOcorrencia = (typeof estadosOcorrencia)[number];

export const transicoesOcorrencia: Record<EstadoOcorrencia, EstadoOcorrencia[]> = {
  Aberta: ["Em análise"],
  "Em análise": ["Em resolução", "Resolvida"],
  "Em resolução": ["Resolvida"],
  Resolvida: ["Encerrada", "Em análise"],
  Encerrada: [],
};

export type Ocorrencia = {
  id: string;
  codigo: string;
  servicoId: string;
  data: string;
  tipo: string;
  descricao: string;
  pessoas: string;
  responsavel: string;
  estado: EstadoOcorrencia;
  historico: EventoHistorico[];
};

export type Empresa = {
  nome: string;
  nif: string;
  morada: string;
  telefone: string;
  email: string;
  rodape: string;
  condicoes: string;
};

export type TipoDocumento = "orcamento" | "ordem" | "ficha" | "mapa" | "recibo" | "termo" | "financeiro";

export const nomesDocumento: Record<TipoDocumento, string> = {
  orcamento: "Orçamento",
  ordem: "Ordem de serviço",
  ficha: "Ficha de serviço concluído",
  mapa: "Mapa mensal de remunerações",
  recibo: "Recibo de pagamento ao colaborador",
  termo: "Termo de entrega de equipamento",
  financeiro: "Relatório financeiro",
};

export const prefixosDocumento: Record<TipoDocumento, string> = {
  orcamento: "ORC", ordem: "OS", ficha: "FSC", mapa: "MAP", recibo: "REC", termo: "TEE", financeiro: "RF",
};

export const tiposDocumento = Object.keys(nomesDocumento) as TipoDocumento[];

export type DocumentoEmitido = {
  id: string;
  tipo: TipoDocumento;
  refId: string;
  numero: string;
  dataEmissao: string;
  utilizador: string;
};