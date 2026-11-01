import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { getTripAccessFor } from "@/lib/access";
import { getDocument } from "@/services/documents";
import { readStoredFile } from "@/lib/storage";

// Download autenticado: só membros da viagem acessam o arquivo.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ tripId: string; documentId: string }> },
) {
  const { tripId, documentId } = await ctx.params;

  const userId = await getSessionUserId();
  if (!userId) return new NextResponse("Não autenticado", { status: 401 });

  const access = await getTripAccessFor(userId, tripId);
  if (!access) return new NextResponse("Não encontrado", { status: 404 });

  const doc = await getDocument(tripId, documentId);
  if (!doc) return new NextResponse("Não encontrado", { status: 404 });

  const data = await readStoredFile(doc.storageKey);
  const safeName = encodeURIComponent(doc.fileName);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Length": String(data.length),
      "Content-Disposition": `inline; filename*=UTF-8''${safeName}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
