import "server-only";
import { and, asc, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { db, t } from "@/db";

/** Passes de um viajante (ou do dono, quando `travelerId` nulo) na viagem, com a contagem de usos. */
export async function listTravelerPasses(tripId: string, travelerId: string | null) {
  const rows = await db
    .select({
      pass: t.passes,
      usedCount: sql<number>`count(${t.activityPassUsages.id})`.mapWith(Number),
    })
    .from(t.passes)
    .leftJoin(t.activityPassUsages, eq(t.activityPassUsages.passId, t.passes.id))
    .where(
      and(
        eq(t.passes.tripId, tripId),
        travelerId === null ? isNull(t.passes.travelerId) : eq(t.passes.travelerId, travelerId),
      ),
    )
    .groupBy(t.passes.id)
    .orderBy(asc(t.passes.name));
  return rows.map((r) => ({ ...r.pass, usedCount: r.usedCount }));
}

/** Passes do grupo da viagem com vaga (uso < limite) e ainda não usados nesta atividade. */
export async function listAvailablePassesForItem(tripId: string, itemId: string) {
  const alreadyUsed = await db
    .select({ passId: t.activityPassUsages.passId })
    .from(t.activityPassUsages)
    .where(eq(t.activityPassUsages.itemId, itemId));
  const usedIds = alreadyUsed.map((r) => r.passId);

  const rows = await db
    .select({
      pass: t.passes,
      travelerName: t.travelers.name,
      usedCount: sql<number>`count(${t.activityPassUsages.id})`.mapWith(Number),
    })
    .from(t.passes)
    .leftJoin(t.travelers, eq(t.travelers.id, t.passes.travelerId))
    .leftJoin(t.activityPassUsages, eq(t.activityPassUsages.passId, t.passes.id))
    .where(
      usedIds.length > 0 ? and(eq(t.passes.tripId, tripId), notInArray(t.passes.id, usedIds)) : eq(t.passes.tripId, tripId),
    )
    .groupBy(t.passes.id, t.travelers.name)
    .orderBy(asc(t.passes.name));

  return rows
    .map((r) => ({ ...r.pass, travelerName: r.travelerName, usedCount: r.usedCount }))
    .filter((p) => p.maxUses === null || p.usedCount < p.maxUses);
}

/** Passes já usados (e o total de usos de cada um) numa atividade específica. */
export async function getItemPassUsages(itemId: string) {
  const rows = await db
    .select({
      usage: t.activityPassUsages,
      pass: t.passes,
      travelerName: t.travelers.name,
    })
    .from(t.activityPassUsages)
    .innerJoin(t.passes, eq(t.passes.id, t.activityPassUsages.passId))
    .leftJoin(t.travelers, eq(t.travelers.id, t.passes.travelerId))
    .where(eq(t.activityPassUsages.itemId, itemId));
  if (rows.length === 0) return [];

  const passIds = [...new Set(rows.map((r) => r.pass.id))];
  const totals = await db
    .select({ passId: t.activityPassUsages.passId, usedCount: sql<number>`count(*)`.mapWith(Number) })
    .from(t.activityPassUsages)
    .where(inArray(t.activityPassUsages.passId, passIds))
    .groupBy(t.activityPassUsages.passId);
  const totalById = new Map(totals.map((row) => [row.passId, row.usedCount]));

  return rows.map((r) => ({ ...r, usedCount: totalById.get(r.pass.id) ?? 0 }));
}
