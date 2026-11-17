import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, t } from "@/db";
import { listTripTravelerOptions, type TripTravelerOption } from "./trip-travelers";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type PaymentSourceType =
  | "EXPENSE"
  | "ITEM_COST"
  | "ITEM_RESERVATION"
  | "ACTIVITY_TICKET"
  | "PASS"
  | "TRANSPORT_VOUCHER"
  | "LODGING_VOUCHER"
  | "TRAVEL_INSURANCE";

export type NewPayment = {
  payerTravelerId: string | null;
  paymentDate: string;
  method: "PIX" | "CREDITO" | "DEBITO" | "DINHEIRO" | "OUTRO";
  form: "AVISTA" | "PARCELADO";
  installments: string | null;
  amount: string;
};

type SourceInfo = { tripId: string; amount: string | null; currency: string };

async function baseCurrencyOf(tx: Tx | typeof db, tripId: string): Promise<string> {
  const [row] = await tx.select({ baseCurrency: t.trips.baseCurrency }).from(t.trips).where(eq(t.trips.id, tripId)).limit(1);
  return row!.baseCurrency;
}

/** Busca a origem do pagamento (pra moeda/tripId/valor do total) conforme `sourceType`. */
async function getSource(tx: Tx | typeof db, sourceType: PaymentSourceType, sourceId: string): Promise<SourceInfo | null> {
  switch (sourceType) {
    case "EXPENSE": {
      const [row] = await tx.select().from(t.expenses).where(eq(t.expenses.id, sourceId)).limit(1);
      if (!row) return null;
      return { tripId: row.tripId, amount: row.amount, currency: row.currency };
    }
    case "ITEM_COST": {
      const [row] = await tx.select().from(t.itineraryItems).where(eq(t.itineraryItems.id, sourceId)).limit(1);
      if (!row) return null;
      return { tripId: row.tripId, amount: row.costEstimate, currency: await baseCurrencyOf(tx, row.tripId) };
    }
    case "ITEM_RESERVATION": {
      const [row] = await tx.select().from(t.itineraryItems).where(eq(t.itineraryItems.id, sourceId)).limit(1);
      if (!row) return null;
      return { tripId: row.tripId, amount: row.reservationPrice, currency: row.reservationCurrency ?? (await baseCurrencyOf(tx, row.tripId)) };
    }
    case "ACTIVITY_TICKET": {
      const [row] = await tx.select().from(t.activityTickets).where(eq(t.activityTickets.id, sourceId)).limit(1);
      if (!row) return null;
      return { tripId: row.tripId, amount: row.price, currency: row.currency ?? (await baseCurrencyOf(tx, row.tripId)) };
    }
    case "PASS": {
      const [row] = await tx.select().from(t.passes).where(eq(t.passes.id, sourceId)).limit(1);
      if (!row) return null;
      return { tripId: row.tripId, amount: row.price, currency: row.currency ?? (await baseCurrencyOf(tx, row.tripId)) };
    }
    case "TRANSPORT_VOUCHER": {
      const [row] = await tx
        .select({ v: t.transportVouchers, tripId: t.bookings.tripId })
        .from(t.transportVouchers)
        .innerJoin(t.bookings, eq(t.bookings.id, t.transportVouchers.bookingId))
        .where(eq(t.transportVouchers.id, sourceId))
        .limit(1);
      if (!row) return null;
      return { tripId: row.tripId, amount: row.v.price, currency: row.v.currency ?? (await baseCurrencyOf(tx, row.tripId)) };
    }
    case "LODGING_VOUCHER": {
      const [row] = await tx
        .select({ v: t.lodgingVouchers, tripId: t.lodgings.tripId })
        .from(t.lodgingVouchers)
        .innerJoin(t.lodgings, eq(t.lodgings.id, t.lodgingVouchers.lodgingId))
        .where(eq(t.lodgingVouchers.id, sourceId))
        .limit(1);
      if (!row) return null;
      return { tripId: row.tripId, amount: row.v.price, currency: row.v.currency ?? (await baseCurrencyOf(tx, row.tripId)) };
    }
    case "TRAVEL_INSURANCE": {
      const [row] = await tx.select().from(t.travelInsurances).where(eq(t.travelInsurances.id, sourceId)).limit(1);
      if (!row) return null;
      return { tripId: row.tripId, amount: row.price, currency: row.currency ?? (await baseCurrencyOf(tx, row.tripId)) };
    }
  }
}

async function setSourceStatus(tx: Tx | typeof db, sourceType: PaymentSourceType, sourceId: string, status: "A_PAGAR" | "PAGO") {
  switch (sourceType) {
    case "EXPENSE":
      return void (await tx.update(t.expenses).set({ status }).where(eq(t.expenses.id, sourceId)));
    case "ITEM_COST":
      return void (await tx.update(t.itineraryItems).set({ costStatus: status }).where(eq(t.itineraryItems.id, sourceId)));
    case "ITEM_RESERVATION":
      return void (await tx.update(t.itineraryItems).set({ reservationStatus: status }).where(eq(t.itineraryItems.id, sourceId)));
    case "ACTIVITY_TICKET":
      return void (await tx.update(t.activityTickets).set({ status }).where(eq(t.activityTickets.id, sourceId)));
    case "PASS":
      return void (await tx.update(t.passes).set({ status }).where(eq(t.passes.id, sourceId)));
    case "TRANSPORT_VOUCHER":
      return void (await tx.update(t.transportVouchers).set({ status }).where(eq(t.transportVouchers.id, sourceId)));
    case "LODGING_VOUCHER":
      return void (await tx.update(t.lodgingVouchers).set({ status }).where(eq(t.lodgingVouchers.id, sourceId)));
    case "TRAVEL_INSURANCE":
      return void (await tx.update(t.travelInsurances).set({ status }).where(eq(t.travelInsurances.id, sourceId)));
  }
}

/** Confere que uma origem pertence à viagem informada, antes de lançar um pagamento nela. */
export async function sourceBelongsToTrip(sourceType: PaymentSourceType, sourceId: string, tripId: string): Promise<boolean> {
  const source = await getSource(db, sourceType, sourceId);
  return source !== null && source.tripId === tripId;
}

/** Recalcula o status da origem a partir da soma dos pagamentos já lançados (nunca escolhido à mão). */
export async function recomputeStatus(sourceType: PaymentSourceType, sourceId: string, tx: Tx | typeof db = db) {
  const source = await getSource(tx, sourceType, sourceId);
  if (!source || source.amount === null) return;
  const rows = await tx
    .select({ amount: t.payments.amount })
    .from(t.payments)
    .where(and(eq(t.payments.sourceType, sourceType), eq(t.payments.sourceId, sourceId)));
  const paid = rows.reduce((sum, p) => sum + Number(p.amount), 0);
  await setSourceStatus(tx, sourceType, sourceId, paid >= Number(source.amount) ? "PAGO" : "A_PAGAR");
}

/** Pagamento novo contra uma origem — a moeda é sempre a da origem, nunca a do formulário. */
export async function addPayment(sourceType: PaymentSourceType, sourceId: string, input: NewPayment) {
  return db.transaction(async (tx) => {
    const source = await getSource(tx, sourceType, sourceId);
    if (!source) throw new Error("Registro de origem não encontrado.");
    const [row] = await tx
      .insert(t.payments)
      .values({ tripId: source.tripId, sourceType, sourceId, ...input, currency: source.currency })
      .returning();
    await recomputeStatus(sourceType, sourceId, tx);
    return row;
  });
}

export async function listPayments(sourceType: PaymentSourceType, sourceId: string) {
  return db
    .select()
    .from(t.payments)
    .where(and(eq(t.payments.sourceType, sourceType), eq(t.payments.sourceId, sourceId)))
    .orderBy(desc(t.payments.createdAt));
}

/**
 * Limpa os pagamentos de uma origem (ou várias) antes/depois de apagá-la —
 * não tem FK/cascade do banco pro `sourceId` (é polimórfico), então toda
 * ação que apaga um registro de origem, ou que apaga em cascata registros
 * filhos (ex.: apagar uma atividade apaga os ingressos dela), precisa
 * chamar isso explicitamente pra não deixar pagamento órfão.
 */
export async function deletePaymentsFor(sourceType: PaymentSourceType, sourceId: string | string[], tx: Tx | typeof db = db) {
  const ids = Array.isArray(sourceId) ? sourceId : [sourceId];
  if (ids.length === 0) return;
  await tx.delete(t.payments).where(and(eq(t.payments.sourceType, sourceType), inArray(t.payments.sourceId, ids)));
}

/** Pra cada sourceId, os ids distintos de quem pagou (null = dono da viagem) — alimenta filtros por pagador. */
export async function payerIdsBySource(sourceType: PaymentSourceType, sourceIds: string[]): Promise<Map<string, (string | null)[]>> {
  if (sourceIds.length === 0) return new Map();
  const rows = await db
    .select({ sourceId: t.payments.sourceId, payerTravelerId: t.payments.payerTravelerId })
    .from(t.payments)
    .where(and(eq(t.payments.sourceType, sourceType), inArray(t.payments.sourceId, sourceIds)));
  const byId = new Map<string, Set<string | null>>();
  for (const row of rows) {
    const set = byId.get(row.sourceId) ?? new Set<string | null>();
    set.add(row.payerTravelerId);
    byId.set(row.sourceId, set);
  }
  return new Map([...byId.entries()].map(([id, set]) => [id, [...set]]));
}

export type PaymentPayerSummary = { payer: TripTravelerOption; byCurrency: { currency: string; total: number }[] };

/** Quanto cada viajante pagou na viagem, somando TODOS os módulos de custo. */
export async function getTripPaymentSummaryByPayer(trip: { id: string; ownerId: string; ownerIsTraveler: boolean }): Promise<PaymentPayerSummary[]> {
  const rows = await db
    .select({ payerTravelerId: t.payments.payerTravelerId, currency: t.payments.currency, amount: t.payments.amount })
    .from(t.payments)
    .where(eq(t.payments.tripId, trip.id));

  const byPayer = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const key = row.payerTravelerId ?? "owner";
    const byCurrency = byPayer.get(key) ?? new Map<string, number>();
    byCurrency.set(row.currency, (byCurrency.get(row.currency) ?? 0) + Number(row.amount));
    byPayer.set(key, byCurrency);
  }
  if (byPayer.size === 0) return [];

  const options = await listTripTravelerOptions(trip);
  const nameOf = new Map(options.map((o) => [o.id ?? "owner", o]));
  return [...byPayer.entries()]
    .map(([key, byCurrency]) => ({
      payer: nameOf.get(key) ?? { id: key === "owner" ? null : key, name: "Viajante removido" },
      byCurrency: [...byCurrency.entries()].map(([currency, total]) => ({ currency, total })),
    }))
    .sort((a, b) => a.payer.name.localeCompare(b.payer.name));
}
