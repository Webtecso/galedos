"use client";

import { useEffect, useState } from "react";
import Etiqueta from "@/components/ui/Etiqueta";
import { getSupabase } from "@/lib/supabase/client";
import { traduzirErro } from "@/lib/erros";
import { dataLuanda, formatMin, horaLuanda, minutosEntre } from "@/lib/presenca";
import { formatData } from "@/lib/format";

type Exec = {
  id: string; colaborador_id: string; chegada_em: string | null; inicio_em: string | null; fim_em: string | null;
  observacoes: string; chegada_dist_m: number | null; inicio_dist_m: number | null; fim_dist_m: number | null;
  colaboradores: { nome: string } | null;
};
type Chk = { execucao_id: string; texto: string; feito: boolean };
type Foto = { id: string; fase: "Antes" | "Depois"; caminho: string; colaborador_id: string };
type Conf = {
  nome: string; assinatura: string; satisfeito: boolean; comentario: string; criado_em: string; registado_por_nome: string;
};

export default function ExecucaoServico({ servicoId }: { servicoId: string }) {
  const [execs, setExecs] = useState<Exec[]>([]);
  const [chk, setChk] = useState<Chk[]>([]);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [conf, setConf] = useState<Conf | null>(null);
  const [erro, setErro] = useState("");
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    let activo = true;
    (async () => {
      const sb = getSupabase();
      const [e, f, c] = await Promise.all([
        sb.from("execucoes_servico").select("*, colaboradores(nome)").eq("servico_id", servicoId).order("criado_em"),
        sb.from("fotos_servico").select("id,fase,caminho,colaborador_id").eq("servico_id", servicoId).order("criado_em"),
        sb.from("confirmacoes_cliente").select("*").eq("servico_id", servicoId).maybeSingle(),
      ]);
      if (!activo) return;
      const falha = e.error ?? f.error ?? c.error;
      if (falha) {
        setErro(traduzirErro(falha));
        setCarregado(true);
        return;
      }
      const lista = (e.data ?? []) as unknown as Exec[];
      const listaFotos = (f.data ?? []) as unknown as Foto[];

      let itens: Chk[] = [];
      if (lista.length > 0) {
        const r = await sb.from("execucao_checklist").select("execucao_id,texto,feito").in("execucao_id", lista.map((x) => x.id));
        if (!r.error) itens = (r.data ?? []) as unknown as Chk[];
      }
      const mapa: Record<string, string> = {};
      if (listaFotos.length > 0) {
        const s = await sb.storage.from("fotos-servico").createSignedUrls(listaFotos.map((x) => x.caminho), 3600);
        if (s.data) for (const x of s.data) if (x.path && x.signedUrl) mapa[x.path] = x.signedUrl;
      }
      if (!activo) return;
      setExecs(lista);
      setChk(itens);
      setFotos(listaFotos);
      setUrls(mapa);
      setConf((c.data as unknown as Conf | null) ?? null);
      setCarregado(true);
    })();
    return () => {
      activo = false;
    };
  }, [servicoId]);

  if (!carregado) return null;
  if (erro) return <p className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</p>;
  if (execs.length === 0 && fotos.length === 0 && !conf) return null;

  function dist(m: number | null) {
    return m === null ? "sem distância" : `${m} m do cliente`;
  }

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Execução no local</h2></div>
      <div className="space-y-5 p-5">
        {execs.map((x) => {
          const itens = chk.filter((c) => c.execucao_id === x.id);
          const meusFotos = fotos.filter((f) => f.colaborador_id === x.colaborador_id);
          return (
            <div key={x.id} className="rounded-lg border border-slate-200 p-4">
              <p className="font-medium text-slate-900">{x.colaboradores?.nome ?? x.colaborador_id}</p>
              <p className="mt-1 text-sm text-slate-600">
                {x.chegada_em && <>Chegada às {horaLuanda(x.chegada_em)} ({dist(x.chegada_dist_m)}). </>}
                {x.inicio_em && <>Início às {horaLuanda(x.inicio_em)} ({dist(x.inicio_dist_m)}). </>}
                {x.fim_em ? <>Fim às {horaLuanda(x.fim_em)} · {formatMin(minutosEntre(x.inicio_em ?? x.fim_em, x.fim_em))}.</> : x.inicio_em ? "Ainda em curso." : ""}
              </p>
              {x.observacoes && <p className="mt-1 text-sm text-slate-600">Observações: {x.observacoes}</p>}

              {itens.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium uppercase text-slate-500">
                    Lista de verificação ({itens.filter((i) => i.feito).length}/{itens.length})
                  </p>
                  <ul className="mt-1 space-y-0.5 text-sm">
                    {itens.map((i, n) => (
                      <li key={n} className={i.feito ? "text-slate-700" : "text-amber-700"}>{i.feito ? "[x] " : "[ ] "}{i.texto}</li>
                    ))}
                  </ul>
                </div>
              )}

              {meusFotos.length > 0 && (
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  {(["Antes", "Depois"] as const).map((fase) => (
                    <div key={fase}>
                      <p className="text-xs font-medium uppercase text-slate-500">Fotos {fase.toLowerCase()}</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {meusFotos.filter((f) => f.fase === fase).map((f) =>
                          urls[f.caminho] ? (
                            <a key={f.id} href={urls[f.caminho]} target="_blank" rel="noopener noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={urls[f.caminho]} alt={`Foto ${fase.toLowerCase()}`} className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />
                            </a>
                          ) : (
                            <Etiqueta key={f.id} texto="indisponível" tom="cinza" />
                          )
                        )}
                        {meusFotos.filter((f) => f.fase === fase).length === 0 && <span className="text-xs text-slate-400">nenhuma</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {conf && (
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-slate-900">Confirmação do cliente</p>
              <Etiqueta texto={conf.satisfeito ? "Satisfeito" : "Não satisfeito"} tom={conf.satisfeito ? "verde" : "vermelho"} />
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {conf.nome} · registada por {conf.registado_por_nome} em {formatData(dataLuanda(conf.criado_em))} às {horaLuanda(conf.criado_em)}
            </p>
            {conf.comentario && <p className="mt-1 text-sm text-slate-600">Comentário: {conf.comentario}</p>}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={conf.assinatura} alt="Assinatura do cliente" className="mt-2 h-24 rounded-lg border border-slate-200 bg-white" />
            {!conf.satisfeito && <p className="mt-2 text-xs text-red-700">Cliente não satisfeito: considere registar uma ocorrência.</p>}
          </div>
        )}
      </div>
    </div>
  );
}