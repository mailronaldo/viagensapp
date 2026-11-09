"use server";

import { redirect } from "next/navigation";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { attachmentFromForm } from "@/lib/attachment";
import { ISO_DATE, fail, parseDecimal, parseStatus, str } from "@/lib/form";
import { listClientCurrencyCodes } from "@/services/currencies";
import { getInsuranceCategoryId } from "@/services/catalogs";

async function requireLinkedTraveler(tripId: string, travelerId: string) {
  const [link] = await db
    .select({ travelerId: t.tripTravelers.travelerId })
    .from(t.tripTravelers)
    .where(and(eq(t.tripTravelers.tripId, tripId), eq(t.tripTravelers.travelerId, travelerId)))
    .limit(1);
  if (!link) redirect(`/trips/${tripId}/travelers`);
}

async function parseInsurance(ownerId: string, formData: FormData, back: string) {
  const startDate = str(formData, "startDate");
  const endDate = str(formData, "endDate");
  const coverageCurrency = str(formData, "coverageCurrency");
  const currency = str(formData, "currency");

  if (startDate && !ISO_DATE.test(startDate)) fail(back, "Data de início inválida.");
  if (endDate && !ISO_DATE.test(endDate)) fail(back, "Data de término inválida.");
  if (startDate && endDate && endDate < startDate) fail(back, "A data de término não pode ser antes do início.");

  const validCurrencies = coverageCurrency || currency ? await listClientCurrencyCodes(ownerId) : null;
  if (coverageCurrency && !validCurrencies!.includes(coverageCurrency)) fail(back, "Moeda de cobertura inválida.");
  if (currency && !validCurrencies!.includes(currency)) fail(back, "Moeda do valor inválida.");

  const coverageRaw = str(formData, "coverageAmount");
  const coverageAmount = parseDecimal(coverageRaw, { positive: true });
  if (coverageRaw && coverageAmount === null) fail(back, "Valor de cobertura inválido.");

  const priceRaw = str(formData, "price");
  const price = parseDecimal(priceRaw, { positive: true });
  if (priceRaw && price === null) fail(back, "Valor inválido.");

  return {
    provider: str(formData, "provider"),
    policyNumber: str(formData, "policyNumber"),
    coverageAmount,
    coverageCurrency: coverageAmount ? (coverageCurrency ?? "BRL") : null,
    startDate,
    endDate,
    price,
    currency: price ? (currency ?? "BRL") : null,
    status: parseStatus(str(formData, "status")),
    category: await getInsuranceCategoryId(),
    notes: str(formData, "notes"),
  };
}

export async function upsertInsuranceAction(tripId: string, travelerId: string, formData: FormData) {
  const { trip } = await requireTripAccess(tripId, { write: true });
  await requireLinkedTraveler(tripId, travelerId);
  const back = `/trips/${tripId}/travelers/${travelerId}`;

  const [current] = await db
    .select()
    .from(t.travelInsurances)
    .where(and(eq(t.travelInsurances.tripId, tripId), eq(t.travelInsurances.travelerId, travelerId)))
    .limit(1);

  const v = await parseInsurance(trip.ownerId, formData, back);
  const policyDocumentId = await attachmentFromForm({
    tripId,
    formData,
    fileField: "policy",
    removeField: "removePolicy",
    doc: { type: "RECEIPT", title: `Apólice de seguro — ${v.provider ?? "sem fornecedor"}` },
    back,
    current: current?.policyDocumentId ?? null,
  });

  await db
    .insert(t.travelInsurances)
    .values({ tripId, travelerId, ...v, policyDocumentId })
    .onConflictDoUpdate({
      target: [t.travelInsurances.tripId, t.travelInsurances.travelerId],
      targetWhere: sql`${t.travelInsurances.travelerId} IS NOT NULL`,
      set: { ...v, policyDocumentId },
    });
  redirect(`${back}?saved=seguro`);
}

export async function deleteInsuranceAction(tripId: string, travelerId: string) {
  await requireTripAccess(tripId, { write: true });
  await db
    .delete(t.travelInsurances)
    .where(and(eq(t.travelInsurances.tripId, tripId), eq(t.travelInsurances.travelerId, travelerId)));
  redirect(`/trips/${tripId}/travelers/${travelerId}`);
}

// ---------- Seguro do próprio cliente (dono da viagem), quando ele também viaja ----------

export async function upsertOwnerInsuranceAction(tripId: string, formData: FormData) {
  const { trip } = await requireTripAccess(tripId, { write: true });
  const back = `/trips/${tripId}/travelers/owner`;
  if (!trip.ownerIsTraveler) redirect(`/trips/${tripId}/travelers`);

  const [current] = await db
    .select()
    .from(t.travelInsurances)
    .where(and(eq(t.travelInsurances.tripId, tripId), isNull(t.travelInsurances.travelerId)))
    .limit(1);

  const v = await parseInsurance(trip.ownerId, formData, back);
  const policyDocumentId = await attachmentFromForm({
    tripId,
    formData,
    fileField: "policy",
    removeField: "removePolicy",
    doc: { type: "RECEIPT", title: `Apólice de seguro — ${v.provider ?? "sem fornecedor"}` },
    back,
    current: current?.policyDocumentId ?? null,
  });

  await db
    .insert(t.travelInsurances)
    .values({ tripId, travelerId: null, ...v, policyDocumentId })
    .onConflictDoUpdate({
      target: [t.travelInsurances.tripId],
      targetWhere: sql`${t.travelInsurances.travelerId} IS NULL`,
      set: { ...v, policyDocumentId },
    });
  redirect(`${back}?saved=seguro`);
}

export async function deleteOwnerInsuranceAction(tripId: string) {
  await requireTripAccess(tripId, { write: true });
  await db.delete(t.travelInsurances).where(and(eq(t.travelInsurances.tripId, tripId), isNull(t.travelInsurances.travelerId)));
  redirect(`/trips/${tripId}/travelers/owner`);
}
