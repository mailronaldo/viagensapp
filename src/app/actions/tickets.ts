"use server";

import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { attachmentFromForm } from "@/lib/attachment";
import { fail, parseDecimal, parseStatus, str } from "@/lib/form";
import { isInTripGroup } from "@/services/trip-travelers";
import { listClientCurrencyCodes } from "@/services/currencies";
import { parseOptionalCategory } from "@/services/catalogs";

function itemEditPath(tripId: string, itemId: string) {
  return `/trips/${tripId}/itinerary/items/${itemId}`;
}

async function ownItem(tripId: string, itemId: string) {
  const [row] = await db
    .select({ id: t.itineraryItems.id })
    .from(t.itineraryItems)
    .where(and(eq(t.itineraryItems.id, itemId), eq(t.itineraryItems.tripId, tripId)))
    .limit(1);
  return !!row;
}

export async function addTicketAction(tripId: string, itemId: string, formData: FormData) {
  const { trip } = await requireTripAccess(tripId, { write: true });
  const back = itemEditPath(tripId, itemId);
  if (!(await ownItem(tripId, itemId))) redirect(`/trips/${tripId}/itinerary`);

  const travelerRaw = str(formData, "travelerId");
  const travelerId = travelerRaw === "owner" ? null : travelerRaw;
  if (travelerRaw === null) fail(back, "Selecione o viajante do ingresso.");
  if (!(await isInTripGroup(trip, travelerId))) fail(back, "Esse viajante não está no grupo desta viagem.");

  const [dup] = await db
    .select({ id: t.activityTickets.id })
    .from(t.activityTickets)
    .where(
      and(
        eq(t.activityTickets.itemId, itemId),
        travelerId === null ? isNull(t.activityTickets.travelerId) : eq(t.activityTickets.travelerId, travelerId),
      ),
    )
    .limit(1);
  if (dup) fail(back, "Esse viajante já tem um ingresso cadastrado nesta atividade.");

  const currency = str(formData, "currency");
  if (currency) {
    const validCurrencies = await listClientCurrencyCodes(trip.ownerId);
    if (!validCurrencies.includes(currency)) fail(back, "Moeda inválida.");
  }
  const priceRaw = str(formData, "price");
  const price = parseDecimal(priceRaw, { positive: true });
  if (priceRaw && price === null) fail(back, "Valor do ingresso inválido.");

  const voucherDocumentId = await attachmentFromForm({
    tripId,
    formData,
    fileField: "voucher",
    doc: { type: "TICKET", title: "Ingresso" },
    back,
    current: null,
  });

  try {
    await db.insert(t.activityTickets).values({
      itemId,
      tripId,
      travelerId,
      provider: str(formData, "provider"),
      ticketNumber: str(formData, "ticketNumber"),
      price,
      currency: price ? (currency ?? "BRL") : null,
      status: parseStatus(str(formData, "status")),
      category: await parseOptionalCategory(str(formData, "category")),
      voucherDocumentId,
      details: str(formData, "details"),
    });
  } catch {
    fail(back, "Esse viajante já tem um ingresso cadastrado nesta atividade.");
  }
  redirect(back);
}

export async function deleteTicketAction(tripId: string, itemId: string, ticketId: string) {
  await requireTripAccess(tripId, { write: true });
  await db
    .delete(t.activityTickets)
    .where(and(eq(t.activityTickets.id, ticketId), eq(t.activityTickets.itemId, itemId)));
  redirect(itemEditPath(tripId, itemId));
}
