const styles: Record<string, string> = {
  "Pedido recebido": "bg-slate-100 text-slate-700 ring-slate-200",
  "A aguardar orçamento": "bg-violet-50 text-violet-700 ring-violet-200",
  "Orçamento enviado": "bg-indigo-50 text-indigo-700 ring-indigo-200",
  "A aguardar confirmação": "bg-orange-50 text-orange-700 ring-orange-200",
  Agendado: "bg-blue-50 text-blue-700 ring-blue-200",
  "Em execução": "bg-amber-50 text-amber-700 ring-amber-200",
  Concluído: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Cancelado: "bg-red-50 text-red-700 ring-red-200",
  Pago: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Pendente: "bg-slate-100 text-slate-700 ring-slate-200",
  "Sem pagamento": "bg-slate-100 text-slate-700 ring-slate-200",
  "Parcialmente pago": "bg-amber-50 text-amber-700 ring-amber-200",
  "Totalmente pago": "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "Reembolso pendente": "bg-red-50 text-red-700 ring-red-200",
};

export default function StatusBadge({ status }: { status: string }) {
  const cls = styles[status] ?? "bg-slate-100 text-slate-700 ring-slate-200";
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {status}
    </span>
  );
}