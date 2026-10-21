"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import ColaboradorForm from "@/components/colaboradores/ColaboradorForm";
import { useColaboradores } from "@/components/colaboradores/ColaboradoresProvider";

export default function NovoColaboradorPage() {
  const router = useRouter();
  const { adicionar } = useColaboradores();
  const [erro, setErro] = useState("");
  const aGuardar = useRef(false);

  return (
    <>
      <PageHeader title="Novo colaborador" description="Registe um colaborador. O código COL-NNNN é automático. Só a administração pode criar colaboradores." />
      <div className="max-w-3xl">
        {erro && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</p>}
        <ColaboradorForm
          textoBotao="Guardar colaborador"
          cancelarHref="/colaboradores"
          onSubmit={async (dados) => {
            if (aGuardar.current) return;
            aGuardar.current = true;
            const r = await adicionar(dados);
            if (r.ok && r.colaborador) {
              router.push(`/colaboradores/${r.colaborador.id}`);
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