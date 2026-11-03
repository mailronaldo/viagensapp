"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { attachmentFromForm } from "@/lib/attachment";
import { CURRENCIES, LODGING_TYPE_LABEL } from "@/lib/labels";
import { HH_MM, ISO_DATE, fail, parseDecimal, str } from "@/lib/form";

async function parseLodging(tripId: string, formData: FormData, back: string) {
  const name = str(formData, "name");
  const type = str(formData, "type") ?? "HOTEL";
  const cityId = str(formData, "cityId");
  const checkInDate = str(formData, "checkInDate");
  const checkOutDate = str(formData, "checkOutDate");
  const checkInTime = str(formData, "checkInTime");
  const checkOutTime = str(formData, "checkOutTime");
  const currency = str(formData, "currency");

  if (!name) fail(back, "Informe o nome da hospedagem.");
  if (!(type in LODGING_TYPE_LABEL)) fail(back, "Tipo de hospedagem inválido.");
  if (checkInDate && !ISO_DATE.test(checkInDate)) fail(back, "Data de check-in inválida.");
  if (checkOutDate && !ISO_DATE.test(checkOutDate)) fail(back, "Data de check-out inválida.");
  if (checkInTime && !HH_MM.test(checkInTime)) fail(back, "Hora de check-in inválida.");
  if (checkOutTime && !HH_MM.test(checkOutTime)) fail(back, "Hora de check-out inválida.");
  if (checkInDate && checkOutDate && checkOutDate < checkInDate) {
    fail(back, "O check-out não pode ser antes do check-in.");
  }
  if (currency && !(CURRENCIES as readonly string[]).includes(currency)) fail(back, "Moeda inválida.");

  const priceRaw = str(formData, "totalPrice");
  const totalPrice = parseDecimal(priceRaw, { positive: true });
  if (priceRaw && totalPrice === null) fail(back, "Valor inválido.");

  if (cityId) {
    const [city] = await db
      .select({ id: t.cities.id })
      .from(t.cities)
      .where(and(eq(t.cities.id, cityId), eq(t.cities.tripId, tripId)))
      .limit(1);
    if (!city) fail(back, "Cidade inválida.");
  }

  return {
    name,
    type: type as keyof typeof LODGING_TYPE_LABEL,
    cityId,
    provider: str(formData, "provider"),
    address: str(formData, "address"),
    checkInDate,
    checkInTime,
    checkOutDate,
    checkOutTime,
    confirmationCode: str(formData, "confirmationCode"),
    totalPrice,
    currency: totalPrice ? (currency ?? "BRL") : null,
    notes: str(formData, "notes"),
  };
}

export async function addLodgingAction(tripId: string, formData: FormData) {
  await requireTripAccess(tripId, { write: true });
  const back = `/trips/${tripId}/lodgings`;
  const v = await parseLodging(tripId, formData, back);
  const documentId = await attachmentFromForm({
    tripId,
    formData,
    fileField: "voucher",
    doc: { type: "RESERVATION", title: `Hospedagem — ${v.name}` },
    back,
    current: null,
  });
  await db.insert(t.lodgings).values({ tripId, ...v, documentId });
  redirect(back);
}

export async function updateLodgingAction(tripId: string, lodgingId: string, formData: FormData) {
  await requireTripAccess(tripId, { write: true });
  const back = `/trips/${tripId}/lodgings/${lodgingId}`;
  const [current] = await db
    .select()
    .from(t.lodgings)
    .where(and(eq(t.lodgings.id, lodgingId), eq(t.lodgings.tripId, tripId)))
    .limit(1);
  if (!current) redirect(`/trips/${tripId}/lodgings`);

  const v = await parseLodging(tripId, formData, back);
  const documentId = await attachmentFromForm({
    tripId,
    formData,
    fileField: "voucher",
    removeField: "removeVoucher",
    doc: { type: "RESERVATION", title: `Hospedagem — ${v.name}` },
    back,
    current: current.documentId,
  });
  await db
    .update(t.lodgings)
    .set({ ...v, documentId })
    .where(and(eq(t.lodgings.id, lodgingId), eq(t.lodgings.tripId, tripId)));
  redirect(`/trips/${tripId}/lodgings`);
}

export async function deleteLodgingAction(tripId: string, lodgingId: string) {
  await requireTripAccess(tripId, { write: true });
  await db
    .delete(t.lodgings)
    .where(and(eq(t.lodgings.id, lodgingId), eq(t.lodgings.tripId, tripId)));
  redirect(`/trips/${tripId}/lodgings`);
}
