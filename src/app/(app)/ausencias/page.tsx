"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Etiqueta from "@/components/ui/Etiqueta";
import { useAuth } from "@/components/auth/AuthProvider";
import { useColaboradores } from "@/components/colaboradores/ColaboradoresProvider";
import { getSupabase } from "@/lib/supabase/client";
import { traduzirErro } from "@/lib/erros";
import { exportarCsv } from "@/lib/csv";
import { dataLuanda } from "@/lib/presenca";
import { formatData, formatPeriodo } from "@/lib/format";

type Aba = "ausencias" | "faltas" | "calendario";
type Tipo = "Férias" | "Baixa médica" | "Licença" | "Falta justificada" | "Outra";
type Ausencia = {
  id: string; colaborador_id: string; tipo: Tipo; data_inicio: string; data_fim: string; motivo: string;
  estado: "Activa" | "Anulada"; motivo_anulacao: string; registado_por: string;
};
type Feriado = { id: string; data: string; nome: string };
type Falta = { colaborador_id: string; dia: string; situacao: string };
type Msg = { tipo: "ok" | "erro"; texto: string } | null;

const tipos: Tipo[] = ["Férias", "Baixa médica", "Licença", "Falta justificada", "Outra"];
const diasSemana = [
  { n: 1, l: "Seg" }, { n: 2, l: "Ter" }, { n: 3, l: "Qua" }, { n: 4, l: "Qui" },
  { n: 5, l: "Sex" }, { n: 6, l: "Sáb" }, { n: 7, l: "Dom" },
];
const campo =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
const seletor =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
const btn = "rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:bg-slate-300";

export default function AusenciasPage() {
  const { perfil } = useAuth();
  const co = useColaboradores();
  const eAdmin = perfil.perfil === "administrador";
  const [aba, setAba] = useState<Aba>("ausencias");
  const [msg, setMsg] = useState<Msg>(null);
  const [ocupado, setOcupado] = useState(false);
  const [ausencias, setAusencias] = useState<Ausencia[]>([]);
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [dias, setDias] = useState<number[]>([1, 2, 3, 4, 5]);
  const [faltas, setFaltas] = useState<Falta[]>([]);
  const [mes, setMes] = useState(() => dataLuanda(new Date().toISOString()).slice(0, 7));
  const [carregado, setCarregado] = useState(false);
  const [form, setForm] = useState({ colaborador: "", tipo: "Férias" as Tipo, inicio: "", fim: "", motivo: "" });
  const [anulando, setAnulando] = useState("");
  const [motivoAnul, setMotivoAnul] = useState("");
  const [novoFeriado, setNovoFeriado] = useState({ data: "", nome: "" });

  const nome = useCallback((id: string) => co.obter(id)?.nome ?? id, [co]);

  const carregar = useCallback(async () => {
    const sb = getSupabase();
    const [a, f, c] = await Promise.all([
      sb.from("ausencias").select("*").order("data_inicio", { ascending: false }).limit(500),
      sb.from("feriados").select("*").order("data"),
      sb.from("config_presenca").select("dias_trabalho").eq("id", 1).maybeSingle(),
    ]);
    const falha = a.error ?? f.error ?? c.error;
    if (falha) setMsg({ tipo: "erro", texto: traduzirErro(falha) });
    else {
      setAusencias((a.data ?? []) as unknown as Ausencia[]);
      setFeriados((f.data ?? []) as unknown as Feriado[]);
      const d = (c.data as unknown as { dias_trabalho: number[] } | null)?.dias_trabalho;
      if (d) setDias(d);
    }
    setCarregado(true);
  }, []);

  const carregarFaltas = useCallback(async () => {
    const { data, error } = await getSupabase().rpc("faltas_mes", { p_mes: mes });
    if (error) setMsg({ tipo: "erro", texto: traduzirErro(error) });
    else setFaltas((data ?? []) as unknown as Falta[]);
  }, [mes]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    carregarFaltas();
  }, [carregarFaltas]);

  async function chamar(fn: string, args: Record<string, unknown>, ok: string): Promise<boolean> {
    if (ocupado) return false;
    setOcupado(true);
    setMsg(null);
    try {
      const { error } = await getSupabase().rpc(fn, args);
      if (error) {
        setMsg({ tipo: "erro", texto: traduzirErro(error) });
        return false;
      }
      setMsg({ tipo: "ok", texto: ok });
      await Promise.all([carregar(), carregarFaltas()]);
      return true;
    } finally {
      setOcupado(false);
    }
  }

  async function registar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.colaborador) return setMsg({ tipo: "erro", texto: "Seleccione o colaborador." });
    if (!form.inicio || !form.fim) return setMsg({ tipo: "erro", texto: "Indique as datas de início e de fim." });
    const ok = await chamar(
      "registar_ausencia",
      { p: { colaborador_id: form.colaborador, tipo: form.tipo, data_inicio: form.inicio, data_fim: form.fim, motivo: form.motivo } },
      "Ausência registada."
    );
    if (ok) setForm({ ...form, inicio: "", fim: "", motivo: "" });
  }

  async function anular() {
    const ok = await chamar("anular_ausencia", { p_id: anulando, p_motivo: motivoAnul }, "Ausência anulada.");
    if (ok) {
      setAnulando("");
      setMotivoAnul("");
    }
  }

  async function guardarDias(e: React.FormEvent) {
    e.preventDefault();
    await chamar("alterar_dias_trabalho", { p_dias: dias }, "Dias de trabalho guardados.");
  }

  async function adicionarFeriado(e: React.FormEvent) {
    e.preventDefault();
    const ok = await chamar("adicionar_feriado", { p_data: novoFeriado.data || null, p_nome: novoFeriado.nome }, "Feriado adicionado.");
    if (ok) setNovoFeriado({ data: "", nome: "" });
  }

  const resumo = useMemo(() => {
    const ids = Array.from(new Set(faltas.map((f) => f.colaborador_id)));
    return ids.map((id) => {
      const l = faltas.filter((f) => f.colaborador_id === id);
      const n = (...s: string[]) => l.filter((f) => s.includes(f.situacao)).length;
      return {
        id,
        injustificadas: n("Injustificada"),
        justificadas: n("Justificada", "Falta justificada"),
        ferias: n("Férias"),
        baixa: n("Baixa médica"),
        outras: n("Licença", "Outra"),
      };
    });
  }, [faltas]);

  if (!co.carregado || !carregado) return <p className="text-sm text-slate-500">A carregar...</p>;

  const abas: { chave: Aba; label: string }[] = [
    { chave: "ausencias", label: "Ausências" },
    { chave: "faltas", label: "Faltas do mês" },
    { chave: "calendario", label: "Calendário" },
  ];
  const activos = co.colaboradores.filter((c) => c.estado === "Activo");
  const hoje = dataLuanda(new Date().toISOString());

  return (
    <>
      <PageHeader
        title="Ausências"
        description="Férias, baixas e faltas. As faltas contam os dias de trabalho sem presença, sem feriado e sem ausência registada. Não geram descontos automáticos."
      />

      {msg && (
        <div className={`mb-4 rounded-lg border p-3 text-sm ${msg.tipo === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{msg.texto}</div>
      )}

      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200">
        {abas.map((a) => (
          <button key={a.chave} onClick={() => setAba(a.chave)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${aba === a.chave ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-900"}`}>
            {a.label}
          </button>
        ))}
      </div>

      {aba === "ausencias" && (
        <>
          {eAdmin && (
            <form onSubmit={registar} noValidate className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 font-semibold text-slate-900">Registar ausência</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Colaborador *</label>
                  <select className={campo} value={form.colaborador} onChange={(e) => setForm({ ...form, colaborador: e.target.value })}>
                    <option value="">Seleccione</option>
                    {activos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Tipo *</label>
                  <select className={campo} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as Tipo })}>
                    {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">De *</label>
                  <input type="date" className={campo} value={form.inicio} onChange={(e) => setForm({ ...form, inicio: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Até *</label>
                  <input type="date" className={campo} value={form.fim} onChange={(e) => setForm({ ...form, fim: e.target.value })} />
                </div>
                <div className="sm:col-span-2 lg:col-span-4">
                  <label className="text-sm font-medium text-slate-700">Motivo {form.tipo === "Falta justificada" || form.tipo === "Outra" ? "*" : "(opcional)"}</label>
                  <input className={campo} value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} />
                </div>
              </div>
              <div className="mt-4 flex justify-end"><button type="submit" disabled={ocupado} className={btn}>Registar</button></div>
            </form>
          )}

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Colaborador</th>
                    <th className="px-5 py-3 font-medium">Tipo</th>
                    <th className="px-5 py-3 font-medium">Período</th>
                    <th className="px-5 py-3 font-medium">Motivo</th>
                    <th className="px-5 py-3 font-medium">Estado</th>
                    {eAdmin && <th className="px-5 py-3 font-medium">Acções</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ausencias.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium">{nome(a.colaborador_id)}</td>
                      <td className="px-5 py-3">{a.tipo}</td>
                      <td className="whitespace-nowrap px-5 py-3">{formatData(a.data_inicio)} a {formatData(a.data_fim)}</td>
                      <td className="px-5 py-3 text-xs text-slate-600">{a.motivo || "—"}{a.estado === "Anulada" && <span className="block text-red-700">Anulada: {a.motivo_anulacao}</span>}</td>
                      <td className="px-5 py-3"><Etiqueta texto={a.estado} tom={a.estado === "Activa" ? (a.data_fim < hoje ? "cinza" : "verde") : "vermelho"} /></td>
                      {eAdmin && (
                        <td className="whitespace-nowrap px-5 py-3">
                          {a.estado === "Activa" && (
                            <button onClick={() => { setAnulando(a.id); setMotivoAnul(""); }} className="text-sm font-medium text-red-700 hover:underline">Anular</button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {ausencias.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Sem ausências registadas.</p>}
          </div>

          {anulando && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
              <label className="text-sm font-medium text-red-800">Motivo da anulação *</label>
              <input className={campo} value={motivoAnul} onChange={(e) => setMotivoAnul(e.target.value)} />
              <div className="mt-3 flex gap-2">
                <button disabled={ocupado} onClick={anular} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">Confirmar anulação</button>
                <button onClick={() => setAnulando("")} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700">Voltar</button>
              </div>
            </div>
          )}
        </>
      )}

      {aba === "faltas" && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <input type="month" className={seletor} value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} />
            <button disabled={faltas.length === 0}
              onClick={() => exportarCsv(`faltas-${mes}`, ["Colaborador", "Data", "Situação"], faltas.map((f) => [nome(f.colaborador_id), formatData(f.dia), f.situacao]))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:text-slate-300">
              <Download className="h-4 w-4" /> CSV
            </button>
          </div>
          <p className="mb-3 text-sm text-slate-500">{formatPeriodo(mes)} · só os dias até ontem. "Justificada" vem de um pedido de justificação aprovado.</p>
          <div className="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Colaborador</th>
                    <th className="px-5 py-3 font-medium">Injustificadas</th>
                    <th className="px-5 py-3 font-medium">Justificadas</th>
                    <th className="px-5 py-3 font-medium">Férias</th>
                    <th className="px-5 py-3 font-medium">Baixa médica</th>
                    <th className="px-5 py-3 font-medium">Licença e outras</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {resumo.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium">{nome(r.id)}</td>
                      <td className={`px-5 py-3 ${r.injustificadas > 0 ? "font-semibold text-red-700" : ""}`}>{r.injustificadas}</td>
                      <td className="px-5 py-3">{r.justificadas}</td>
                      <td className="px-5 py-3">{r.ferias}</td>
                      <td className="px-5 py-3">{r.baixa}</td>
                      <td className="px-5 py-3">{r.outras}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {resumo.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Sem faltas nem ausências neste mês.</p>}
          </div>

          {faltas.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Dias em detalhe</h2></div>
              <ul className="divide-y divide-slate-100">
                {faltas.slice(0, 400).map((f, i) => (
                  <li key={i} className="flex flex-wrap justify-between gap-2 px-5 py-2 text-sm">
                    <span>{nome(f.colaborador_id)} · {formatData(f.dia)}</span>
                    <Etiqueta texto={f.situacao} tom={f.situacao === "Injustificada" ? "vermelho" : f.situacao === "Justificada" || f.situacao === "Falta justificada" ? "ambar" : "azul"} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {aba === "calendario" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={guardarDias} noValidate className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-1 font-semibold text-slate-900">Dias de trabalho</h2>
            <p className="mb-3 text-xs text-slate-500">Só estes dias contam para as faltas.</p>
            <div className="flex flex-wrap gap-3">
              {diasSemana.map((d) => (
                <label key={d.n} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" disabled={!eAdmin} checked={dias.includes(d.n)}
                    onChange={(e) => setDias(e.target.checked ? [...dias, d.n].sort() : dias.filter((x) => x !== d.n))} />
                  {d.l}
                </label>
              ))}
            </div>
            {eAdmin && <div className="mt-4 flex justify-end"><button type="submit" disabled={ocupado || dias.length === 0} className={btn}>Guardar</button></div>}
          </form>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-1 font-semibold text-slate-900">Feriados</h2>
            <p className="mb-3 text-xs text-slate-500">Os de data fixa e os móveis de 2026 e 2027 vêm carregados. Confirme com o calendário oficial e acrescente os que faltarem.</p>
            {eAdmin && (
              <form onSubmit={adicionarFeriado} noValidate className="mb-4 flex flex-wrap items-end gap-2">
                <div><label className="text-sm text-slate-700">Data</label><input type="date" className={campo} value={novoFeriado.data} onChange={(e) => setNovoFeriado({ ...novoFeriado, data: e.target.value })} /></div>
                <div className="min-w-40 flex-1"><label className="text-sm text-slate-700">Nome</label><input className={campo} value={novoFeriado.nome} onChange={(e) => setNovoFeriado({ ...novoFeriado, nome: e.target.value })} /></div>
                <button type="submit" disabled={ocupado} className={btn}>Adicionar</button>
              </form>
            )}
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {feriados.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span>{formatData(f.data)} · {f.nome}</span>
                  {eAdmin && (
                    <button disabled={ocupado} onClick={() => { if (window.confirm(`Remover o feriado "${f.nome}"?`)) chamar("remover_feriado", { p_id: f.id }, "Feriado removido."); }}
                      className="text-xs font-medium text-red-700 hover:underline">Remover</button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}