const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const ESQ = 52;
const DIR = 590;
const TOPO = 12;
const BASE = 190;

function maximoBonito(v: number): number {
  if (v <= 0) return 100;
  const e = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / e;
  const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return n * e;
}

function abreviar(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1000) return `${Math.round(v / 1000)}k`;
  return String(Math.round(v));
}

type Ponto = readonly [number, number];

export default function GraficoReceitas({ receitas, despesas }: { receitas: number[]; despesas: number[] }) {
  const max = maximoBonito(Math.max(...receitas, ...despesas));
  const passo = (DIR - ESQ) / 11;
  const alt = BASE - TOPO;
  const pontos = (v: number[]): Ponto[] => v.map((y, i) => [ESQ + i * passo, BASE - (y / max) * alt] as const);
  const linha = (p: Ponto[]) => p.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const pr = pontos(receitas);
  const pd = pontos(despesas);
  const area = `${linha(pr)} L${pr[11][0].toFixed(1)},${BASE} L${pr[0][0].toFixed(1)},${BASE} Z`;

  return (
    <div>
      <div className="mb-2 flex gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Receitas</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Despesas</span>
      </div>
      <svg viewBox="0 0 600 215" className="h-auto w-full" role="img" aria-label="Receitas e despesas por mês">
        <defs>
          <linearGradient id="gradReceitas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.30" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((i) => {
          const y = BASE - (i / 4) * alt;
          return (
            <g key={i}>
              <line x1={ESQ} x2={DIR} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={ESQ - 6} y={y + 3} textAnchor="end" fontSize="9" className="fill-slate-400">{abreviar((max * i) / 4)}</text>
            </g>
          );
        })}
        {MESES.map((m, i) => (
          <text key={m} x={ESQ + i * passo} y={BASE + 16} textAnchor="middle" fontSize="9" className="fill-slate-400">{m}</text>
        ))}
        <path d={area} fill="url(#gradReceitas)" />
        <path d={linha(pr)} fill="none" stroke="#10b981" strokeWidth="2" />
        <path d={linha(pd)} fill="none" stroke="#f59e0b" strokeWidth="2" />
        {pr.map(([x, y], i) => <circle key={"r" + i} cx={x} cy={y} r="2.5" fill="#10b981" />)}
        {pd.map(([x, y], i) => <circle key={"d" + i} cx={x} cy={y} r="2.5" fill="#f59e0b" />)}
      </svg>
    </div>
  );
}