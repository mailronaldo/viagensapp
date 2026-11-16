"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { files } from "@/lib/form";
import { addErrandPhoto } from "@/services/errands";
import { removeDocument } from "@/services/documents";

async function ownErrand(tripId: string, errandId: string) {
  const [row] = await db
    .select({ id: t.errands.id })
    .from(t.errands)
    .where(and(eq(t.errands.id, errandId), eq(t.errands.tripId, tripId)))
    .limit(1);
  return row ?? null;
}

export async function addErrandPhotosAction(tripId: string, errandId: string, formData: FormData) {
  await requireTripAccess(tripId, { write: true });
  const back = `/trips/${tripId}/errands/${errandId}`;
  const errand = await ownErrand(tripId, errandId);
  if (!errand) redirect(`/trips/${tripId}/errands`);

  for (const photo of files(formData, "photos")) {
    await addErrandPhoto(tripId, errandId, photo);
  }
  redirect(back);
}

/** Sem restrição a OWNER — foto não é histórico sensível como valor/status, qualquer um com acesso de escrita gerencia. */
export async function deleteErrandPhotoAction(tripId: string, errandId: string, documentId: string) {
  await requireTripAccess(tripId, { write: true });
  const back = `/trips/${tripId}/errands/${errandId}`;

  const [link] = await db
    .select({ documentId: t.errandPhotos.documentId })
    .from(t.errandPhotos)
    .where(and(eq(t.errandPhotos.documentId, documentId), eq(t.errandPhotos.errandId, errandId)))
    .limit(1);
  if (link) await removeDocument(tripId, link.documentId);
  redirect(back);
}
