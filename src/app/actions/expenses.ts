"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { attachmentFromForm } from "@/lib/attachment";
import { ISO_DATE, fail, parseDecimal, parseRate, parseStatus, str } from "@/lib/form";
import { addExpense } from "@/services/expenses";
import { listClientCurrencyCodes } from "@/services/currencies";

async function parseExpense(
  trip: { baseCurrency: string; ownerId: string },
  formData: FormData,
  back: string,
) {
  const date = str(formData, "date");
  const description = str(formData, "description");
  const category = str(formData, "category") ?? "OTHER";
  const currency = str(formData, "currency") ?? trip.baseCurrency;

  if (!description) fail(back, "Informe uma descrição.");
  if (!date || !ISO_DATE.test(date)) fail(back, "Data inválida.");
  const [cat] = await db.select({ id: t.expenseCategories.id }).from(t.expenseCategories).where(eq(t.expenseCategories.id, category)).limit(1);
  if (!cat) fail(back, "Categoria inválida.");
  const validCurrencies = await listClientCurrencyCodes(trip.ownerId);
  if (!validCurrencies.includes(currency)) fail(back, "Moeda inválida.");

  const amount = parseDecimal(str(formData, "amount"), { positive: true });
  if (amount === null) fail(back, "Informe um valor válido maior que zero.");

  const rateRaw = str(formData, "exchangeRate");
  const exchangeRate = parseRate(rateRaw);
  if (rateRaw && exchangeRate === null) fail(back, "Cotação inválida.");

  return {
    date,
    category,
    status: parseStatus(str(formData, "status")),
    description,
    amount,
    currency,
    exchangeRate: currency === trip.baseCurrency ? null : exchangeRate,
    paymentMethod: str(formData, "paymentMethod"),
  };
}

export async function addExpenseAction(tripId: string, formData: FormData) {
  const { user, trip } = await requireTripAccess(tripId, { write: true });
  const back = `/trips/${tripId}/expenses`;
  const v = await parseExpense(trip, formData, back);

  const receiptDocumentId = await attachmentFromForm({
    tripId,
    formData,
    fileField: "receipt",
    doc: { type: "RECEIPT", title: `Recibo — ${v.description}` },
    back,
    current: null,
  });

  await addExpense(tripId, user.id, { ...v, receiptDocumentId });
  redirect(back);
}

export async function updateExpenseAction(tripId: string, expenseId: string, formData: FormData) {
  const { trip } = await requireTripAccess(tripId, { write: true });
  const back = `/trips/${tripId}/expenses/${expenseId}`;

  const [current] = await db
    .select()
    .from(t.expenses)
    .where(and(eq(t.expenses.id, expenseId), eq(t.expenses.tripId, tripId)))
    .limit(1);
  if (!current) redirect(`/trips/${tripId}/expenses`);

  const v = await parseExpense(trip, formData, back);
  const receiptDocumentId = await attachmentFromForm({
    tripId,
    formData,
    fileField: "receipt",
    removeField: "removeReceipt",
    doc: { type: "RECEIPT", title: `Recibo — ${v.description}` },
    back,
    current: current.receiptDocumentId,
  });

  // paidById e source (origem do lançamento) permanecem como foram criados.
  await db
    .update(t.expenses)
    .set({ ...v, receiptDocumentId })
    .where(and(eq(t.expenses.id, expenseId), eq(t.expenses.tripId, tripId)));
  redirect(`/trips/${tripId}/expenses`);
}

export async function deleteExpenseAction(tripId: string, expenseId: string) {
  await requireTripAccess(tripId, { write: true });
  await db
    .delete(t.expenses)
    .where(and(eq(t.expenses.id, expenseId), eq(t.expenses.tripId, tripId)));
  redirect(`/trips/${tripId}/expenses`);
}
