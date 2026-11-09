"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { attachmentFromForm } from "@/lib/attachment";
import { fail, parseDecimal, parseStatus, str } from "@/lib/form";
import { isInTripGroup } from "@/services/trip-travelers";
import { listClientCurrencyCodes } from "@/services/currencies";
import { getTransportCategoryId } from "@/services/catalogs";

function bookingEditPath(tripId: string, bookingId: string) {
  return `/trips/${tripId}/transports/${bookingId}`;
}

async function ownBooking(tripId: string, bookingId: string) {
  const [row] = await db
    .select({ id: t.bookings.id })
    .from(t.bookings)
    .where(and(eq(t.bookings.id, bookingId), eq(t.bookings.tripId, tripId)))
    .limit(1);
  return !!row;
}

async function parseVoucherValues(ownerId: string, formData: FormData, back: string) {
  const currency = str(formData, "currency");
  if (currency) {
    const validCurrencies = await listClientCurrencyCodes(ownerId);
    if (!validCurrencies.includes(currency)) fail(back, "Moeda inválida.");
  }
  const priceRaw = str(formData, "price");
  const price = parseDecimal(priceRaw, { positive: true });
  if (priceRaw && price === null) fail(back, "Valor do voucher inválido.");

  return {
    provider: str(formData, "provider"),
    reservationCode: str(formData, "reservationCode"),
    price,
    currency: price ? (currency ?? "BRL") : null,
    status: parseStatus(str(formData, "status")),
    category: await getTransportCategoryId(),
    notes: str(formData, "notes"),
  };
}

export async function addVoucherAction(tripId: string, bookingId: string, formData: FormData) {
  const { trip } = await requireTripAccess(tripId, { write: true });
  const back = bookingEditPath(tripId, bookingId);
  if (!(await ownBooking(tripId, bookingId))) redirect(`/trips/${tripId}/transports`);

  const scopeRaw = str(formData, "scope");
  if (!scopeRaw) fail(back, "Selecione o escopo do voucher.");
  const isGroup = scopeRaw === "group";
  const travelerId = isGroup || scopeRaw === "owner" ? null : scopeRaw;
  if (!isGroup && travelerId !== null && !(await isInTripGroup(trip, travelerId))) {
    fail(back, "Esse viajante não está no grupo desta viagem.");
  }

  const v = await parseVoucherValues(trip.ownerId, formData, back);
  const voucherDocumentId = await attachmentFromForm({
    tripId,
    formData,
    fileField: "voucher",
    doc: { type: "RECEIPT", title: `Voucher — ${v.provider ?? "transporte"}` },
    back,
    current: null,
  });

  try {
    await db.insert(t.transportVouchers).values({ bookingId, isGroup, travelerId, ...v, voucherDocumentId });
  } catch {
    fail(back, isGroup ? "Já existe um voucher do grupo para este transporte." : "Esse viajante já tem um voucher cadastrado para este transporte.");
  }
  redirect(back);
}

export async function updateVoucherAction(tripId: string, bookingId: string, voucherId: string, formData: FormData) {
  const { trip } = await requireTripAccess(tripId, { write: true });
  const back = bookingEditPath(tripId, bookingId);
  if (!(await ownBooking(tripId, bookingId))) redirect(`/trips/${tripId}/transports`);

  const [current] = await db
    .select()
    .from(t.transportVouchers)
    .where(and(eq(t.transportVouchers.id, voucherId), eq(t.transportVouchers.bookingId, bookingId)))
    .limit(1);
  if (!current) fail(back, "Voucher não encontrado.");

  const v = await parseVoucherValues(trip.ownerId, formData, back);
  const voucherDocumentId = await attachmentFromForm({
    tripId,
    formData,
    fileField: "voucher",
    removeField: "removeVoucher",
    doc: { type: "RECEIPT", title: `Voucher — ${v.provider ?? "transporte"}` },
    back,
    current: current!.voucherDocumentId,
  });

  await db
    .update(t.transportVouchers)
    .set({ ...v, voucherDocumentId })
    .where(eq(t.transportVouchers.id, voucherId));
  redirect(back);
}

export async function deleteVoucherAction(tripId: string, bookingId: string, voucherId: string) {
  await requireTripAccess(tripId, { write: true });
  await db
    .delete(t.transportVouchers)
    .where(and(eq(t.transportVouchers.id, voucherId), eq(t.transportVouchers.bookingId, bookingId)));
  redirect(bookingEditPath(tripId, bookingId));
}
