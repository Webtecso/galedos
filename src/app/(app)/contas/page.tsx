"use client";

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Etiqueta from "@/components/ui/Etiqueta";
import { useAuth, type PerfilUtilizador } from "@/components/auth/AuthProvider";
import { useColaboradores } from "@/components/colaboradores/ColaboradoresProvider";
import { getSupabase } from "@/lib/supabase/client";
import { traduzirErro } from "@/lib/erros";

type Conta = { id: string; email: string; nome: string; perfil: PerfilUtilizador; activo: boolean; colaborador_id: string | null };
type Msg = { tipo: "ok" | "erro"; texto: string } | null;
type Credenciais = { nome: string; email: string; password: string };

const seletor =
  "rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
const campo =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
const btn = "rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:bg-slate-300";

function gerarPassword(): string {
  const alfabeto = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join("");
}

async function chamarApi(corpo: Record<string, unknown>): Promise<void> {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Entre de novo.");
  const r = await fetch("/api/contas", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(corpo),
  });
  const j = (await r.json().catch(() => ({}))) as { erro?: string };
  if (!r.ok) throw new Error(j.erro ?? "Não foi possível concluir a operação.");
}

export default function ContasPage() {
  const { perfil, userId } = useAuth();
  const co = useColaboradores();
  const [contas, setContas] = useState<Conta[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [escolha, setEscolha] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState(false);
  const [form, setForm] = useState({ colaborador: "", email: "", password: "" });
  const [criada, setCriada] = useState<Credenciais | null>(null);
  const [repor, setRepor] = useState<{ id: string; email: string; password: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  const carregar = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from("perfis")
      .select("id,email,nome,perfil,activo,colaborador_id")
      .order("email");
    if (error) setMsg({ tipo: "erro", texto: traduzirErro(error) });
    else setContas((data ?? []) as unknown as Conta[]);
    setCarregado(true);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function chamar(fn: string, args: Record<string, unknown>, ok: string) {
    if (ocupado) return;
    setOcupado(true);
    setMsg(null);
    try {
      const { error } = await getSupabase().rpc(fn, args);
      if (error) setMsg({ tipo: "erro", texto: traduzirErro(error) });
      else {
        setMsg({ tipo: "ok", texto: ok });
        await carregar();
      }
    } finally {
      setOcupado(false);
    }
  }

  async function criarConta(e: React.FormEvent) {
    e.preventDefault();
    if (ocupado) return;
    if (!form.colaborador) return setMsg({ tipo: "erro", texto: "Seleccione o colaborador." });
    if (!form.email.trim()) return setMsg({ tipo: "erro", texto: "Indique o email." });
    if (form.password.length < 8) return setMsg({ tipo: "erro", texto: "A palavra-passe deve ter pelo menos 8 caracteres." });
    setOcupado(true);
    setMsg(null);
    setCriada(null);
    try {
      await chamarApi({ accao: "criar", colaborador_id: form.colaborador, email: form.email, password: form.password });
      setCriada({ nome: co.obter(form.colaborador)?.nome ?? "", email: form.email.trim().toLowerCase(), password: form.password });
      setForm({ colaborador: "", email: "", password: "" });
      await carregar();
    } catch (err) {
      setMsg({ tipo: "erro", texto: err instanceof Error ? err.message : "Erro." });
    } finally {
      setOcupado(false);
    }
  }

  async function reporPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!repor || ocupado) return;
    if (repor.password.length < 8) return setMsg({ tipo: "erro", texto: "A palavra-passe deve ter pelo menos 8 caracteres." });
    setOcupado(true);
    setMsg(null);
    setCriada(null);
    try {
      await chamarApi({ accao: "repor", user_id: repor.id, password: repor.password });
      setCriada({ nome: "Nova palavra-passe", email: repor.email, password: repor.password });
      setRepor(null);
    } catch (err) {
      setMsg({ tipo: "erro", texto: err instanceof Error ? err.message : "Erro." });
    } finally {
      setOcupado(false);
    }
  }

  async function copiar(c: Credenciais) {
    try {
      await navigator.clipboard.writeText(`Galedos Gestão\nEmail: ${c.email}\nPalavra-passe: ${c.password}`);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  if (perfil.perfil !== "administrador") return <p className="text-sm text-slate-500">Sem permissão.</p>;
  if (!carregado || !co.carregado) return <p className="text-sm text-slate-500">A carregar...</p>;

  const nomeColab = (id: string | null) => (id ? co.obter(id)?.nome ?? id : "—");
  const ligados = new Set(contas.map((c) => c.colaborador_id).filter((x): x is string => !!x));
  const semConta = co.colaboradores.filter((x) => x.estado === "Activo" && !ligados.has(x.id));

  return (
    <>
      <PageHeader title="Contas de Acesso" description="Crie a conta de login de cada colaborador para ele usar a área Hoje, Presenças e Meus Ganhos no telemóvel." />

      {msg && (
        <div className={`mb-4 rounded-lg border p-3 text-sm ${msg.tipo === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{msg.texto}</div>
      )}

      {criada && (
        <div className="mb-6 rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-sm text-emerald-900">
          <p className="font-semibold">{criada.nome === "Nova palavra-passe" ? "Palavra-passe alterada." : `Conta criada para ${criada.nome}.`} Entregue estes dados ao colaborador:</p>
          <p className="mt-2">Email: <strong>{criada.email}</strong></p>
          <p>Palavra-passe: <strong>{criada.password}</strong></p>
          <p className="mt-2 text-xs">Esta palavra-passe só aparece agora. Depois de sair desta página já não é possível vê-la (só repor outra).</p>
          <div className="mt-3 flex gap-2">
            <button onClick={() => copiar(criada)} className={btn}>{copiado ? "Copiado" : "Copiar dados"}</button>
            <button onClick={() => { setCriada(null); setCopiado(false); }} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700">Fechar</button>
          </div>
        </div>
      )}

      <form onSubmit={criarConta} noValidate className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 font-semibold text-slate-900">Criar conta de colaborador</h2>
        <p className="mb-3 text-xs text-slate-500">Só aparecem colaboradores activos que ainda não têm conta. Cadastre primeiro o colaborador em Colaboradores.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="text-sm font-medium text-slate-700">Colaborador *</label>
            <select className={campo} value={form.colaborador} onChange={(e) => setForm({ ...form, colaborador: e.target.value })}>
              <option value="">Seleccione</option>
              {semConta.map((x) => <option key={x.id} value={x.id}>{x.codigo} · {x.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Email de acesso *</label>
            <input type="email" autoComplete="off" className={campo} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Palavra-passe * (mín. 8)</label>
            <div className="flex gap-2">
              <input autoComplete="off" className={campo} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <button type="button" onClick={() => setForm({ ...form, password: gerarPassword() })} className="mt-1 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50">Gerar</button>
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end"><button type="submit" disabled={ocupado || semConta.length === 0} className={btn}>Criar conta</button></div>
        {semConta.length === 0 && <p className="mt-2 text-right text-xs text-slate-500">Todos os colaboradores activos já têm conta.</p>}
      </form>

      {repor && (
        <form onSubmit={reporPassword} noValidate className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="mb-2 font-semibold text-slate-900">Nova palavra-passe para {repor.email}</h2>
          <div className="flex flex-wrap gap-2">
            <input autoComplete="off" className={campo + " max-w-xs"} value={repor.password} onChange={(e) => setRepor({ ...repor, password: e.target.value })} />
            <button type="button" onClick={() => setRepor({ ...repor, password: gerarPassword() })} className="mt-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700">Gerar</button>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="submit" disabled={ocupado} className={btn}>Guardar</button>
            <button type="button" onClick={() => setRepor(null)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700">Cancelar</button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Perfil</th>
                <th className="px-5 py-3 font-medium">Colaborador ligado</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Acções</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contas.map((c) => {
                const eu = c.id === userId;
                const disponiveis = co.colaboradores.filter((x) => x.estado === "Activo" && (!ligados.has(x.id) || x.id === c.colaborador_id));
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">{c.email}{c.nome && <p className="text-xs text-slate-500">{c.nome}</p>}{eu && <p className="text-xs text-brand-700">(a sua conta)</p>}</td>
                    <td className="px-5 py-3">
                      <select className={seletor} disabled={eu || ocupado} value={c.perfil}
                        onChange={(e) => { if (window.confirm(`Alterar o perfil de ${c.email} para "${e.target.value}"?`)) chamar("definir_perfil_conta", { p_user: c.id, p_perfil: e.target.value }, "Perfil alterado."); }}>
                        <option value="administrador">Administrador</option>
                        <option value="gestao">Gestão</option>
                        <option value="operacional">Operacional</option>
                      </select>
                    </td>
                    <td className="px-5 py-3">
                      {c.colaborador_id ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{nomeColab(c.colaborador_id)}</span>
                          <button disabled={ocupado} onClick={() => { if (window.confirm("Desligar esta conta do colaborador?")) chamar("desligar_conta", { p_user: c.id }, "Conta desligada."); }} className="text-xs font-medium text-red-700 hover:underline">Desligar</button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <select className={seletor} value={escolha[c.id] ?? ""} onChange={(e) => setEscolha({ ...escolha, [c.id]: e.target.value })}>
                            <option value="">Seleccione</option>
                            {disponiveis.map((x) => <option key={x.id} value={x.id}>{x.codigo} · {x.nome}</option>)}
                          </select>
                          <button disabled={!escolha[c.id] || ocupado} onClick={() => chamar("ligar_conta", { p_user: c.id, p_colaborador: escolha[c.id] }, "Conta ligada ao colaborador.")}
                            className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:bg-slate-300">Ligar</button>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3"><Etiqueta texto={c.activo ? "Activa" : "Desactivada"} tom={c.activo ? "verde" : "cinza"} /></td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <div className="flex gap-4">
                        <button disabled={ocupado} onClick={() => { setCriada(null); setRepor({ id: c.id, email: c.email, password: gerarPassword() }); }}
                          className="text-sm font-medium text-brand-700 hover:underline disabled:text-slate-300">Nova palavra-passe</button>
                        <button disabled={eu || ocupado} onClick={() => chamar("alternar_conta_activa", { p_user: c.id }, c.activo ? "Conta desactivada." : "Conta activada.")}
                          className="text-sm font-medium text-slate-600 hover:underline disabled:text-slate-300">{c.activo ? "Desactivar" : "Activar"}</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {contas.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Sem contas.</p>}
      </div>
    </>
  );
}