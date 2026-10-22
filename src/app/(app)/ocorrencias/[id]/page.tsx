"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Etiqueta, { type Tom } from "@/components/ui/Etiqueta";
import { useOcorrencias } from "@/components/ocorrencias/OcorrenciasProvider";
import { useServicos } from "@/components/servicos/ServicosProvider";
import { transicoesOcorrencia, type EstadoOcorrencia } from "@/lib/operacao";
import { formatData } from "@/lib/format";

const tom: Record<EstadoOcorrencia, Tom> = {
  Aberta: "vermelho", "Em análise": "ambar", "Em resolução": "azul", Resolvida: "verde", Encerrada: "cinza",
};

const campo =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export default function DetalheOcorrenciaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { obter, mudarEstado, adicionarMedida, carregado } = useOcorrencias();
  const { servicos } = useServicos();
  const [erro, setErro] = useState("");
  const [medida, setMedida] = useState("");

  if (!carregado) return <p className="text-sm text-slate-500">A carregar...</p>;
  const o = obter(id);
  if (!o) {
    return (
      <>
        <PageHeader title="Ocorrência não encontrada" />
        <Link href="/ocorrencias" className="text-sm font-medium text-brand-700 hover:underline">Voltar às ocorrências</Link>
      </>
    );
  }

  const servico = servicos.find((s) => s.id === o.servicoId);

  async function mudar(novo: EstadoOcorrencia) {
    const r = await mudarEstado(o!.id, novo);
    setErro(r.ok ? "" : r.erro ?? "Erro.");
  }

  async function guardarMedida(e: React.FormEvent) {
    e.preventDefault();
    const r = await adicionarMedida(o!.id, medida);
    if (r.ok) { setMedida(""); setErro(""); } else setErro(r.erro ?? "Erro.");
  }

  return (
    <>
      <Link href="/ocorrencias" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Ocorrências
      </Link>
      <PageHeader title={o.codigo} description={`${o.tipo} · ${formatData(o.data)}`} action={<Etiqueta texto={o.estado} tom={tom[o.estado]} />} />

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-4 font-semibold text-slate-900">Detalhes</h2>
          <dl className="space-y-3 text-sm">
            <div><dt className="text-xs text-slate-500">Descrição</dt><dd>{o.descricao}</dd></div>
            <div><dt className="text-xs text-slate-500">Serviço relacionado</dt><dd>{servico ? <Link href={`/servicos/${servico.id}`} className="font-medium text-brand-700 hover:underline">{servico.codigo}</Link> : "—"}</dd></div>
            <div><dt className="text-xs text-slate-500">Pessoas envolvidas</dt><dd>{o.pessoas || "—"}</dd></div>
            <div><dt className="text-xs text-slate-500">Responsável pelo acompanhamento</dt><dd>{o.responsavel || "—"}</dd></div>
          </dl>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-900">Estado</h2>
          {transicoesOcorrencia[o.estado].length === 0 ? <p className="text-sm text-slate-500">Ocorrência encerrada.</p> : (
            <div className="flex flex-col gap-2">
              {transicoesOcorrencia[o.estado].map((n) => (
                <button key={n} onClick={() => mudar(n)} className="rounded-lg bg-brand-600 px-3 py-2 text-left text-sm font-medium text-white hover:bg-brand-700">Passar a "{n}"</button>
              ))}
            </div>
          )}
          {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}
        </div>
      </div>

      {o.estado !== "Encerrada" && (
        <form onSubmit={guardarMedida} noValidate className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="text-sm font-medium text-slate-700">Registar medida ou decisão</label>
          <textarea className={campo} rows={2} value={medida} onChange={(e) => setMedida(e.target.value)} />
          <div className="mt-3 flex justify-end"><button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Guardar medida</button></div>
        </form>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Histórico de decisões e medidas</h2></div>
        <ul className="divide-y divide-slate-100">
          {[...o.historico].reverse().map((h) => (
            <li key={h.id} className="px-5 py-3 text-sm">
              <p>{h.accao}</p>
              <p className="text-xs text-slate-500">{new Date(h.data).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })} · {h.utilizador}</p>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}