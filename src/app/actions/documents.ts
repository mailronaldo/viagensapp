"use server";

import { redirect } from "next/navigation";
import { requireTripAccess } from "@/lib/access";
import { DOCUMENT_TYPE_LABEL } from "@/lib/labels";
import { fail, file, str } from "@/lib/form";
import { addDocument, removeDocument, type DocType } from "@/services/documents";

export async function uploadDocumentAction(tripId: string, formData: FormData) {
  await requireTripAccess(tripId, { write: true });
  const back = `/trips/${tripId}/documents`;

  const upload = file(formData, "file");
  if (!upload) fail(back, "Selecione um arquivo.");

  const type = str(formData, "type") ?? "OTHER";
  if (!(type in DOCUMENT_TYPE_LABEL)) fail(back, "Tipo de documento inválido.");

  try {
    await addDocument(tripId, upload, {
      type: type as DocType,
      title: str(formData, "title") ?? undefined,
    });
  } catch (e) {
    fail(back, e instanceof Error ? e.message : "Falha no upload.");
  }
  redirect(back);
}

export async function deleteDocumentAction(tripId: string, documentId: string) {
  await requireTripAccess(tripId, { write: true });
  await removeDocument(tripId, documentId);
  redirect(`/trips/${tripId}/documents`);
}
