export function formatKz(value: number): string {
  return `${new Intl.NumberFormat("pt-PT").format(value)} Kz`;
}

export function formatData(iso: string): string {
  const [a, m, d] = iso.split("-");
  if (!a || !m || !d) return iso;
  return `${d}/${m}/${a}`;
}

export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function isoLocal(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dia}`;
}

export function hojeISO(): string {
  return isoLocal(new Date());
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function formatPeriodo(p: string): string {
  const [a, m] = p.split("-");
  const nome = MESES[Number(m) - 1];
  return nome ? `${nome} ${a}` : p;
}