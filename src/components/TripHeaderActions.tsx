"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { btnOutline, btnPrimary } from "@/components/ui";

/**
 * Na tela de editar atividade, o roteiro completo fica "escondido" atrás do
 * breadcrumb — troca o "Editar viagem" por um atalho de volta pra lá. O
 * atalho de volta pro dia específico mora junto do X de excluir, dentro da
 * própria tela de edição (padrão igual ao de transporte/hospedagem).
 *
 * Na central de custos, o atalho é pro novo lançamento (custo avulso); na
 * tela de novo lançamento, o atalho volta pra central de custos.
 */
export function TripHeaderActions({ tripId, canEditTrip }: { tripId: string; canEditTrip: boolean }) {
  const pathname = usePathname();
  const isItemEdit = pathname?.startsWith(`/trips/${tripId}/itinerary/items/`);
  const isCostCenter = pathname === `/trips/${tripId}/costs`;
  const isNewExpense = pathname === `/trips/${tripId}/expenses`;

  if (isItemEdit) {
    return (
      <Link href={`/trips/${tripId}/itinerary`} className={btnOutline}>
        Roteiro completo
      </Link>
    );
  }
  if (isCostCenter) {
    return (
      <Link href={`/trips/${tripId}/expenses`} className={btnPrimary}>
        Novo lançamento
      </Link>
    );
  }
  if (isNewExpense) {
    return (
      <Link href={`/trips/${tripId}/costs`} className={btnOutline}>
        Central de custos
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
