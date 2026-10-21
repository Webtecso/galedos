import { isoLocal } from "./format";

export const diasSemana = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function paraData(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function somarDias(iso: string, n: number): string {
  const d = paraData(iso);
  d.setDate(d.getDate() + n);
  return isoLocal(d);
}

export function inicioSemana(iso: string): string {
  const d = paraData(iso);
  return somarDias(iso, -((d.getDay() + 6) % 7));
}

export function nomeDia(iso: string): string {
  return paraData(iso).toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}