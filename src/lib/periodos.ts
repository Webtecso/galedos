import { isoLocal } from "./format";

export type PeriodoChave = "hoje" | "semana" | "mes" | "mes_anterior" | "ano" | "tudo";

export const periodosOpcoes: { chave: PeriodoChave; label: string }[] = [
  { chave: "hoje", label: "Hoje" },
  { chave: "semana", label: "Esta semana" },
  { chave: "mes", label: "Este mês" },
  { chave: "mes_anterior", label: "Mês anterior" },
  { chave: "ano", label: "Ano actual" },
  { chave: "tudo", label: "Todo o histórico" },
];

export type Intervalo = { de: string; ate: string };

export function intervaloDe(chave: PeriodoChave, base: Date = new Date()): Intervalo {
  const y = base.getFullYear();
  const m = base.getMonth();
  switch (chave) {
    case "hoje": {
      const h = isoLocal(base);
      return { de: h, ate: h };
    }
    case "semana": {
      const dia = (base.getDay() + 6) % 7;
      const ini = new Date(y, m, base.getDate() - dia);
      const fim = new Date(y, m, base.getDate() - dia + 6);
      return { de: isoLocal(ini), ate: isoLocal(fim) };
    }
    case "mes":
      return { de: isoLocal(new Date(y, m, 1)), ate: isoLocal(new Date(y, m + 1, 0)) };
    case "mes_anterior":
      return { de: isoLocal(new Date(y, m - 1, 1)), ate: isoLocal(new Date(y, m, 0)) };
    case "ano":
      return { de: `${y}-01-01`, ate: `${y}-12-31` };
    default:
      return { de: "0000-01-01", ate: "9999-12-31" };
  }
}

export function dentro(data: string, i: Intervalo): boolean {
  return data !== "" && data >= i.de && data <= i.ate;
}