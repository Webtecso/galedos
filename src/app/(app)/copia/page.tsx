"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import { getSupabase } from "@/lib/supabase/client";

const tabelas = [
  "perfis", "empresa", "clientes", "colaboradores", "catalogo_servicos", "servicos", "servico_colaboradores",
  "servico_historico", "recebimentos", "categorias_despesa", "despesas", "config_remuneracao",
  "periodos_remuneracao", "quotas_servico", "remuneracoes", "pagamentos_colaboradores", "config_presenca",
  "presencas", "pausas_presenca", "execucoes_servico", "fotos_servico", "checklist_itens", "execucao_checklist",
  "confirmacoes_cliente", "pedidos_colaborador", "feriados", "ausencias", "avisos", "avisos_lidos", "produtos",
  "movimentos_stock", "equipamentos", "manutencoes_equipamento", "equipamento_historico", "ocorrencias",
  "ocorrencia_historico", "documentos_emitidos", "orcamentos", "auditoria",
];

const PAGINA = 1000;
const MAXIMO = 50000;

async function lerTabela(nome: string): Promise<{ linhas: unknown[]; erro?: string }> {
  const sb = getSupabase();
  const todas: unknown[] = [];
  let ordenar = true;
  for (let de = 0; de < MAXIMO; de += PAGINA) {
    let q = sb.from(nome).select("*").range(de, de + PAGINA - 1);
    if (ordenar) q = q.order("id", { ascending: true });
    let r = await q;
    if (r.error && ordenar) {
      ordenar = false;
      r = await sb.from(nome).select("*").range(de, de + PAGINA - 1);
    }
    if (r.error) return { linhas: todas, erro: r.error.message };
    const lote = (r.data ?? []) as unknown[];
    todas.push(...lote);
    if (lote.length < PAGINA) break;
  }
  return { linhas: todas };
}

export default function CopiaPage() {
  const { perfil } = useAuth();
  const [a, setA] = useState(false);
  const [passo, setPasso] = useState("");
  const [resumo, setResumo] = useState<{ nome: string; n: number }[]>([]);
  const [falhas, setFalhas] = useState<string[]>([]);
  const [feito, setFeito] = useState("");

  async function descarregar() {
    if (a) return;
    setA(true);
    setResumo([]);
    setFalhas([]);
    setFeito("");
    const dados: Record<string, unknown[]> = {};
    const lista: { nome: string; n: number }[] = [];
    const fl: string[] = [];
    try {
      for (const t of tabelas) {
        setPasso(`A ler ${t}...`);
        const r = await lerTabela(t);
        if (r.erro) fl.push(`${t}: ${r.erro}`);
        dados[t] = r.linhas;
        lista.push({ nome: t, n: r.linhas.length });
      }
      const agora = new Date();
      const corpo = JSON.stringify({ aplicacao: "Galedos Gestão", gerado_em: agora.toISOString(), versao: 1, tabelas: dados, falhas: fl });
      const blob = new Blob([corpo], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const el = document.createElement("a");
      const nome = `galedos-copia-${agora.toISOString().slice(0, 10)}.json`;
      el.href = url;
      el.download = nome;
      document.body.appendChild(el);
      el.click();
      document.body.removeChild(el);
      URL.revokeObjectURL(url);
      setResumo(lista);
      setFalhas(fl);
      setFeito(nome);
    } finally {
      setPasso("");
      setA(false);
    }
  }

  if (perfil.perfil !== "administrador") return <p className="text-sm text-slate-500">Sem permissão.</p>;

  return (
    <>
      <PageHeader title="Cópia de segurança" description="Descarrega todos os dados da aplicação num ficheiro, para guardar fora do Supabase." />

      <div className="mb-6 max-w-2xl rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
        <p>O ficheiro tem os dados de clientes, serviços, presenças, remunerações, pagamentos e contas. <strong>Contém dados pessoais e financeiros:</strong> guarde-o num sítio seguro (um disco ou serviço só seu) e não o envie por mensagem.</p>
        <p className="mt-2">Não inclui as fotografias (ficam no armazenamento do Supabase) nem as palavras-passe. Recomenda-se uma cópia por semana.</p>
        <button onClick={descarregar} disabled={a} className="mt-4 inline-flex h-12 items-center gap-2 rounded-xl bg-brand-600 px-5 text-base font-semibold text-white hover:bg-brand-700 disabled:bg-slate-300">
          <Download className="h-5 w-5" /> {a ? passo || "A preparar..." : "Descarregar cópia"}
        </button>
      </div>

      {feito && (
        <div className="max-w-2xl rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
          <p className="font-semibold">Cópia descarregada: {feito}</p>
          <ul className="mt-2 grid gap-x-6 sm:grid-cols-2">
            {resumo.map((r) => <li key={r.nome}>{r.nome}: {r.n}</li>)}
          </ul>
          {falhas.length > 0 && (
            <div className="mt-3 rounded-lg bg-amber-50 p-3 text-amber-900">
              <p className="font-medium">Algumas tabelas não foram lidas:</p>
              <ul className="list-disc pl-5">{falhas.map((f) => <li key={f}>{f}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </>
  );
}