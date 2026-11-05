import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, t } from "@/db";

/** Catálogo de cidades cadastradas pelo cliente (ainda vinculadas ou não a alguma viagem). */
export async function getClientCities(clientId: string) {
  return db.select().from(t.cities).where(eq(t.cities.clientId, clientId)).orderBy(asc(t.cities.name));
}

/** Cidades vinculadas a uma viagem (cadastro do cliente + vínculo), na ordem do roteiro. */
export async function getTripCities(tripId: string) {
  return db
    .select({ id: t.cities.id, name: t.cities.name, country: t.cities.country })
    .from(t.tripCities)
    .innerJoin(t.cities, eq(t.cities.id, t.tripCities.cityId))
    .where(eq(t.tripCities.tripId, tripId))
    .orderBy(asc(t.tripCities.position), asc(t.cities.name));
}

/** Países distintos das cidades vinculadas a uma viagem, na ordem do roteiro. */
export async function getTripCountries(tripId: string): Promise<string[]> {
  const cities = await getTripCities(tripId);
  const seen = new Set<string>();
  const countries: string[] = [];
  for (const c of cities) {
    if (!c.country || seen.has(c.country)) continue;
    seen.add(c.country);
    countries.push(c.country);
  }
  return countries;
}
