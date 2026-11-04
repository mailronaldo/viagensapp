import { CalendarDays, MapPin, Briefcase, Hotel, Users, Wallet, FileText } from "lucide-react";
import type { NavLink } from "./nav-links";

// Sub-navegação de uma viagem (MENU 2): fica no layout de /trips/[id] e é
// contextual — só aparece quando se está dentro de uma viagem.
export const TRIP_LINKS: (Omit<NavLink, "href"> & { href: string })[] = [
  { href: "", label: "Visão geral", icon: CalendarDays },
  { href: "/itinerary", label: "Roteiro", icon: MapPin },
  { href: "/transports", label: "Transportes", icon: Briefcase },
  { href: "/lodgings", label: "Hospedagens", icon: Hotel },
  { href: "/travelers", label: "Viajantes", icon: Users },
  { href: "/expenses", label: "Custos", icon: Wallet },
  { href: "/documents", label: "Documentos", icon: FileText },
];
