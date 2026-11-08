"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { btnOutline } from "@/components/ui";

/**
 * Na tela de editar atividade, o roteiro completo fica "escondido" atrás do
 * breadcrumb — troca o "Editar viagem" por um atalho de volta pra lá. O
 * atalho de volta pro dia específico mora junto do X de excluir, dentro da
 * própria tela de edição (padrão igual ao de transporte/hospedagem).
 */
export function TripHeaderActions({ tripId, canEditTrip }: { tripId: string; canEditTrip: boolean }) {
  const pathname = usePathname();
  const isItemEdit = pathname?.startsWith(`/trips/${tripId}/itinerary/items/`);

  if (isItemEdit) {
    return (
      <Link href={`/trips/${tripId}/itinerary`} className={btnOutline}>
        Roteiro completo
      </Link>
    );
  }
  if (!canEditTrip) return null;
  return (
    <Link href={`/trips/${tripId}/edit`} className={btnOutline}>
      Editar viagem
    </Link>
  );
}
