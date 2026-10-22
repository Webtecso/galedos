"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, FileText, Plus } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Etiqueta, { type Tom } from "@/components/ui/Etiqueta";
import { useStock } from "@/components/stock/StockProvider";
import { useColaboradores } from "@/components/colaboradores/ColaboradoresProvider";
import {
  categoriasEquipamento, categoriasProduto, estadosEquipamento, tiposMovimento,
  type EstadoEquipamento, type TipoMovimento,
} from "@/lib/operacao";
import { formatData, formatKz, hojeISO } from "@/lib/format";

const campo =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
const btn = "rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700";
const btnSec = "rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50";

type Aba = "produtos" | "movimentos" | "equipamentos";
const tomEquip: Record<EstadoEquipamento, Tom> = {
  Operacional: "verde", "Em manutenção": "ambar", Avariado: "vermelho", Abatido: "cinza",
};

export default function StockPage() {
  const st = useStock();
  const co = useColaboradores();
  const [aba, setAba] = useState<Aba>("produtos");
  const [msg, setMsg] = useState("");

  const [novoProd, setNovoProd] = useState(false);
  const [p, setP] = useState({ nome: "", categoria: "", unidade: "unidade", quantidade: "0", minimo: "0", fornecedor: "", custo: "0" });
  const [mProd, setMProd] = useState("");
  const [mTipo, setMTipo] = useState<TipoMovimento>("Saída para utilização");
  const [mValor, setMValor] = useState("");
  const [mMotivo, setMMotivo] = useState("");

  const [novoEq, setNovoEq] = useState(false);
  const [q, setQ] = useState({ nome: "", categoria: categoriasEquipamento[0], dataAquisicao: "", observacoes: "" });
  const [sel, setSel] = useState<string | null>(null);
  const [manDesc, setManDesc] = useState("");
  const [manCusto, setManCusto] = useState("0");

  if (!st.carregado || !co.carregado) return <p className="text-sm text-slate-500">A carregar...</p>;

  const nomeProd = (id: string) => st.produtos.find((x) => x.id === id)?.nome ?? id;
  const baixos = st.produtos.filter((x) => x.estado === "Activo" && x.quantidade <= x.minimo);
  const eqSel = st.equipamentos.find((x) => x.id === sel);
  const prodSel = st.produtos.find((x) => x.id === mProd);
  const num = (v: string) => Number(v.replace(",", "."));

  async function guardarProduto(e: React.FormEvent) {
    e.preventDefault();
    const r = await st.adicionarProduto({
      nome: p.nome, categoria: p.categoria, unidade: p.unidade, quantidade: num(p.quantidade),
      minimo: num(p.minimo), fornecedor: p.fornecedor, custo: num(p.custo),
    });
    if (r.ok) {
      setNovoProd(false); setMsg("");
      setP({ nome: "", categoria: "", unidade: "unidade", quantidade: "0", minimo: "0", fornecedor: "", custo: "0" });
    } else setMsg(r.erro ?? "Erro.");
  }

  async function registarMov(e: React.FormEvent) {
    e.preventDefault();
    const r = await st.movimentar(mProd, mTipo, num(mValor), mMotivo);
    if (r.ok) { setMValor(""); setMMotivo(""); setMsg(""); } else setMsg(r.erro ?? "Erro.");
  }

  async function guardarEquip(e: React.FormEvent) {
    e.preventDefault();
    const r = await st.adicionarEquipamento(q);
    if (r.ok) { setNovoEq(false); setMsg(""); setQ({ nome: "", categoria: categoriasEquipamento[0], dataAquisicao: "", observacoes: "" }); }
    else setMsg(r.erro ?? "Erro.");
  }

  async function guardarManutencao(e: React.FormEvent) {
    e.preventDefault();
    if (!eqSel) return;
    const r = await st.registarManutencao(eqSel.id, manDesc, num(manCusto));
    if (r.ok) { setManDesc(""); setManCusto("0"); setMsg(""); } else setMsg(r.erro ?? "Erro.");
  }

  const abas: { chave: Aba; label: string }[] = [
    { chave: "produtos", label: "Produtos" },
    { chave: "movimentos", label: "Movimentos" },
    { chave: "equipamentos", label: "Equipamentos" },
  ];

  return (
    <>
      <PageHeader title="Stock e equipamentos" description="Os movimentos nunca são apagados; correcções fazem-se por ajuste de inventário." />

      {baixos.length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p><strong>Stock baixo:</strong> {baixos.map((x) => `${x.nome} (${x.quantidade} ${x.unidade}, mínimo ${x.minimo})`).join("; ")}.</p>
        </div>
      )}
      {msg && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{msg}</p>}

      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200">
        {abas.map((a) => (
          <button key={a.chave} onClick={() => { setAba(a.chave); setMsg(""); }}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${aba === a.chave ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-900"}`}>
            {a.label}
          </button>
        ))}
      </div>

      {aba === "produtos" && (
        <>
          <div className="mb-4 flex justify-end">
            <button onClick={() => setNovoProd(!novoProd)} className={`${btn} inline-flex items-center gap-2`}><Plus className="h-4 w-4" /> Novo produto</button>
          </div>

          {novoProd && (
            <form onSubmit={guardarProduto} noValidate className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 font-semibold text-slate-900">Novo produto</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2"><label className="text-sm font-medium text-slate-700">Nome *</label><input className={campo} value={p.nome} onChange={(e) => setP({ ...p, nome: e.target.value })} /></div>
                <div><label className="text-sm font-medium text-slate-700">Categoria *</label>
                  <select className={campo} value={p.categoria} onChange={(e) => setP({ ...p, categoria: e.target.value })}>
                    <option value="">Seleccione</option>
                    {categoriasProduto.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select></div>
                <div><label className="text-sm font-medium text-slate-700">Unidade de medida</label><input className={campo} value={p.unidade} onChange={(e) => setP({ ...p, unidade: e.target.value })} /></div>
                <div><label className="text-sm font-medium text-slate-700">Quantidade inicial</label><input className={campo} inputMode="decimal" value={p.quantidade} onChange={(e) => setP({ ...p, quantidade: e.target.value })} /></div>
                <div><label className="text-sm font-medium text-slate-700">Quantidade mínima</label><input className={campo} inputMode="decimal" value={p.minimo} onChange={(e) => setP({ ...p, minimo: e.target.value })} /></div>
                <div><label className="text-sm font-medium text-slate-700">Fornecedor</label><input className={campo} value={p.fornecedor} onChange={(e) => setP({ ...p, fornecedor: e.target.value })} /></div>
                <div><label className="text-sm font-medium text-slate-700">Custo de aquisição (Kz)</label><input className={campo} inputMode="decimal" value={p.custo} onChange={(e) => setP({ ...p, custo: e.target.value })} /></div>
              </div>
              <div className="mt-4 flex justify-end gap-3"><button type="button" onClick={() => setNovoProd(false)} className={btnSec}>Cancelar</button><button type="submit" className={btn}>Guardar</button></div>
            </form>
          )}

          <form onSubmit={registarMov} noValidate className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-semibold text-slate-900">Registar movimento</h2>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Produto</label>
                <select className={campo} value={mProd} onChange={(e) => setMProd(e.target.value)}>
                  <option value="">Seleccione</option>
                  {st.produtos.filter((x) => x.estado === "Activo").map((x) => <option key={x.id} value={x.id}>{x.nome} ({x.quantidade} {x.unidade})</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Tipo</label>
                <select className={campo} value={mTipo} onChange={(e) => setMTipo(e.target.value as TipoMovimento)}>
                  {tiposMovimento.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">{mTipo === "Ajuste de inventário" ? "Quantidade contada" : "Quantidade"}</label>
                <input className={campo} inputMode="decimal" value={mValor} onChange={(e) => setMValor(e.target.value)} />
                {prodSel && <p className="mt-1 text-xs text-slate-500">Stock actual: {prodSel.quantidade} {prodSel.unidade}</p>}
              </div>
              <div className="sm:col-span-4">
                <label className="text-sm font-medium text-slate-700">Motivo *</label>
                <input className={campo} placeholder="Ex.: Compra na Casa da Química; utilizado no serviço GAL-2026-0004" value={mMotivo} onChange={(e) => setMMotivo(e.target.value)} />
              </div>
            </div>
            <div className="mt-4 flex justify-end"><button type="submit" className={btn}>Registar movimento</button></div>
          </form>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Código</th><th className="px-5 py-3 font-medium">Produto</th>
                    <th className="px-5 py-3 font-medium">Categoria</th><th className="px-5 py-3 font-medium">Disponível</th>
                    <th className="px-5 py-3 font-medium">Mínimo</th><th className="px-5 py-3 font-medium">Custo</th>
                    <th className="px-5 py-3 font-medium">Última entrada</th><th className="px-5 py-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {st.produtos.map((x) => {
                    const baixo = x.estado === "Activo" && x.quantidade <= x.minimo;
                    return (
                      <tr key={x.id} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-5 py-3 font-medium text-slate-900">{x.codigo}</td>
                        <td className="px-5 py-3">{x.nome}{x.fornecedor && <p className="text-xs text-slate-500">{x.fornecedor}</p>}</td>
                        <td className="px-5 py-3">{x.categoria}</td>
                        <td className="whitespace-nowrap px-5 py-3">
                          <span className={baixo ? "font-semibold text-red-700" : ""}>{x.quantidade} {x.unidade}</span>
                          {baixo && <span className="ml-2"><Etiqueta texto="Stock baixo" tom="vermelho" /></span>}
                        </td>
                        <td className="px-5 py-3">{x.minimo}</td>
                        <td className="whitespace-nowrap px-5 py-3">{formatKz(x.custo)}</td>
                        <td className="whitespace-nowrap px-5 py-3">{x.ultimaEntrada ? formatData(x.ultimaEntrada) : "—"}</td>
                        <td className="px-5 py-3">
                          <button onClick={async () => { const r = await st.alternarProduto(x.id); setMsg(r.ok ? "" : r.erro ?? "Erro."); }} title="Alternar estado">
                            <Etiqueta texto={x.estado} tom={x.estado === "Activo" ? "verde" : "cinza"} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {aba === "movimentos" && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Data</th><th className="px-5 py-3 font-medium">Produto</th>
                  <th className="px-5 py-3 font-medium">Tipo</th><th className="px-5 py-3 font-medium">Variação</th>
                  <th className="px-5 py-3 font-medium">Saldo</th><th className="px-5 py-3 font-medium">Responsável</th>
                  <th className="px-5 py-3 font-medium">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...st.movimentos].reverse().map((m) => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap px-5 py-3">{formatData(m.data)}</td>
                    <td className="px-5 py-3">{nomeProd(m.produtoId)}</td>
                    <td className="px-5 py-3">{m.tipo}</td>
                    <td className={`whitespace-nowrap px-5 py-3 font-medium ${m.variacao < 0 ? "text-red-700" : "text-emerald-700"}`}>{m.variacao > 0 ? "+" : ""}{m.variacao}</td>
                    <td className="px-5 py-3">{m.saldoApos}</td>
                    <td className="px-5 py-3">{m.responsavel}</td>
                    <td className="px-5 py-3">{m.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {st.movimentos.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Ainda sem movimentos registados.</p>}
        </div>
      )}

      {aba === "equipamentos" && (
        <>
          <div className="mb-4 flex justify-end">
            <button onClick={() => setNovoEq(!novoEq)} className={`${btn} inline-flex items-center gap-2`}><Plus className="h-4 w-4" /> Novo equipamento</button>
          </div>

          {novoEq && (
            <form onSubmit={guardarEquip} noValidate className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 font-semibold text-slate-900">Novo equipamento</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2"><label className="text-sm font-medium text-slate-700">Nome *</label><input className={campo} value={q.nome} onChange={(e) => setQ({ ...q, nome: e.target.value })} /></div>
                <div><label className="text-sm font-medium text-slate-700">Categoria</label>
                  <select className={campo} value={q.categoria} onChange={(e) => setQ({ ...q, categoria: e.target.value })}>
                    {categoriasEquipamento.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select></div>
                <div><label className="text-sm font-medium text-slate-700">Data de aquisição</label><input type="date" max={hojeISO()} className={campo} value={q.dataAquisicao} onChange={(e) => setQ({ ...q, dataAquisicao: e.target.value })} /></div>
                <div className="sm:col-span-2"><label className="text-sm font-medium text-slate-700">Observações</label><input className={campo} value={q.observacoes} onChange={(e) => setQ({ ...q, observacoes: e.target.value })} /></div>
              </div>
              <div className="mt-4 flex justify-end gap-3"><button type="button" onClick={() => setNovoEq(false)} className={btnSec}>Cancelar</button><button type="submit" className={btn}>Guardar</button></div>
            </form>
          )}

          <div className="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Código</th><th className="px-5 py-3 font-medium">Equipamento</th>
                    <th className="px-5 py-3 font-medium">Estado</th><th className="px-5 py-3 font-medium">Responsável</th>
                    <th className="px-5 py-3 font-medium">Acções</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {st.equipamentos.map((x) => (
                    <tr key={x.id} className={sel === x.id ? "bg-brand-50" : "hover:bg-slate-50"}>
                      <td className="whitespace-nowrap px-5 py-3 font-medium text-slate-900">{x.codigo}</td>
                      <td className="px-5 py-3">
                        <button onClick={() => setSel(sel === x.id ? null : x.id)} className="font-medium text-brand-700 hover:underline">{x.nome}</button>
                        <p className="text-xs text-slate-500">{x.categoria}{x.dataAquisicao ? ` · adquirido em ${formatData(x.dataAquisicao)}` : ""}</p>
                      </td>
                      <td className="px-5 py-3">
                        <select className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs" value={x.estado} onChange={async (e) => { const r = await st.alterarEstadoEquipamento(x.id, e.target.value as EstadoEquipamento); setMsg(r.ok ? "" : r.erro ?? "Erro."); }}>
                          {estadosEquipamento.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <div className="mt-1"><Etiqueta texto={x.estado} tom={tomEquip[x.estado]} /></div>
                      </td>
                      <td className="px-5 py-3">
                        <select className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs" value={x.responsavelId}
                          onChange={async (e) => { const r = await st.atribuirEquipamento(x.id, e.target.value, co.obter(e.target.value)?.nome ?? ""); setMsg(r.ok ? "" : r.erro ?? "Erro."); }}>
                          <option value="">Na empresa</option>
                          {co.colaboradores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">
                        <Link href={`/documentos/ver/termo/${x.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"><FileText className="h-4 w-4" /> Termo de entrega</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {eqSel && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Manutenções · {eqSel.nome}</h2></div>
                {eqSel.manutencoes.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">Sem manutenções registadas.</p> : (
                  <ul className="divide-y divide-slate-100">
                    {[...eqSel.manutencoes].reverse().map((m) => (
                      <li key={m.id} className="flex flex-wrap justify-between gap-2 px-5 py-3 text-sm"><span>{formatData(m.data)} · {m.descricao}</span><span className="font-medium">{formatKz(m.custo)}</span></li>
                    ))}
                  </ul>
                )}
                <form onSubmit={guardarManutencao} noValidate className="space-y-3 border-t border-slate-100 p-5">
                  <p className="text-sm font-medium text-slate-700">Registar manutenção</p>
                  <input className={campo} placeholder="Descrição" value={manDesc} onChange={(e) => setManDesc(e.target.value)} />
                  <input className={campo} inputMode="decimal" placeholder="Custo (Kz)" value={manCusto} onChange={(e) => setManCusto(e.target.value)} />
                  <p className="text-xs text-slate-500">O custo regista-se aqui como histórico do equipamento. Para contar como despesa, registe-o também em Finanças.</p>
                  <button type="submit" className={btn}>Registar</button>
                </form>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Histórico · {eqSel.nome}</h2></div>
                <ul className="divide-y divide-slate-100">
                  {[...eqSel.historico].reverse().map((h) => (
                    <li key={h.id} className="px-5 py-3 text-sm"><p>{h.accao}</p><p className="text-xs text-slate-500">{new Date(h.data).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })} · {h.utilizador}</p></li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}