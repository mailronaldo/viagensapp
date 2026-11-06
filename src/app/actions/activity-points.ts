"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { fail, str } from "@/lib/form";

type Kind = "POI" | "TIP";

const TIP_CATEGORIES = ["COMIDA", "ARTE", "CULTURA", "ATRACOES", "LOJAS", "CURIOSIDADES", "OUTROS"];

function itemEditPath(tripId: string, itemId: string) {
  return `/trips/${tripId}/itinerary/items/${itemId}`;
}

/** Confirma que a atividade é desta viagem antes de mexer nos filhos dela. */
async function ownItem(tripId: string, itemId: string) {
  const [row] = await db
    .select({ id: t.itineraryItems.id })
    .from(t.itineraryItems)
    .where(and(eq(t.itineraryItems.id, itemId), eq(t.itineraryItems.tripId, tripId)))
    .limit(1);
  return !!row;
}

function normalizeUrl(raw: string | null): string | null {
  if (!raw) return null;
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

export async function addActivityPointAction(tripId: string, itemId: string, kind: Kind, formData: FormData) {
  await requireTripAccess(tripId, { write: true });
  const back = itemEditPath(tripId, itemId);
  if (!(await ownItem(tripId, itemId))) redirect(`/trips/${tripId}/itinerary`);

  const name = str(formData, "name");
  if (!name) fail(back, kind === "POI" ? "Informe o nome do ponto de interesse." : "Informe o nome da dica.");

  const existing = await db
    .select({ id: t.itineraryItemPoints.id })
    .from(t.itineraryItemPoints)
    .where(and(eq(t.itineraryItemPoints.itemId, itemId), eq(t.itineraryItemPoints.kind, kind)));

  const categoryRaw = str(formData, "category");
  const category = kind === "TIP" && categoryRaw && TIP_CATEGORIES.includes(categoryRaw) ? categoryRaw : null;

  await db.insert(t.itineraryItemPoints).values({
    itemId,
    kind,
    name,
    description: str(formData, "description"),
    url: normalizeUrl(str(formData, "url")),
    category: category as "COMIDA" | "ARTE" | "CULTURA" | "ATRACOES" | "LOJAS" | "CURIOSIDADES" | "OUTROS" | null,
    position: existing.length,
  });
  redirect(back);
}

export async function deleteActivityPointAction(tripId: string, itemId: string, pointId: string) {
  await requireTripAccess(tripId, { write: true });
  await db
    .delete(t.itineraryItemPoints)
    .where(and(eq(t.itineraryItemPoints.id, pointId), eq(t.itineraryItemPoints.itemId, itemId)));
  redirect(itemEditPath(tripId, itemId));
}

export async function addActivityRegionAction(tripId: string, itemId: string, formData: FormData) {
  await requireTripAccess(tripId, { write: true });
  const back = itemEditPath(tripId, itemId);
  if (!(await ownItem(tripId, itemId))) redirect(`/trips/${tripId}/itinerary`);

  const name = str(formData, "name");
  if (!name) fail(back, "Informe o nome da região.");

  const existing = await db
    .select({ id: t.itineraryItemRegions.id })
    .from(t.itineraryItemRegions)
    .where(eq(t.itineraryItemRegions.itemId, itemId));
  // Evita repetir a mesma tag (comparação simples, sem diferenciar maiúsculas).
  const [dup] = await db
    .select({ id: t.itineraryItemRegions.id })
    .from(t.itineraryItemRegions)
    .where(and(eq(t.itineraryItemRegions.itemId, itemId), eq(t.itineraryItemRegions.name, name)))
    .limit(1);
  if (!dup) {
    await db.insert(t.itineraryItemRegions).values({ itemId, name, position: existing.length });
  }
  redirect(back);
}

export async function deleteActivityRegionAction(tripId: string, itemId: string, regionId: string) {
  await requireTripAccess(tripId, { write: true });
  await db
    .delete(t.itineraryItemRegions)
    .where(and(eq(t.itineraryItemRegions.id, regionId), eq(t.itineraryItemRegions.itemId, itemId)));
  redirect(itemEditPath(tripId, itemId));
}
