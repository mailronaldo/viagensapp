import { Briefcase, Coins, Copy, FolderCog, HandCoins, LifeBuoy, MapPin, Settings2, Users, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Ícones do lucide-react são componentes React: não dá pra passar por props de
// Server Component pra Client Component (não é serializável). Por isso os
// componentes do shell recebem só `role` (string) e resolvem os links aqui
// localmente, já no lado do client.
export type NavRole = "agency" | "client" | "traveler";

export type NavLink = { href: string; label: string; icon: LucideIcon };
export type NavItem =
  | ({ kind: "link" } & NavLink)
  | { kind: "group"; label: string; icon: LucideIcon; children: NavLink[] };

const AGENCY_LINKS: NavItem[] = [
  { kind: "link", href: "/agency", label: "Clientes", icon: Users },
  { kind: "link", href: "/agency/system", label: "Sistema", icon: Settings2 },
];

// Menu global do cliente (independe de estar dentro de uma viagem ou não).
// "Gestores" reúne cadastros do cliente usados em qualquer viagem — hoje
// cidades (precisa de ao menos uma pra criar uma viagem) e viajantes.
// Financeiro e Suporte ainda não têm página própria — ficam aqui só pra
// reservar o lugar; apontam pra uma página "em breve".
const CLIENT_LINKS: NavItem[] = [
  { kind: "link", href: "/", label: "Viagens", icon: Briefcase },
  {
    kind: "group",
    label: "Gestores",
    icon: FolderCog,
    children: [
      { href: "/cities", label: "Cidades", icon: MapPin },
      { href: "/travelers", label: "Viajantes", icon: Users },
      { href: "/currencies", label: "Moedas", icon: Coins },
    ],
  },
  {
    kind: "group",
    label: "Ferramentas",
    icon: Wrench,
    children: [{ href: "/tools/cloner", label: "Clonador", icon: Copy }],
  },
  { kind: "link", href: "/financial", label: "Financeiro", icon: HandCoins },
  { kind: "link", href: "/support", label: "Suporte ao cliente", icon: LifeBuoy },
];

const TRAVELER_LINKS: NavItem[] = [{ kind: "link", href: "/traveler", label: "Minhas viagens", icon: Briefcase }];

export function getNavLinks(role: NavRole): NavItem[] {
  if (role === "agency") return AGENCY_LINKS;
  if (role === "traveler") return TRAVELER_LINKS;
  return CLIENT_LINKS;
}
