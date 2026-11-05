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
    .select({
      id: t.cities.id,
      name: t.cities.name,
      country: t.cities.country,
      countryCode: t.cities.countryCode,
    })
    .from(t.tripCities)
    .innerJoin(t.cities, eq(t.cities.id, t.tripCities.cityId))
    .where(eq(t.tripCities.tripId, tripId))
    .orderBy(asc(t.tripCities.position), asc(t.cities.name));
}

/** Códigos (ISO 3166-1 alpha-2) dos países das cidades vinculadas a uma viagem, na ordem do roteiro. */
export async function getTripCountryCodes(tripId: string): Promise<string[]> {
  const cities = await getTripCities(tripId);
  const seen = new Set<string>();
  const codes: string[] = [];
  for (const c of cities) {
    if (!c.countryCode || seen.has(c.countryCode)) continue;
    seen.add(c.countryCode);
    codes.push(c.countryCode);
  }
  return codes;
}
