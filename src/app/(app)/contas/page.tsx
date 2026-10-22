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

const seletor =
  "rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export default function ContasPage() {
  const { perfil, userId } = useAuth();
  const co = useColaboradores();
  const [contas, setContas] = useState<Conta[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [escolha, setEscolha] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState(false);

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

  if (perfil.perfil !== "administrador") return <p className="text-sm text-slate-500">Sem permissão.</p>;
  if (!carregado || !co.carregado) return <p className="text-sm text-slate-500">A carregar...</p>;

  const nomeColab = (id: string | null) => (id ? co.obter(id)?.nome ?? id : "—");
  const ligados = new Set(contas.map((c) => c.colaborador_id).filter((x): x is string => !!x));

  return (
    <>
      <PageHeader title="Contas de Acesso" description="Ligue as contas de login aos colaboradores para eles usarem a área Hoje, Presenças e Meus Ganhos." />

      {msg && (
        <div className={`mb-4 rounded-lg border p-3 text-sm ${msg.tipo === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{msg.texto}</div>
      )}

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
        <h2 className="mb-2 font-semibold text-slate-900">Como dar acesso a um colaborador</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>No painel do Supabase, em <strong>Authentication &gt; Users &gt; Add user &gt; Create new user</strong>, crie a conta com o email do colaborador, uma palavra-passe e <strong>Auto Confirm User</strong> marcado.</li>
          <li>Volte aqui e clique em <strong>Actualizar</strong> (ou recarregue a página). A conta aparece abaixo com o perfil <em>Operacional</em>.</li>
          <li>Escolha o colaborador e clique em <strong>Ligar</strong>.</li>
          <li>Entregue o email e a palavra-passe ao colaborador, que deve entrar no telemóvel.</li>
        </ol>
        <button onClick={carregar} className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Actualizar lista</button>
      </div>

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
                      <button disabled={eu || ocupado} onClick={() => chamar("alternar_conta_activa", { p_user: c.id }, c.activo ? "Conta desactivada." : "Conta activada.")}
                        className="text-sm font-medium text-slate-600 hover:underline disabled:text-slate-300">{c.activo ? "Desactivar" : "Activar"}</button>
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