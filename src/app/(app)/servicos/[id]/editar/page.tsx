"use client";

import { use, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import ServicoForm from "@/components/servicos/ServicoForm";
import { useServicos } from "@/components/servicos/ServicosProvider";

export default function EditarServicoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { obterServico, actualizar, carregado } = useServicos();
  const [erro, setErro] = useState("");
  const aGuardar = useRef(false);
  const servico = obterServico(id);

  if (!carregado) return <p className="text-sm text-slate-500">A carregar...</p>;

  if (!servico) {
    return (
      <>
        <PageHeader title="Serviço não encontrado" />
        <Link href="/servicos" className="text-sm font-medium text-brand-700 hover:underline">Voltar aos serviços</Link>
      </>
    );
  }

  if (servico.estadoOperacional === "Concluído" || servico.estadoOperacional === "Cancelado") {
    return (
      <>
        <PageHeader title={`${servico.codigo} não pode ser editado`} description={`Serviços "${servico.estadoOperacional}" ficam bloqueados (também na base de dados) para preservar o histórico. Correcções serão feitas por ajuste autorizado.`} />
        <Link href={`/servicos/${servico.id}`} className="text-sm font-medium text-brand-700 hover:underline">Voltar ao serviço</Link>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Editar ordem de serviço" description={`${servico.codigo} · alterações de preço, horário e equipa ficam registadas no histórico.`} />
      <div className="max-w-4xl">
        {erro && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</p>}
        <ServicoForm
          inicial={servico}
          textoBotao="Guardar alterações"
          cancelarHref={`/servicos/${servico.id}`}
          onSubmit={async (dados) => {
            if (aGuardar.current) return;
            aGuardar.current = true;
            const r = await actualizar(servico.id, dados);
            if (r.ok) {
              router.push(`/servicos/${servico.id}`);
            } else {
              aGuardar.current = false;
              setErro(r.erro ?? "Erro.");
              window.scrollTo({ top: 0 });
            }
          }}
        />
      </div>
    </>
  );
}