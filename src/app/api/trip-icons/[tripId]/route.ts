import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { getTripAccessFor } from "@/lib/access";
import { getTravelerIdFor } from "@/lib/traveler-access";
import { readStoredFile } from "@/lib/storage";

// Ícone da viagem: qualquer um que já enxerga a viagem (membro ou viajante do
// grupo) pode ver — é só um ícone decorativo, sem conteúdo sensível.
export async function GET(_req: Request, ctx: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await ctx.params;

  const user = await getCurrentUser();
  if (!user) return new NextResponse("Não autenticado", { status: 401 });

  const access = await getTripAccessFor(user.id, tripId);
  if (!access) {
    const travelerId = user.role === "TRAVELER" ? await getTravelerIdFor(user.id, tripId) : null;
    if (!travelerId) return new NextResponse("Não encontrado", { status: 404 });
  }

  const [trip] = await db
    .select({ iconKey: t.trips.iconKey, iconMimeType: t.trips.iconMimeType })
    .from(t.trips)
    .where(eq(t.trips.id, tripId))
    .limit(1);
  if (!trip?.iconKey) return new NextResponse("Não encontrado", { status: 404 });

  let data: Buffer;
  try {
    data = await readStoredFile(trip.iconKey);
  } catch {
    return new NextResponse("Não encontrado", { status: 404 });
  }

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": trip.iconMimeType ?? "application/octet-stream",
      "Content-Length": String(data.length),
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
