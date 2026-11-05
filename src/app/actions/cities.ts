"use server";

import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { db, t } from "@/db";
import { requireClient } from "@/lib/auth";
import { requireTripAccess } from "@/lib/access";
import { fail, str } from "@/lib/form";
import { countryName, stateName } from "@/lib/geo";

function readCity(formData: FormData) {
  const name = str(formData, "name");
  const countryCode = str(formData, "countryCode");
  if (!countryCode) return { error: "Selecione o país." };
  if (!name) return { error: "Selecione a cidade." };
  const stateCode = str(formData, "stateCode");
  return {
    data: {
      name,
      countryCode,
      country: countryName(countryCode),
      stateCode,
      state: stateName(countryCode, stateCode),
    },
  };
}

/** Só devolve a cidade se ela pertencer ao cliente atual (isolamento entre clientes). */
async function ownCity(clientId: string, cityId: string) {
  const [row] = await db
    .select()
    .from(t.cities)
    .where(and(eq(t.cities.id, cityId), eq(t.cities.clientId, clientId)))
    .limit(1);
  return row ?? null;
}

// ---------- Cadastro do cliente ----------

export async function addCityAction(formData: FormData) {
  const user = await requireClient();
  const r = readCity(formData);
  if (r.error) fail("/cities", r.error);
  await db.insert(t.cities).values({ clientId: user.id, ...r.data! });
  redirect("/cities");
}

export async function deleteCityAction(cityId: string) {
  const user = await requireClient();
  const city = await ownCity(user.id, cityId);
  if (city) await db.delete(t.cities).where(eq(t.cities.id, cityId));
  redirect("/cities");
}

// ---------- Cidades dentro de uma viagem ----------

function citiesTab(tripId: string, error?: string) {
  return `/trips/${tripId}/cities${error ? `?error=${encodeURIComponent(error)}` : ""}`;
}

/** Vincula uma ou várias cidades já cadastradas (campo `cityIds`) à viagem. */
export async function linkCityAction(tripId: string, formData: FormData) {
  const { trip } = await requireTripAccess(tripId, { write: true });
  const ids = [...new Set(formData.getAll("cityIds").map(String).filter(Boolean))];
  const existing = await db
    .select({ id: t.tripCities.id })
    .from(t.tripCities)
    .where(eq(t.tripCities.tripId, tripId));
  let position = existing.length;
  for (const cityId of ids) {
    // A cidade precisa ser do mesmo cliente dono da viagem.
    const city = await ownCity(trip.ownerId, cityId);
    if (city) {
      const [inserted] = await db
        .insert(t.tripCities)
        .values({ tripId, cityId, position })
        .onConflictDoNothing()
        .returning({ id: t.tripCities.id });
      if (inserted) position += 1;
    }
  }
  redirect(citiesTab(tripId));
}

/** Remove a cidade do roteiro desta viagem — só se ela não estiver em uso. */
export async function unlinkCityAction(tripId: string, cityId: string) {
  await requireTripAccess(tripId, { write: true });

  const days = await db.select({ id: t.tripDays.id }).from(t.tripDays).where(eq(t.tripDays.tripId, tripId));
  const [dayCity, item, lodging] = await Promise.all([
    days.length
      ? db
          .select({ id: t.tripDayCities.tripDayId })
          .from(t.tripDayCities)
          .where(and(eq(t.tripDayCities.cityId, cityId), inArray(t.tripDayCities.tripDayId, days.map((d) => d.id))))
          .limit(1)
      : Promise.resolve([]),
    db
      .select({ id: t.itineraryItems.id })
      .from(t.itineraryItems)
      .where(and(eq(t.itineraryItems.tripId, tripId), eq(t.itineraryItems.cityId, cityId)))
      .limit(1),
    db
      .select({ id: t.lodgings.id })
      .from(t.lodgings)
      .where(and(eq(t.lodgings.tripId, tripId), eq(t.lodgings.cityId, cityId)))
      .limit(1),
  ]);

  if (dayCity.length || item.length || lodging.length) {
    const parts: string[] = [];
    if (dayCity.length) parts.push("um resumo de dia");
    if (item.length) parts.push("uma atividade do roteiro");
    if (lodging.length) parts.push("uma hospedagem");
    fail(citiesTab(tripId), `Essa cidade está sendo usada em ${parts.join(" e ")}. Remova essas referências antes de tirá-la da viagem.`);
  }

  await db.delete(t.tripCities).where(and(eq(t.tripCities.tripId, tripId), eq(t.tripCities.cityId, cityId)));
  redirect(citiesTab(tripId));
}

/** Cadastra uma cidade nova (para o cliente dono da viagem) e já a vincula à viagem. */
export async function createAndLinkCityAction(tripId: string, formData: FormData) {
  const { trip } = await requireTripAccess(tripId, { write: true });
  const r = readCity(formData);
  if (r.error) fail(citiesTab(tripId), r.error);
  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(t.cities)
      .values({ clientId: trip.ownerId, ...r.data! })
      .returning({ id: t.cities.id });
    const existing = await tx.select({ id: t.tripCities.id }).from(t.tripCities).where(eq(t.tripCities.tripId, tripId));
    await tx.insert(t.tripCities).values({ tripId, cityId: created.id, position: existing.length });
  });
  redirect(citiesTab(tripId));
}
