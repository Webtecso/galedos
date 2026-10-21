const styles: Record<string, string> = {
  Apurada: "bg-slate-100 text-slate-700 ring-slate-200",
  Aprovada: "bg-blue-50 text-blue-700 ring-blue-200",
  "Parcialmente paga": "bg-amber-50 text-amber-700 ring-amber-200",
  Paga: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Aberto: "bg-blue-50 text-blue-700 ring-blue-200",
  Fechado: "bg-slate-200 text-slate-700 ring-slate-300",
};

export default function RemEstadoBadge({ estado }: { estado: string }) {
  const cls = styles[estado] ?? "bg-slate-100 text-slate-700 ring-slate-200";
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {estado}
    </span>
  );
}