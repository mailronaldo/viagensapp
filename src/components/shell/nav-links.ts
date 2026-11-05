import { Briefcase, FolderCog, MapPin, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Ícones do lucide-react são componentes React: não dá pra passar por props de
// Server Component pra Client Component (não é serializável). Por isso os
// componentes do shell recebem só `role` (string) e resolvem os links aqui
// localmente, já no lado do client.
export type NavRole = "agency" | "client" | "traveler";

export type NavLink = { href: string; label: string; icon: LucideIcon };
type NavLeaf = { kind: "link" } & NavLink;
type NavGroup = { kind: "group"; label: string; icon: LucideIcon; children: NavLink[] };
export type NavItem = NavLeaf | NavGroup;

const AGENCY_LINKS: NavItem[] = [{ kind: "link", href: "/agency", label: "Clientes", icon: Users }];

const CLIENT_LINKS: NavItem[] = [
  { kind: "link", href: "/", label: "Viagens", icon: Briefcase },
  {
    kind: "group",
    label: "Gestores",
    icon: FolderCog,
    children: [
      { href: "/cities", label: "Cidades", icon: MapPin },
      { href: "/travelers", label: "Viajantes", icon: Users },
    ],
  },
];

const TRAVELER_LINKS: NavItem[] = [{ kind: "link", href: "/traveler", label: "Minhas viagens", icon: Briefcase }];

export function getNavItems(role: NavRole): NavItem[] {
  if (role === "agency") return AGENCY_LINKS;
  if (role === "traveler") return TRAVELER_LINKS;
  return CLIENT_LINKS;
}

/** Versão achatada (sem agrupamento), usada no menu mobile. */
export function getNavLinksFlat(role: NavRole): NavLink[] {
  return getNavItems(role).flatMap((item) => (item.kind === "link" ? [item] : item.children));
}
