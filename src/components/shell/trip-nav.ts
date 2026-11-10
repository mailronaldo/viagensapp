import { LayoutDashboard, MapPin, Briefcase, Hotel, Users, Wallet, FileText, FolderCog } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type SideNavLeaf = { kind: "link"; href: string; label: string; icon: LucideIcon };
type SideNavGroup = {
  kind: "group";
  label: string;
  icon: LucideIcon;
  children: { href: string; label: string; icon: LucideIcon }[];
};
export type SideNavItem = SideNavLeaf | SideNavGroup;

// Sub-navegação de uma viagem (MENU 2): fica no layout de /trips/[id] e é
// contextual — só aparece quando se está dentro de uma viagem. "Gestores"
// agrupa dados de apoio da viagem (hoje: cidades e documentos); deve crescer
// com outros cadastros no futuro. Fica por último na lista. "Viajantes" é
// usado o bastante (chip, permissão) pra ficar solto em vez de dentro do grupo.
export const TRIP_NAV: SideNavItem[] = [
  { kind: "link", href: "", label: "Dashboard", icon: LayoutDashboard },
  { kind: "link", href: "/itinerary", label: "Roteiro", icon: MapPin },
  { kind: "link", href: "/transports", label: "Transportes", icon: Briefcase },
  { kind: "link", href: "/lodgings", label: "Hospedagens", icon: Hotel },
  { kind: "link", href: "/travelers", label: "Viajantes", icon: Users },
  { kind: "link", href: "/costs", label: "Central de custos", icon: Wallet },
  {
    kind: "group",
    label: "Gestores",
    icon: FolderCog,
    children: [
      { href: "/cities", label: "Cidades", icon: MapPin },
      { href: "/documents", label: "Documentos", icon: FileText },
    ],
  },
];

// Versão simples (sem agrupamento) usada na faixa de tabs do mobile.
export const TRIP_LINKS_FLAT: { href: string; label: string; icon: LucideIcon }[] = TRIP_NAV.flatMap((item) =>
  item.kind === "link" ? [{ href: item.href, label: item.label, icon: item.icon }] : item.children,
);
