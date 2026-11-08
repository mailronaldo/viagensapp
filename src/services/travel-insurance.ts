import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db, t } from "@/db";

/** Apólice de um viajante (ou do dono, quando `travelerId` nulo) numa viagem — no máximo uma. */
export async function getTravelerInsurance(tripId: string, travelerId: string | null) {
  const [row] = await db
    .select()
    .from(t.travelInsurances)
    .where(
      and(
        eq(t.travelInsurances.tripId, tripId),
        travelerId === null ? isNull(t.travelInsurances.travelerId) : eq(t.travelInsurances.travelerId, travelerId),
      ),
    )
    .limit(1);
  return row ?? null;
}
