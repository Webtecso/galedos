import {
  LayoutDashboard, Users, Sparkles, CalendarDays, UserCog, Wallet,
  Landmark, Boxes, FileText, BarChart3, AlertTriangle, Settings, LogOut,
  ClipboardCheck, Clock, HandCoins, KeyRound, Inbox, UserX, ListChecks,
  Megaphone, Database, User,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { label: string; href: string; icon: LucideIcon };

export const navItems: NavItem[] = [
  { label: "Hoje", href: "/hoje", icon: ClipboardCheck },
  { label: "Painel Principal", href: "/painel", icon: LayoutDashboard },
  { label: "Clientes", href: "/clientes", icon: Users },
  { label: "Serviços", href: "/servicos", icon: Sparkles },
  { label: "Listas de verificação", href: "/servicos/checklists", icon: ListChecks },
  { label: "Agendamento", href: "/agenda", icon: CalendarDays },
  { label: "Colaboradores", href: "/colaboradores", icon: UserCog },
  { label: "Presenças", href: "/presencas", icon: Clock },
  { label: "Ausências", href: "/ausencias", icon: UserX },
  { label: "Meus Ganhos", href: "/meus-ganhos", icon: HandCoins },
  { label: "Pedidos", href: "/pedidos", icon: Inbox },
  { label: "Avisos", href: "/avisos", icon: Megaphone },
  { label: "Remunerações", href: "/remuneracoes", icon: Wallet },
  { label: "Financeiro", href: "/financas", icon: Landmark },
  { label: "Stock e Equipamentos", href: "/stock", icon: Boxes },
  { label: "Documentos", href: "/documentos", icon: FileText },
  { label: "Relatórios", href: "/relatorios", icon: BarChart3 },
  { label: "Ocorrências", href: "/ocorrencias", icon: AlertTriangle },
  { label: "Contas de Acesso", href: "/contas", icon: KeyRound },
  { label: "Cópia de segurança", href: "/copia", icon: Database },
  { label: "Configurações", href: "/configuracoes", icon: Settings },
  { label: "A minha conta", href: "/conta", icon: User },
  { label: "Sair", href: "/login", icon: LogOut },
];