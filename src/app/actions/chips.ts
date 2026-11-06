"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { attachmentFromForm } from "@/lib/attachment";
import { CURRENCIES } from "@/lib/labels";
import { ISO_DATE, fail, parseDecimal, str } from "@/lib/form";

const EID = /^\d{32}$/;
const IMEI2 = /^\d{15}$/;

async function requireLinkedTraveler(tripId: string, travelerId: string) {
  const [link] = await db
    .select({ travelerId: t.tripTravelers.travelerId })
    .from(t.tripTravelers)
    .where(and(eq(t.tripTravelers.tripId, tripId), eq(t.tripTravelers.travelerId, travelerId)))
    .limit(1);
  if (!link) redirect(`/trips/${tripId}/travelers`);
}

async function parseChip(tripId: string, travelerId: string, formData: FormData, back: string) {
  const startDate = str(formData, "startDate");
  const endDate = str(formData, "endDate");
  const type = str(formData, "type") ?? "CHIP";
  const currency = str(formData, "currency");
  const eid = str(formData, "eid");
  const imei2 = str(formData, "imei2");

  if (startDate && !ISO_DATE.test(startDate)) fail(back, "Data de início inválida.");
  if (endDate && !ISO_DATE.test(endDate)) fail(back, "Data de término inválida.");
  if (startDate && endDate && endDate < startDate) fail(back, "A data de término não pode ser antes do início.");
  if (type !== "CHIP" && type !== "ESIM") fail(back, "Tipo de chip inválido.");
  if (currency && !(CURRENCIES as readonly string[]).includes(currency)) fail(back, "Moeda inválida.");
  if (eid && !EID.test(eid)) fail(back, "EID deve ter 32 dígitos.");
  if (imei2 && !IMEI2.test(imei2)) fail(back, "IMEI2 deve ter 15 dígitos.");

  const costRaw = str(formData, "cost");
  const cost = parseDecimal(costRaw, { positive: true });
  if (costRaw && cost === null) fail(back, "Custo inválido.");

  return {
    tripId,
    travelerId,
    provider: str(formData, "provider"),
    orderNumber: str(formData, "orderNumber"),
    plan: str(formData, "plan"),
    cost,
    currency: cost ? (currency ?? "BRL") : null,
    startDate,
    endDate,
    type: type as "CHIP" | "ESIM",
    eid,
    imei2,
  };
}

export async function upsertChipAction(tripId: string, travelerId: string, formData: FormData) {
  await requireTripAccess(tripId, { write: true });
  await requireLinkedTraveler(tripId, travelerId);
  const back = `/trips/${tripId}/travelers/${travelerId}`;

  const [current] = await db
    .select()
    .from(t.chips)
    .where(and(eq(t.chips.tripId, tripId), eq(t.chips.travelerId, travelerId)))
    .limit(1);

  const v = await parseChip(tripId, travelerId, formData, back);
  const receiptDocumentId = await attachmentFromForm({
    tripId,
    formData,
    fileField: "receipt",
    removeField: "removeReceipt",
    doc: { type: "RECEIPT", title: `Chip — ${v.provider ?? "sem fornecedor"}` },
    back,
    current: current?.receiptDocumentId ?? null,
  });

  await db
    .insert(t.chips)
    .values({ ...v, receiptDocumentId })
    .onConflictDoUpdate({ target: [t.chips.tripId, t.chips.travelerId], set: { ...v, receiptDocumentId } });
  redirect(`${back}?saved=1`);
}

export async function deleteChipAction(tripId: string, travelerId: string) {
  await requireTripAccess(tripId, { write: true });
  await db.delete(t.chips).where(and(eq(t.chips.tripId, tripId), eq(t.chips.travelerId, travelerId)));
  redirect(`/trips/${tripId}/travelers/${travelerId}`);
}
