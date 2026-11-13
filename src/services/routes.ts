import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
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

type DayItem = {
  id: string;
  startTime: string | null;
  location: string | null;
  address: string | null;
  neighborhoodName: string | null;
  cityName: string | null;
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

function placeOf(row: DayItem): string {
  return [row.location, row.address, row.neighborhoodName, row.cityName].filter(Boolean).join(", ");
}

/** Itens do roteiro num dia, na mesma ordem usada na agenda (horário, nulls no fim). */
async function itemsOnDay(tripId: string, date: string): Promise<DayItem[]> {
  return db
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
    .where(and(eq(t.itineraryItems.tripId, tripId), eq(t.itineraryItems.date, date)))
    .orderBy(sql`${t.itineraryItems.startTime} asc nulls last`, asc(t.itineraryItems.title));
}

/**
 * Monta os links de rota de uma atividade do roteiro (mesma lógica da tool
 * `get_route` do bot) — usada tanto pelo bot quanto pelos botões da tela de
 * edição da atividade.
 */
export async function getActivityRouteUrls(tripId: string, itemId: string): Promise<ActivityRouteUrls | null> {
  const [item] = await db
    .select({ type: t.itineraryItems.type, date: t.itineraryItems.date })
    .from(t.itineraryItems)
    .where(and(eq(t.itineraryItems.id, itemId), eq(t.itineraryItems.tripId, tripId)))
    .limit(1);
  if (!item) return null;

  const place = await activityPlace(itemId);
  const tips = await listItemTips(itemId);
  const tipPlace = (tp: (typeof tips)[number]) => [tp.name, tp.neighborhoodName, tp.cityName];

  // Com dicas cadastradas, a rota termina na última delas — não faz sentido
  // "voltar" pro local da atividade depois de visitar os pontos; quem quiser
  // retornar cadastra uma última dica própria pra isso.
  const destinationParts =
    tips.length > 0 ? tipPlace(tips[tips.length - 1]) : [place?.location, place?.address, place?.neighborhoodName, place?.cityName];
  const destinationQuery = destinationParts.filter(Boolean).join(", ");
  if (!destinationQuery) return null;

  // Acha a atividade anterior pela posição no dia (mesma ordem da agenda),
  // não pelo horário desta atividade — senão uma atividade sem horário
  // definido nunca encontrava a anterior.
  const sameDay = await itemsOnDay(tripId, item.date);
  const idx = sameDay.findIndex((i) => i.id === itemId);
  const previous = idx > 0 ? sameDay[idx - 1] : undefined;

  const travelmode = item.type === "WALK" ? ("walking" as const) : undefined;
  // As paradas no meio do caminho: todas as dicas menos a última (que já é o destino).
  const stops = tips.slice(0, -1);

  // Sem GPS, o live usa todas as paradas como waypoints (não tem de onde "começar" a não ser pela primeira delas).
  const liveWaypoints = stops.length > 0 ? stops.map(tipPlace) : undefined;
  const liveUrl = googleMapsDirectionsUrl({ destination: destinationQuery, waypoints: liveWaypoints, travelmode });

  let origin = previous ? placeOf(previous) : "";
  // Sem atividade anterior, a primeira dica vira a origem explícita do mapUrl
  // (em vez de aparecer também como parada) — senão o link ficaria sem ponto
  // de partida (dependendo do GPS) ou criaria uma volta desnecessária.
  let mapStops = stops;
  if (!origin && mapStops.length > 0) {
    origin = tipPlace(mapStops[0]).filter(Boolean).join(", ");
    mapStops = mapStops.slice(1);
  }
  const mapWaypoints = mapStops.length > 0 ? mapStops.map(tipPlace) : undefined;

  let mapUrl: string | null = null;
  let mapLabel: string | null = null;
  if (origin) {
    mapUrl = googleMapsDirectionsUrl({ origin, destination: destinationQuery, waypoints: mapWaypoints, travelmode });
    mapLabel = previous ? "A partir da atividade anterior" : "Roteiro com as paradas (começa na primeira dica)";
  }

  return { liveUrl, mapUrl, mapLabel };
}

/**
 * Mesma ideia, mas pra hospedagem: destino é a própria hospedagem, origem é
 * a última atividade do roteiro antes do check-in (pelo horário de check-in,
 * ou a última do dia quando o horário não foi informado).
 */
export async function getLodgingRouteUrls(tripId: string, lodgingId: string): Promise<ActivityRouteUrls | null> {
  const [lodging] = await db
    .select({
      name: t.lodgings.name,
      address: t.lodgings.address,
      cityName: t.cities.name,
      checkInDate: t.lodgings.checkInDate,
      checkInTime: t.lodgings.checkInTime,
    })
    .from(t.lodgings)
    .leftJoin(t.cities, eq(t.cities.id, t.lodgings.cityId))
    .where(and(eq(t.lodgings.id, lodgingId), eq(t.lodgings.tripId, tripId)))
    .limit(1);
  if (!lodging) return null;

  const destination = [lodging.name, lodging.address, lodging.cityName].filter(Boolean).join(", ");
  if (!destination) return null;

  // A hospedagem não é um item do roteiro com horário comparável (muita
  // atividade do dia fica sem horário definido) — usa direto a última
  // atividade do dia do check-in, na mesma ordem da agenda.
  let origin = "";
  if (lodging.checkInDate) {
    const sameDay = await itemsOnDay(tripId, lodging.checkInDate);
    const previous = sameDay[sameDay.length - 1];
    if (previous) origin = placeOf(previous);
  }

  const liveUrl = googleMapsDirectionsUrl({ destination });
  const mapUrl = origin ? googleMapsDirectionsUrl({ origin, destination }) : null;
  const mapLabel = origin ? "A partir da atividade anterior" : null;
  return { liveUrl, mapUrl, mapLabel };
}
