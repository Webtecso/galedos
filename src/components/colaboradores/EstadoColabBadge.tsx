export default function EstadoColabBadge({ estado }: { estado: string }) {
  const cls =
    estado === "Activo"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : estado === "Suspenso"
      ? "bg-amber-50 text-amber-700 ring-amber-200"
      : "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {estado}
    </span>
  );
}