"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { traduzirErro } from "@/lib/erros";
import { reduzirImagem } from "@/lib/imagem";

type Painel = {
  checklist: { id: string; texto: string; feito: boolean }[];
  antes: number;
  depois: number;
  confirmada: boolean;
};

const campo =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
const botao = "flex h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold disabled:opacity-50";

function Assinatura({ onChange }: { onChange: (dataUrl: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const ultimo = useRef<{ x: number; y: number } | null>(null);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = ref.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * c.width) / r.width, y: ((e.clientY - r.top) * c.height) / r.height };
  }

  function iniciar(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    desenhando.current = true;
    ultimo.current = pos(e);
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current) return;
    const c = ref.current;
    const ctx = c?.getContext("2d");
    const de = ultimo.current;
    if (!c || !ctx || !de) return;
    const p = pos(e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.beginPath();
    ctx.moveTo(de.x, de.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ultimo.current = p;
  }

  function terminar() {
    if (!desenhando.current) return;
    desenhando.current = false;
    ultimo.current = null;
    if (ref.current) onChange(ref.current.toDataURL("image/png"));
  }

  function limpar() {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
    onChange("");
  }

  return (
    <div>
      <canvas
        ref={ref}
        width={500}
        height={200}
        style={{ touchAction: "none" }}
        className="h-40 w-full rounded-lg border border-dashed border-slate-400 bg-white"
        onPointerDown={iniciar}
        onPointerMove={mover}
        onPointerUp={terminar}
        onPointerCancel={terminar}
      />
      <button type="button" onClick={limpar} className="mt-1 text-sm text-slate-600 hover:underline">Limpar assinatura</button>
    </div>
  );
}

export default function PainelExecucao({
  servicoId, aberto, terminado,
}: { servicoId: string; aberto: boolean; terminado: boolean }) {
  const [p, setP] = useState<Painel | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState("");
  const antesRef = useRef<HTMLInputElement>(null);
  const depoisRef = useRef<HTMLInputElement>(null);
  const [nome, setNome] = useState("");
  const [assinatura, setAssinatura] = useState("");
  const [satisfeito, setSatisfeito] = useState<"" | "sim" | "nao">("");
  const [comentario, setComentario] = useState("");

  const carregar = useCallback(async () => {
    const { data, error } = await getSupabase().rpc("meu_painel_servico", { p_servico: servicoId });
    if (error) {
      setErro(traduzirErro(error));
      return;
    }
    setP(data as unknown as Painel);
  }, [servicoId]);

  useEffect(() => {
    carregar();
  }, [carregar, terminado]);

  async function enviarFoto(fase: "Antes" | "Depois", ficheiro: File) {
    setOcupado("foto");
    setErro("");
    setAviso("");
    try {
      const blob = await reduzirImagem(ficheiro);
      const caminho = `${servicoId}/${crypto.randomUUID()}.jpg`;
      const sb = getSupabase();
      const up = await sb.storage.from("fotos-servico").upload(caminho, blob, { contentType: "image/jpeg", upsert: false });
      if (up.error) {
        setErro("Não foi possível enviar a foto: " + up.error.message);
        return;
      }
      const { error } = await sb.rpc("registar_foto", { p_servico: servicoId, p_fase: fase, p_caminho: caminho });
      if (error) {
        setErro(traduzirErro(error));
        return;
      }
      setAviso(`Foto (${fase === "Antes" ? "antes" : "depois"}) enviada.`);
      await carregar();
    } catch {
      setErro("Não foi possível processar a foto. Tente de novo.");
    } finally {
      setOcupado("");
    }
  }

  async function escolher(fase: "Antes" | "Depois", e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) await enviarFoto(fase, f);
  }

  async function alternar(id: string, feito: boolean) {
    setOcupado("chk");
    setErro("");
    setAviso("");
    try {
      const { error } = await getSupabase().rpc("marcar_checklist", { p_servico: servicoId, p_item: id, p_feito: feito });
      if (error) {
        setErro(traduzirErro(error));
        return;
      }
      await carregar();
    } finally {
      setOcupado("");
    }
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (ocupado) return;
    if (nome.trim().length < 2) {
      setErro("Indique o nome de quem confirma.");
      return;
    }
    if (!assinatura) {
      setErro("Peça ao cliente para assinar no ecrã.");
      return;
    }
    if (!satisfeito) {
      setErro("Indique se o cliente ficou satisfeito.");
      return;
    }
    setOcupado("conf");
    setErro("");
    setAviso("");
    try {
      const { error } = await getSupabase().rpc("registar_confirmacao", {
        p_servico: servicoId,
        p_nome: nome,
        p_assinatura: assinatura,
        p_satisfeito: satisfeito === "sim",
        p_comentario: comentario,
      });
      if (error) {
        setErro(traduzirErro(error));
        return;
      }
      setAviso("Confirmação do cliente registada.");
      await carregar();
    } finally {
      setOcupado("");
    }
  }

  if (!p) return erro ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{erro}</p> : null;

  const feitos = p.checklist.filter((i) => i.feito).length;

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      {erro && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-800">{erro}</p>}
      {aviso && <p className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-800">{aviso}</p>}

      {aberto && (
        <>
          {p.checklist.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-medium text-slate-700">Lista de verificação ({feitos}/{p.checklist.length})</p>
              <ul className="space-y-1">
                {p.checklist.map((i) => (
                  <li key={i.id}>
                    <label className="flex items-start gap-3 rounded-lg bg-white p-2 text-sm text-slate-800">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-5 w-5 shrink-0"
                        checked={i.feito}
                        disabled={!!ocupado}
                        onChange={(e) => alternar(i.id, e.target.checked)}
                      />
                      <span>{i.texto}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" disabled={!!ocupado} onClick={() => antesRef.current?.click()} className={`${botao} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`}>
              <Camera className="h-5 w-5" /> Foto antes ({p.antes})
            </button>
            <button type="button" disabled={!!ocupado} onClick={() => depoisRef.current?.click()} className={`${botao} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`}>
              <Camera className="h-5 w-5" /> Foto depois ({p.depois})
            </button>
          </div>
          <input ref={antesRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => escolher("Antes", e)} />
          <input ref={depoisRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => escolher("Depois", e)} />
          <p className="text-xs text-slate-500">Tire as fotos antes de terminar o serviço. Máximo de 8 por fase. As fotos são comprimidas e só a administração as vê.</p>
          {ocupado === "foto" && <p className="text-sm text-slate-600">A enviar a foto...</p>}
        </>
      )}

      {terminado && (
        <>
          <p className="text-xs text-slate-600">Fotos enviadas: {p.antes} antes · {p.depois} depois</p>
          {p.confirmada ? (
            <p className="text-sm text-emerald-700">Confirmação do cliente registada.</p>
          ) : (
            <form onSubmit={confirmar} noValidate className="space-y-3 border-t border-slate-200 pt-3">
              <p className="text-sm font-medium text-slate-700">Confirmação do cliente</p>
              <div>
                <label className="text-sm text-slate-700">Nome de quem confirma *</label>
                <input className={campo} value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-slate-700">O cliente ficou satisfeito? *</label>
                <select className={campo} value={satisfeito} onChange={(e) => setSatisfeito(e.target.value as "" | "sim" | "nao")}>
                  <option value="">Seleccione</option>
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-700">Comentário (opcional)</label>
                <textarea className={campo} rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-slate-700">Assinatura do cliente *</label>
                <Assinatura onChange={setAssinatura} />
              </div>
              <button type="submit" disabled={!!ocupado} className={`${botao} bg-brand-600 text-white hover:bg-brand-700`}>
                Registar confirmação
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}