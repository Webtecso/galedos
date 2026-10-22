"use client";

import { useEffect, useState } from "react";
import { Hourglass, HandCoins, ClipboardCheck, Wallet } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import RemEstadoBadge from "@/components/ui/RemEstadoBadge";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRemuneracoes } from "@/components/remuneracoes/RemuneracoesProvider";
import { getSupabase } from "@/lib/supabase/client";
import { traduzirErro } from "@/lib/erros";
import { estadosRemuneracao, saldoColaborador } from "@/lib/remuneracoes";
import { formatData, formatKz } from "@/lib/format";
import type { Remuneracao } from "@/lib/types";

type LinhaMinha = {
  id: string; tipo: "Serviço" | "Ajuste"; servico_codigo: string; valor: number; data: string;
  periodo: string; aprovada: boolean; motivo: string;
};

export default function MeusGanhosPage() {
  const { perfil } = useAuth();
  const rm = useRemuneracoes();
  const cid = perfil.colaboradorId;
  const [minhas, setMinhas] = useState<Remuneracao[]>([]);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!cid) {
      setPronto(true);
      return;
    }
    let activo = true;
    (async () => {
      const { data, error } = await getSupabase().rpc("minhas_remuneracoes");
      if (!activo) return;
      if (error) {
        setErro(traduzirErro(error));
      } else {
        const linhas = (data ?? []) as unknown as LinhaMinha[];
        setMinhas(
          linhas.map((l) => ({
            id: l.id, tipo: l.tipo, servicoId: "", servicoCodigo: l.servico_codigo, recebimentoId: "",
            colaboradorId: cid, valorElegivel: 0, percentagem: 0, regra: "", valor: Number(l.valor),
            data: l.data, periodo: l.periodo, aprovada: l.aprovada, motivo: l.motivo,
          }))
        );
      }
      setPronto(true);
    })();
    return () => {
      activo = false;
    };
  }, [cid]);

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
  if (!rm.carregado || !pronto) return <p className="text-sm text-slate-500">A carregar...</p>;

  const lista = [...minhas].sort((a, b) => (b.data + b.id).localeCompare(a.data + a.id));
  const pagas = rm.pagamentos.filter((p) => p.colaboradorId === cid).sort((a, b) => b.data.localeCompare(a.data));
  const s = saldoColaborador(cid, lista, pagas);
  const estados = estadosRemuneracao(lista, pagas);

  return (
    <>
      <PageHeader title="Meus Ganhos" description="As suas remunerações, aprovadas pela administração, e os pagamentos recebidos." />
      {erro && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</p>}

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
              {lista.map((r) => (
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
        {lista.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Ainda sem remunerações apuradas.</p>}
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