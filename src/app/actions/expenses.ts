"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { CURRENCIES, EXPENSE_CATEGORY_LABEL } from "@/lib/labels";
import { ISO_DATE, fail, file, parseDecimal, parseRate, str } from "@/lib/form";
import { addDocument } from "@/services/documents";
import { addExpense } from "@/services/expenses";

export async function addExpenseAction(tripId: string, formData: FormData) {
  const { user, trip } = await requireTripAccess(tripId, { write: true });
  const back = `/trips/${tripId}/expenses`;

  const date = str(formData, "date");
  const description = str(formData, "description");
  const category = str(formData, "category") ?? "OTHER";
  const currency = str(formData, "currency") ?? trip.baseCurrency;

  if (!description) fail(back, "Informe uma descrição.");
  if (!date || !ISO_DATE.test(date)) fail(back, "Data inválida.");
  if (!(category in EXPENSE_CATEGORY_LABEL)) fail(back, "Categoria inválida.");
  if (!(CURRENCIES as readonly string[]).includes(currency)) fail(back, "Moeda inválida.");

  const amount = parseDecimal(str(formData, "amount"), { positive: true });
  if (amount === null) fail(back, "Informe um valor válido maior que zero.");

  const rateRaw = str(formData, "exchangeRate");
  const exchangeRate = parseRate(rateRaw);
  if (rateRaw && exchangeRate === null) fail(back, "Cotação inválida.");

  let receiptDocumentId: string | null = null;
  const receipt = file(formData, "receipt");
  if (receipt) {
    try {
      const doc = await addDocument(tripId, receipt, {
        type: "RECEIPT",
        title: `Recibo — ${description}`,
      });
      receiptDocumentId = doc.id;
    } catch (e) {
      fail(back, e instanceof Error ? e.message : "Falha no upload do recibo.");
    }
  }

  await addExpense(tripId, user.id, {
    date,
    category: category as keyof typeof EXPENSE_CATEGORY_LABEL,
    description,
    amount,
    currency,
    exchangeRate: currency === trip.baseCurrency ? null : exchangeRate,
    paymentMethod: str(formData, "paymentMethod"),
    receiptDocumentId,
  });

  redirect(back);
}

export async function deleteExpenseAction(tripId: string, expenseId: string) {
  await requireTripAccess(tripId, { write: true });
  await db
    .delete(t.expenses)
    .where(and(eq(t.expenses.id, expenseId), eq(t.expenses.tripId, tripId)));
  redirect(`/trips/${tripId}/expenses`);
}
