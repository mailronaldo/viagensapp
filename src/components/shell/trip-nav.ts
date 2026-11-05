import { LayoutDashboard, MapPin, Briefcase, Hotel, Users, Wallet, FileText, FolderCog } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type TripNavLeaf = { kind: "link"; href: string; label: string; icon: LucideIcon };
type TripNavGroup = {
  kind: "group";
  label: string;
  icon: LucideIcon;
  children: { href: string; label: string; icon: LucideIcon }[];
};
export type TripNavItem = TripNavLeaf | TripNavGroup;

// Sub-navegação de uma viagem (MENU 2): fica no layout de /trips/[id] e é
// contextual — só aparece quando se está dentro de uma viagem. "Cadastros"
// agrupa dados de apoio da viagem (hoje: cidades e o grupo de viajantes);
// deve crescer com outros cadastros no futuro.
export const TRIP_NAV: TripNavItem[] = [
  { kind: "link", href: "", label: "Dashboard", icon: LayoutDashboard },
  { kind: "link", href: "/itinerary", label: "Roteiro", icon: MapPin },
  {
    kind: "group",
    label: "Cadastros",
    icon: FolderCog,
    children: [
      { href: "/cities", label: "Cidades", icon: MapPin },
      { href: "/travelers", label: "Viajantes", icon: Users },
    ],
  },
  { kind: "link", href: "/transports", label: "Transportes", icon: Briefcase },
  { kind: "link", href: "/lodgings", label: "Hospedagens", icon: Hotel },
  { kind: "link", href: "/expenses", label: "Custos", icon: Wallet },
  { kind: "link", href: "/documents", label: "Documentos", icon: FileText },
];

// Versão simples (sem agrupamento) usada na faixa de tabs do mobile.
export const TRIP_LINKS_FLAT: { href: string; label: string; icon: LucideIcon }[] = TRIP_NAV.flatMap((item) =>
  item.kind === "link" ? [{ href: item.href, label: item.label, icon: item.icon }] : item.children,
);
