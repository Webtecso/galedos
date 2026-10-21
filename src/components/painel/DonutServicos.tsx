export type Fatia = { nome: string; valor: number };

const CORES = ["#c9a24a", "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#94a3b8"];

export default function DonutServicos({ fatias }: { fatias: Fatia[] }) {
  const total = fatias.reduce((t, f) => t + f.valor, 0);
  if (total === 0) return <p className="py-10 text-center text-sm text-slate-500">Sem serviços no período seleccionado.</p>;

  const R = 42;
  const C = 2 * Math.PI * R;
  let acumulado = 0;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative h-40 w-40 shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full" role="img" aria-label="Serviços por tipo">
          <g transform="rotate(-90 60 60)">
            <circle cx="60" cy="60" r={R} fill="none" stroke="#f1f5f9" strokeWidth="16" />
            {fatias.map((f, i) => {
              const comprimento = (f.valor / total) * C;
              const el = (
                <circle
                  key={f.nome}
                  cx="60" cy="60" r={R} fill="none"
                  stroke={CORES[i % CORES.length]} strokeWidth="16"
                  strokeDasharray={`${comprimento} ${C - comprimento}`}
                  strokeDashoffset={-acumulado}
                />
              );
              acumulado += comprimento;
              return el;
            })}
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-slate-900">{total}</span>
          <span className="text-xs text-slate-500">Serviços</span>
        </div>
      </div>
      <ul className="min-w-[160px] flex-1 space-y-2 text-sm">
        {fatias.map((f, i) => (
          <li key={f.nome} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: CORES[i % CORES.length] }} />
              <span className="truncate text-slate-700">{f.nome}</span>
            </span>
            <span className="text-slate-500">{Math.round((f.valor / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}