"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Etiqueta from "@/components/ui/Etiqueta";
import StatCard from "@/components/ui/StatCard";
import { CalendarCheck, Clock, AlertTriangle } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getSupabase } from "@/lib/supabase/client";
import { traduzirErro } from "@/lib/erros";
import { dataLuanda, formatMin, horaLuanda, minutosPausas, minutosTrabalhados, type Presenca } from "@/lib/presenca";
import { formatData } from "@/lib/format";

export default function MinhasPresencas() {
  const { perfil } = useAuth();
  const cid = perfil.colaboradorId;
  const [lista, setLista] = useState<Presenca[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!cid) {
      setCarregado(true);
      return;
    }
    let activo = true;
    (async () => {
      const { data, error } = await getSupabase()
        .from("presencas")
        .select("*, pausas_presenca(*)")
        .eq("colaborador_id", cid)
        .order("data", { ascending: false })
        .limit(62);
      if (!activo) return;
      if (error) setErro(traduzirErro(error));
      else setLista((data ?? []) as unknown as Presenca[]);
      setCarregado(true);
    })();
    return () => {
      activo = false;
    };
  }, [cid]);

  if (!cid) {
    return (
      <>
        <PageHeader title="Presenças" />
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          A sua conta ainda não está ligada a um colaborador. Peça à administração para a ligar.
        </div>
      </>
    );
  }
  if (!carregado) return <p className="text-sm text-slate-500">A carregar...</p>;

  const agora = Date.now();
  const hoje = dataLuanda(new Date(agora).toISOString());
  const mes = hoje.slice(0, 7);
  const doMes = lista.filter((p) => p.data.startsWith(mes));
  const minutos = doMes.reduce((t, p) => t + minutosTrabalhados(p, agora), 0);
  const atrasos = doMes.filter((p) => p.atraso_min > 0).length;

  return (
    <>
      <PageHeader title="Presenças" description="O seu histórico de entradas e saídas (últimos 62 registos)." />
      {erro && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</p>}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Dias trabalhados (mês)" value={String(doMes.length)} icon={CalendarCheck} tom="azul" />
        <StatCard label="Horas (mês)" value={formatMin(minutos)} icon={Clock} tom="verde" />
        <StatCard label="Atrasos (mês)" value={String(atrasos)} icon={AlertTriangle} tom="ambar" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Data</th>
                <th className="px-5 py-3 font-medium">Entrada</th>
                <th className="px-5 py-3 font-medium">Saída</th>
                <th className="px-5 py-3 font-medium">Pausas</th>
                <th className="px-5 py-3 font-medium">Horas</th>
                <th className="px-5 py-3 font-medium">Atraso</th>
                <th className="px-5 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lista.map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap px-5 py-3">{formatData(p.data)}</td>
                  <td className="px-5 py-3">{horaLuanda(p.entrada_em)}</td>
                  <td className="px-5 py-3">{p.saida_em ? horaLuanda(p.saida_em) : "—"}</td>
                  <td className="px-5 py-3">{formatMin(minutosPausas(p, p.saida_em ? new Date(p.saida_em).getTime() : agora))}</td>
                  <td className="px-5 py-3 font-medium">{formatMin(minutosTrabalhados(p, agora))}</td>
                  <td className="px-5 py-3">{p.atraso_min > 0 ? `${p.atraso_min} min` : "—"}</td>
                  <td className="px-5 py-3">
                    {!p.saida_em ? <Etiqueta texto={p.data < hoje ? "Sem saída" : "Em curso"} tom={p.data < hoje ? "vermelho" : "azul"} /> :
                      p.validada ? <Etiqueta texto="Validada" tom="verde" /> : <Etiqueta texto="Por validar" tom="cinza" />}
                    {p.motivo_correccao && <p className="mt-1 text-xs text-slate-500">Corrigido: {p.motivo_correccao}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {lista.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Ainda sem presenças registadas.</p>}
      </div>
    </>
  );
}