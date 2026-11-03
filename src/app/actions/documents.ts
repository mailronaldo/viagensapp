"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { DOCUMENT_TYPE_LABEL } from "@/lib/labels";
import { fail, file, str } from "@/lib/form";
import { addDocument, removeDocument, type DocType } from "@/services/documents";

type Visibility = { visibility: "OWNER" | "GROUP" | "TRAVELER"; travelerId: string | null };

/**
 * "Quem pode ver": OWNER (só o dono), GROUP (todos os viajantes da viagem) ou
 * TRAVELER:<id> (um viajante que esteja no grupo desta viagem).
 */
async function parseVisibility(tripId: string, raw: string | null, back: string): Promise<Visibility> {
  if (!raw || raw === "OWNER") return { visibility: "OWNER", travelerId: null };
  if (raw === "GROUP") return { visibility: "GROUP", travelerId: null };
  if (raw.startsWith("TRAVELER:")) {
    const travelerId = raw.slice("TRAVELER:".length);
    const [link] = await db
      .select({ id: t.tripTravelers.travelerId })
      .from(t.tripTravelers)
      .where(and(eq(t.tripTravelers.tripId, tripId), eq(t.tripTravelers.travelerId, travelerId)))
      .limit(1);
    if (!link) fail(back, "Esse viajante não faz parte do grupo desta viagem.");
    return { visibility: "TRAVELER", travelerId };
  }
  fail(back, "Opção de visibilidade inválida.");
}

export async function uploadDocumentAction(tripId: string, formData: FormData) {
  await requireTripAccess(tripId, { write: true });
  const back = `/trips/${tripId}/documents`;

  const upload = file(formData, "file");
  if (!upload) fail(back, "Selecione um arquivo.");

  const type = str(formData, "type") ?? "OTHER";
  if (!(type in DOCUMENT_TYPE_LABEL)) fail(back, "Tipo de documento inválido.");
  const vis = await parseVisibility(tripId, str(formData, "visibility"), back);

  try {
    await addDocument(tripId, upload, {
      type: type as DocType,
      title: str(formData, "title") ?? undefined,
      ...vis,
    });
  } catch (e) {
    fail(back, e instanceof Error ? e.message : "Falha no upload.");
  }
  redirect(back);
}

export async function setDocumentVisibilityAction(tripId: string, documentId: string, formData: FormData) {
  await requireTripAccess(tripId, { write: true });
  const back = `/trips/${tripId}/documents`;
  const vis = await parseVisibility(tripId, str(formData, "visibility"), back);
  await db
    .update(t.documents)
    .set(vis)
    .where(and(eq(t.documents.id, documentId), eq(t.documents.tripId, tripId)));
  redirect(back);
}

export async function deleteDocumentAction(tripId: string, documentId: string) {
  await requireTripAccess(tripId, { write: true });
  await removeDocument(tripId, documentId);
  redirect(`/trips/${tripId}/documents`);
}
