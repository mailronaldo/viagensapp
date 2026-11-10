import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
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
  const byTrip = await getCountryCodesByTrip([tripId]);
  return byTrip.get(tripId) ?? [];
}

/** Mesma coisa, pra várias viagens de uma vez (ex.: lista de cards do dashboard). */
export async function getCountryCodesByTrip(tripIds: string[]): Promise<Map<string, string[]>> {
  const byTrip = new Map<string, string[]>();
  if (tripIds.length === 0) return byTrip;

  const rows = await db
    .select({
      tripId: t.tripCities.tripId,
      countryCode: t.cities.countryCode,
      position: t.tripCities.position,
      name: t.cities.name,
    })
    .from(t.tripCities)
    .innerJoin(t.cities, eq(t.cities.id, t.tripCities.cityId))
    .where(inArray(t.tripCities.tripId, tripIds))
    .orderBy(asc(t.tripCities.position), asc(t.cities.name));

  for (const r of rows) {
    if (!r.countryCode) continue;
    const codes = byTrip.get(r.tripId) ?? [];
    if (!codes.includes(r.countryCode)) codes.push(r.countryCode);
    byTrip.set(r.tripId, codes);
  }
  return byTrip;
}

/** Bairros/regiões cadastrados numa cidade. */
export async function listCityNeighborhoods(cityId: string) {
  return db
    .select()
    .from(t.cityNeighborhoods)
    .where(eq(t.cityNeighborhoods.cityId, cityId))
    .orderBy(asc(t.cityNeighborhoods.name));
}

/** Mesma coisa, pra várias cidades de uma vez (ex.: todas as cidades de uma viagem). */
export async function listNeighborhoodsForCities(cityIds: string[]) {
  if (cityIds.length === 0) return [];
  return db
    .select()
    .from(t.cityNeighborhoods)
    .where(inArray(t.cityNeighborhoods.cityId, cityIds))
    .orderBy(asc(t.cityNeighborhoods.name));
}
