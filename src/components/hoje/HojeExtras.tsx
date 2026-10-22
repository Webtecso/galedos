"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Camera, Wrench } from "lucide-react";
import Etiqueta from "@/components/ui/Etiqueta";
import { useAuth } from "@/components/auth/AuthProvider";
import { getSupabase } from "@/lib/supabase/client";
import { traduzirErro } from "@/lib/erros";
import { reduzirImagem } from "@/lib/imagem";
import { dataLuanda } from "@/lib/presenca";
import { formatData } from "@/lib/format";

type Aviso = { id: string; titulo: string; texto: string; data: string; lido: boolean };
type Equip = { id: string; codigo: string; nome: string; categoria: string; estado: string; data_aquisicao: string | null };

const botao = "flex h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold disabled:opacity-50";

export default function HojeExtras({ parte }: { parte: "topo" | "fundo" }) {
  const { perfil } = useAuth();
  const cid = perfil.colaboradorId;
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [equip, setEquip] = useState<Equip[]>([]);
  const [selfiePendente, setSelfiePendente] = useState(false);
  const [dispensada, setDispensada] = useState(false);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const ficheiro = useRef<HTMLInputElement>(null);

  const carregarTopo = useCallback(async () => {
    if (!cid) return;
    const sb = getSupabase();
    const hoje = dataLuanda(new Date().toISOString());
    const [a, p] = await Promise.all([
      sb.rpc("meus_avisos"),
      sb.from("presencas").select("id,selfie_caminho").eq("colaborador_id", cid).eq("data", hoje).maybeSingle(),
    ]);
    if (!a.error) setAvisos((a.data ?? []) as unknown as Aviso[]);
    const linha = p.data as unknown as { id: string; selfie_caminho: string | null } | null;
    setSelfiePendente(!!linha && !linha.selfie_caminho);
  }, [cid]);

  useEffect(() => {
    if (parte !== "topo") return;
    carregarTopo();
    const t = setInterval(carregarTopo, 12000);
    return () => clearInterval(t);
  }, [parte, carregarTopo]);

  useEffect(() => {
    if (parte !== "fundo" || !cid) return;
    let activo = true;
    (async () => {
      const { data, error } = await getSupabase().rpc("meus_equipamentos");
      if (activo && !error) setEquip((data ?? []) as unknown as Equip[]);
    })();
    return () => {
      activo = false;
    };
  }, [parte, cid]);

  async function lido(id: string) {
    const { error } = await getSupabase().rpc("marcar_aviso_lido", { p_id: id });
    if (error) setErro(traduzirErro(error));
    else await carregarTopo();
  }

  async function enviarSelfie(f: File) {
    if (!cid) return;
    setOcupado(true);
    setErro("");
    try {
      const blob = await reduzirImagem(f, 640, 0.6);
      const caminho = `${cid}/${crypto.randomUUID()}.jpg`;
      const sb = getSupabase();
      const up = await sb.storage.from("selfies-presenca").upload(caminho, blob, { contentType: "image/jpeg", upsert: false });
      if (up.error) {
        setErro("Não foi possível enviar a selfie: " + up.error.message);
        return;
      }
      const { error } = await sb.rpc("registar_selfie", { p_caminho: caminho });
      if (error) {
        setErro(traduzirErro(error));
        return;
      }
      await carregarTopo();
    } catch {
      setErro("Não foi possível processar a foto. Tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  if (!cid) return null;

  if (parte === "fundo") {
    if (equip.length === 0) return null;
    return (
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Os meus equipamentos</h2>
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
          {equip.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span className="flex items-center gap-2 text-slate-800">
                <Wrench className="h-4 w-4 text-slate-400" />
                {e.codigo} · {e.nome}
                {e.data_aquisicao && <span className="text-xs text-slate-500">(desde {formatData(e.data_aquisicao)})</span>}
              </span>
              <Etiqueta texto={e.estado} tom={e.estado === "Operacional" ? "verde" : e.estado === "Em manutenção" ? "ambar" : "vermelho"} />
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-500">Se algum equipamento avariar, registe uma ocorrência ou avise a administração.</p>
      </section>
    );
  }

  const naoLidos = avisos.filter((a) => !a.lido);

  return (
    <>
      {erro && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</p>}

      {naoLidos.length > 0 && (
        <section className="mb-6 space-y-3">
          {naoLidos.map((a) => (
            <div key={a.id} className="rounded-xl border border-brand-200 bg-brand-50 p-4 shadow-sm">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Bell className="h-4 w-4 text-brand-700" /> {a.titulo}</p>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{a.texto}</p>
              <p className="mt-1 text-xs text-slate-500">{formatData(dataLuanda(a.data))}</p>
              <button onClick={() => lido(a.id)} className="mt-3 h-11 rounded-lg border border-brand-500 bg-white px-4 text-sm font-semibold text-brand-700 hover:bg-brand-100">Marcar como lido</button>
            </div>
          ))}
        </section>
      )}

      {selfiePendente && !dispensada && (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-900">Selfie de entrada (opcional)</p>
          <p className="mt-1 text-xs text-slate-500">Reforça o registo de presença. Só a administração a vê.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button disabled={ocupado} onClick={() => ficheiro.current?.click()} className={`${botao} bg-brand-600 text-white hover:bg-brand-700`}>
              <Camera className="h-5 w-5" /> {ocupado ? "A enviar..." : "Tirar selfie"}
            </button>
            <button disabled={ocupado} onClick={() => setDispensada(true)} className={`${botao} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>Agora não</button>
          </div>
          <input
            ref={ficheiro}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) enviarSelfie(f);
            }}
          />
        </section>
      )}
    </>
  );
}