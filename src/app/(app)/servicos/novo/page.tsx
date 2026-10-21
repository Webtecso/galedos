"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import ServicoForm from "@/components/servicos/ServicoForm";
import { useServicos } from "@/components/servicos/ServicosProvider";

export default function NovoServicoPage() {
  const router = useRouter();
  const { criar } = useServicos();
  const [erro, setErro] = useState("");
  const aGuardar = useRef(false);

  return (
    <>
      <PageHeader title="Nova ordem de serviço" description="O código GAL-AAAA-NNNN é gerado automaticamente pela base de dados." />
      <div className="max-w-4xl">
        {erro && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</p>}
        <ServicoForm
          textoBotao="Criar ordem de serviço"
          cancelarHref="/servicos"
          onSubmit={async (dados) => {
            if (aGuardar.current) return;
            aGuardar.current = true;
            const r = await criar(dados);
            if (r.ok) {
              router.push(r.servico ? `/servicos/${r.servico.id}` : "/servicos");
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