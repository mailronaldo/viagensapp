import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import {
  ALLOWED_MIME,
  MAX_UPLOAD_BYTES,
  deleteStoredFile,
  saveFile,
} from "@/lib/storage";

export type DocType = (typeof t.documentType.enumValues)[number];

export function validateUpload(file: File) {
  if (file.size === 0) throw new Error("Arquivo vazio.");
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Arquivo maior que 10 MB.");
  }
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error("Formato não suportado. Use PDF, JPG, PNG, WEBP ou HEIC.");
  }
}

export async function addDocument(
  tripId: string,
  file: File,
  meta: { type: DocType; title?: string },
) {
  validateUpload(file);
  const storageKey = await saveFile(tripId, file);
  const [doc] = await db
    .insert(t.documents)
    .values({
      tripId,
      type: meta.type,
      title: meta.title?.trim() || file.name,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      storageKey,
    })
    .returning();
  return doc;
}

export async function listDocuments(tripId: string, type?: DocType) {
  return db
    .select()
    .from(t.documents)
    .where(
      type
        ? and(eq(t.documents.tripId, tripId), eq(t.documents.type, type))
        : eq(t.documents.tripId, tripId),
    )
    .orderBy(desc(t.documents.createdAt));
}

export async function getDocument(tripId: string, documentId: string) {
  const [doc] = await db
    .select()
    .from(t.documents)
    .where(and(eq(t.documents.id, documentId), eq(t.documents.tripId, tripId)))
    .limit(1);
  return doc ?? null;
}

export async function removeDocument(tripId: string, documentId: string) {
  const doc = await getDocument(tripId, documentId);
  if (!doc) return;
  await db.delete(t.documents).where(eq(t.documents.id, doc.id));
  await deleteStoredFile(doc.storageKey);
}
