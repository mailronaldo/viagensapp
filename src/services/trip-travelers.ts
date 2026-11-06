import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db, t } from "@/db";

export type TripTravelerOption = { id: string | null; name: string };

/**
 * Grupo da viagem pra selects (ingressos, passes): o dono quando ele também
 * viaja (`travelerId` nulo, mesma convenção de `chips`) + os viajantes
 * vinculados, na ordem alfabética.
 */
export async function listTripTravelerOptions(trip: {
  id: string;
  ownerId: string;
  ownerIsTraveler: boolean;
}): Promise<TripTravelerOption[]> {
  const [linked, [owner]] = await Promise.all([
    db
      .select({ id: t.travelers.id, name: t.travelers.name })
      .from(t.tripTravelers)
      .innerJoin(t.travelers, eq(t.travelers.id, t.tripTravelers.travelerId))
      .where(eq(t.tripTravelers.tripId, trip.id))
      .orderBy(asc(t.travelers.name)),
    trip.ownerIsTraveler
      ? db.select({ name: t.users.name }).from(t.users).where(eq(t.users.id, trip.ownerId)).limit(1)
      : Promise.resolve([null]),
  ]);
  const options: TripTravelerOption[] = linked.map((l) => ({ id: l.id, name: l.name }));
  if (owner) options.unshift({ id: null, name: `${owner.name} (dono da viagem)` });
  return options;
}

/** Confirma que `travelerId` (ou `null` = dono) está no grupo desta viagem. */
export async function isInTripGroup(
  trip: { id: string; ownerId: string; ownerIsTraveler: boolean },
  travelerId: string | null,
): Promise<boolean> {
  if (travelerId === null) return trip.ownerIsTraveler;
  const [row] = await db
    .select({ id: t.tripTravelers.id })
    .from(t.tripTravelers)
    .where(and(eq(t.tripTravelers.tripId, trip.id), eq(t.tripTravelers.travelerId, travelerId)))
    .limit(1);
  return !!row;
}
