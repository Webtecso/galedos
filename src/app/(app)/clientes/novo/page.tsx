"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import ClienteForm from "@/components/clientes/ClienteForm";
import { useClientes } from "@/components/clientes/ClientesProvider";

export default function NovoClientePage() {
  const router = useRouter();
  const { adicionar } = useClientes();
  const [erro, setErro] = useState("");
  const aGuardar = useRef(false);

  return (
    <>
      <PageHeader title="Novo cliente" description="Registe um novo cliente e os seus contactos." />
      <div className="max-w-3xl">
        {erro && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</p>}
        <ClienteForm
          textoBotao="Guardar cliente"
          cancelarHref="/clientes"
          onSubmit={async (dados) => {
            if (aGuardar.current) return;
            aGuardar.current = true;
            const r = await adicionar(dados);
            aGuardar.current = false;
            if (r.ok && r.cliente) router.push(`/clientes/${r.cliente.id}`);
            else setErro(r.erro ?? "Erro.");
          }}
        />
      </div>
    </>
  );
}