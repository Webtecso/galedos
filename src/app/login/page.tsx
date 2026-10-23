"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, ClipboardCheck, Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react";
import Logo from "@/components/ui/Logo";
import { getSupabase } from "@/lib/supabase/client";

const campo =
  "w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

const destaques = [
  { icone: ShieldCheck, texto: "Mais organização" },
  { icone: BarChart3, texto: "Mais controlo" },
  { icone: ClipboardCheck, texto: "Mais resultados" },
];

export default function LoginPage() {
  const router = useRouter();
  const [modo, setModo] = useState<"entrar" | "recuperar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState("");
  const [info, setInfo] = useState("");
  const [aEntrar, setAEntrar] = useState(false);

  useEffect(() => {
    const motivo = new URLSearchParams(window.location.search).get("motivo");
    if (motivo === "sem-acesso") setErro("Esta conta não tem acesso à aplicação. Contacte a administração.");
    if (motivo === "senha-alterada") setInfo("Palavra-passe alterada. Já pode entrar com a nova.");
    const detalhe = new URLSearchParams(window.location.search).get("detalhe") ?? "";
    if (motivo === "sem-sessao") setErro("A sessão não ficou guardada neste navegador (código: sem-sessao). Verifique se os cookies estão permitidos e tente de novo.");
    if (motivo === "sem-perfil") setErro("Entrou, mas esta conta não tem perfil na aplicação (código: sem-perfil). Contacte a administração.");
    if (motivo === "conta-inactiva") setErro("Esta conta está desactivada (código: conta-inactiva). Contacte a administração.");
    if (motivo === "erro-perfil") setErro("Não foi possível ler o perfil (código: erro-perfil). " + detalhe);
    getSupabase().auth.getSession().then(({ data }: { data: { session: unknown } }) => {
      if (data.session) router.replace("/painel");
    });
  }, [router]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (aEntrar) return;
    if (!email.trim() || !senha) {
      setErro("Preencha o email e a palavra-passe.");
      return;
    }
    setAEntrar(true);
    setErro("");
    setInfo("");
    const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error) {
      setErro(error.message.toLowerCase().includes("invalid") ? "Email ou palavra-passe incorrectos." : "Não foi possível entrar: " + error.message);
      setAEntrar(false);
      return;
    }
    router.push("/painel");
  }

  async function recuperar(e: React.FormEvent) {
    e.preventDefault();
    if (aEntrar) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErro("Indique o seu email.");
      return;
    }
    setAEntrar(true);
    setErro("");
    setInfo("");
    const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/recuperar` });
    setAEntrar(false);
    if (error) {
      setErro("Não foi possível enviar agora. Tente mais tarde ou peça à administração para repor a palavra-passe.");
      return;
    }
    setInfo("Se o email estiver registado, receberá um link em poucos minutos. Verifique também a pasta de spam.");
  }

  return (
    <div
      className="min-h-screen bg-navy-950 bg-cover bg-center"
      style={{
        backgroundImage:
          "radial-gradient(60% 50% at 15% 20%, rgba(201,162,74,0.20), transparent 70%), linear-gradient(135deg, rgba(7,12,22,0.93), rgba(7,12,22,0.75)), url('/login-bg.jpg'), linear-gradient(135deg, #070c16, #101b30)",
      }}
    >
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 p-6 lg:grid-cols-2">
        <div className="text-white">
          <Logo altura={96} classe="h-24 w-auto sm:h-28 lg:h-40" />
          <h1 className="mt-6 text-3xl font-semibold leading-tight lg:mt-10 lg:text-4xl">
            Bem-vindo ao<br />
            <span className="text-brand-200">Galedos Gestão</span>
          </h1>
          <p className="mt-4 max-w-md text-slate-300">
            A sua plataforma de gestão para um controlo total dos serviços, clientes, colaboradores e finanças.
          </p>
          <div className="mt-10 flex flex-wrap gap-8">
            {destaques.map((d) => (
              <div key={d.texto} className="flex flex-col items-start gap-2 text-sm text-slate-300">
                <d.icone className="h-7 w-7 text-brand-500" />
                {d.texto}
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
          <h2 className="text-2xl font-semibold text-slate-900">{modo === "entrar" ? "Iniciar sessão" : "Recuperar palavra-passe"}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {modo === "entrar" ? "Aceda à sua conta para continuar." : "Indique o email da sua conta. Enviamos um link para definir uma nova palavra-passe."}
          </p>

          <form onSubmit={modo === "entrar" ? entrar : recuperar} noValidate className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">E-mail</label>
              <div className="relative mt-1">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input className={campo} type="email" autoComplete="email" placeholder="exemplo@grupo-galedos.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            {modo === "entrar" && (
              <div>
                <label className="text-sm font-medium text-slate-700">Palavra-passe</label>
                <div className="relative mt-1">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input className={campo} type={ver ? "text" : "password"} autoComplete="current-password" placeholder="Introduza a sua palavra-passe" value={senha} onChange={(e) => setSenha(e.target.value)} />
                  <button type="button" onClick={() => setVer(!ver)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label={ver ? "Esconder palavra-passe" : "Mostrar palavra-passe"}>
                    {ver ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            {info && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{info}</p>}
            <button type="submit" disabled={aEntrar} className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-slate-300">
              {modo === "entrar" ? (aEntrar ? "A entrar..." : "Entrar") : aEntrar ? "A enviar..." : "Enviar link"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => { setModo(modo === "entrar" ? "recuperar" : "entrar"); setErro(""); setInfo(""); }}
            className="mt-4 w-full text-center text-sm font-medium text-brand-700 hover:underline"
          >
            {modo === "entrar" ? "Esqueci a palavra-passe" : "Voltar ao início de sessão"}
          </button>

          <p className="mt-6 text-center text-xs text-slate-500">
            Ainda não tem uma conta? <span className="font-medium text-brand-700">Contacte o administrador</span>
          </p>
          <p className="mt-6 text-center text-[11px] text-slate-400">Grupo Galedos © 2026 | Galedos Gestão v1.0</p>
        </div>
      </div>
    </div>
  );
}