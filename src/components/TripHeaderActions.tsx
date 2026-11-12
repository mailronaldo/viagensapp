"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapPin, Navigation } from "lucide-react";
import { btnOutline, btnPrimary } from "@/components/ui";
import { getItemRouteLinksAction } from "@/app/actions/items";
import { getLodgingRouteLinksAction } from "@/app/actions/lodgings";

/**
 * Nas telas de editar atividade e editar hospedagem, no lugar do atalho pro
 * roteiro completo (o próprio formulário já tem um botão de voltar pro
 * dia), mostramos os links de rota no Google Maps — é o que o viajante mais
 * usa chegando nelas.
 *
 * Na central de custos, o atalho é pro novo lançamento (custo avulso); na
 * tela de novo lançamento, o atalho volta pra central de custos.
 */
export function TripHeaderActions({ tripId, canEditTrip }: { tripId: string; canEditTrip: boolean }) {
  const pathname = usePathname();
  const itemEditMatch = pathname?.match(new RegExp(`^/trips/${tripId}/itinerary/items/([^/]+)$`));
  const lodgingEditMatch = pathname?.match(new RegExp(`^/trips/${tripId}/lodgings/([^/]+)$`));
  const isCostCenter = pathname === `/trips/${tripId}/costs`;
  const isNewExpense = pathname === `/trips/${tripId}/expenses`;

  if (itemEditMatch) {
    return <RouteActions key={itemEditMatch[1]} fetchLinks={() => getItemRouteLinksAction(tripId, itemEditMatch[1])} />;
  }
  if (lodgingEditMatch) {
    return <RouteActions key={lodgingEditMatch[1]} fetchLinks={() => getLodgingRouteLinksAction(tripId, lodgingEditMatch[1])} />;
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

type RouteLinks = { liveUrl: string; mapUrl: string | null; mapLabel: string | null };

function RouteActions({ fetchLinks }: { fetchLinks: () => Promise<RouteLinks | null> }) {
  const [links, setLinks] = useState<RouteLinks | null>(null);

  useEffect(() => {
    fetchLinks().then(setLinks).catch(() => setLinks(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roda uma vez por montagem (o pai já troca de key quando o item/hospedagem muda)
  }, []);

  if (!links) return null;
  return (
    <>
      <a href={links.liveUrl} target="_blank" rel="noreferrer" className={`${btnOutline} gap-1.5`} title="Rota a partir de onde você estiver agora">
        <Navigation className="size-4" aria-hidden />
        Rota em tempo real
      </a>
      {links.mapUrl && (
        <a href={links.mapUrl} target="_blank" rel="noreferrer" className={`${btnOutline} gap-1.5`} title={links.mapLabel ?? undefined}>
          <MapPin className="size-4" aria-hidden />
          Rota no mapa
        </a>
      )}
    </>
  );
}
