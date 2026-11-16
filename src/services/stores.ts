import "server-only";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import { db, t } from "@/db";
import { getTripCities } from "./cities";

export type NewStore = {
  name: string;
  type: "PHYSICAL" | "ONLINE";
  cityId: string | null;
};

export async function addStore(clientId: string, input: NewStore) {
  const [store] = await db
    .insert(t.stores)
    .values({ clientId, ...input })
    .returning();
  return store;
}

/**
 * Lojas que podem ser vinculadas a uma encomenda desta viagem: online
 * (sempre) + físicas cuja cidade está entre as cidades da viagem.
 */
export async function listStoresForTrip(trip: { id: string; ownerId: string }) {
  const cities = await getTripCities(trip.id);
  const cityIds = cities.map((c) => c.id);

  return db
    .select()
    .from(t.stores)
    .where(
      and(
        eq(t.stores.clientId, trip.ownerId),
        cityIds.length > 0
          ? or(eq(t.stores.type, "ONLINE"), and(eq(t.stores.type, "PHYSICAL"), inArray(t.stores.cityId, cityIds)))
          : eq(t.stores.type, "ONLINE"),
      ),
    )
    .orderBy(asc(t.stores.name));
}
