"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getSupabase } from "@/lib/supabase/client";

export default function PedidosPendentes() {
  const { perfil } = useAuth();
  const [n, setN] = useState(0);
  const gestao = perfil.perfil !== "operacional";

  useEffect(() => {
    if (!gestao) return;
    let activo = true;
    (async () => {
      const { count } = await getSupabase()
        .from("pedidos_colaborador")
        .select("id", { count: "exact", head: true })
        .eq("estado", "Pendente");
      if (activo) setN(count ?? 0);
    })();
    return () => {
      activo = false;
    };
  }, [gestao]);

  if (!gestao || n === 0) return null;
  return (
    <Link href="/pedidos" className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900 hover:bg-amber-100">
      <Inbox className="h-5 w-5 shrink-0" />
      Tem {n} pedido{n === 1 ? "" : "s"} de colaboradores por responder.
    </Link>
  );
}