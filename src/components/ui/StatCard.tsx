import type { LucideIcon } from "lucide-react";

const tons = {
  dourado: "bg-brand-50 text-brand-600",
  azul: "bg-blue-50 text-blue-600",
  roxo: "bg-violet-50 text-violet-600",
  verde: "bg-emerald-50 text-emerald-600",
  ambar: "bg-amber-50 text-amber-600",
  vermelho: "bg-red-50 text-red-600",
};

export type TomCartao = keyof typeof tons;

export default function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tom = "dourado",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tom?: TomCartao;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-4">
        <div className={`rounded-xl p-3 ${tons[tom]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="truncate text-xl font-semibold text-slate-900 sm:text-2xl">{value}</p>
        </div>
      </div>
      {hint && <p className="mt-3 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}