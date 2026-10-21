"use client";

import { use, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import ColaboradorForm from "@/components/colaboradores/ColaboradorForm";
import { useColaboradores } from "@/components/colaboradores/ColaboradoresProvider";

export default function EditarColaboradorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { obter, actualizar, carregado } = useColaboradores();
  const [erro, setErro] = useState("");
  const aGuardar = useRef(false);
  const c = obter(id);

  if (!carregado) return <p className="text-sm text-slate-500">A carregar...</p>;
  if (!c) {
    return (
      <>
        <PageHeader title="Colaborador não encontrado" />
        <Link href="/colaboradores" className="text-sm font-medium text-brand-700 hover:underline">Voltar à lista</Link>
      </>
    );
  }
  return (
    <>
      <PageHeader title="Editar colaborador" description={`${c.codigo} · ${c.nome}`} />
      <div className="max-w-3xl">
        {erro && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</p>}
        <ColaboradorForm
          inicial={c}
          textoBotao="Guardar alterações"
          cancelarHref={`/colaboradores/${c.id}`}
          onSubmit={async (dados) => {
            if (aGuardar.current) return;
            aGuardar.current = true;
            const r = await actualizar(c.id, dados);
            if (r.ok) {
              router.push(`/colaboradores/${c.id}`);
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