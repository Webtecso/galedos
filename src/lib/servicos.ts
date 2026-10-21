import type { EstadoFinanceiro, EstadoOperacional, MeioPagamento, Servico } from "./types";

export const UTILIZADOR_ACTUAL = "Administrador";

export const estadosOperacionais: EstadoOperacional[] = [
  "Pedido recebido",
  "A aguardar orçamento",
  "Orçamento enviado",
  "A aguardar confirmação",
  "Agendado",
  "Em execução",
  "Concluído",
  "Cancelado",
];

export const estadosFinanceiros: EstadoFinanceiro[] = [
  "Sem pagamento",
  "Parcialmente pago",
  "Totalmente pago",
  "Reembolso pendente",
];

export const transicoes: Record<EstadoOperacional, EstadoOperacional[]> = {
  "Pedido recebido": ["A aguardar orçamento", "Agendado", "Cancelado"],
  "A aguardar orçamento": ["Orçamento enviado", "Cancelado"],
  "Orçamento enviado": ["A aguardar confirmação", "Agendado", "Cancelado"],
  "A aguardar confirmação": ["Agendado", "Cancelado"],
  Agendado: ["Em execução", "Cancelado"],
  "Em execução": ["Concluído", "Cancelado"],
  Concluído: [],
  Cancelado: [],
};

export const meiosPagamento: MeioPagamento[] = [
  "Dinheiro",
  "Transferência bancária",
  "Multicaixa Express",
  "Outro",
];

export function calcularTotal(quantidade: number, preco: number, desconto: number): number {
  return Math.max(0, Math.round(quantidade * preco - desconto));
}

export function totalRecebido(s: Servico): number {
  return s.recebimentos.reduce((t, r) => t + r.valor, 0);
}

export function saldoPendente(s: Servico): number {
  if (s.estadoOperacional === "Cancelado") return 0;
  return Math.max(0, s.total - totalRecebido(s));
}

export function estadoFinanceiro(s: Servico): EstadoFinanceiro {
  const rec = totalRecebido(s);
  if (s.estadoOperacional === "Cancelado") return rec > 0 ? "Reembolso pendente" : "Sem pagamento";
  if (rec <= 0) return "Sem pagamento";
  if (rec >= s.total) return "Totalmente pago";
  return "Parcialmente pago";
}

export function paraMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function formatDuracao(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}min`;
  if (h) return `${h}h`;
  return `${m}min`;
}

export function formatDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
}

export function proximoCodigo(servicos: Servico[], ano: number): string {
  const prefixo = `GAL-${ano}-`;
  const maior = servicos.reduce((max, s) => {
    if (!s.codigo.startsWith(prefixo)) return max;
    const n = parseInt(s.codigo.slice(prefixo.length), 10);
    return Number.isNaN(n) ? max : Math.max(max, n);
  }, 0);
  return prefixo + String(maior + 1).padStart(4, "0");
}

type Candidato = {
  id?: string;
  data: string;
  hora: string;
  duracaoMin: number;
  colaboradorIds: string[];
};

export function detectarConflitos(c: Candidato, todos: Servico[]): Servico[] {
  if (!c.data || !c.hora || c.colaboradorIds.length === 0) return [];
  const ini = paraMinutos(c.hora);
  const fim = ini + c.duracaoMin;
  return todos.filter((s) => {
    if (s.id === c.id) return false;
    if (s.estadoOperacional !== "Agendado" && s.estadoOperacional !== "Em execução") return false;
    if (s.data !== c.data || !s.hora) return false;
    if (!s.colaboradorIds.some((id) => c.colaboradorIds.includes(id))) return false;
    const sIni = paraMinutos(s.hora);
    const sFim = sIni + s.duracaoMin;
    return ini < sFim && sIni < fim;
  });
}