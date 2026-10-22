"use client";

import { Hourglass, HandCoins, ClipboardCheck, Wallet } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import RemEstadoBadge from "@/components/ui/RemEstadoBadge";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRemuneracoes } from "@/components/remuneracoes/RemuneracoesProvider";
import { estadosRemuneracao, saldoColaborador } from "@/lib/remuneracoes";
import { formatData, formatKz } from "@/lib/format";

export default function MeusGanhosPage() {
  const { perfil } = useAuth();
  const rm = useRemuneracoes();
  const cid = perfil.colaboradorId;

  if (!cid) {
    return (
      <>
        <PageHeader title="Meus Ganhos" />
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          A sua conta ainda não está ligada a um colaborador.
        </div>
      </>
    );
  }
  if (!rm.carregado) return <p className="text-sm text-slate-500">A carregar...</p>;

  const minhas = rm.remuneracoes.filter((r) => r.colaboradorId === cid).sort((a, b) => (b.data + b.id).localeCompare(a.data + a.id));
  const pagas = rm.pagamentos.filter((p) => p.colaboradorId === cid).sort((a, b) => b.data.localeCompare(a.data));
  const s = saldoColaborador(cid, minhas, pagas);
  const estados = estadosRemuneracao(minhas, pagas);

  return (
    <>
      <PageHeader title="Meus Ganhos" description="As suas remunerações, aprovadas pela administração, e os pagamentos recebidos." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total apurado" value={formatKz(s.apurado)} icon={Wallet} />
        <StatCard label="Aprovado" value={formatKz(s.aprovado)} icon={ClipboardCheck} tom="azul" />
        <StatCard label="Já recebido" value={formatKz(s.pago)} icon={HandCoins} tom="verde" hint="Pagamentos e adiantamentos" />
        <StatCard label="Saldo a receber" value={formatKz(s.saldo)} icon={Hourglass} tom="ambar" hint={s.saldo < 0 ? "Adiantamento a compensar" : "Aprovado e ainda não pago"} />
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Remunerações</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Data</th>
                <th className="px-5 py-3 font-medium">Serviço</th>
                <th className="px-5 py-3 font-medium">Valor</th>
                <th className="px-5 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {minhas.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-5 py-3">{formatData(r.data)}</td>
                  <td className="px-5 py-3">{r.tipo === "Serviço" ? r.servicoCodigo : `Ajuste: ${r.motivo}`}</td>
                  <td className={`whitespace-nowrap px-5 py-3 font-medium ${r.valor < 0 ? "text-red-700" : ""}`}>{formatKz(r.valor)}</td>
                  <td className="px-5 py-3"><RemEstadoBadge estado={estados[r.id] ?? "Apurada"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {minhas.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Ainda sem remunerações apuradas.</p>}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Pagamentos recebidos</h2></div>
        {pagas.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">Ainda sem pagamentos registados.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {pagas.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2 px-5 py-3 text-sm">
                <span>{formatData(p.data)} · {p.tipo} · {p.meio}{p.referencia ? ` · ${p.referencia}` : ""}</span>
                <span className="font-medium">{formatKz(p.valor)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}