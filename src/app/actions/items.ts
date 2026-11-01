"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { ITEM_TYPE_LABEL } from "@/lib/labels";
import { HH_MM, ISO_DATE, fail, file, parseDecimal, str } from "@/lib/form";
import { addDocument } from "@/services/documents";

export async function addItemAction(tripId: string, formData: FormData) {
  const { trip } = await requireTripAccess(tripId, { write: true });
  const back = `/trips/${tripId}/itinerary`;

  const date = str(formData, "date");
  const title = str(formData, "title");
  const startTime = str(formData, "startTime");
  const endTime = str(formData, "endTime");
  const type = str(formData, "type") ?? "ATTRACTION";
  const cityId = str(formData, "cityId");

  if (!title) fail(back, "Informe o título da atividade.");
  if (!date || !ISO_DATE.test(date)) fail(back, "Data inválida.");
  if (date < trip.startDate || date > trip.endDate) {
    fail(back, "A data precisa estar dentro do período da viagem.");
  }
  if (startTime && !HH_MM.test(startTime)) fail(back, "Horário de início inválido.");
  if (endTime && !HH_MM.test(endTime)) fail(back, "Horário de término inválido.");
  if (!(type in ITEM_TYPE_LABEL)) fail(back, "Tipo inválido.");

  if (cityId) {
    const [city] = await db
      .select({ id: t.cities.id })
      .from(t.cities)
      .where(and(eq(t.cities.id, cityId), eq(t.cities.tripId, tripId)))
      .limit(1);
    if (!city) fail(back, "Cidade inválida.");
  }

  const costRaw = str(formData, "costEstimate");
  const costEstimate = parseDecimal(costRaw);
  if (costRaw && costEstimate === null) fail(back, "Valor estimado inválido.");

  let ticketDocumentId: string | null = null;
  const ticket = file(formData, "ticket");
  if (ticket) {
    try {
      const doc = await addDocument(tripId, ticket, {
        type: "TICKET",
        title: `Ingresso — ${title}`,
      });
      ticketDocumentId = doc.id;
    } catch (e) {
      fail(back, e instanceof Error ? e.message : "Falha no upload do ingresso.");
    }
  }

  await db.insert(t.itineraryItems).values({
    tripId,
    cityId,
    date,
    startTime,
    endTime,
    type: type as keyof typeof ITEM_TYPE_LABEL,
    title,
    location: str(formData, "location"),
    address: str(formData, "address"),
    notes: str(formData, "notes"),
    costEstimate,
    ticketDocumentId,
  });

  redirect(`${back}?day=${date}`);
}

export async function deleteItemAction(tripId: string, itemId: string, day: string) {
  await requireTripAccess(tripId, { write: true });
  await db
    .delete(t.itineraryItems)
    .where(and(eq(t.itineraryItems.id, itemId), eq(t.itineraryItems.tripId, tripId)));
  redirect(`/trips/${tripId}/itinerary?day=${encodeURIComponent(day)}`);
}
