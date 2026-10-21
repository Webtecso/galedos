import type { CatalogoServico, Colaborador, Servico } from "@/lib/types";

export const colaboradoresMock: Colaborador[] = [
  { id: "col1", codigo: "COL-0001", nome: "Pedro Manuel", funcao: "Técnico de limpeza", activo: true },
  { id: "col2", codigo: "COL-0002", nome: "Joana Kiala", funcao: "Técnica de limpeza", activo: true },
  { id: "col3", codigo: "COL-0003", nome: "Domingos Neto", funcao: "Técnico de limpeza", activo: true },
  { id: "col4", codigo: "COL-0004", nome: "Sandra Pires", funcao: "Técnica de limpeza", activo: true },
];

export const catalogoMock: CatalogoServico[] = [
  { id: "cat1", codigo: "SRV-001", nome: "Lavagem de sofá", descricao: "Lavagem e higienização de sofá (por unidade).", unidade: "unidade", preco: 25000, duracaoMin: 120, activo: true },
  { id: "cat2", codigo: "SRV-002", nome: "Lavagem de poltrona", descricao: "Lavagem e higienização de poltrona.", unidade: "unidade", preco: 10000, duracaoMin: 60, activo: true },
  { id: "cat3", codigo: "SRV-003", nome: "Lavagem de colchão", descricao: "Lavagem e desinfecção de colchão.", unidade: "unidade", preco: 15000, duracaoMin: 60, activo: true },
  { id: "cat4", codigo: "SRV-004", nome: "Lavagem de cadeiras estofadas", descricao: "Lavagem de cadeiras estofadas.", unidade: "unidade", preco: 5000, duracaoMin: 15, activo: true },
  { id: "cat5", codigo: "SRV-005", nome: "Limpeza de interior de viatura", descricao: "Limpeza completa de bancos e interior.", unidade: "viatura", preco: 18000, duracaoMin: 90, activo: true },
  { id: "cat6", codigo: "SRV-006", nome: "Lavagem de carpetes e tapetes", descricao: "Cobrança por metro quadrado.", unidade: "m²", preco: 3500, duracaoMin: 20, activo: false },
];

function seed(
  n: number, clienteId: string, catalogoId: string, tipo: string, qtd: number, preco: number,
  data: string, hora: string, duracaoMin: number, local: string, equipa: string[],
  estado: Servico["estadoOperacional"], recebido: number
): Servico {
  const criado = (data < "2026-10-15" ? data : "2026-10-15") + "T08:00:00.000Z";
  return {
    id: "s" + n,
    codigo: "GAL-2026-" + String(n).padStart(4, "0"),
    clienteId, dataCriacao: criado, catalogoId, tipoServico: tipo,
    descricao: "", quantidade: qtd, precoUnitario: preco, desconto: 0, total: qtd * preco,
    data, hora, duracaoMin, local, colaboradorIds: equipa,
    estadoOperacional: estado, motivoCancelamento: "",
    recebimentos: recebido > 0
      ? [{ id: "r" + n, data, valor: recebido, meio: "Dinheiro", referencia: "", utilizador: "Administrador" }]
      : [],
    observacoes: "", excepcaoConflito: false,
    historico: [{ id: "h" + n, data: criado, utilizador: "Administrador", accao: "Serviço criado (estado: " + estado + ")" }],
  };
}

export const servicosMock: Servico[] = [
  seed(1, "c1", "cat1", "Lavagem de sofá", 1, 25000, "2026-01-15", "09:00", 120, "Rua Direita do Miramar, 45", ["col1", "col2"], "Concluído", 25000),
  seed(2, "c2", "cat3", "Lavagem de colchão", 6, 15000, "2026-02-01", "08:00", 360, "Av. 4 de Fevereiro, 120", ["col1", "col2"], "Concluído", 90000),
  seed(3, "c4", "cat2", "Lavagem de poltrona", 2, 10000, "2026-03-01", "10:00", 120, "Rua da Samba, 8", ["col3"], "Concluído", 20000),
  seed(4, "c1", "cat1", "Lavagem de sofá", 1, 25000, "2026-10-20", "09:00", 120, "Rua Direita do Miramar, 45", ["col1", "col2"], "Agendado", 0),
  seed(5, "c2", "cat3", "Lavagem de colchão", 6, 15000, "2026-10-19", "11:30", 240, "Av. 4 de Fevereiro, 120", ["col3", "col4"], "Em execução", 45000),
  seed(6, "c3", "cat5", "Limpeza de interior de viatura", 1, 18000, "2026-10-20", "14:00", 90, "Condomínio Jardins do Kilamba, Bloco C", ["col1"], "Agendado", 0),
  seed(7, "c5", "cat4", "Lavagem de cadeiras estofadas", 12, 5000, "2026-04-14", "09:00", 180, "Rua Rainha Ginga, 77", ["col3", "col4"], "Concluído", 30000),
  seed(8, "c7", "cat3", "Lavagem de colchão", 1, 15000, "2026-05-06", "15:00", 60, "Rua Comandante Gika, 31", ["col2"], "Concluído", 15000),
  seed(9, "c8", "cat4", "Lavagem de cadeiras estofadas", 20, 5000, "2026-06-03", "08:30", 300, "Edifício Torres do Carmo, 5.º andar", ["col1", "col2", "col3"], "Concluído", 100000),
];