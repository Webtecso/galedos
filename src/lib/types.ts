export type TipoCliente = "Particular" | "Empresa";
export type EstadoCliente = "Activo" | "Inactivo";

export type Cliente = {
  id: string;
  codigo: string;
  nome: string;
  tipo: TipoCliente;
  telefone: string;
  email: string;
  endereco: string;
  localizacao: string;
  latitude?: number | null;
  longitude?: number | null;
  nif: string;
  dataRegisto: string;
  observacoes: string;
  estado: EstadoCliente;
};

export type ServicoCliente = {
  codigo: string;
  clienteId: string;
  servico: string;
  data: string;
  valor: number;
  recebido: number;
  estadoOperacional: string;
};

export type EstadoOperacional =
  | "Pedido recebido"
  | "A aguardar orçamento"
  | "Orçamento enviado"
  | "A aguardar confirmação"
  | "Agendado"
  | "Em execução"
  | "Concluído"
  | "Cancelado";

export type EstadoFinanceiro =
  | "Sem pagamento"
  | "Parcialmente pago"
  | "Totalmente pago"
  | "Reembolso pendente";

export type MeioPagamento = "Dinheiro" | "Transferência bancária" | "Multicaixa Express" | "Outro";

export type Recebimento = {
  id: string;
  data: string;
  valor: number;
  meio: MeioPagamento;
  referencia: string;
  utilizador: string;
};

export type EventoHistorico = {
  id: string;
  data: string;
  utilizador: string;
  accao: string;
};

export type CatalogoServico = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
  unidade: string;
  preco: number;
  duracaoMin: number;
  activo: boolean;
};

export type Colaborador = {
  id: string;
  codigo: string;
  nome: string;
  funcao: string;
  activo: boolean;
};

export type Servico = {
  id: string;
  codigo: string;
  clienteId: string;
  dataCriacao: string;
  catalogoId: string;
  tipoServico: string;
  descricao: string;
  quantidade: number;
  precoUnitario: number;
  desconto: number;
  total: number;
  data: string;
  hora: string;
  duracaoMin: number;
  local: string;
  colaboradorIds: string[];
  estadoOperacional: EstadoOperacional;
  motivoCancelamento: string;
  recebimentos: Recebimento[];
  observacoes: string;
  excepcaoConflito: boolean;
  historico: EventoHistorico[];
};

export type EstadoColaborador = "Activo" | "Inactivo" | "Suspenso";
export type ModalidadeContrato = "Contrato de trabalho" | "Prestação de serviços" | "Colaboração ocasional";

export type ColaboradorCompleto = Colaborador & {
  telefone: string;
  dataInicio: string;
  modalidade: ModalidadeContrato;
  contrato: string;
  percentagem: number;
  estado: EstadoColaborador;
  observacoes: string;
};

export type ModalidadeDistribuicao = "Divisão igual" | "Percentagens individuais" | "Quotas por serviço";

export type EstadoRemuneracao =
  | "Apurada"
  | "Aprovada"
  | "Parcialmente paga"
  | "Paga";

export type Remuneracao = {
  id: string;
  tipo: "Serviço" | "Ajuste";
  servicoId: string;
  servicoCodigo: string;
  recebimentoId: string;
  colaboradorId: string;
  valorElegivel: number;
  percentagem: number;
  regra: string;
  valor: number;
  data: string;
  periodo: string;
  aprovada: boolean;
  motivo: string;
};

export type PagamentoColaborador = {
  id: string;
  colaboradorId: string;
  tipo: "Pagamento" | "Adiantamento";
  data: string;
  valor: number;
  meio: MeioPagamento;
  referencia: string;
  utilizador: string;
};

export type ConfigRemuneracao = {
  percentagemEquipa: number;
  modalidade: ModalidadeDistribuicao;
  entradaEmVigor: string;
  historico: EventoHistorico[];
};

export type EstadoDespesa = "Pago" | "Por pagar" | "Anulada";

export type Despesa = {
  id: string;
  codigo: string;
  data: string;
  categoria: string;
  descricao: string;
  valor: number;
  fornecedor: string;
  meio: MeioPagamento;
  referencia: string;
  estado: EstadoDespesa;
  observacoes: string;
  motivoAnulacao: string;
  historico: EventoHistorico[];
};