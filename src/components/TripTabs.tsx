"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "", label: "Visão geral" },
  { href: "/itinerary", label: "Roteiro" },
  { href: "/transports", label: "Transportes" },
  { href: "/lodgings", label: "Hospedagens" },
  { href: "/travelers", label: "Viajantes" },
  { href: "/expenses", label: "Custos" },
  { href: "/documents", label: "Documentos" },
];

export function TripTabs({ tripId }: { tripId: string }) {
  const pathname = usePathname();
  const base = `/trips/${tripId}`;
  return (
    <nav className="-mb-6 flex gap-1 overflow-x-auto">
      {TABS.map((tab) => {
        const href = `${base}${tab.href}`;
        const active = tab.href === "" ? pathname === base : pathname.startsWith(href);
        return (
          <Link
            key={tab.label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap border-b-[3px] px-3 py-2 text-sm ${
              active
                ? "border-white font-medium text-white"
                : "border-transparent text-brand-100 hover:text-white"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
