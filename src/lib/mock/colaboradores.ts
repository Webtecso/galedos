import type { ColaboradorCompleto } from "@/lib/types";

export const colaboradoresMock: ColaboradorCompleto[] = [
  { id: "col1", codigo: "COL-0001", nome: "Pedro Manuel", funcao: "Técnico de limpeza", activo: true, telefone: "923 100 200", dataInicio: "2026-01-05", modalidade: "Prestação de serviços", contrato: "CT-001/2026", percentagem: 20, estado: "Activo", observacoes: "" },
  { id: "col2", codigo: "COL-0002", nome: "Joana Kiala", funcao: "Técnica de limpeza", activo: true, telefone: "912 300 400", dataInicio: "2026-01-05", modalidade: "Prestação de serviços", contrato: "CT-002/2026", percentagem: 20, estado: "Activo", observacoes: "" },
  { id: "col3", codigo: "COL-0003", nome: "Domingos Neto", funcao: "Técnico de limpeza", activo: true, telefone: "934 500 600", dataInicio: "2026-02-10", modalidade: "Colaboração ocasional", contrato: "", percentagem: 20, estado: "Activo", observacoes: "" },
  { id: "col4", codigo: "COL-0004", nome: "Sandra Pires", funcao: "Técnica de limpeza", activo: true, telefone: "926 700 800", dataInicio: "2026-03-01", modalidade: "Prestação de serviços", contrato: "CT-004/2026", percentagem: 20, estado: "Activo", observacoes: "" },
];