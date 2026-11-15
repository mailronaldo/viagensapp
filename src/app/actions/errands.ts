"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { attachmentFromForm } from "@/lib/attachment";
import { fail, parseDecimal, parseEnum, str } from "@/lib/form";
import { addErrand } from "@/services/errands";
import { isInTripGroup } from "@/services/trip-travelers";

const VALUE_STATUSES = ["ESTIMADO", "ORCAMENTO", "REALIZADO"] as const;
const PAYMENT_STATUSES = ["A_PAGAR", "PAGO"] as const;
const PURCHASE_STATUSES = ["AGUARDANDO_COMPRA", "PEDIDO_APROVACAO", "COMPRA_EFETUADA"] as const;

async function requireOwnRequester(clientId: string, requesterId: string, back: string) {
  const [r] = await db
    .select({ id: t.requesters.id })
    .from(t.requesters)
    .where(and(eq(t.requesters.id, requesterId), eq(t.requesters.clientId, clientId)))
    .limit(1);
  if (!r) fail(back, "Solicitante inválido.");
}

async function parseErrand(trip: { ownerId: string; id: string; ownerIsTraveler: boolean }, formData: FormData, back: string) {
  const travelerRaw = str(formData, "travelerId");
  const requesterId = str(formData, "requesterId");
  const product = str(formData, "product");
  if (!travelerRaw) fail(back, "Selecione o viajante responsável.");
  if (!requesterId) fail(back, "Selecione o solicitante.");
  if (!product) fail(back, "Informe o produto.");

  const travelerId = travelerRaw === "owner" ? null : travelerRaw;
  if (!(await isInTripGroup(trip, travelerId))) fail(back, "Esse viajante não está nesta viagem.");
  await requireOwnRequester(trip.ownerId, requesterId, back);

  const priceRaw = str(formData, "price");
  const price = parseDecimal(priceRaw, { positive: true });
  if (priceRaw && price === null) fail(back, "Valor inválido.");
  const currency = str(formData, "currency");

  return {
    travelerId,
    requesterId,
    product,
    price,
    currency: price ? currency : null,
    valueStatus: parseEnum(str(formData, "valueStatus"), VALUE_STATUSES, "ESTIMADO"),
    paymentStatus: parseEnum(str(formData, "paymentStatus"), PAYMENT_STATUSES, "A_PAGAR"),
    purchaseStatus: parseEnum(str(formData, "purchaseStatus"), PURCHASE_STATUSES, "AGUARDANDO_COMPRA"),
    details: str(formData, "details"),
  };
}

export async function addErrandAction(tripId: string, formData: FormData) {
  const { trip } = await requireTripAccess(tripId, { write: true });
  const back = `/trips/${tripId}/errands`;
  const v = await parseErrand(trip, formData, back);

  const receiptDocumentId = await attachmentFromForm({
    tripId,
    formData,
    fileField: "receipt",
    doc: { type: "RECEIPT", title: `Encomenda — ${v.product}` },
    back,
    current: null,
  });

  await addErrand(tripId, { ...v, receiptDocumentId });
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

  const v = await parseErrand(trip, formData, back);
  const receiptDocumentId = await attachmentFromForm({
    tripId,
    formData,
    fileField: "receipt",
    removeField: "removeReceipt",
    doc: { type: "RECEIPT", title: `Encomenda — ${v.product}` },
    back,
    current: current.receiptDocumentId,
  });

  await db
    .update(t.errands)
    .set({ ...v, receiptDocumentId })
    .where(and(eq(t.errands.id, errandId), eq(t.errands.tripId, tripId)));
  redirect(`/trips/${tripId}/errands`);
}

export async function deleteErrandAction(tripId: string, errandId: string) {
  await requireTripAccess(tripId, { write: true });
  await db.delete(t.errands).where(and(eq(t.errands.id, errandId), eq(t.errands.tripId, tripId)));
  redirect(`/trips/${tripId}/errands`);
}
