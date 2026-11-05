import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db, t } from "@/db";

export async function getActivityPoints(itemId: string, kind: "POI" | "TIP") {
  return db
    .select()
    .from(t.itineraryItemPoints)
    .where(and(eq(t.itineraryItemPoints.itemId, itemId), eq(t.itineraryItemPoints.kind, kind)))
    .orderBy(asc(t.itineraryItemPoints.position));
}

export async function getActivityRegions(itemId: string) {
  return db
    .select()
    .from(t.itineraryItemRegions)
    .where(eq(t.itineraryItemRegions.itemId, itemId))
    .orderBy(asc(t.itineraryItemRegions.position));
}
