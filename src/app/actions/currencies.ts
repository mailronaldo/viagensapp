"use server";

import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { db, t } from "@/db";
import { requireClient } from "@/lib/auth";
import { fail, str } from "@/lib/form";
import { BRL } from "@/services/currencies";

const ISO_CODE = /^[A-Z]{3}$/;

export async function addCurrencyAction(formData: FormData) {
  const user = await requireClient();
  const back = "/currencies";
  const code = str(formData, "code")?.toUpperCase() ?? null;
  if (!code || !ISO_CODE.test(code)) fail(back, "Informe um código de moeda válido (3 letras, ex.: USD).");
  if (code === BRL) fail(back, "BRL já é a moeda padrão do sistema — não precisa cadastrar.");
  const name = str(formData, "name");

  const [existing] = await db
    .select({ id: t.currencies.id })
    .from(t.currencies)
    .where(and(eq(t.currencies.clientId, user.id), eq(t.currencies.code, code!)))
    .limit(1);
  if (existing) fail(back, "Essa moeda já está cadastrada.");

  await db.insert(t.currencies).values({ clientId: user.id, code: code!, name });
  redirect(back);
}

/** Exclui a moeda do cadastro do cliente — só se ela não estiver em uso em nenhuma viagem dele. */
export async function deleteCurrencyAction(currencyId: string) {
  const user = await requireClient();
  const back = "/currencies";

  const [currency] = await db
    .select()
    .from(t.currencies)
    .where(and(eq(t.currencies.id, currencyId), eq(t.currencies.clientId, user.id)))
    .limit(1);
  if (!currency) redirect(back);

  const tripIds = (
    await db.select({ id: t.trips.id }).from(t.trips).where(eq(t.trips.ownerId, user.id))
  ).map((r) => r.id);

  if (tripIds.length > 0) {
    const code = currency!.code;
    const [inTrip, inExpense, inBooking, inLodging, inChip, inTicket, inPass, inItem] = await Promise.all([
      db.select({ id: t.trips.id }).from(t.trips).where(and(inArray(t.trips.id, tripIds), eq(t.trips.baseCurrency, code))).limit(1),
      db.select({ id: t.expenses.id }).from(t.expenses).where(and(inArray(t.expenses.tripId, tripIds), eq(t.expenses.currency, code))).limit(1),
      db
        .select({ id: t.transportVouchers.id })
        .from(t.transportVouchers)
        .innerJoin(t.bookings, eq(t.bookings.id, t.transportVouchers.bookingId))
        .where(and(inArray(t.bookings.tripId, tripIds), eq(t.transportVouchers.currency, code)))
        .limit(1),
      db
        .select({ id: t.lodgingVouchers.id })
        .from(t.lodgingVouchers)
        .innerJoin(t.lodgings, eq(t.lodgings.id, t.lodgingVouchers.lodgingId))
        .where(and(inArray(t.lodgings.tripId, tripIds), eq(t.lodgingVouchers.currency, code)))
        .limit(1),
      db.select({ id: t.chips.id }).from(t.chips).where(and(inArray(t.chips.tripId, tripIds), eq(t.chips.currency, code))).limit(1),
      db.select({ id: t.activityTickets.id }).from(t.activityTickets).where(and(inArray(t.activityTickets.tripId, tripIds), eq(t.activityTickets.currency, code))).limit(1),
      db.select({ id: t.passes.id }).from(t.passes).where(and(inArray(t.passes.tripId, tripIds), eq(t.passes.currency, code))).limit(1),
      db.select({ id: t.itineraryItems.id }).from(t.itineraryItems).where(and(inArray(t.itineraryItems.tripId, tripIds), eq(t.itineraryItems.reservationCurrency, code))).limit(1),
    ]);
    if (inTrip.length || inExpense.length || inBooking.length || inLodging.length || inChip.length || inTicket.length || inPass.length || inItem.length) {
      fail(back, "Essa moeda está em uso em alguma viagem sua. Troque a moeda nesses lançamentos antes de excluir do catálogo.");
    }
  }

  await db.delete(t.currencies).where(eq(t.currencies.id, currencyId));
  redirect(back);
}
