import { Briefcase, FileText, HandCoins, LifeBuoy, Users, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Ícones do lucide-react são componentes React: não dá pra passar por props de
// Server Component pra Client Component (não é serializável). Por isso os
// componentes do shell recebem só `role` (string) e resolvem os links aqui
// localmente, já no lado do client.
export type NavRole = "agency" | "client" | "traveler";

export type NavLink = { href: string; label: string; icon: LucideIcon };

const AGENCY_LINKS: NavLink[] = [
  { href: "/agency", label: "Clientes", icon: Users },
  { href: "/agency/document-types", label: "Tipos de documento", icon: FileText },
  { href: "/agency/expense-categories", label: "Categorias de custo", icon: Wallet },
];

// Menu global do cliente (independe de estar dentro de uma viagem ou não).
// Financeiro e Suporte ainda não têm página própria — ficam aqui só pra
// reservar o lugar; apontam pra uma página "em breve".
const CLIENT_LINKS: NavLink[] = [
  { href: "/", label: "Viagens", icon: Briefcase },
  { href: "/financial", label: "Financeiro", icon: HandCoins },
  { href: "/support", label: "Suporte ao cliente", icon: LifeBuoy },
];

const TRAVELER_LINKS: NavLink[] = [{ href: "/traveler", label: "Minhas viagens", icon: Briefcase }];

export function getNavLinks(role: NavRole): NavLink[] {
  if (role === "agency") return AGENCY_LINKS;
  if (role === "traveler") return TRAVELER_LINKS;
  return CLIENT_LINKS;
}
