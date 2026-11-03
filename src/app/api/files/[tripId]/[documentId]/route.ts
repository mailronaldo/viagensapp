import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getTripAccessFor } from "@/lib/access";
import { getDocument } from "@/services/documents";
import { readStoredFile } from "@/lib/storage";

// Download autenticado: só membros da viagem acessam o arquivo. A agência, ao acessar a
// área de um cliente, é tratada como o próprio cliente (usuário efetivo).
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ tripId: string; documentId: string }> },
) {
  const { tripId, documentId } = await ctx.params;

  const user = await getCurrentUser();
  if (!user) return new NextResponse("Não autenticado", { status: 401 });

  const access = await getTripAccessFor(user.id, tripId);
  if (!access) return new NextResponse("Não encontrado", { status: 404 });

  const doc = await getDocument(tripId, documentId);
  if (!doc) return new NextResponse("Não encontrado", { status: 404 });

  let data: Buffer;
  try {
    data = await readStoredFile(doc.storageKey);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      // O registro existe no banco, mas o arquivo sumiu do disco (ex.: volume não persistente).
      console.error(
        `[files] arquivo ausente no storage: documento=${doc.id} chave=${doc.storageKey}. ` +
          "Verifique se /data/uploads é um volume persistente.",
      );
      return new NextResponse(
        "O arquivo não foi encontrado no armazenamento do servidor. Envie o documento novamente.",
        { status: 404 },
      );
    }
    throw err;
  }

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
