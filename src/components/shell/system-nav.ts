import { Bus, CreditCard, FileText, Hotel, ListChecks, Table2, Wallet } from "lucide-react";
import type { SideNavItem } from "./trip-nav";

// Menu 2 da área "Sistema" da agência: por enquanto só o grupo "Tabelas",
// com os cadastros únicos da agência (valem para todos os clientes/viagens).
export const SYSTEM_NAV: SideNavItem[] = [
  {
    kind: "group",
    label: "Tabelas",
    icon: Table2,
    children: [
      { href: "/document-types", label: "Tipos de documento", icon: FileText },
      { href: "/expense-categories", label: "Categorias de custo", icon: Wallet },
      { href: "/activity-types", label: "Tipos de atividade", icon: ListChecks },
      { href: "/booking-types", label: "Tipos de transporte", icon: Bus },
      { href: "/lodging-types", label: "Tipos de hospedagem", icon: Hotel },
      { href: "/reservation-methods", label: "Métodos de reserva", icon: CreditCard },
    ],
  },
];
