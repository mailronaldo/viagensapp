"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { btnOutline } from "@/components/ui";

/**
 * Na tela de editar atividade, o roteiro completo fica "escondido" atrás do
 * breadcrumb — troca o "Editar viagem" por um atalho de volta pra lá, e,
 * quando sabemos de qual dia viemos (via `?day=`), um atalho direto pra
 * agenda daquele dia.
 */
export function TripHeaderActions({ tripId, canEditTrip }: { tripId: string; canEditTrip: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isItemEdit = pathname?.startsWith(`/trips/${tripId}/itinerary/items/`);

  if (isItemEdit) {
    const day = searchParams.get("day");
    return (
      <div className="flex items-center gap-2">
        {day && (
          <Link href={`/trips/${tripId}/itinerary/day/${day}`} className={btnOutline}>
            Voltar
          </Link>
        )}
        <Link href={`/trips/${tripId}/itinerary`} className={btnOutline}>
          Roteiro completo
        </Link>
      </div>
    );
  }
  if (!canEditTrip) return null;
  return (
    <Link href={`/trips/${tripId}/edit`} className={btnOutline}>
      Editar viagem
    </Link>
  );
}
