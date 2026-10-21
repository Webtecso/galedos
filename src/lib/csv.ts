export type CelulaCsv = string | number;

function celula(v: CelulaCsv): string {
  if (typeof v === "number") return String(v).replace(".", ",");
  let t = v;
  if (/^[=+\-@\t\r]/.test(t)) t = "\u0027" + t;
  return "\"" + t.replace(/"/g, "\"\"") + "\"";
}

export function exportarCsv(nome: string, cabecalhos: string[], linhas: CelulaCsv[][]) {
  const corpo = [cabecalhos, ...linhas].map((l) => l.map(celula).join(";")).join("\r\n");
  const blob = new Blob(["\uFEFF" + corpo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome + ".csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}