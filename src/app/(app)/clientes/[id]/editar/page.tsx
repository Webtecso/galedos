"use client";

import { use, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import ClienteForm from "@/components/clientes/ClienteForm";
import { useClientes } from "@/components/clientes/ClientesProvider";

export default function EditarClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { obter, actualizar, carregado } = useClientes();
  const [erro, setErro] = useState("");
  const aGuardar = useRef(false);
  const cliente = obter(id);

  if (!carregado) return <p className="text-sm text-slate-500">A carregar...</p>;

  if (!cliente) {
    return (
      <>
        <PageHeader title="Cliente não encontrado" />
        <Link href="/clientes" className="text-sm font-medium text-brand-700 hover:underline">
          Voltar à lista de clientes
        </Link>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Editar cliente" description={`${cliente.codigo} · ${cliente.nome}`} />
      <div className="max-w-3xl">
        {erro && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</p>}
        <ClienteForm
          inicial={cliente}
          textoBotao="Guardar alterações"
          cancelarHref={`/clientes/${cliente.id}`}
          onSubmit={async (dados) => {
            if (aGuardar.current) return;
            aGuardar.current = true;
            const r = await actualizar(cliente.id, dados);
            aGuardar.current = false;
            if (r.ok) router.push(`/clientes/${cliente.id}`);
            else setErro(r.erro ?? "Erro.");
          }}
        />
      </div>
    </>
  );
}