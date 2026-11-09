"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { attachmentFromForm } from "@/lib/attachment";
import { fail, parseDecimal, parseStatus, str } from "@/lib/form";
import { isInTripGroup } from "@/services/trip-travelers";
import { listClientCurrencyCodes } from "@/services/currencies";
import { getLodgingCategoryId } from "@/services/catalogs";

function lodgingEditPath(tripId: string, lodgingId: string) {
  return `/trips/${tripId}/lodgings/${lodgingId}`;
}

async function getOwnLodging(tripId: string, lodgingId: string) {
  const [row] = await db
    .select({ id: t.lodgings.id, type: t.lodgings.type })
    .from(t.lodgings)
    .where(and(eq(t.lodgings.id, lodgingId), eq(t.lodgings.tripId, tripId)))
    .limit(1);
  return row ?? null;
}

async function parseVoucherValues(
  trip: { id: string; ownerId: string; ownerIsTraveler: boolean },
  lodgingType: string,
  formData: FormData,
  back: string,
) {
  const name = str(formData, "name");
  if (!name) fail(back, "Informe o nome do voucher.");

  const subcategoryId = str(formData, "subcategoryId");
  if (subcategoryId) {
    const [sc] = await db
      .select({ id: t.lodgingTypeSubcategories.id })
      .from(t.lodgingTypeSubcategories)
      .where(and(eq(t.lodgingTypeSubcategories.id, subcategoryId), eq(t.lodgingTypeSubcategories.lodgingTypeId, lodgingType)))
      .limit(1);
    if (!sc) fail(back, "Subcategoria inválida para o tipo desta hospedagem.");
  }

  const provider = str(formData, "provider");
  if (provider) {
    const [method] = await db
      .select({ id: t.reservationMethods.id })
      .from(t.reservationMethods)
      .where(eq(t.reservationMethods.id, provider))
      .limit(1);
    if (!method) fail(back, "Método de reserva inválido.");
  }

  const currency = str(formData, "currency");
  if (currency) {
    const validCurrencies = await listClientCurrencyCodes(trip.ownerId);
    if (!validCurrencies.includes(currency)) fail(back, "Moeda inválida.");
  }
  const priceRaw = str(formData, "price");
  const price = parseDecimal(priceRaw, { positive: true });
  if (priceRaw && price === null) fail(back, "Valor do voucher inválido.");

  const isGroup = str(formData, "isGroup") === "on";
  let travelerIds: (string | null)[] = [];
  if (!isGroup) {
    const raw = formData.getAll("travelerIds").map((v) => String(v));
    travelerIds = raw.map((v) => (v === "owner" ? null : v));
    if (travelerIds.length === 0) fail(back, "Selecione ao menos um viajante, ou marque como voucher do grupo.");
    for (const travelerId of travelerIds) {
      if (!(await isInTripGroup(trip, travelerId))) fail(back, "Um dos viajantes selecionados não está no grupo desta viagem.");
    }
  }

  return {
    name,
    subcategoryId,
    isGroup,
    travelerIds,
    provider,
    confirmationCode: str(formData, "confirmationCode"),
    pin: str(formData, "pin"),
    price,
    currency: price ? (currency ?? "BRL") : null,
    status: parseStatus(str(formData, "status")),
    category: await getLodgingCategoryId(),
    notes: str(formData, "notes"),
  };
}

export async function addVoucherAction(tripId: string, lodgingId: string, formData: FormData) {
  const { trip } = await requireTripAccess(tripId, { write: true });
  const back = lodgingEditPath(tripId, lodgingId);
  const lodging = await getOwnLodging(tripId, lodgingId);
  if (!lodging) redirect(`/trips/${tripId}/lodgings`);

  const { travelerIds, ...v } = await parseVoucherValues(trip, lodging.type, formData, back);
  const voucherDocumentId = await attachmentFromForm({
    tripId,
    formData,
    fileField: "voucher",
    doc: { type: "RECEIPT", title: `Voucher — ${v.name}` },
    back,
    current: null,
  });

  await db.transaction(async (tx) => {
    const [row] = await tx.insert(t.lodgingVouchers).values({ lodgingId, ...v, voucherDocumentId }).returning({ id: t.lodgingVouchers.id });
    if (!v.isGroup) {
      await tx.insert(t.lodgingVoucherTravelers).values(travelerIds.map((travelerId) => ({ voucherId: row.id, travelerId })));
    }
  });
  redirect(back);
}

export async function updateVoucherAction(tripId: string, lodgingId: string, voucherId: string, formData: FormData) {
  const { trip } = await requireTripAccess(tripId, { write: true });
  const back = lodgingEditPath(tripId, lodgingId);
  const lodging = await getOwnLodging(tripId, lodgingId);
  if (!lodging) redirect(`/trips/${tripId}/lodgings`);

  const [current] = await db
    .select()
    .from(t.lodgingVouchers)
    .where(and(eq(t.lodgingVouchers.id, voucherId), eq(t.lodgingVouchers.lodgingId, lodgingId)))
    .limit(1);
  if (!current) fail(back, "Voucher não encontrado.");

  const { travelerIds, ...v } = await parseVoucherValues(trip, lodging.type, formData, back);
  const voucherDocumentId = await attachmentFromForm({
    tripId,
    formData,
    fileField: "voucher",
    removeField: "removeVoucher",
    doc: { type: "RECEIPT", title: `Voucher — ${v.name}` },
    back,
    current: current!.voucherDocumentId,
  });

  await db.transaction(async (tx) => {
    await tx.update(t.lodgingVouchers).set({ ...v, voucherDocumentId }).where(eq(t.lodgingVouchers.id, voucherId));
    await tx.delete(t.lodgingVoucherTravelers).where(eq(t.lodgingVoucherTravelers.voucherId, voucherId));
    if (!v.isGroup) {
      await tx.insert(t.lodgingVoucherTravelers).values(travelerIds.map((travelerId) => ({ voucherId, travelerId })));
    }
  });
  redirect(back);
}

export async function deleteVoucherAction(tripId: string, lodgingId: string, voucherId: string) {
  await requireTripAccess(tripId, { write: true });
  await db.delete(t.lodgingVouchers).where(and(eq(t.lodgingVouchers.id, voucherId), eq(t.lodgingVouchers.lodgingId, lodgingId)));
  redirect(lodgingEditPath(tripId, lodgingId));
}
