const tons = {
  verde: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  azul: "bg-blue-50 text-blue-700 ring-blue-200",
  ambar: "bg-amber-50 text-amber-700 ring-amber-200",
  vermelho: "bg-red-50 text-red-700 ring-red-200",
  cinza: "bg-slate-100 text-slate-700 ring-slate-200",
};

export type Tom = keyof typeof tons;

export default function Etiqueta({ texto, tom = "cinza" }: { texto: string; tom?: Tom }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tons[tom]}`}>
      {texto}
    </span>
  );
}