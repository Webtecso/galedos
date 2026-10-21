import type { Equipamento, Produto } from "@/lib/operacao";

export const produtosMock: Produto[] = [
  { id: "p1", codigo: "PRD-0001", nome: "Detergente para estofados", categoria: "Detergentes", unidade: "litro", quantidade: 3, minimo: 5, fornecedor: "Casa da Química", custo: 1400, estado: "Activo", ultimaEntrada: "2026-10-02" },
  { id: "p2", codigo: "PRD-0002", nome: "Desinfectante para colchões", categoria: "Desinfectantes", unidade: "litro", quantidade: 12, minimo: 4, fornecedor: "Casa da Química", custo: 1800, estado: "Activo", ultimaEntrada: "2026-09-20" },
  { id: "p3", codigo: "PRD-0003", nome: "Escovas de limpeza", categoria: "Escovas e panos", unidade: "unidade", quantidade: 8, minimo: 3, fornecedor: "", custo: 900, estado: "Activo", ultimaEntrada: "2026-08-15" },
  { id: "p4", codigo: "PRD-0004", nome: "Panos de microfibra", categoria: "Escovas e panos", unidade: "unidade", quantidade: 25, minimo: 10, fornecedor: "", custo: 350, estado: "Activo", ultimaEntrada: "2026-08-15" },
];

export const equipamentosMock: Equipamento[] = [
  {
    id: "e1", codigo: "EQP-0001", nome: "Aspirador industrial", categoria: "Aspirador", estado: "Operacional",
    dataAquisicao: "2026-01-10", responsavelId: "col1", observacoes: "", manutencoes: [],
    historico: [{ id: "eh1", data: "2026-01-10T09:00:00.000Z", utilizador: "Administrador", accao: "Equipamento registado" }],
  },
  {
    id: "e2", codigo: "EQP-0002", nome: "Máquina de extracção", categoria: "Máquina de extracção", estado: "Em manutenção",
    dataAquisicao: "2026-01-10", responsavelId: "", observacoes: "Reparação da bomba.",
    manutencoes: [{ id: "m1", data: "2026-10-14", descricao: "Reparação da bomba de água", custo: 22000 }],
    historico: [{ id: "eh2", data: "2026-01-10T09:00:00.000Z", utilizador: "Administrador", accao: "Equipamento registado" }],
  },
  {
    id: "e3", codigo: "EQP-0003", nome: "Máquina de lavagem de colchões", categoria: "Máquina de lavagem", estado: "Operacional",
    dataAquisicao: "2026-02-20", responsavelId: "col3", observacoes: "", manutencoes: [],
    historico: [{ id: "eh3", data: "2026-02-20T09:00:00.000Z", utilizador: "Administrador", accao: "Equipamento registado" }],
  },
];