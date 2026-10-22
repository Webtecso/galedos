"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import AdminPresencas from "@/components/presencas/AdminPresencas";
import MinhasPresencas from "@/components/presencas/MinhasPresencas";

export default function PresencasPage() {
  const { perfil } = useAuth();
  if (perfil.perfil === "operacional") return <MinhasPresencas />;
  return <AdminPresencas />;
}