"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireClient } from "@/lib/auth";
import { requireTripAccess } from "@/lib/access";
import { CURRENCIES, TIMEZONES } from "@/lib/labels";
import { ISO_DATE, fail, str } from "@/lib/form";
import { removeDocument } from "@/services/documents";

export async function createTripAction(formData: FormData) {
  // Só clientes têm viagens; a agência cria viagens "como" um cliente (área do cliente).
  const user = await requireClient();
  const back = "/trips/new";

  const title = str(formData, "title");
  const destination = str(formData, "destination");
  const startDate = str(formData, "startDate");
  const endDate = str(formData, "endDate");
  const timezone = str(formData, "timezone") ?? "America/Sao_Paulo";
  const baseCurrency = str(formData, "baseCurrency") ?? "BRL";
  const notes = str(formData, "notes");

  if (!title) fail(back, "Informe um nome para a viagem.");
  if (!destination) fail(back, "Informe o destino.");
  if (!startDate || !ISO_DATE.test(startDate)) fail(back, "Data de ida inválida.");
  if (!endDate || !ISO_DATE.test(endDate)) fail(back, "Data de volta inválida.");
  if (endDate < startDate) fail(back, "A volta não pode ser antes da ida.");
  if (!(TIMEZONES as readonly string[]).includes(timezone)) fail(back, "Fuso horário inválido.");
  if (!(CURRENCIES as readonly string[]).includes(baseCurrency)) fail(back, "Moeda inválida.");

  const tripId = await db.transaction(async (tx) => {
    const [trip] = await tx
      .insert(t.trips)
      .values({
        ownerId: user.id,
        title,
        destination,
        startDate,
        endDate,
        timezone,
        baseCurrency,
        notes,
      })
      .returning({ id: t.trips.id });
    await tx
      .insert(t.tripMembers)
      .values({ tripId: trip.id, userId: user.id, role: "OWNER" });
    return trip.id;
  });

  redirect(`/trips/${tripId}`);
}

export async function deleteTripAction(tripId: string) {
  const { role, trip } = await requireTripAccess(tripId);
  if (role !== "OWNER") throw new Error("Só o dono da viagem pode excluí-la.");
  // Os arquivos em disco são removidos antes; o banco apaga o resto em cascata.
  const docs = await db
    .select({ id: t.documents.id })
    .from(t.documents)
    .where(eq(t.documents.tripId, trip.id));
  for (const d of docs) await removeDocument(trip.id, d.id);
  await db.delete(t.trips).where(eq(t.trips.id, trip.id));
  redirect("/");
}

// ---------- Cidades ----------

export async function addCityAction(tripId: string, formData: FormData) {
  await requireTripAccess(tripId, { write: true });
  const back = `/trips/${tripId}/itinerary`;
  const name = str(formData, "name");
  if (!name) fail(back, "Informe o nome da cidade.");
  const arrival = str(formData, "arrival");
  const departure = str(formData, "departure");
  if (arrival && !ISO_DATE.test(arrival)) fail(back, "Data de chegada inválida.");
  if (departure && !ISO_DATE.test(departure)) fail(back, "Data de saída inválida.");

  const existing = await db
    .select({ id: t.cities.id })
    .from(t.cities)
    .where(eq(t.cities.tripId, tripId));

  await db.insert(t.cities).values({
    tripId,
    name,
    country: str(formData, "country"),
    arrival,
    departure,
    position: existing.length,
  });
  redirect(back);
}

export async function deleteCityAction(tripId: string, cityId: string) {
  await requireTripAccess(tripId, { write: true });
  await db
    .delete(t.cities)
    .where(and(eq(t.cities.id, cityId), eq(t.cities.tripId, tripId)));
  redirect(`/trips/${tripId}/itinerary`);
}
