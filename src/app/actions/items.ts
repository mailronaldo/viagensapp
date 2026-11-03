"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { attachmentFromForm } from "@/lib/attachment";
import { ITEM_TYPE_LABEL } from "@/lib/labels";
import { HH_MM, ISO_DATE, fail, parseDecimal, str } from "@/lib/form";

async function parseItem(
  tripId: string,
  trip: { startDate: string; endDate: string },
  formData: FormData,
  back: string,
) {
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
  if (startTime && endTime && endTime < startTime) {
    fail(back, "O término não pode ser antes do início.");
  }
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

  return {
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
  };
}

export async function addItemAction(tripId: string, formData: FormData) {
  const { trip } = await requireTripAccess(tripId, { write: true });
  const back = `/trips/${tripId}/itinerary`;
  const v = await parseItem(tripId, trip, formData, back);

  const ticketDocumentId = await attachmentFromForm({
    tripId,
    formData,
    fileField: "ticket",
    doc: { type: "TICKET", title: `Ingresso — ${v.title}` },
    back,
    current: null,
  });

  await db.insert(t.itineraryItems).values({ tripId, ...v, ticketDocumentId });
  redirect(`${back}?day=${v.date}`);
}

export async function updateItemAction(tripId: string, itemId: string, formData: FormData) {
  const { trip } = await requireTripAccess(tripId, { write: true });
  const back = `/trips/${tripId}/itinerary/items/${itemId}`;

  const [current] = await db
    .select()
    .from(t.itineraryItems)
    .where(and(eq(t.itineraryItems.id, itemId), eq(t.itineraryItems.tripId, tripId)))
    .limit(1);
  if (!current) redirect(`/trips/${tripId}/itinerary`);

  const v = await parseItem(tripId, trip, formData, back);
  const ticketDocumentId = await attachmentFromForm({
    tripId,
    formData,
    fileField: "ticket",
    removeField: "removeTicket",
    doc: { type: "TICKET", title: `Ingresso — ${v.title}` },
    back,
    current: current.ticketDocumentId,
  });

  await db
    .update(t.itineraryItems)
    .set({ ...v, ticketDocumentId })
    .where(and(eq(t.itineraryItems.id, itemId), eq(t.itineraryItems.tripId, tripId)));
  redirect(`/trips/${tripId}/itinerary?day=${v.date}`);
}

export async function deleteItemAction(tripId: string, itemId: string, day: string) {
  await requireTripAccess(tripId, { write: true });
  await db
    .delete(t.itineraryItems)
    .where(and(eq(t.itineraryItems.id, itemId), eq(t.itineraryItems.tripId, tripId)));
  redirect(`/trips/${tripId}/itinerary?day=${encodeURIComponent(day)}`);
}
