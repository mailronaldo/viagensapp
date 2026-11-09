"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { attachmentFromForm } from "@/lib/attachment";
import { HH_MM, ISO_DATE, fail, str } from "@/lib/form";

async function parseLodging(tripId: string, formData: FormData, back: string) {
  const name = str(formData, "name");
  const type = str(formData, "type") ?? "HOTEL";
  const provider = str(formData, "provider");
  const cityId = str(formData, "cityId");
  const checkInDate = str(formData, "checkInDate");
  const checkOutDate = str(formData, "checkOutDate");
  const checkInTime = str(formData, "checkInTime");
  const checkOutTime = str(formData, "checkOutTime");

  if (!name) fail(back, "Informe o nome da hospedagem.");
  const [lodgingType] = await db.select({ id: t.lodgingTypes.id }).from(t.lodgingTypes).where(eq(t.lodgingTypes.id, type)).limit(1);
  if (!lodgingType) fail(back, "Tipo de hospedagem inválido.");
  if (provider) {
    const [method] = await db
      .select({ id: t.reservationMethods.id })
      .from(t.reservationMethods)
      .where(eq(t.reservationMethods.id, provider))
      .limit(1);
    if (!method) fail(back, "Método de reserva inválido.");
  }
  if (checkInDate && !ISO_DATE.test(checkInDate)) fail(back, "Data de check-in inválida.");
  if (checkOutDate && !ISO_DATE.test(checkOutDate)) fail(back, "Data de check-out inválida.");
  if (checkInTime && !HH_MM.test(checkInTime)) fail(back, "Hora de check-in inválida.");
  if (checkOutTime && !HH_MM.test(checkOutTime)) fail(back, "Hora de check-out inválida.");
  if (checkInDate && checkOutDate && checkOutDate < checkInDate) {
    fail(back, "O check-out não pode ser antes do check-in.");
  }

  if (cityId) {
    const [city] = await db
      .select({ id: t.tripCities.cityId })
      .from(t.tripCities)
      .where(and(eq(t.tripCities.cityId, cityId), eq(t.tripCities.tripId, tripId)))
      .limit(1);
    if (!city) fail(back, "Cidade inválida.");
  }

  return {
    name,
    type,
    cityId,
    provider,
    address: str(formData, "address"),
    checkInDate,
    checkInTime,
    checkOutDate,
    checkOutTime,
    confirmationCode: str(formData, "confirmationCode"),
    pin: str(formData, "pin"),
    notes: str(formData, "notes"),
  };
}

export async function addLodgingAction(tripId: string, formData: FormData) {
  await requireTripAccess(tripId, { write: true });
  const day = str(formData, "day");
  const back = day ? `/trips/${tripId}/itinerary/day/${day}` : `/trips/${tripId}/lodgings`;
  const v = await parseLodging(tripId, formData, back);
  const documentId = await attachmentFromForm({
    tripId,
    formData,
    fileField: "voucher",
    doc: { type: "RESERVATION", title: `Hospedagem — ${v.name}` },
    back,
    current: null,
  });
  const iconDocumentId = await attachmentFromForm({
    tripId,
    formData,
    fileField: "icon",
    doc: { type: "RECEIPT", title: `Ícone — ${v.name}` },
    back,
    current: null,
  });
  await db.insert(t.lodgings).values({ tripId, ...v, documentId, iconDocumentId });
  redirect(back);
}

export async function updateLodgingAction(tripId: string, lodgingId: string, formData: FormData) {
  await requireTripAccess(tripId, { write: true });
  const day = str(formData, "day");
  const editUrl = `/trips/${tripId}/lodgings/${lodgingId}`;
  const back = day ? `${editUrl}?day=${day}` : editUrl;
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
  const iconDocumentId = await attachmentFromForm({
    tripId,
    formData,
    fileField: "icon",
    removeField: "removeIcon",
    doc: { type: "RECEIPT", title: `Ícone — ${v.name}` },
    back,
    current: current.iconDocumentId,
  });
  await db
    .update(t.lodgings)
    .set({ ...v, documentId, iconDocumentId })
    .where(and(eq(t.lodgings.id, lodgingId), eq(t.lodgings.tripId, tripId)));
  redirect(day ? `/trips/${tripId}/itinerary/day/${day}` : `${back}?saved=1`);
}

export async function deleteLodgingAction(tripId: string, lodgingId: string) {
  await requireTripAccess(tripId, { write: true });
  await db
    .delete(t.lodgings)
    .where(and(eq(t.lodgings.id, lodgingId), eq(t.lodgings.tripId, tripId)));
  redirect(`/trips/${tripId}/lodgings`);
}
