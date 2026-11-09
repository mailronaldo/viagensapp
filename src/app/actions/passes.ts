"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { fail, parseDecimal, parseStatus, str } from "@/lib/form";
import { isInTripGroup } from "@/services/trip-travelers";
import { listClientCurrencyCodes } from "@/services/currencies";
import { parseOptionalCategory } from "@/services/catalogs";

function travelerHubPath(tripId: string, travelerId: string | null) {
  return travelerId === null ? `/trips/${tripId}/travelers/owner` : `/trips/${tripId}/travelers/${travelerId}`;
}

function itemEditPath(tripId: string, itemId: string) {
  return `/trips/${tripId}/itinerary/items/${itemId}`;
}

async function ownItem(tripId: string, itemId: string) {
  const [row] = await db
    .select({ id: t.itineraryItems.id, date: t.itineraryItems.date })
    .from(t.itineraryItems)
    .where(and(eq(t.itineraryItems.id, itemId), eq(t.itineraryItems.tripId, tripId)))
    .limit(1);
  return row ?? null;
}

export async function addPassAction(tripId: string, travelerId: string, formData: FormData) {
  const { trip } = await requireTripAccess(tripId, { write: true });
  const realTravelerId = travelerId === "owner" ? null : travelerId;
  const back = travelerHubPath(tripId, realTravelerId);
  if (!(await isInTripGroup(trip, realTravelerId))) fail(back, "Esse viajante não está no grupo desta viagem.");

  const name = str(formData, "name");
  if (!name) fail(back, "Informe o nome do passe.");

  const currency = str(formData, "currency");
  if (currency) {
    const validCurrencies = await listClientCurrencyCodes(trip.ownerId);
    if (!validCurrencies.includes(currency)) fail(back, "Moeda inválida.");
  }
  const priceRaw = str(formData, "price");
  const price = parseDecimal(priceRaw, { positive: true });
  if (priceRaw && price === null) fail(back, "Valor do passe inválido.");

  const validityRaw = str(formData, "validityDays");
  const validityDays = validityRaw ? Number(validityRaw) : null;
  if (validityRaw && (!Number.isInteger(validityDays) || (validityDays ?? 0) <= 0)) {
    fail(back, "Validade em dias inválida.");
  }
  const maxUsesRaw = str(formData, "maxUses");
  const maxUses = maxUsesRaw ? Number(maxUsesRaw) : null;
  if (maxUsesRaw && (!Number.isInteger(maxUses) || (maxUses ?? 0) <= 0)) {
    fail(back, "Número de atrações inválido.");
  }

  await db.insert(t.passes).values({
    tripId,
    travelerId: realTravelerId,
    name,
    provider: str(formData, "provider"),
    validityDays,
    maxUses,
    price,
    currency: price ? (currency ?? "BRL") : null,
    status: parseStatus(str(formData, "status")),
    category: await parseOptionalCategory(str(formData, "category")),
    passNumber: str(formData, "passNumber"),
  });
  redirect(back);
}

export async function updatePassAction(tripId: string, travelerId: string, passId: string, formData: FormData) {
  const { trip } = await requireTripAccess(tripId, { write: true });
  const realTravelerId = travelerId === "owner" ? null : travelerId;
  const back = travelerHubPath(tripId, realTravelerId);

  const [pass] = await db.select().from(t.passes).where(and(eq(t.passes.id, passId), eq(t.passes.tripId, tripId))).limit(1);
  if (!pass) fail(back, "Passe não encontrado.");

  const name = str(formData, "name");
  if (!name) fail(back, "Informe o nome do passe.");

  const currency = str(formData, "currency");
  if (currency) {
    const validCurrencies = await listClientCurrencyCodes(trip.ownerId);
    if (!validCurrencies.includes(currency)) fail(back, "Moeda inválida.");
  }
  const priceRaw = str(formData, "price");
  const price = parseDecimal(priceRaw, { positive: true });
  if (priceRaw && price === null) fail(back, "Valor do passe inválido.");

  const validityRaw = str(formData, "validityDays");
  const validityDays = validityRaw ? Number(validityRaw) : null;
  if (validityRaw && (!Number.isInteger(validityDays) || (validityDays ?? 0) <= 0)) {
    fail(back, "Validade em dias inválida.");
  }
  const maxUsesRaw = str(formData, "maxUses");
  const maxUses = maxUsesRaw ? Number(maxUsesRaw) : null;
  if (maxUsesRaw && (!Number.isInteger(maxUses) || (maxUses ?? 0) <= 0)) {
    fail(back, "Número de atrações inválido.");
  }
  if (maxUses !== null) {
    const usages = await db
      .select({ id: t.activityPassUsages.id })
      .from(t.activityPassUsages)
      .where(eq(t.activityPassUsages.passId, passId));
    if (usages.length > maxUses) fail(back, "Esse passe já tem mais usos lançados do que o novo limite.");
  }

  await db
    .update(t.passes)
    .set({
      name,
      provider: str(formData, "provider"),
      validityDays,
      maxUses,
      price,
      currency: price ? (currency ?? "BRL") : null,
      status: parseStatus(str(formData, "status")),
      category: await parseOptionalCategory(str(formData, "category")),
      passNumber: str(formData, "passNumber"),
    })
    .where(eq(t.passes.id, passId));
  redirect(back);
}

export async function deletePassAction(tripId: string, travelerId: string, passId: string) {
  await requireTripAccess(tripId, { write: true });
  const realTravelerId = travelerId === "owner" ? null : travelerId;
  const back = travelerHubPath(tripId, realTravelerId);

  const usages = await db
    .select({ id: t.activityPassUsages.id })
    .from(t.activityPassUsages)
    .where(eq(t.activityPassUsages.passId, passId));
  if (usages.length > 0) fail(back, "Esse passe já tem usos lançados em atividades — remova os usos antes de excluir.");

  await db.delete(t.passes).where(and(eq(t.passes.id, passId), eq(t.passes.tripId, tripId)));
  redirect(back);
}

export async function useItemPassAction(tripId: string, itemId: string, formData: FormData) {
  await requireTripAccess(tripId, { write: true });
  const back = itemEditPath(tripId, itemId);
  const item = await ownItem(tripId, itemId);
  if (!item) redirect(`/trips/${tripId}/itinerary`);

  const passId = str(formData, "passId");
  if (!passId) fail(back, "Selecione um passe.");

  const [pass] = await db
    .select()
    .from(t.passes)
    .where(and(eq(t.passes.id, passId), eq(t.passes.tripId, tripId)))
    .limit(1);
  if (!pass) fail(back, "Passe não encontrado nesta viagem.");

  const usages = await db
    .select({ id: t.activityPassUsages.id })
    .from(t.activityPassUsages)
    .where(eq(t.activityPassUsages.passId, passId));
  if (pass.maxUses !== null && usages.length >= pass.maxUses) {
    fail(back, "Esse passe já atingiu o limite de usos.");
  }

  await db.insert(t.activityPassUsages).values({ itemId, passId }).onConflictDoNothing();
  if (!pass.firstUsedAt) {
    await db.update(t.passes).set({ firstUsedAt: item.date }).where(eq(t.passes.id, passId));
  }
  redirect(back);
}

export async function removeItemPassUsageAction(tripId: string, itemId: string, usageId: string) {
  await requireTripAccess(tripId, { write: true });
  await db
    .delete(t.activityPassUsages)
    .where(and(eq(t.activityPassUsages.id, usageId), eq(t.activityPassUsages.itemId, itemId)));
  redirect(itemEditPath(tripId, itemId));
}
