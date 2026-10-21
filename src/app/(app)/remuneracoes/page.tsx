"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calculator, CheckCheck, Lock, Wallet, HandCoins, Hourglass, ClipboardCheck } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import RemEstadoBadge from "@/components/ui/RemEstadoBadge";
import { useRemuneracoes } from "@/components/remuneracoes/RemuneracoesProvider";
import { useColaboradores } from "@/components/colaboradores/ColaboradoresProvider";
import { meiosPagamento } from "@/lib/servicos";
import { estadosRemuneracao, modalidadesDistribuicao, saldoColaborador } from "@/lib/remuneracoes";
import type { MeioPagamento, ModalidadeDistribuicao } from "@/lib/types";
import { formatData, formatKz, formatPeriodo, hojeISO } from "@/lib/format";

const campo =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
const btn = "rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700";
const btnSec = "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50";

type Msg = { tipo: "ok" | "erro"; texto: string } | null;

export default function RemuneracoesPage() {
  const {
    config, remuneracoes, pagamentos, periodosFechados, carregado,
    apurar, aprovarPeriodo, fecharPeriodo, registarPagamento, registarAjuste, alterarConfig,
  } = useRemuneracoes();
  const { colaboradores } = useColaboradores();

  const [msg, setMsg] = useState<Msg>(null);
  const [avisos, setAvisos] = useState<string[]>([]);

  const [pct, setPct] = useState(String(config.percentagemEquipa));
  const [mod, setMod] = useState<ModalidadeDistribuicao>(config.modalidade);
  useEffect(() => {
    setPct(String(config.percentagemEquipa));
    setMod(config.modalidade);
  }, [config.percentagemEquipa, config.modalidade]);

  const [pagColab, setPagColab] = useState("");
  const [pagTipo, setPagTipo] = useState<"Pagamento" | "Adiantamento">("Pagamento");
  const [pagValor, setPagValor] = useState("");
  const [pagMeio, setPagMeio] = useState<MeioPagamento>("Dinheiro");
  const [pagRef, setPagRef] = useState("");

  const [ajColab, setAjColab] = useState("");
  const [ajValor, setAjValor] = useState("");
  const [ajMotivo, setAjMotivo] = useState("");

  const [fColab, setFColab] = useState("todos");
  const [fPeriodo, setFPeriodo] = useState("todos");

  const nome = (id: string) => colaboradores.find((c) => c.id === id)?.nome ?? id;
  const estados = useMemo(() => estadosRemuneracao(remuneracoes, pagamentos), [remuneracoes, pagamentos]);

  const periodos = useMemo(() => {
    const set = new Set(remuneracoes.map((r) => r.periodo));
    set.add(hojeISO().slice(0, 7));
    return Array.from(set).sort().reverse();
  }, [remuneracoes]);

  const resumos = colaboradores.map((c) => ({ c, s: saldoColaborador(c.id, remuneracoes, pagamentos) }));
  const totalApurado = remuneracoes.reduce((t, r) => t + r.valor, 0);
  const totalAprovado = remuneracoes.filter((r) => r.aprovada).reduce((t, r) => t + r.valor, 0);
  const totalPago = pagamentos.reduce((t, p) => t + p.valor, 0);
  const porPagar = resumos.reduce((t, x) => t + Math.max(0, x.s.saldo), 0);

  const saldoSel = pagColab ? saldoColaborador(pagColab, remuneracoes, pagamentos) : null;

  const listadas = remuneracoes
    .filter((r) => (fColab === "todos" || r.colaboradorId === fColab) && (fPeriodo === "todos" || r.periodo === fPeriodo))
    .sort((a, b) => (b.data + b.id).localeCompare(a.data + a.id));

  async function fazerApuramento() {
    const r = await apurar();
    if (r.erro) {
      setMsg({ tipo: "erro", texto: r.erro });
      setAvisos([]);
      return;
    }
    setAvisos(r.avisos);
    setMsg({
      tipo: "ok",
      texto: r.criadas > 0 ? `${r.criadas} remuneração(ões) apurada(s).` : "Não há novos recebimentos de serviços concluídos para apurar.",
    });
  }

  async function guardarConfig(e: React.FormEvent) {
    e.preventDefault();
    const r = await alterarConfig(Number(pct.replace(",", ".")), mod);
    setMsg(r.ok ? { tipo: "ok", texto: "Configuração guardada. Aplica-se apenas a apuramentos futuros." } : { tipo: "erro", texto: r.erro ?? "Erro." });
  }

  async function aprovar(p: string) {
    const r = await aprovarPeriodo(p);
    setMsg(r.ok ? { tipo: "ok", texto: `${r.n} remuneração(ões) aprovada(s) em ${formatPeriodo(p)}.` } : { tipo: "erro", texto: r.erro ?? "Erro." });
  }

  async function fechar(p: string) {
    const r = await fecharPeriodo(p);
    setMsg(r.ok ? { tipo: "ok", texto: `${formatPeriodo(p)} fechado.` } : { tipo: "erro", texto: r.erro ?? "Erro." });
  }

  async function pagar(e: React.FormEvent) {
    e.preventDefault();
    const r = await registarPagamento(pagColab, { tipo: pagTipo, valor: Number(pagValor.replace(",", ".")), meio: pagMeio, referencia: pagRef });
    if (r.ok) {
      setPagValor("");
      setPagRef("");
      setMsg({ tipo: "ok", texto: `${pagTipo} registado.` });
    } else {
      setMsg({ tipo: "erro", texto: r.erro ?? "Erro." });
    }
  }

  async function ajustar(e: React.FormEvent) {
    e.preventDefault();
    const r = await registarAjuste(ajColab, Number(ajValor.replace(",", ".")), ajMotivo);
    if (r.ok) {
      setAjValor("");
      setAjMotivo("");
      setMsg({ tipo: "ok", texto: "Ajuste registado." });
    } else {
      setMsg({ tipo: "erro", texto: r.erro ?? "Erro." });
    }
  }

  if (!carregado) return <p className="text-sm text-slate-500">A carregar...</p>;

  return (
    <>
      <PageHeader
        title="Remunerações"
        description="O valor é calculado sobre os recebimentos de serviços concluídos e guardado no momento do apuramento."
        action={
          <button onClick={fazerApuramento} className={`${btn} inline-flex items-center gap-2`}>
            <Calculator className="h-4 w-4" /> Apurar remunerações
          </button>
        }
      />

      {msg && (
        <div className={`mb-4 rounded-lg border p-3 text-sm ${msg.tipo === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
          {msg.texto}
        </div>
      )}
      {avisos.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <ul className="list-disc space-y-1 pl-5">{avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total apurado" value={formatKz(totalApurado)} icon={Wallet} hint="Inclui ajustes" />
        <StatCard label="Aprovado" value={formatKz(totalAprovado)} icon={ClipboardCheck} />
        <StatCard label="Pago (inclui adiantamentos)" value={formatKz(totalPago)} icon={HandCoins} />
        <StatCard label="Por pagar" value={formatKz(porPagar)} icon={Hourglass} hint="Aprovado e ainda não liquidado" />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <form onSubmit={guardarConfig} noValidate className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-1 font-semibold text-slate-900">Regras de remuneração</h2>
          <Link href="/remuneracoes/quotas" className="mb-3 inline-block text-xs font-medium text-brand-700 hover:underline">Definir quotas por serviço (modalidade C)</Link>
          <p className="mb-4 text-xs text-slate-500">Em vigor desde {formatData(config.entradaEmVigor)}. Alterações não mudam cálculos já apurados.</p>
          <label className="text-sm font-medium text-slate-700">Percentagem da equipa (%)</label>
          <input className={campo} inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} />
          <p className="mt-1 text-xs text-slate-500">Parcela da empresa: {Number.isNaN(Number(pct.replace(",", "."))) ? "—" : `${100 - Number(pct.replace(",", "."))}%`}</p>
          <label className="mt-4 block text-sm font-medium text-slate-700">Modalidade de distribuição</label>
          <select className={campo} value={mod} onChange={(e) => setMod(e.target.value as ModalidadeDistribuicao)}>
            {modalidadesDistribuicao.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            {mod === "Divisão igual" ? "A parte da equipa é dividida igualmente pelos participantes." : mod === "Percentagens individuais" ? "Cada colaborador recebe a sua percentagem individual do valor recebido (definida na ficha)." : "A parte da equipa é distribuída pelas quotas definidas em cada ordem de serviço (ver Quotas por serviço)."}
          </p>
          <div className="mt-4 flex justify-end"><button type="submit" className={btn}>Guardar regras</button></div>
          {config.historico.length > 0 && (
            <ul className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
              {[...config.historico].reverse().slice(0, 3).map((h) => <li key={h.id}>{new Date(h.data).toLocaleDateString("pt-PT")} · {h.accao}</li>)}
            </ul>
          )}
        </form>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Fecho mensal</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Período</th>
                  <th className="px-5 py-3 font-medium">Total</th>
                  <th className="px-5 py-3 font-medium">Por aprovar</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3 font-medium">Acções</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {periodos.map((p) => {
                  const regs = remuneracoes.filter((r) => r.periodo === p);
                  const pend = regs.filter((r) => !r.aprovada).length;
                  const fechado = periodosFechados.includes(p);
                  return (
                    <tr key={p}>
                      <td className="px-5 py-3 font-medium">{formatPeriodo(p)}</td>
                      <td className="whitespace-nowrap px-5 py-3">{formatKz(regs.reduce((t, r) => t + r.valor, 0))}</td>
                      <td className="px-5 py-3">{pend}</td>
                      <td className="px-5 py-3"><RemEstadoBadge estado={fechado ? "Fechado" : "Aberto"} /></td>
                      <td className="whitespace-nowrap px-5 py-3">
                        {!fechado && (
                          <div className="flex gap-2">
                            <button onClick={() => aprovar(p)} className={`${btnSec} inline-flex items-center gap-1`}><CheckCheck className="h-4 w-4" /> Aprovar</button>
                            <button onClick={() => fechar(p)} className={`${btnSec} inline-flex items-center gap-1`}><Lock className="h-4 w-4" /> Fechar</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Saldos por colaborador</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Colaborador</th>
                <th className="px-5 py-3 font-medium">Apurado</th>
                <th className="px-5 py-3 font-medium">Aprovado</th>
                <th className="px-5 py-3 font-medium">Pago</th>
                <th className="px-5 py-3 font-medium">Saldo devido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {resumos.map(({ c, s }) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3"><Link href={`/colaboradores/${c.id}`} className="font-medium text-brand-700 hover:underline">{c.nome}</Link></td>
                  <td className="whitespace-nowrap px-5 py-3">{formatKz(s.apurado)}</td>
                  <td className="whitespace-nowrap px-5 py-3">{formatKz(s.aprovado)}</td>
                  <td className="whitespace-nowrap px-5 py-3">{formatKz(s.pago)}</td>
                  <td className={`whitespace-nowrap px-5 py-3 font-semibold ${s.saldo > 0 ? "text-amber-700" : s.saldo < 0 ? "text-red-700" : ""}`}>{formatKz(s.saldo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Saldo negativo significa adiantamento a recuperar em apuramentos futuros.</p>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <form onSubmit={pagar} noValidate className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-900">Registar pagamento ao colaborador</h2>
          <div className="space-y-3">
            <select className={campo} value={pagColab} onChange={(e) => setPagColab(e.target.value)}>
              <option value="">Seleccione o colaborador</option>
              {colaboradores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            {saldoSel && <p className="text-xs text-slate-500">Saldo aprovado por pagar: <strong>{formatKz(Math.max(0, saldoSel.saldo))}</strong></p>}
            <select className={campo} value={pagTipo} onChange={(e) => setPagTipo(e.target.value as "Pagamento" | "Adiantamento")}>
              <option value="Pagamento">Pagamento (até ao saldo aprovado)</option>
              <option value="Adiantamento">Adiantamento</option>
            </select>
            <input className={campo} inputMode="decimal" placeholder="Valor (Kz)" value={pagValor} onChange={(e) => setPagValor(e.target.value)} />
            <select className={campo} value={pagMeio} onChange={(e) => setPagMeio(e.target.value as MeioPagamento)}>
              {meiosPagamento.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <input className={campo} placeholder="Referência / comprovativo (opcional)" value={pagRef} onChange={(e) => setPagRef(e.target.value)} />
            <button type="submit" className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700">Registar</button>
          </div>
        </form>

        <form onSubmit={ajustar} noValidate className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-1 font-semibold text-slate-900">Ajuste autorizado</h2>
          <p className="mb-4 text-xs text-slate-500">Correcções são feitas por ajuste, nunca editando o cálculo original. Use valor negativo para deduzir.</p>
          <div className="space-y-3">
            <select className={campo} value={ajColab} onChange={(e) => setAjColab(e.target.value)}>
              <option value="">Seleccione o colaborador</option>
              {colaboradores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <input className={campo} inputMode="decimal" placeholder="Valor do ajuste (Kz, ex.: 2000 ou -2000)" value={ajValor} onChange={(e) => setAjValor(e.target.value)} />
            <textarea className={campo} rows={2} placeholder="Motivo (obrigatório)" value={ajMotivo} onChange={(e) => setAjMotivo(e.target.value)} />
            <button type="submit" className={`${btn} w-full`}>Registar ajuste</button>
          </div>
        </form>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Remunerações apuradas</h2>
          <div className="flex flex-wrap gap-2">
            <select className={campo + " mt-0 w-auto"} value={fColab} onChange={(e) => setFColab(e.target.value)}>
              <option value="todos">Todos os colaboradores</option>
              {colaboradores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <select className={campo + " mt-0 w-auto"} value={fPeriodo} onChange={(e) => setFPeriodo(e.target.value)}>
              <option value="todos">Todos os períodos</option>
              {periodos.map((p) => <option key={p} value={p}>{formatPeriodo(p)}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Data</th>
                <th className="px-5 py-3 font-medium">Colaborador</th>
                <th className="px-5 py-3 font-medium">Serviço</th>
                <th className="px-5 py-3 font-medium">Valor elegível</th>
                <th className="px-5 py-3 font-medium">Regra</th>
                <th className="px-5 py-3 font-medium">Valor</th>
                <th className="px-5 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listadas.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-5 py-3">{formatData(r.data)}</td>
                  <td className="px-5 py-3">{nome(r.colaboradorId)}</td>
                  <td className="whitespace-nowrap px-5 py-3">{r.servicoId ? <Link href={`/servicos/${r.servicoId}`} className="text-brand-700 hover:underline">{r.servicoCodigo}</Link> : "Ajuste"}</td>
                  <td className="whitespace-nowrap px-5 py-3">{r.tipo === "Serviço" ? formatKz(r.valorElegivel) : "—"}</td>
                  <td className="px-5 py-3 text-xs text-slate-600">
                    {r.tipo === "Serviço" ? `${r.regra} · ${Math.round(r.percentagem * 100) / 100}% cada` : r.motivo}
                  </td>
                  <td className={`whitespace-nowrap px-5 py-3 font-medium ${r.valor < 0 ? "text-red-700" : ""}`}>{formatKz(r.valor)}</td>
                  <td className="px-5 py-3"><RemEstadoBadge estado={estados[r.id] ?? "Apurada"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {listadas.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Sem remunerações. Conclua serviços com recebimentos e clique em "Apurar remunerações".</p>}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Pagamentos efectuados</h2></div>
        {pagamentos.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">Ainda sem pagamentos a colaboradores.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {[...pagamentos].reverse().map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2 px-5 py-3 text-sm">
                <span>{formatData(p.data)} · {nome(p.colaboradorId)} · {p.tipo} · {p.meio}{p.referencia ? ` · ${p.referencia}` : ""}</span>
                <span className="font-medium">{formatKz(p.valor)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}