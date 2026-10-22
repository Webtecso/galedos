"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, Search, X } from "lucide-react";
import { navItems } from "@/lib/nav";
import { useAuth, type PerfilUtilizador } from "@/components/auth/AuthProvider";
import Logo from "@/components/ui/Logo";

const itens = navItems.filter((i) => i.href !== "/login");
const rotulos = { administrador: "Administrador", gestao: "Gestão", operacional: "Operacional" } as const;

function permitido(perfil: PerfilUtilizador, href: string, temColab: boolean): boolean {
  if (href === "/hoje" || href === "/meus-ganhos") return temColab;
  if (perfil === "administrador") return true;
  if (perfil === "gestao") return !["/configuracoes", "/remuneracoes", "/financas", "/contas"].includes(href);
  return href === "/presencas";
}

function Brand() {
  return (
    <div className="flex h-16 items-center border-b border-white/10 px-5">
      <Logo altura={48} />
    </div>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { sair, perfil } = useAuth();
  const temColab = !!perfil.colaboradorId;
  const visiveis = itens.filter((i) => permitido(perfil.perfil, i.href, temColab));
  return (
    <>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {visiveis.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-r-lg border-l-2 px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "border-brand-500 bg-white/10 text-brand-200"
                  : "border-transparent text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <button
          onClick={() => sair()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          Sair
        </button>
      </div>
    </>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [termo, setTermo] = useState("");
  const { perfil } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const nome = perfil.nome || perfil.email;
  const operacional = perfil.perfil === "operacional";
  const temColab = !!perfil.colaboradorId;
  const base = "/" + (pathname.split("/")[1] ?? "");
  const bloqueado = !permitido(perfil.perfil, base, temColab);
  const inicio = operacional ? (temColab ? "/hoje" : "/presencas") : "/painel";

  useEffect(() => {
    if (bloqueado) router.replace(inicio);
  }, [bloqueado, inicio, router]);

  function pesquisar(e: React.FormEvent) {
    e.preventDefault();
    const q = termo.trim();
    if (pathname === "/clientes") {
      window.dispatchEvent(new CustomEvent("galedos:pesquisa", { detail: q }));
    } else {
      router.push(`/clientes?q=${encodeURIComponent(q)}`);
    }
  }

  if (bloqueado) {
    return <div className="p-8 text-sm text-slate-500">A redireccionar...</div>;
  }

  return (
    <div className="app-shell min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/5 bg-navy-900 lg:flex">
        <Brand />
        <NavList />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-navy-900 shadow-xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-4 rounded-md p-1 text-slate-300 hover:bg-white/10"
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
            <Brand />
            <NavList onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
        <div className="flex flex-1 items-center gap-2">
          <button
            onClick={() => setOpen(true)}
            className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          {!operacional && (
            <form onSubmit={pesquisar} className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
                placeholder="Pesquisar clientes..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
              />
            </form>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-sm font-medium text-slate-900">{nome}</p>
            <p className="text-xs text-slate-500">{rotulos[perfil.perfil]}</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-br from-brand-200 to-brand-600 text-sm font-semibold text-navy-900">
            {nome.charAt(0).toUpperCase()}
          </div>
        </div>
      </header>

      <main className="p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}