import type { Despesa } from "@/lib/types";

function d(n: number, data: string, categoria: string, descricao: string, valor: number, fornecedor: string, estado: Despesa["estado"]): Despesa {
  return {
    id: "d" + n, codigo: "DSP-" + String(n).padStart(4, "0"), data, categoria, descricao, valor,
    fornecedor, meio: "Dinheiro", referencia: "", estado, observacoes: "", motivoAnulacao: "",
    historico: [{ id: "dh" + n, data: data + "T09:00:00.000Z", utilizador: "Administrador", accao: "Despesa registada (" + estado + ")" }],
  };
}

export const despesasMock: Despesa[] = [
  d(1, "2026-10-02", "Produtos de limpeza", "Detergente para estofados (20 L)", 28000, "Casa da Química", "Pago"),
  d(2, "2026-10-05", "Combustível", "Combustível da carrinha", 15000, "", "Pago"),
  d(3, "2026-10-09", "Transporte", "Táxi para entrega de equipamento", 4500, "", "Pago"),
  d(4, "2026-10-14", "Manutenção", "Reparação da máquina de extracção", 22000, "Oficina Técnica Luanda", "Por pagar"),
  d(5, "2026-09-18", "Comunicações", "Saldo de dados móveis", 6000, "", "Pago"),
];