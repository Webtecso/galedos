import {
  LayoutDashboard, Users, Sparkles, CalendarDays, UserCog, Wallet,
  Landmark, Boxes, FileText, BarChart3, AlertTriangle, Settings, LogOut,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { label: string; href: string; icon: LucideIcon };

export const navItems: NavItem[] = [
  { label: "Painel Principal", href: "/painel", icon: LayoutDashboard },
  { label: "Clientes", href: "/clientes", icon: Users },
  { label: "Serviços", href: "/servicos", icon: Sparkles },
  { label: "Agendamento", href: "/agenda", icon: CalendarDays },
  { label: "Colaboradores", href: "/colaboradores", icon: UserCog },
  { label: "Remunerações", href: "/remuneracoes", icon: Wallet },
  { label: "Financeiro", href: "/financas", icon: Landmark },
  { label: "Stock e Equipamentos", href: "/stock", icon: Boxes },
  { label: "Documentos", href: "/documentos", icon: FileText },
  { label: "Relatórios", href: "/relatorios", icon: BarChart3 },
  { label: "Ocorrências", href: "/ocorrencias", icon: AlertTriangle },
  { label: "Configurações", href: "/configuracoes", icon: Settings },
  { label: "Sair", href: "/login", icon: LogOut },
];