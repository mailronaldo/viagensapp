"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { ISO_DATE, fail, parseDecimal, str } from "@/lib/form";
import { isInTripGroup } from "@/services/trip-travelers";
import { addExpensePayment } from "@/services/expense-payments";

const PAYMENT_METHODS = ["PIX", "CREDITO", "DEBITO", "DINHEIRO"] as const;
const PAYMENT_FORMS = ["AVISTA", "PARCELADO"] as const;

async function ownExpense(tripId: string, expenseId: string) {
  const [row] = await db
    .select({ id: t.expenses.id })
    .from(t.expenses)
    .where(and(eq(t.expenses.id, expenseId), eq(t.expenses.tripId, tripId)))
    .limit(1);
  return row ?? null;
}

/** Lança um pagamento novo contra uma despesa — nunca edita/apaga um pagamento anterior. */
export async function addExpensePaymentAction(tripId: string, expenseId: string, formData: FormData) {
  const { trip } = await requireTripAccess(tripId, { write: true });
  const back = `/trips/${tripId}/expenses/${expenseId}`;
  const expense = await ownExpense(tripId, expenseId);
  if (!expense) redirect(`/trips/${tripId}/expenses`);

  const travelerRaw = str(formData, "payerTravelerId");
  const payerTravelerId = travelerRaw === "owner" ? null : travelerRaw;
  if (!(await isInTripGroup(trip, payerTravelerId))) fail(back, "Esse pagador não está nesta viagem.");

  const paymentDate = str(formData, "paymentDate");
  if (!paymentDate || !ISO_DATE.test(paymentDate)) fail(back, "Data de pagamento inválida.");

  const methodRaw = str(formData, "method");
  if (!methodRaw || !PAYMENT_METHODS.includes(methodRaw as (typeof PAYMENT_METHODS)[number])) fail(back, "Selecione o meio de pagamento.");
  const method = methodRaw as (typeof PAYMENT_METHODS)[number];

  const formRaw = str(formData, "form");
  const form = formRaw && PAYMENT_FORMS.includes(formRaw as (typeof PAYMENT_FORMS)[number]) ? (formRaw as (typeof PAYMENT_FORMS)[number]) : "AVISTA";

  const amount = parseDecimal(str(formData, "amount"), { positive: true });
  if (amount === null) fail(back, "Informe um valor válido maior que zero.");

  await addExpensePayment(expenseId, {
    payerTravelerId,
    paymentDate,
    method,
    form,
    installments: str(formData, "installments"),
    amount,
  });
  redirect(back);
}
