import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { listItemTips } from "@/services/tips";
import { googleMapsDirectionsUrl } from "@/lib/maps";

export type ActivityRouteUrls = {
  /** Sem origem — o Maps usa a localização atual de quem abrir o link. */
  liveUrl: string;
  /** Com origem explícita (atividade anterior, ou a própria atividade quando é um roteiro de várias paradas sem atividade anterior) — não depende do GPS no momento de abrir. */
  mapUrl: string | null;
  mapLabel: string | null;
};

/** Ponto de uma atividade: local/endereço/bairro/cidade — mesmo critério já usado em `googleMapsSearchUrl` pelas dicas. */
async function activityPlace(itemId: string) {
  const [row] = await db
    .select({
      location: t.itineraryItems.location,
      address: t.itineraryItems.address,
      neighborhoodName: t.cityNeighborhoods.name,
      cityName: t.cities.name,
    })
    .from(t.itineraryItems)
    .leftJoin(t.cityNeighborhoods, eq(t.cityNeighborhoods.id, t.itineraryItems.neighborhoodId))
    .leftJoin(t.cities, eq(t.cities.id, t.itineraryItems.cityId))
    .where(eq(t.itineraryItems.id, itemId))
    .limit(1);
  return row ?? null;
}

/**
 * Monta os links de rota de uma atividade do roteiro (mesma lógica da tool
 * `get_route` do bot) — usada tanto pelo bot quanto pelos botões da tela de
 * edição da atividade.
 */
export async function getActivityRouteUrls(tripId: string, itemId: string): Promise<ActivityRouteUrls | null> {
  const [item] = await db
    .select({ type: t.itineraryItems.type, startTime: t.itineraryItems.startTime, date: t.itineraryItems.date })
    .from(t.itineraryItems)
    .where(and(eq(t.itineraryItems.id, itemId), eq(t.itineraryItems.tripId, tripId)))
    .limit(1);
  if (!item) return null;

  const place = await activityPlace(itemId);
  const tips = await listItemTips(itemId);
  const waypoints = tips.length >= 2 ? tips.map((tp) => [tp.name, tp.neighborhoodName, tp.cityName]) : undefined;

  let destination = place ? [place.location, place.address, place.neighborhoodName, place.cityName].filter(Boolean).join(", ") : "";
  if (!destination && tips.length > 0) {
    const last = tips[tips.length - 1];
    destination = [last.name, last.neighborhoodName, last.cityName].filter(Boolean).join(", ");
  }
  if (!destination) return null;

  const sameDay = await db
    .select({
      id: t.itineraryItems.id,
      startTime: t.itineraryItems.startTime,
      location: t.itineraryItems.location,
      address: t.itineraryItems.address,
      neighborhoodName: t.cityNeighborhoods.name,
      cityName: t.cities.name,
    })
    .from(t.itineraryItems)
    .leftJoin(t.cityNeighborhoods, eq(t.cityNeighborhoods.id, t.itineraryItems.neighborhoodId))
    .leftJoin(t.cities, eq(t.cities.id, t.itineraryItems.cityId))
    .where(and(eq(t.itineraryItems.tripId, tripId), eq(t.itineraryItems.date, item.date)))
    .orderBy(asc(t.itineraryItems.startTime));
  const previous = item.startTime ? sameDay.filter((i) => i.id !== itemId && i.startTime && i.startTime < item.startTime!).pop() : undefined;

  const travelmode = item.type === "WALK" ? ("walking" as const) : undefined;
  let origin = previous ? [previous.location, previous.address, previous.neighborhoodName, previous.cityName].filter(Boolean).join(", ") : "";
  // Sem atividade anterior, uma rota com várias paradas ainda precisa de uma origem explícita
  // (senão o link depende do GPS do celular no momento de abrir, e não carrega se o viajante
  // ainda não estiver lá) — usa o próprio local da atividade como ponto de partida e chegada.
  const isLoop = !origin && !!waypoints;
  if (isLoop) origin = destination;

  const liveUrl = googleMapsDirectionsUrl({ destination, waypoints, travelmode });
  let mapUrl: string | null = null;
  let mapLabel: string | null = null;
  if (origin) {
    mapUrl = googleMapsDirectionsUrl({ origin, destination, waypoints, travelmode });
    mapLabel = previous ? "A partir da atividade anterior" : "Roteiro com as paradas (não depende da sua localização)";
  }

  return { liveUrl, mapUrl, mapLabel };
}
