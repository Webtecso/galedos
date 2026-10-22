"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import { getSupabase } from "@/lib/supabase/client";
import { traduzirErro } from "@/lib/erros";

type Msg = { tipo: "ok" | "erro"; texto: string } | null;

const campo =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
const btn = "h-12 w-full rounded-xl bg-brand-600 px-4 text-base font-semibold text-white hover:bg-brand-700 disabled:bg-slate-300 sm:w-auto";

export default function ContaPage() {
  const { perfil, recarregar } = useAuth();
  const router = useRouter();
  const operacional = perfil.perfil === "operacional";
  const precisaPrivacidade = operacional && !perfil.privacidadeAceite;
  const inicio = operacional ? (perfil.colaboradorId ? "/hoje" : "/presencas") : "/painel";

  const [aceito, setAceito] = useState(false);
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  async function aceitar() {
    if (!aceito || ocupado) return;
    setOcupado(true);
    setMsg(null);
    try {
      const { error } = await getSupabase().rpc("aceitar_privacidade");
      if (error) {
        setMsg({ tipo: "erro", texto: traduzirErro(error) });
        return;
      }
      await recarregar();
      if (!perfil.deveMudarPassword) router.replace(inicio);
    } finally {
      setOcupado(false);
    }
  }

  async function mudarPassword(e: React.FormEvent) {
    e.preventDefault();
    if (ocupado) return;
    if (nova.length < 8) return setMsg({ tipo: "erro", texto: "A palavra-passe deve ter pelo menos 8 caracteres." });
    if (nova !== confirma) return setMsg({ tipo: "erro", texto: "As duas palavras-passe não coincidem." });
    setOcupado(true);
    setMsg(null);
    try {
      const sb = getSupabase();
      const { error } = await sb.auth.updateUser({ password: nova });
      if (error) {
        setMsg({ tipo: "erro", texto: "Não foi possível alterar a palavra-passe: " + error.message });
        return;
      }
      if (perfil.deveMudarPassword) {
        const r = await sb.rpc("concluir_mudanca_password");
        if (r.error) {
          setMsg({ tipo: "erro", texto: traduzirErro(r.error) });
          return;
        }
      }
      setNova("");
      setConfirma("");
      setMsg({ tipo: "ok", texto: "Palavra-passe alterada." });
      await recarregar();
      if (!precisaPrivacidade) router.replace(inicio);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <PageHeader title="A minha conta" description={perfil.email} />

      {(perfil.deveMudarPassword || precisaPrivacidade) && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Primeiro acesso: {perfil.deveMudarPassword && "escolha uma palavra-passe só sua"}
          {perfil.deveMudarPassword && precisaPrivacidade && " e "}
          {precisaPrivacidade && "leia e aceite o aviso de privacidade"}. Depois pode usar a aplicação.
        </p>
      )}

      {msg && (
        <div className={`mb-4 rounded-lg border p-3 text-sm ${msg.tipo === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{msg.texto}</div>
      )}

      <form onSubmit={mudarPassword} noValidate className="mb-6 max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-slate-900">{perfil.deveMudarPassword ? "Escolha a sua palavra-passe" : "Alterar palavra-passe"}</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Nova palavra-passe (mín. 8 caracteres)</label>
            <input type="password" autoComplete="new-password" className={campo} value={nova} onChange={(e) => setNova(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Repita a nova palavra-passe</label>
            <input type="password" autoComplete="new-password" className={campo} value={confirma} onChange={(e) => setConfirma(e.target.value)} />
          </div>
        </div>
        <div className="mt-4"><button type="submit" disabled={ocupado} className={btn}>Guardar palavra-passe</button></div>
      </form>

      {precisaPrivacidade && (
        <section className="max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-slate-900">Aviso de privacidade</h2>
          <div className="space-y-2 text-sm text-slate-700">
            <p>Para o seu trabalho, o Grupo Galedos regista nesta aplicação:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>as horas de entrada, saída e pausas, e o início e o fim de cada serviço (a hora é a do servidor);</li>
              <li>a sua localização, apenas no momento em que marca entrada, saída, chegada, início e fim. Não há rastreio contínuo;</li>
              <li>fotografias do trabalho (antes e depois) e, se quiser, uma selfie à entrada;</li>
              <li>as suas remunerações, pagamentos, pedidos e ausências.</li>
            </ul>
            <p>Estes dados servem para controlar a presença, provar os serviços prestados e calcular as remunerações.</p>
            <p>Só a administração e a gestão os consultam, e você vê os seus próprios dados. Não são partilhados com terceiros.</p>
            <p>Pode pedir à administração para consultar ou corrigir os seus dados.</p>
          </div>
          <label className="mt-4 flex items-start gap-3 text-sm text-slate-800">
            <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={aceito} onChange={(e) => setAceito(e.target.checked)} />
            <span>Li e aceito o aviso de privacidade.</span>
          </label>
          <div className="mt-4"><button type="button" disabled={!aceito || ocupado} onClick={aceitar} className={btn}>Aceitar e continuar</button></div>
        </section>
      )}
    </>
  );
}