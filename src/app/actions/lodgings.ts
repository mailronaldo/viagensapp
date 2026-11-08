"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { attachmentFromForm } from "@/lib/attachment";
import { HH_MM, ISO_DATE, fail, parseDecimal, str } from "@/lib/form";
import { listClientCurrencyCodes } from "@/services/currencies";

async function parseLodging(tripId: string, ownerId: string, formData: FormData, back: string) {
  const name = str(formData, "name");
  const type = str(formData, "type") ?? "HOTEL";
  const provider = str(formData, "provider");
  const cityId = str(formData, "cityId");
  const checkInDate = str(formData, "checkInDate");
  const checkOutDate = str(formData, "checkOutDate");
  const checkInTime = str(formData, "checkInTime");
  const checkOutTime = str(formData, "checkOutTime");
  const currency = str(formData, "currency");

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
  if (currency) {
    const validCurrencies = await listClientCurrencyCodes(ownerId);
    if (!validCurrencies.includes(currency)) fail(back, "Moeda inválida.");
  }

  const priceRaw = str(formData, "totalPrice");
  const totalPrice = parseDecimal(priceRaw, { positive: true });
  if (priceRaw && totalPrice === null) fail(back, "Valor inválido.");

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
    totalPrice,
    currency: totalPrice ? (currency ?? "BRL") : null,
    notes: str(formData, "notes"),
  };
}

export async function addLodgingAction(tripId: string, formData: FormData) {
  const { trip } = await requireTripAccess(tripId, { write: true });
  const day = str(formData, "day");
  const back = day ? `/trips/${tripId}/itinerary/day/${day}` : `/trips/${tripId}/lodgings`;
  const v = await parseLodging(tripId, trip.ownerId, formData, back);
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
  const { trip } = await requireTripAccess(tripId, { write: true });
  const day = str(formData, "day");
  const editUrl = `/trips/${tripId}/lodgings/${lodgingId}`;
  const back = day ? `${editUrl}?day=${day}` : editUrl;
  const [current] = await db
    .select()
    .from(t.lodgings)
    .where(and(eq(t.lodgings.id, lodgingId), eq(t.lodgings.tripId, tripId)))
    .limit(1);
  if (!current) redirect(`/trips/${tripId}/lodgings`);

  const v = await parseLodging(tripId, trip.ownerId, formData, back);
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
  redirect(day ? `/trips/${tripId}/itinerary/day/${day}` : `${back}?saved=1`);
}

export async function deleteLodgingAction(tripId: string, lodgingId: string) {
  await requireTripAccess(tripId, { write: true });
  await db
    .delete(t.lodgings)
    .where(and(eq(t.lodgings.id, lodgingId), eq(t.lodgings.tripId, tripId)));
  redirect(`/trips/${tripId}/lodgings`);
}
