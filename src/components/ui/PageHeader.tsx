"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/nav";

export default function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  const pathname = usePathname();
  const base = "/" + (pathname.split("/")[1] ?? "");
  const modulo = navItems.find((i) => i.href === base);

  return (
    <div className="no-print mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        {modulo && (
          <p className="mb-1 text-xs text-slate-500">
            <Link href="/painel" className="hover:underline">Início</Link>
            {" / "}
            {pathname === modulo.href ? modulo.label : <Link href={modulo.href} className="hover:underline">{modulo.label}</Link>}
          </p>
        )}
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}