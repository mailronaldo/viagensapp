import { Briefcase, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Ícones do lucide-react são componentes React: não dá pra passar por props de
// Server Component pra Client Component (não é serializável). Por isso os
// componentes do shell recebem só `role` (string) e resolvem os links aqui
// localmente, já no lado do client.
export type NavRole = "agency" | "client" | "traveler";

export type NavLink = { href: string; label: string; icon: LucideIcon };

const AGENCY_LINKS: NavLink[] = [{ href: "/agency", label: "Clientes", icon: Users }];

const CLIENT_LINKS: NavLink[] = [
  { href: "/", label: "Viagens", icon: Briefcase },
  { href: "/travelers", label: "Viajantes", icon: Users },
];

const TRAVELER_LINKS: NavLink[] = [{ href: "/traveler", label: "Minhas viagens", icon: Briefcase }];

export function getNavLinks(role: NavRole): NavLink[] {
  if (role === "agency") return AGENCY_LINKS;
  if (role === "traveler") return TRAVELER_LINKS;
  return CLIENT_LINKS;
}
