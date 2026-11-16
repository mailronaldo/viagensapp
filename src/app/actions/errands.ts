"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { attachmentFromForm } from "@/lib/attachment";
import { fail, files, str } from "@/lib/form";
import { parseErrandEntry } from "@/lib/errands-form";
import { addErrand, addErrandPhoto } from "@/services/errands";
import { isInTripGroup } from "@/services/trip-travelers";

async function requireOwnRequester(clientId: string, requesterId: string, back: string) {
  const [r] = await db
    .select({ id: t.requesters.id })
    .from(t.requesters)
    .where(and(eq(t.requesters.id, requesterId), eq(t.requesters.clientId, clientId)))
    .limit(1);
  if (!r) fail(back, "Solicitante inválido.");
}

async function parseStoreId(clientId: string, formData: FormData, back: string) {
  const storeId = str(formData, "storeId");
  if (!storeId) return null;
  const [s] = await db
    .select({ id: t.stores.id })
    .from(t.stores)
    .where(and(eq(t.stores.id, storeId), eq(t.stores.clientId, clientId)))
    .limit(1);
  if (!s) fail(back, "Loja inválida.");
  return storeId;
}

async function parseErrandBase(trip: { ownerId: string; id: string; ownerIsTraveler: boolean }, formData: FormData, back: string) {
  const travelerRaw = str(formData, "travelerId");
  const requesterId = str(formData, "requesterId");
  const product = str(formData, "product");
  if (!travelerRaw) fail(back, "Selecione o viajante responsável.");
  if (!requesterId) fail(back, "Selecione o solicitante.");
  if (!product) fail(back, "Informe o produto.");

  const travelerId = travelerRaw === "owner" ? null : travelerRaw;
  if (!(await isInTripGroup(trip, travelerId))) fail(back, "Esse viajante não está nesta viagem.");
  await requireOwnRequester(trip.ownerId, requesterId, back);
  const storeId = await parseStoreId(trip.ownerId, formData, back);

  return { travelerId, requesterId, product, storeId, details: str(formData, "details") };
}

export async function addErrandAction(tripId: string, formData: FormData) {
  const { trip } = await requireTripAccess(tripId, { write: true });
  const back = `/trips/${tripId}/errands`;
  const base = await parseErrandBase(trip, formData, back);
  const entry = parseErrandEntry(formData, back);

  const receiptDocumentId = await attachmentFromForm({
    tripId,
    formData,
    fileField: "receipt",
    doc: { type: "RECEIPT", title: `Encomenda — ${base.product}` },
    back,
    current: null,
  });

  const errand = await addErrand(tripId, { ...base, receiptDocumentId, entry });
  for (const photo of files(formData, "photos")) {
    await addErrandPhoto(tripId, errand.id, photo);
  }
  redirect(back);
}

export async function updateErrandAction(tripId: string, errandId: string, formData: FormData) {
  const { trip } = await requireTripAccess(tripId, { write: true });
  const back = `/trips/${tripId}/errands/${errandId}`;

  const [current] = await db
    .select()
    .from(t.errands)
    .where(and(eq(t.errands.id, errandId), eq(t.errands.tripId, tripId)))
    .limit(1);
  if (!current) redirect(`/trips/${tripId}/errands`);

  const base = await parseErrandBase(trip, formData, back);
  const receiptDocumentId = await attachmentFromForm({
    tripId,
    formData,
    fileField: "receipt",
    removeField: "removeReceipt",
    doc: { type: "RECEIPT", title: `Encomenda — ${base.product}` },
    back,
    current: current.receiptDocumentId,
  });

  await db
    .update(t.errands)
    .set({ ...base, receiptDocumentId })
    .where(and(eq(t.errands.id, errandId), eq(t.errands.tripId, tripId)));
  redirect(`/trips/${tripId}/errands`);
}

export async function deleteErrandAction(tripId: string, errandId: string) {
  await requireTripAccess(tripId, { write: true });
  await db.delete(t.errands).where(and(eq(t.errands.id, errandId), eq(t.errands.tripId, tripId)));
  redirect(`/trips/${tripId}/errands`);
}
