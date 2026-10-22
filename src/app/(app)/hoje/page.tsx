"use client";

import { useCallback, useEffect, useState } from "react";
import { Coffee, LogIn, LogOut, Navigation, Phone, Play, Square } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Etiqueta from "@/components/ui/Etiqueta";
import { useAuth } from "@/components/auth/AuthProvider";
import { getSupabase } from "@/lib/supabase/client";
import { traduzirErro } from "@/lib/erros";
import { useAgora } from "@/lib/useAgora";
import {
  dataLuanda, formatMin, horaLuanda, minutosEntre, minutosTrabalhados, obterPosicao, type Presenca,
} from "@/lib/presenca";
import { formatData } from "@/lib/format";
import PainelExecucao from "@/components/execucao/PainelExecucao";
import HojeExtras from "@/components/hoje/HojeExtras";

type Servico = {
  id: string; codigo: string; tipo: string; descricao: string; quantidade: number; data: string; hora: string;
  duracao: number; local: string; observacoes: string; estado: string; cliente: string; telefone: string;
  equipa: string[]; chegada_em: string | null; inicio_em: string | null; fim_em: string | null;
};
type ErroRpc = { message: string; code?: string } | null;
type ArgsPosicao = { p_lat: number | null; p_lng: number | null; p_precisao: number | null };

const botao = "flex h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold disabled:opacity-50";
const campo =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export default function HojePage() {
  const { perfil } = useAuth();
  const cid = perfil.colaboradorId;
  const agora = useAgora(30000);
  const [presenca, setPresenca] = useState<Presenca | null>(null);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [terminando, setTerminando] = useState("");
  const [obs, setObs] = useState("");

  const carregar = useCallback(async () => {
    if (!cid) {
      setCarregado(true);
      return;
    }
    const sb = getSupabase();
    const hoje = dataLuanda(new Date().toISOString());
    const [pr, sv] = await Promise.all([
      sb.from("presencas").select("*, pausas_presenca(*)").eq("colaborador_id", cid)
        .or(`data.eq.${hoje},saida_em.is.null`).order("data", { ascending: false }).limit(1),
      sb.rpc("meus_servicos"),
    ]);
    if (pr.error || sv.error) {
      setErro(traduzirErro(pr.error ?? sv.error));
      setCarregado(true);
      return;
    }
    setErro("");
    const lista = (pr.data ?? []) as unknown as Presenca[];
    setPresenca(lista[0] ?? null);
    setServicos((sv.data ?? []) as unknown as Servico[]);
    setCarregado(true);
  }, [cid]);

  useEffect(() => {
    carregar();
    const f = () => { carregar(); };
    window.addEventListener("focus", f);
    return () => window.removeEventListener("focus", f);
  }, [carregar]);

  async function accao(
    chave: string,
    texto: string,
    comPosicao: boolean,
    fn: (p: ArgsPosicao) => Promise<{ error: ErroRpc }>
  ) {
    if (ocupado) return;
    setOcupado(chave);
    setErro("");
    setAviso("");
    try {
      const pos = comPosicao ? await obterPosicao() : { lat: null, lng: null, precisao: null };
      const { error } = await fn({ p_lat: pos.lat, p_lng: pos.lng, p_precisao: pos.precisao });
      if (error) {
        setErro(traduzirErro(error));
        return;
      }
      setAviso(
        texto +
          (comPosicao
            ? pos.lat === null
              ? " Sem localização: permita o acesso à localização no navegador para ficar registada."
              : " Localização registada."
            : "")
      );
      await carregar();
    } finally {
      setOcupado("");
    }
  }

  const entrar = () =>
    accao("entrada", "Entrada registada.", true, async (p) => {
      const { error } = await getSupabase().rpc("marcar_entrada", p);
      return { error };
    });

  const sair = () => {
    if (!window.confirm("Confirma a saída do trabalho?")) return;
    return accao("saida", "Saída registada.", true, async (p) => {
      const { error } = await getSupabase().rpc("marcar_saida", p);
      return { error };
    });
  };

  const iniciarPausa = () =>
    accao("pausa", "Pausa iniciada.", false, async () => {
      const { error } = await getSupabase().rpc("iniciar_pausa");
      return { error };
    });

  const terminarPausa = () =>
    accao("pausa", "Pausa terminada.", false, async () => {
      const { error } = await getSupabase().rpc("terminar_pausa");
      return { error };
    });

  const chegar = (s: Servico) =>
    accao("chegada" + s.id, "Chegada ao local registada.", true, async (p) => {
      const { error } = await getSupabase().rpc("marcar_chegada", { p_servico: s.id, ...p });
      return { error };
    });

  const iniciar = (s: Servico) =>
    accao("inicio" + s.id, "Serviço iniciado.", true, async (p) => {
      const { error } = await getSupabase().rpc("iniciar_execucao", { p_servico: s.id, ...p });
      return { error };
    });

  const terminar = (s: Servico) =>
    accao("fim" + s.id, "Serviço terminado.", true, async (p) => {
      const { error } = await getSupabase().rpc("terminar_execucao", { p_servico: s.id, ...p, p_obs: obs });
      if (!error) {
        setTerminando("");
        setObs("");
      }
      return { error };
    });

  if (!cid) {
    return (
      <>
        <PageHeader title="Hoje" />
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          A sua conta ainda não está ligada a um colaborador. Peça à administração para a ligar em Contas de Acesso.
        </div>
      </>
    );
  }
  if (!carregado) return <p className="text-sm text-slate-500">A carregar...</p>;

  const hoje = dataLuanda(new Date(agora).toISOString());
  const agoraISO = new Date(agora).toISOString();
  const aberta = !!presenca && !presenca.saida_em;
  const anterior = aberta && presenca!.data < hoje;
  const pausaAberta = presenca?.pausas_presenca?.find((x) => !x.fim_em) ?? null;
  const podeTrabalhar = aberta && !anterior && !pausaAberta;
  const nomeCurto = (perfil.nome || perfil.email.split("@")[0]).split(" ")[0];

  const activos = servicos.filter((s) => s.estado !== "Concluído" && s.data <= hoje);
  const proximos = servicos.filter((s) => s.estado !== "Concluído" && s.data > hoje);
  const concluidos = servicos.filter((s) => s.estado === "Concluído");

  function cartao(s: Servico) {
    const emCurso = !!s.inicio_em && !s.fim_em;
    const terminado = !!s.fim_em;
    return (
      <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs text-slate-500">{s.codigo} · {formatData(s.data)} às {s.hora} · {formatMin(s.duracao)}</p>
            <p className="text-base font-semibold text-slate-900">{s.tipo}{s.quantidade > 1 ? ` (x${s.quantidade})` : ""}</p>
            <p className="text-sm text-slate-700">{s.cliente}</p>
          </div>
          {terminado ? <Etiqueta texto="Terminado" tom="verde" /> : emCurso ? <Etiqueta texto="Em curso" tom="ambar" /> : <Etiqueta texto={s.estado} tom="azul" />}
        </div>

        <div className="mt-3 space-y-1 text-sm text-slate-600">
          {s.local && (
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.local)}`} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 text-brand-700 hover:underline">
              <Navigation className="mt-0.5 h-4 w-4 shrink-0" /> {s.local}
            </a>
          )}
          {s.telefone && (
            <a href={`tel:${s.telefone.replace(/\s/g, "")}`} className="flex items-center gap-2 text-brand-700 hover:underline">
              <Phone className="h-4 w-4 shrink-0" /> {s.telefone}
            </a>
          )}
          {s.equipa.length > 1 && <p>Equipa: {s.equipa.join(", ")}</p>}
          {s.descricao && <p>{s.descricao}</p>}
          {s.observacoes && <p className="text-slate-500">Obs.: {s.observacoes}</p>}
        </div>

        {(!!s.chegada_em || !!s.inicio_em) && s.estado !== "Concluído" && (
          <PainelExecucao servicoId={s.id} aberto={!terminado} terminado={terminado} />
        )}

        {terminado && (
          <p className="mt-3 text-sm text-emerald-700">
            Das {horaLuanda(s.inicio_em!)} às {horaLuanda(s.fim_em!)} · {formatMin(minutosEntre(s.inicio_em!, s.fim_em!))}
            {s.estado !== "Concluído" && " · a aguardar validação da administração"}
          </p>
        )}

        {emCurso && (
          <div className="mt-3">
            <p className="text-sm text-amber-700">
              Iniciado às {horaLuanda(s.inicio_em!)} · decorridos {formatMin(minutosEntre(s.inicio_em!, agoraISO))}
            </p>
            {terminando === s.id ? (
              <div className="mt-2 space-y-2">
                <label className="text-sm font-medium text-slate-700">Observações (opcional)</label>
                <textarea className={campo} rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
                <div className="flex gap-2">
                  <button disabled={!!ocupado} onClick={() => terminar(s)} className={`${botao} bg-emerald-600 text-white hover:bg-emerald-700`}>
                    <Square className="h-5 w-5" /> Confirmar fim
                  </button>
                  <button onClick={() => { setTerminando(""); setObs(""); }} className="h-12 rounded-xl border border-slate-300 px-4 text-sm text-slate-700">Voltar</button>
                </div>
              </div>
            ) : (
              <button disabled={!!ocupado} onClick={() => { setTerminando(s.id); setObs(""); }} className={`${botao} mt-2 bg-emerald-600 text-white hover:bg-emerald-700`}>
                <Square className="h-5 w-5" /> Terminar serviço
              </button>
            )}
          </div>
        )}

        {!emCurso && !terminado && (
          <div className="mt-3 space-y-2">
            {!s.chegada_em && (
              <button disabled={!podeTrabalhar || !!ocupado} onClick={() => chegar(s)} className={`${botao} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`}>
                <Navigation className="h-5 w-5" /> Cheguei ao local
              </button>
            )}
            {s.chegada_em && <p className="text-sm text-slate-600">Chegada às {horaLuanda(s.chegada_em)}</p>}
            <button disabled={!podeTrabalhar || !!ocupado} onClick={() => iniciar(s)} className={`${botao} bg-brand-600 text-white hover:bg-brand-700`}>
              <Play className="h-5 w-5" /> Iniciar serviço
            </button>
            {!podeTrabalhar && <p className="text-xs text-slate-500">{aberta ? "Termine a pausa para trabalhar." : "Marque a entrada para poder iniciar serviços."}</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <PageHeader title={`Olá, ${nomeCurto}!`} description={new Date(agora).toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Luanda" })} />

      {erro && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</p>}
      {aviso && <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{aviso}</p>}

      <HojeExtras parte="topo" />

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Presença</h2>
          {!presenca || presenca.data < hoje && !aberta ? <Etiqueta texto="Sem entrada" tom="cinza" /> :
            anterior ? <Etiqueta texto="Saída em falta" tom="vermelho" /> :
            presenca.saida_em ? <Etiqueta texto="Saiu" tom="cinza" /> :
            pausaAberta ? <Etiqueta texto="Em pausa" tom="ambar" /> : <Etiqueta texto="A trabalhar" tom="verde" />}
        </div>

        {anterior && (
          <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            A presença de {formatData(presenca!.data)} ficou sem saída. Peça à administração para a corrigir; só depois poderá marcar nova entrada.
          </p>
        )}

        {(!presenca || (presenca.data < hoje && !aberta)) && (
          <button disabled={!!ocupado} onClick={entrar} className={`${botao} bg-brand-600 text-white hover:bg-brand-700`}>
            <LogIn className="h-5 w-5" /> Marcar entrada
          </button>
        )}

        {presenca && presenca.data === hoje && (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              Entrada às <strong>{horaLuanda(presenca.entrada_em)}</strong>
              {presenca.atraso_min > 0 && <span className="text-amber-700"> · atraso de {presenca.atraso_min} min</span>}
              {presenca.saida_em && <> · saída às <strong>{horaLuanda(presenca.saida_em)}</strong></>}
            </p>
            <p className="text-sm text-slate-600">Tempo trabalhado: <strong>{formatMin(minutosTrabalhados(presenca, agora))}</strong></p>
            {pausaAberta && <p className="text-sm text-amber-700">Pausa desde as {horaLuanda(pausaAberta.inicio_em)}</p>}

            {aberta && !pausaAberta && (
              <div className="grid gap-2 sm:grid-cols-2">
                <button disabled={!!ocupado} onClick={iniciarPausa} className={`${botao} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`}>
                  <Coffee className="h-5 w-5" /> Iniciar pausa
                </button>
                <button disabled={!!ocupado} onClick={sair} className={`${botao} bg-slate-800 text-white hover:bg-slate-900`}>
                  <LogOut className="h-5 w-5" /> Marcar saída
                </button>
              </div>
            )}
            {aberta && pausaAberta && (
              <button disabled={!!ocupado} onClick={terminarPausa} className={`${botao} bg-brand-600 text-white hover:bg-brand-700`}>
                <Coffee className="h-5 w-5" /> Terminar pausa
              </button>
            )}
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">A hora é a do servidor. A localização é pedida só ao marcar entrada, saída, chegada, início e fim.</p>
      </section>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Serviços de hoje e em atraso</h2>
      <div className="mb-6 space-y-3">
        {activos.map(cartao)}
        {activos.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">Sem serviços atribuídos para hoje.</p>}
      </div>

      {proximos.length > 0 && (
        <>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Próximos serviços</h2>
          <div className="mb-6 space-y-3">{proximos.map(cartao)}</div>
        </>
      )}

      <HojeExtras parte="fundo" />

      {concluidos.length > 0 && (
        <>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Concluídos (últimos 30 dias)</h2>
          <div className="space-y-3">{concluidos.map(cartao)}</div>
        </>
      )}
    </>
  );
}