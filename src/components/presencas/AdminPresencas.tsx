"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCheck, Coffee, Download, RefreshCw, Users, Wrench } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Etiqueta from "@/components/ui/Etiqueta";
import StatCard from "@/components/ui/StatCard";
import { useAuth } from "@/components/auth/AuthProvider";
import { useColaboradores } from "@/components/colaboradores/ColaboradoresProvider";
import { useServicos } from "@/components/servicos/ServicosProvider";
import { getSupabase } from "@/lib/supabase/client";
import { traduzirErro } from "@/lib/erros";
import { exportarCsv } from "@/lib/csv";
import { useAgora } from "@/lib/useAgora";
import {
  dataLuanda, formatMin, horaLuanda, inicioMesISO, mapaUrl, minutosEntre, minutosPausas, minutosTrabalhados,
  paraISO, paraMinutosDia, proximoMes, type ConfigPresenca, type Execucao, type Presenca,
} from "@/lib/presenca";
import { formatData, formatPeriodo } from "@/lib/format";
import DistanciaConfig from "./DistanciaConfig";

type Aba = "agora" | "registos" | "mapa" | "servicos" | "horario";
type Msg = { tipo: "ok" | "erro"; texto: string } | null;
type Correccao = { tipo: "presenca" | "execucao"; id: string; data: string; entrada: string; saida: string; motivo: string };

const campo =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
const seletor =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
const btn = "rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:bg-slate-300";

export default function AdminPresencas() {
  const { perfil } = useAuth();
  const co = useColaboradores();
  const sv = useServicos();
  const agoraMs = useAgora(30000);
  const eAdmin = perfil.perfil === "administrador";

  const [aba, setAba] = useState<Aba>("agora");
  const [msg, setMsg] = useState<Msg>(null);
  const [cfg, setCfg] = useState<ConfigPresenca | null>(null);
  const [hojePres, setHojePres] = useState<Presenca[]>([]);
  const [esquecidas, setEsquecidas] = useState<Presenca[]>([]);
  const [abertas, setAbertas] = useState<Execucao[]>([]);
  const [mes, setMes] = useState(() => dataLuanda(new Date().toISOString()).slice(0, 7));
  const [fColab, setFColab] = useState("todos");
  const [mesPres, setMesPres] = useState<Presenca[]>([]);
  const [mesExec, setMesExec] = useState<Execucao[]>([]);
  const [corr, setCorr] = useState<Correccao | null>(null);
  const [formCfg, setFormCfg] = useState({ entrada: "08:00", saida: "17:00", tolerancia: "15", janela: "30" });
  const [ocupado, setOcupado] = useState(false);

  const hoje = dataLuanda(new Date(agoraMs).toISOString());
  const nome = useCallback((id: string) => co.obter(id)?.nome ?? id, [co]);

  const carregarAgora = useCallback(async () => {
    const sb = getSupabase();
    const dia = dataLuanda(new Date().toISOString());
    const [c, h, e, a] = await Promise.all([
      sb.from("config_presenca").select("*").eq("id", 1).maybeSingle(),
      sb.from("presencas").select("*, pausas_presenca(*)").eq("data", dia),
      sb.from("presencas").select("*, pausas_presenca(*)").is("saida_em", null).lt("data", dia),
      sb.from("execucoes_servico").select("*, servicos(codigo,tipo_servico,duracao_min)").not("inicio_em", "is", null).is("fim_em", null),
    ]);
    const falha = c.error ?? h.error ?? e.error ?? a.error;
    if (falha) {
      setMsg({ tipo: "erro", texto: traduzirErro(falha) });
      return;
    }
    if (c.data) {
      const x = c.data as unknown as ConfigPresenca;
      setCfg(x);
      setFormCfg({ entrada: x.hora_entrada.slice(0, 5), saida: x.hora_saida.slice(0, 5), tolerancia: String(x.tolerancia_min), janela: String(x.janela_inicio_min) });
    }
    setHojePres((h.data ?? []) as unknown as Presenca[]);
    setEsquecidas((e.data ?? []) as unknown as Presenca[]);
    setAbertas((a.data ?? []) as unknown as Execucao[]);
  }, []);

  const carregarMes = useCallback(async () => {
    const sb = getSupabase();
    const [p, x] = await Promise.all([
      sb.from("presencas").select("*, pausas_presenca(*)").gte("data", `${mes}-01`).lt("data", `${proximoMes(mes)}-01`).order("data", { ascending: false }).limit(1000),
      sb.from("execucoes_servico").select("*, servicos(codigo,tipo_servico,duracao_min)")
        .gte("inicio_em", inicioMesISO(mes)).lt("inicio_em", inicioMesISO(proximoMes(mes))).not("fim_em", "is", null)
        .order("inicio_em", { ascending: false }).limit(1000),
    ]);
    const falha = p.error ?? x.error;
    if (falha) {
      setMsg({ tipo: "erro", texto: traduzirErro(falha) });
      return;
    }
    setMesPres((p.data ?? []) as unknown as Presenca[]);
    setMesExec((x.data ?? []) as unknown as Execucao[]);
  }, [mes]);

  useEffect(() => {
    carregarAgora();
    const t = setInterval(carregarAgora, 60000);
    return () => clearInterval(t);
  }, [carregarAgora]);

  useEffect(() => {
    carregarMes();
  }, [carregarMes]);

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
      await Promise.all([carregarAgora(), carregarMes()]);
      return true;
    } finally {
      setOcupado(false);
    }
  }

  async function guardarCorreccao(e: React.FormEvent) {
    e.preventDefault();
    if (!corr) return;
    if (!corr.motivo.trim()) {
      setMsg({ tipo: "erro", texto: "O motivo da correcção é obrigatório." });
      return;
    }
    if (!corr.entrada) {
      setMsg({ tipo: "erro", texto: "Indique a hora de início/entrada." });
      return;
    }
    let ok = false;
    if (corr.tipo === "presenca") {
      ok = await chamar("corrigir_presenca", {
        p_id: corr.id,
        p_entrada: paraISO(corr.data, corr.entrada),
        p_saida: corr.saida ? paraISO(corr.data, corr.saida) : null,
        p_motivo: corr.motivo,
      }, "Registo de presença corrigido. Fica por validar.");
    } else {
      if (!corr.saida) {
        setMsg({ tipo: "erro", texto: "Indique a hora de fim." });
        return;
      }
      ok = await chamar("corrigir_execucao", {
        p_id: corr.id,
        p_inicio: paraISO(corr.data, corr.entrada),
        p_fim: paraISO(corr.data, corr.saida),
        p_motivo: corr.motivo,
      }, "Tempos de execução corrigidos.");
    }
    if (ok) setCorr(null);
  }

  async function guardarHorario(e: React.FormEvent) {
    e.preventDefault();
    await chamar("alterar_config_presenca", {
      p_entrada: formCfg.entrada,
      p_saida: formCfg.saida,
      p_tolerancia: Math.round(Number(formCfg.tolerancia)),
      p_janela: Math.round(Number(formCfg.janela)),
    }, "Horário guardado.");
  }

  const colabsActivos = co.colaboradores.filter((c) => c.estado === "Activo");
  const horaActualMin = paraMinutosDia(horaLuanda(new Date(agoraMs).toISOString()));
  const limiteEntrada = cfg ? paraMinutosDia(cfg.hora_entrada) + cfg.tolerancia_min : null;

  const idsComServicoHoje = new Set(
    sv.servicos
      .filter((s) => s.data === hoje && (s.estadoOperacional === "Agendado" || s.estadoOperacional === "Em execução"))
      .flatMap((s) => s.colaboradorIds)
  );
  const semEntrada =
    limiteEntrada !== null && horaActualMin > limiteEntrada
      ? colabsActivos.filter((c) => idsComServicoHoje.has(c.id) && !hojePres.some((p) => p.colaborador_id === c.id))
      : [];
  const comAtraso = hojePres.filter((p) => p.atraso_min > 0);
  const acimaDoTempo = abertas.filter((x) => x.inicio_em && x.servicos && minutosEntre(x.inicio_em, new Date(agoraMs).toISOString()) > x.servicos.duracao_min);

  const presentes = hojePres.filter((p) => !p.saida_em);
  const emPausa = presentes.filter((p) => p.pausas_presenca?.some((x) => !x.fim_em));
  const emServico = abertas.length;

  const presMes = useMemo(
    () => mesPres.filter((p) => fColab === "todos" || p.colaborador_id === fColab),
    [mesPres, fColab]
  );
  const execMes = useMemo(
    () => mesExec.filter((x) => fColab === "todos" || x.colaborador_id === fColab),
    [mesExec, fColab]
  );

  function estadoPres(p: Presenca): { texto: string; tom: "verde" | "azul" | "ambar" | "vermelho" | "cinza" } {
    if (!p.saida_em) return p.data < hoje ? { texto: "Sem saída", tom: "vermelho" } : { texto: "Em curso", tom: "azul" };
    return p.validada ? { texto: "Validada", tom: "verde" } : { texto: "Por validar", tom: "cinza" };
  }

  const resumo = colabsActivos
    .filter((c) => fColab === "todos" || c.id === fColab)
    .map((c) => {
      const l = mesPres.filter((p) => p.colaborador_id === c.id);
      return {
        c,
        dias: l.length,
        minutos: l.reduce((t, p) => t + minutosTrabalhados(p, agoraMs), 0),
        atrasos: l.filter((p) => p.atraso_min > 0).length,
        minAtraso: l.reduce((t, p) => t + p.atraso_min, 0),
        semSaida: l.filter((p) => !p.saida_em && p.data < hoje).length,
        porValidar: l.filter((p) => p.saida_em && !p.validada).length,
      };
    });

  const porValidarIds = presMes.filter((p) => p.saida_em && !p.validada).map((p) => p.id);

  function localizacao(lat: number | null, lng: number | null) {
    return lat !== null && lng !== null ? (
      <a href={mapaUrl(lat, lng)} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">ver mapa</a>
    ) : (
      <Etiqueta texto="Sem localização" tom="ambar" />
    );
  }

  const abas: { chave: Aba; label: string }[] = [
    { chave: "agora", label: "Equipa agora" },
    { chave: "registos", label: "Registos" },
    { chave: "mapa", label: "Mapa mensal" },
    { chave: "servicos", label: "Tempos dos serviços" },
    { chave: "horario", label: "Horário" },
  ];

  const filtros = (
    <div className="mb-4 flex flex-wrap gap-3">
      <input type="month" className={seletor} value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} />
      <select className={seletor} value={fColab} onChange={(e) => setFColab(e.target.value)}>
        <option value="todos">Todos os colaboradores</option>
        {co.colaboradores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
      </select>
    </div>
  );

  if (!co.carregado || !sv.carregado) return <p className="text-sm text-slate-500">A carregar...</p>;

  return (
    <>
      <PageHeader
        title="Presenças"
        description="Entradas, saídas e execução dos serviços, com a hora do servidor. Os registos não se editam: corrigem-se com motivo."
        action={
          <button onClick={() => { carregarAgora(); carregarMes(); }} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" /> Actualizar
          </button>
        }
      />

      {msg && (
        <div className={`mb-4 rounded-lg border p-3 text-sm ${msg.tipo === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{msg.texto}</div>
      )}

      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200">
        {abas.filter((a) => a.chave !== "horario" || eAdmin).map((a) => (
          <button key={a.chave} onClick={() => setAba(a.chave)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${aba === a.chave ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-900"}`}>
            {a.label}
          </button>
        ))}
      </div>

      {corr && (
        <form onSubmit={guardarCorreccao} noValidate className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="mb-3 font-semibold text-slate-900">
            Corrigir {corr.tipo === "presenca" ? "presença" : "tempos de execução"} · {formatData(corr.data)}
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-slate-700">{corr.tipo === "presenca" ? "Entrada" : "Início"} (hora de Luanda)</label>
              <input type="time" className={campo} value={corr.entrada} onChange={(e) => setCorr({ ...corr, entrada: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">{corr.tipo === "presenca" ? "Saída (vazio = sem saída)" : "Fim"}</label>
              <input type="time" className={campo} value={corr.saida} onChange={(e) => setCorr({ ...corr, saida: e.target.value })} />
            </div>
            <div className="sm:col-span-3">
              <label className="text-sm font-medium text-slate-700">Motivo da correcção *</label>
              <input className={campo} value={corr.motivo} onChange={(e) => setCorr({ ...corr, motivo: e.target.value })} />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button type="submit" disabled={ocupado} className={btn}>Guardar correcção</button>
            <button type="button" onClick={() => setCorr(null)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700">Cancelar</button>
          </div>
        </form>
      )}

      {aba === "agora" && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Presentes" value={String(presentes.length)} icon={Users} tom="verde" hint={`${hojePres.length} entradas hoje`} />
            <StatCard label="Em serviço" value={String(emServico)} icon={Wrench} tom="ambar" />
            <StatCard label="Em pausa" value={String(emPausa.length)} icon={Coffee} tom="azul" />
            <StatCard label="Alertas" value={String(semEntrada.length + comAtraso.length + esquecidas.length + acimaDoTempo.length)} icon={AlertTriangle} tom="vermelho" />
          </div>

          {cfg && abertas.some((x) => x.inicio_dist_m != null && x.inicio_dist_m > cfg.distancia_max_m) && (
            <div className="mb-6 space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {abertas.filter((x) => x.inicio_dist_m != null && x.inicio_dist_m > cfg.distancia_max_m).map((x) => (
                <p key={"d" + x.id}>Início longe do local: <strong>{nome(x.colaborador_id)}</strong> em {x.servicos?.codigo} ({x.inicio_dist_m} m do cliente).</p>
              ))}
            </div>
          )}

          {(semEntrada.length > 0 || comAtraso.length > 0 || esquecidas.length > 0 || acimaDoTempo.length > 0) && (
            <div className="mb-6 space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {semEntrada.map((c) => <p key={"s" + c.id}>Sem entrada registada: <strong>{c.nome}</strong> (tem serviço hoje).</p>)}
              {comAtraso.map((p) => <p key={"a" + p.id}>Atraso: <strong>{nome(p.colaborador_id)}</strong> entrou às {horaLuanda(p.entrada_em)} ({p.atraso_min} min).</p>)}
              {esquecidas.map((p) => <p key={"e" + p.id}>Saída esquecida: <strong>{nome(p.colaborador_id)}</strong> em {formatData(p.data)}. Corrija o registo para ele poder marcar nova entrada.</p>)}
              {acimaDoTempo.map((x) => <p key={"t" + x.id}>Acima do tempo estimado: <strong>{nome(x.colaborador_id)}</strong> em {x.servicos?.codigo} ({formatMin(minutosEntre(x.inicio_em!, new Date(agoraMs).toISOString()))} de {formatMin(x.servicos!.duracao_min)}).</p>)}
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Hoje · {formatData(hoje)}</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Colaborador</th>
                    <th className="px-5 py-3 font-medium">Entrada</th>
                    <th className="px-5 py-3 font-medium">Situação</th>
                    <th className="px-5 py-3 font-medium">Horas</th>
                    <th className="px-5 py-3 font-medium">Localização</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {hojePres.map((p) => {
                    const ex = abertas.find((x) => x.colaborador_id === p.colaborador_id);
                    const pausa = p.pausas_presenca?.find((x) => !x.fim_em);
                    return (
                      <tr key={p.id}>
                        <td className="px-5 py-3 font-medium">{nome(p.colaborador_id)}</td>
                        <td className="whitespace-nowrap px-5 py-3">{horaLuanda(p.entrada_em)}{p.atraso_min > 0 && <span className="ml-2"><Etiqueta texto={`+${p.atraso_min} min`} tom="ambar" /></span>}</td>
                        <td className="px-5 py-3">
                          {p.saida_em ? <>Saiu às {horaLuanda(p.saida_em)}</> :
                            pausa ? <Etiqueta texto={`Em pausa desde ${horaLuanda(pausa.inicio_em)}`} tom="azul" /> :
                            ex ? <span>Em serviço <strong>{ex.servicos?.codigo}</strong> desde {horaLuanda(ex.inicio_em!)}</span> :
                            <Etiqueta texto="Presente" tom="verde" />}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3">{formatMin(minutosTrabalhados(p, agoraMs))}</td>
                        <td className="px-5 py-3">{localizacao(p.entrada_lat, p.entrada_lng)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {hojePres.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Ninguém marcou entrada hoje.</p>}
          </div>
        </>
      )}

      {aba === "registos" && (
        <>
          {filtros}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-500">{presMes.length} registos em {formatPeriodo(mes)}</p>
            <div className="flex gap-2">
              <button disabled={porValidarIds.length === 0 || ocupado} onClick={() => chamar("validar_presencas", { p_ids: porValidarIds }, `${porValidarIds.length} registo(s) validado(s).`)}
                className={`${btn} inline-flex items-center gap-2`}>
                <CheckCheck className="h-4 w-4" /> Validar completos ({porValidarIds.length})
              </button>
              <button disabled={presMes.length === 0}
                onClick={() => exportarCsv(`presencas-${mes}`, ["Data", "Colaborador", "Entrada", "Saída", "Pausas (min)", "Horas", "Atraso (min)", "Estado", "Localização na entrada"],
                  presMes.map((p) => [formatData(p.data), nome(p.colaborador_id), horaLuanda(p.entrada_em), p.saida_em ? horaLuanda(p.saida_em) : "", minutosPausas(p, p.saida_em ? new Date(p.saida_em).getTime() : agoraMs), Math.round((minutosTrabalhados(p, agoraMs) / 60) * 100) / 100, p.atraso_min, estadoPres(p).texto, p.entrada_lat !== null ? "Sim" : "Não"]))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:text-slate-300">
                <Download className="h-4 w-4" /> CSV
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Data</th>
                    <th className="px-5 py-3 font-medium">Colaborador</th>
                    <th className="px-5 py-3 font-medium">Entrada</th>
                    <th className="px-5 py-3 font-medium">Saída</th>
                    <th className="px-5 py-3 font-medium">Pausas</th>
                    <th className="px-5 py-3 font-medium">Horas</th>
                    <th className="px-5 py-3 font-medium">Atraso</th>
                    <th className="px-5 py-3 font-medium">Local</th>
                    <th className="px-5 py-3 font-medium">Estado</th>
                    <th className="px-5 py-3 font-medium">Acções</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {presMes.map((p) => {
                    const est = estadoPres(p);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-5 py-3">{formatData(p.data)}</td>
                        <td className="px-5 py-3">{nome(p.colaborador_id)}</td>
                        <td className="px-5 py-3">{horaLuanda(p.entrada_em)}</td>
                        <td className="px-5 py-3">{p.saida_em ? horaLuanda(p.saida_em) : "—"}</td>
                        <td className="px-5 py-3">{formatMin(minutosPausas(p, p.saida_em ? new Date(p.saida_em).getTime() : agoraMs))}</td>
                        <td className="whitespace-nowrap px-5 py-3 font-medium">{formatMin(minutosTrabalhados(p, agoraMs))}</td>
                        <td className="px-5 py-3">{p.atraso_min > 0 ? `${p.atraso_min} min` : "—"}</td>
                        <td className="px-5 py-3">{localizacao(p.entrada_lat, p.entrada_lng)}</td>
                        <td className="px-5 py-3">
                          <Etiqueta texto={est.texto} tom={est.tom} />
                          {p.motivo_correccao && <p className="mt-1 text-xs text-slate-500">Corrigido: {p.motivo_correccao}</p>}
                          {p.validada && <p className="mt-1 text-xs text-slate-500">por {p.validada_por}</p>}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3">
                          {eAdmin && (
                            <button onClick={() => setCorr({ tipo: "presenca", id: p.id, data: p.data, entrada: horaLuanda(p.entrada_em), saida: p.saida_em ? horaLuanda(p.saida_em) : "", motivo: "" })}
                              className="text-sm font-medium text-brand-700 hover:underline">Corrigir</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {presMes.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Sem registos neste mês.</p>}
          </div>
        </>
      )}

      {aba === "mapa" && (
        <>
          {filtros}
          <div className="mb-3 flex justify-end">
            <button disabled={resumo.length === 0}
              onClick={() => exportarCsv(`mapa-presencas-${mes}`, ["Colaborador", "Dias", "Horas", "Atrasos", "Minutos de atraso", "Sem saída", "Por validar"],
                resumo.map((r) => [r.c.nome, r.dias, Math.round((r.minutos / 60) * 100) / 100, r.atrasos, r.minAtraso, r.semSaida, r.porValidar]))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:text-slate-300">
              <Download className="h-4 w-4" /> CSV
            </button>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Colaborador</th>
                    <th className="px-5 py-3 font-medium">Dias</th>
                    <th className="px-5 py-3 font-medium">Horas</th>
                    <th className="px-5 py-3 font-medium">Atrasos</th>
                    <th className="px-5 py-3 font-medium">Min. de atraso</th>
                    <th className="px-5 py-3 font-medium">Sem saída</th>
                    <th className="px-5 py-3 font-medium">Por validar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {resumo.map((r) => (
                    <tr key={r.c.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium">{r.c.nome}</td>
                      <td className="px-5 py-3">{r.dias}</td>
                      <td className="px-5 py-3">{formatMin(r.minutos)}</td>
                      <td className="px-5 py-3">{r.atrasos}</td>
                      <td className="px-5 py-3">{r.minAtraso}</td>
                      <td className="px-5 py-3">{r.semSaida}</td>
                      <td className="px-5 py-3">{r.porValidar}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {resumo.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Sem dados.</p>}
            <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
              Atrasos, faltas e saídas em falta são informação para a administração decidir. Não geram descontos automáticos. Os dias de falta (sem entrada) serão acrescentados com o módulo de ausências.
            </p>
          </div>
        </>
      )}

      {aba === "servicos" && (
        <>
          {filtros}
          <div className="mb-3 flex justify-end">
            <button disabled={execMes.length === 0}
              onClick={() => exportarCsv(`tempos-servicos-${mes}`, ["Serviço", "Tipo", "Colaborador", "Início", "Fim", "Real (min)", "Estimado (min)", "Diferença (min)"],
                execMes.map((x) => { const real = minutosEntre(x.inicio_em!, x.fim_em!); const est = x.servicos?.duracao_min ?? 0; return [x.servicos?.codigo ?? "", x.servicos?.tipo_servico ?? "", nome(x.colaborador_id), `${dataLuanda(x.inicio_em!)} ${horaLuanda(x.inicio_em!)}`, horaLuanda(x.fim_em!), real, est, real - est]; }))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:text-slate-300">
              <Download className="h-4 w-4" /> CSV
            </button>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Serviço</th>
                    <th className="px-5 py-3 font-medium">Colaborador</th>
                    <th className="px-5 py-3 font-medium">Data</th>
                    <th className="px-5 py-3 font-medium">Início</th>
                    <th className="px-5 py-3 font-medium">Fim</th>
                    <th className="px-5 py-3 font-medium">Real</th>
                    <th className="px-5 py-3 font-medium">Estimado</th>
                    <th className="px-5 py-3 font-medium">Diferença</th>
                    <th className="px-5 py-3 font-medium">Local</th>
                    <th className="px-5 py-3 font-medium">Notas</th>
                    <th className="px-5 py-3 font-medium">Acções</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {execMes.map((x) => {
                    const real = minutosEntre(x.inicio_em!, x.fim_em!);
                    const est = x.servicos?.duracao_min ?? 0;
                    const dif = real - est;
                    return (
                      <tr key={x.id} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-5 py-3 font-medium">{x.servicos?.codigo}<p className="text-xs font-normal text-slate-500">{x.servicos?.tipo_servico}</p></td>
                        <td className="px-5 py-3">{nome(x.colaborador_id)}</td>
                        <td className="whitespace-nowrap px-5 py-3">{formatData(dataLuanda(x.inicio_em!))}</td>
                        <td className="px-5 py-3">{horaLuanda(x.inicio_em!)}</td>
                        <td className="px-5 py-3">{horaLuanda(x.fim_em!)}</td>
                        <td className="px-5 py-3 font-medium">{formatMin(real)}</td>
                        <td className="px-5 py-3">{formatMin(est)}</td>
                        <td className={`whitespace-nowrap px-5 py-3 ${dif > 0 ? "text-amber-700" : "text-emerald-700"}`}>{dif > 0 ? "+" : ""}{dif} min</td>
                        <td className="px-5 py-3 text-xs">{x.inicio_dist_m == null ? <Etiqueta texto="Sem distância" tom="cinza" /> : cfg && x.inicio_dist_m > cfg.distancia_max_m ? <Etiqueta texto={`Longe: ${x.inicio_dist_m} m`} tom="ambar" /> : <span>{x.inicio_dist_m} m</span>}</td>
                        <td className="px-5 py-3 text-xs text-slate-600">{x.observacoes}{x.motivo_correccao && <span className="block text-slate-500">Corrigido: {x.motivo_correccao}</span>}</td>
                        <td className="whitespace-nowrap px-5 py-3">
                          {eAdmin && (
                            <button onClick={() => setCorr({ tipo: "execucao", id: x.id, data: dataLuanda(x.inicio_em!), entrada: horaLuanda(x.inicio_em!), saida: horaLuanda(x.fim_em!), motivo: "" })}
                              className="text-sm font-medium text-brand-700 hover:underline">Corrigir</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {execMes.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Sem serviços terminados neste mês.</p>}
          </div>
        </>
      )}

      {aba === "horario" && eAdmin && <div className="mb-6 max-w-2xl"><DistanciaConfig /></div>}

      {aba === "horario" && eAdmin && (
        <form onSubmit={guardarHorario} noValidate className="max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-1 font-semibold text-slate-900">Horário de referência</h2>
          <p className="mb-4 text-xs text-slate-500">Usado para calcular atrasos e para limitar o início dos serviços. Aplica-se às novas marcações.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="text-sm font-medium text-slate-700">Hora de entrada</label><input type="time" className={campo} value={formCfg.entrada} onChange={(e) => setFormCfg({ ...formCfg, entrada: e.target.value })} /></div>
            <div><label className="text-sm font-medium text-slate-700">Hora de saída</label><input type="time" className={campo} value={formCfg.saida} onChange={(e) => setFormCfg({ ...formCfg, saida: e.target.value })} /></div>
            <div><label className="text-sm font-medium text-slate-700">Tolerância de atraso (min)</label><input className={campo} inputMode="numeric" value={formCfg.tolerancia} onChange={(e) => setFormCfg({ ...formCfg, tolerancia: e.target.value })} /></div>
            <div><label className="text-sm font-medium text-slate-700">Início do serviço permitido até (min antes)</label><input className={campo} inputMode="numeric" value={formCfg.janela} onChange={(e) => setFormCfg({ ...formCfg, janela: e.target.value })} /></div>
          </div>
          <div className="mt-4 flex justify-end"><button type="submit" disabled={ocupado} className={btn}>Guardar horário</button></div>
        </form>
      )}
    </>
  );
}