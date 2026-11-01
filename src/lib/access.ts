import "server-only";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireUser, type CurrentUser } from "./auth";

export type Role = "OWNER" | "EDITOR" | "VIEWER";

export type TripAccess = {
  user: CurrentUser;
  trip: typeof t.trips.$inferSelect;
  role: Role;
  canWrite: boolean;
};

/**
 * Ponto único de autorização (isolamento multiusuário): o usuário só enxerga
 * viagens em que é membro. Para quem não é membro, a viagem "não existe".
 */
export async function getTripAccessFor(
  userId: string,
  tripId: string,
): Promise<{ trip: typeof t.trips.$inferSelect; role: Role } | null> {
  const [row] = await db
    .select({ trip: t.trips, role: t.tripMembers.role })
    .from(t.tripMembers)
    .innerJoin(t.trips, eq(t.trips.id, t.tripMembers.tripId))
    .where(and(eq(t.tripMembers.tripId, tripId), eq(t.tripMembers.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function requireTripAccess(
  tripId: string,
  opts: { write?: boolean } = {},
): Promise<TripAccess> {
  const user = await requireUser();
  const access = await getTripAccessFor(user.id, tripId);
  if (!access) notFound();
  const canWrite = access.role !== "VIEWER";
  if (opts.write && !canWrite) {
    throw new Error("Você não tem permissão para editar esta viagem.");
  }
  return { user, trip: access.trip, role: access.role, canWrite };
}
