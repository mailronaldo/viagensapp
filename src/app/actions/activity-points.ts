"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { fail, str } from "@/lib/form";
import { parseOptionalTipCategory } from "@/services/catalogs";

type Kind = "POI" | "TIP";

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

  const category = kind === "TIP" ? await parseOptionalTipCategory(str(formData, "category")) : null;

  await db.insert(t.itineraryItemPoints).values({
    itemId,
    kind,
    name,
    description: str(formData, "description"),
    url: normalizeUrl(str(formData, "url")),
    category,
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
