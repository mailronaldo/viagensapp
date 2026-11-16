"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { parseErrandEntry } from "@/lib/errands-form";
import { addErrandEntry } from "@/services/errands";

async function ownErrand(tripId: string, errandId: string) {
  const [row] = await db
    .select({ id: t.errands.id })
    .from(t.errands)
    .where(and(eq(t.errands.id, errandId), eq(t.errands.tripId, tripId)))
    .limit(1);
  return row ?? null;
}

/** Lança uma nova atualização de valor/status pra uma encomenda, sem alterar os lançamentos anteriores. */
export async function addErrandEntryAction(tripId: string, errandId: string, formData: FormData) {
  await requireTripAccess(tripId, { write: true });
  const back = `/trips/${tripId}/errands/${errandId}`;
  const errand = await ownErrand(tripId, errandId);
  if (!errand) redirect(`/trips/${tripId}/errands`);

  const entry = parseErrandEntry(formData, back);
  await addErrandEntry(errandId, entry);
  redirect(back);
}

/**
 * Exclui um lançamento feito por engano (ex.: erro de digitação). Só o
 * dono da viagem pode — viajantes com acesso de edição (FULL) não têm essa
 * permissão, por segurança (histórico é pra inibir fraude, não pra ser
 * apagado por qualquer editor).
 */
export async function deleteErrandEntryAction(tripId: string, errandId: string, entryId: string) {
  const { role } = await requireTripAccess(tripId, { write: true });
  const back = `/trips/${tripId}/errands/${errandId}`;
  if (role !== "OWNER") throw new Error("Só o dono da viagem pode excluir um lançamento do histórico.");

  const errand = await ownErrand(tripId, errandId);
  if (!errand) redirect(`/trips/${tripId}/errands`);

  await db.delete(t.errandEntries).where(and(eq(t.errandEntries.id, entryId), eq(t.errandEntries.errandId, errandId)));
  redirect(back);
}
