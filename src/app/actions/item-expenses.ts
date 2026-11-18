"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { fail, parseDecimal, str } from "@/lib/form";
import { listClientCurrencyCodes } from "@/services/currencies";
import { deletePaymentsFor } from "@/services/payments";

function itemEditPath(tripId: string, itemId: string) {
  return `/trips/${tripId}/itinerary/items/${itemId}`;
}

async function ownItem(tripId: string, itemId: string) {
  const [row] = await db
    .select({ id: t.itineraryItems.id })
    .from(t.itineraryItems)
    .where(and(eq(t.itineraryItems.id, itemId), eq(t.itineraryItems.tripId, tripId)))
    .limit(1);
  return !!row;
}

/** Lançamento manual de custo avulso dentro de uma atividade (ex.: guia, aluguel de equipamento). */
export async function addItemExpenseAction(tripId: string, itemId: string, formData: FormData) {
  const { trip } = await requireTripAccess(tripId, { write: true });
  const back = itemEditPath(tripId, itemId);
  if (!(await ownItem(tripId, itemId))) redirect(`/trips/${tripId}/itinerary`);

  const description = str(formData, "description");
  if (!description) fail(back, "Informe uma descrição.");

  const currency = str(formData, "currency") ?? trip.baseCurrency;
  const validCurrencies = await listClientCurrencyCodes(trip.ownerId);
  if (!validCurrencies.includes(currency)) fail(back, "Moeda inválida.");

  const amount = parseDecimal(str(formData, "amount"), { positive: true });
  if (amount === null) fail(back, "Informe um valor válido maior que zero.");

  await db.insert(t.itemExpenses).values({
    itemId,
    tripId,
    description,
    amount,
    currency,
    // Sem status manual — vira "Pago" sozinho quando a soma dos pagamentos bater com o total.
    status: "A_PAGAR",
  });
  redirect(back);
}

export async function deleteItemExpenseAction(tripId: string, itemId: string, itemExpenseId: string) {
  await requireTripAccess(tripId, { write: true });
  await db.delete(t.itemExpenses).where(and(eq(t.itemExpenses.id, itemExpenseId), eq(t.itemExpenses.itemId, itemId)));
  await deletePaymentsFor("ITEM_EXPENSE", itemExpenseId);
  redirect(itemEditPath(tripId, itemId));
}
