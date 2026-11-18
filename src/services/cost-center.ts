import "server-only";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { BRL, getLatestRates } from "@/services/currencies";
import { payerIdsBySource, type PaymentSourceType } from "@/services/payments";

export type CostSource =
  | "expense"
  | "transport"
  | "lodging"
  | "chip"
  | "ticket"
  | "pass"
  | "insurance"
  | "activity_cost"
  | "activity_reservation";

export type CostEntry = {
  id: string;
  source: CostSource;
  title: string;
  category: string | null;
  status: "ESTIMADO" | "A_PAGAR" | "PAGO";
  amount: string | null;
  currency: string | null;
  /** "Grupo", nome do viajante, ou "Dono da viagem" — pode listar mais de um (voucher de hospedagem compartilhado). */
  travelerLabel: string;
  /** ids dos viajantes cobertos (vazio = grupo/todos); usado pro filtro "por viajante". */
  travelerIds: (string | null)[];
  /** ids distintos de quem pagou (via pagamentos já lançados); usado pro filtro "por pagador". */
  payerIds: (string | null)[];
  createdAt: string;
  editHref: string;
};

/** De qual `sourceType` de `payments` cada origem da Central de Custos lê os pagamentos. */
const PAYMENT_SOURCE_BY_COST_SOURCE: Record<CostSource, PaymentSourceType> = {
  expense: "EXPENSE",
  transport: "TRANSPORT_VOUCHER",
  lodging: "LODGING_VOUCHER",
  chip: "CHIP",
  ticket: "ACTIVITY_TICKET",
  pass: "PASS",
  insurance: "TRAVEL_INSURANCE",
  activity_cost: "ITEM_EXPENSE",
  activity_reservation: "ITEM_RESERVATION",
};

export const SOURCE_LABEL: Record<CostSource, string> = {
  expense: "Custo avulso",
  transport: "Transporte",
  lodging: "Hospedagem",
  chip: "Internet / chip",
  ticket: "Ingresso",
  pass: "Passe",
  insurance: "Seguro viagem",
  activity_cost: "Atividade (custo avulso)",
  activity_reservation: "Atividade (reserva)",
};

/** Todo lançamento de valor da viagem, de todas as origens, num formato único. */
export async function listCostEntries(tripId: string): Promise<CostEntry[]> {
  const [owner, travelers, expenses, bookings, transportVouchers, lodgings, lodgingVouchers, lodgingVoucherTravelers, chips, tickets, passes, insurances, items, itemExpenseRows] =
    await Promise.all([
      db
        .select({ id: t.trips.ownerId, name: t.users.name })
        .from(t.trips)
        .innerJoin(t.users, eq(t.users.id, t.trips.ownerId))
        .where(eq(t.trips.id, tripId))
        .limit(1)
        .then(([o]) => o),
      db
        .select({ id: t.travelers.id, name: t.travelers.name })
        .from(t.tripTravelers)
        .innerJoin(t.travelers, eq(t.travelers.id, t.tripTravelers.travelerId))
        .where(eq(t.tripTravelers.tripId, tripId)),
      db.select().from(t.expenses).where(eq(t.expenses.tripId, tripId)),
      db.select().from(t.bookings).where(eq(t.bookings.tripId, tripId)),
      db
        .select({ voucher: t.transportVouchers })
        .from(t.transportVouchers)
        .innerJoin(t.bookings, eq(t.bookings.id, t.transportVouchers.bookingId))
        .where(eq(t.bookings.tripId, tripId)),
      db.select().from(t.lodgings).where(eq(t.lodgings.tripId, tripId)),
      db
        .select({ voucher: t.lodgingVouchers })
        .from(t.lodgingVouchers)
        .innerJoin(t.lodgings, eq(t.lodgings.id, t.lodgingVouchers.lodgingId))
        .where(eq(t.lodgings.tripId, tripId)),
      db
        .select({ voucherId: t.lodgingVoucherTravelers.voucherId, travelerId: t.lodgingVoucherTravelers.travelerId })
        .from(t.lodgingVoucherTravelers)
        .innerJoin(t.lodgingVouchers, eq(t.lodgingVouchers.id, t.lodgingVoucherTravelers.voucherId))
        .innerJoin(t.lodgings, eq(t.lodgings.id, t.lodgingVouchers.lodgingId))
        .where(eq(t.lodgings.tripId, tripId)),
      db.select().from(t.chips).where(eq(t.chips.tripId, tripId)),
      db.select().from(t.activityTickets).where(eq(t.activityTickets.tripId, tripId)),
      db
        .select({ pass: t.passes })
        .from(t.passes)
        .where(eq(t.passes.tripId, tripId)),
      db.select().from(t.travelInsurances).where(eq(t.travelInsurances.tripId, tripId)),
      db.select().from(t.itineraryItems).where(eq(t.itineraryItems.tripId, tripId)),
      db.select().from(t.itemExpenses).where(eq(t.itemExpenses.tripId, tripId)),
    ]);

  const travelerName = new Map(travelers.map((tr) => [tr.id, tr.name]));
  const ownerLabel = `${owner?.name ?? "Dono"} (dono da viagem)`;
  const bookingById = new Map(bookings.map((b) => [b.id, b]));
  const lodgingById = new Map(lodgings.map((l) => [l.id, l]));
  const travelersByVoucher = new Map<string, (string | null)[]>();
  for (const row of lodgingVoucherTravelers) {
    const list = travelersByVoucher.get(row.voucherId) ?? [];
    list.push(row.travelerId);
    travelersByVoucher.set(row.voucherId, list);
  }

  function nameOrOwner(travelerId: string | null) {
    return travelerId === null ? ownerLabel : (travelerName.get(travelerId) ?? "Viajante removido");
  }

  const entries: CostEntry[] = [];

  for (const e of expenses) {
    entries.push({
      id: e.id,
      source: "expense",
      title: e.description,
      category: e.category,
      status: e.status,
      amount: e.amount,
      currency: e.currency,
      travelerLabel: "Grupo",
      travelerIds: [],
      payerIds: [],
      createdAt: e.createdAt.toISOString(),
      editHref: `/trips/${tripId}/expenses/${e.id}`,
    });
  }

  for (const { voucher: v } of transportVouchers) {
    const booking = bookingById.get(v.bookingId);
    entries.push({
      id: v.id,
      source: "transport",
      title: booking?.title ?? "Transporte",
      category: v.category,
      status: v.status,
      amount: v.price,
      currency: v.currency,
      travelerLabel: v.isGroup ? "Grupo" : nameOrOwner(v.travelerId),
      travelerIds: v.isGroup ? [] : [v.travelerId],
      payerIds: [],
      createdAt: v.createdAt.toISOString(),
      editHref: `/trips/${tripId}/transports/${v.bookingId}`,
    });
  }

  for (const { voucher: v } of lodgingVouchers) {
    const lodging = lodgingById.get(v.lodgingId);
    const coveredIds = travelersByVoucher.get(v.id) ?? [];
    entries.push({
      id: v.id,
      source: "lodging",
      title: `${lodging?.name ?? "Hospedagem"} — ${v.name}`,
      category: v.category,
      status: v.status,
      amount: v.price,
      currency: v.currency,
      travelerLabel: v.isGroup ? "Grupo" : coveredIds.map(nameOrOwner).join(", ") || "Sem viajante",
      travelerIds: v.isGroup ? [] : coveredIds,
      payerIds: [],
      createdAt: v.createdAt.toISOString(),
      editHref: `/trips/${tripId}/lodgings/${v.lodgingId}`,
    });
  }

  for (const c of chips) {
    entries.push({
      id: c.id,
      source: "chip",
      title: `Chip — ${nameOrOwner(c.travelerId)}`,
      category: c.category,
      status: c.status,
      amount: c.cost,
      currency: c.currency,
      travelerLabel: nameOrOwner(c.travelerId),
      travelerIds: [c.travelerId],
      payerIds: [],
      createdAt: c.createdAt.toISOString(),
      editHref: c.travelerId === null ? `/trips/${tripId}/travelers/owner` : `/trips/${tripId}/travelers/${c.travelerId}`,
    });
  }

  for (const ti of tickets) {
    entries.push({
      id: ti.id,
      source: "ticket",
      title: `Ingresso — ${nameOrOwner(ti.travelerId)}`,
      category: ti.category,
      status: ti.status,
      amount: ti.price,
      currency: ti.currency,
      travelerLabel: nameOrOwner(ti.travelerId),
      travelerIds: [ti.travelerId],
      payerIds: [],
      createdAt: ti.createdAt.toISOString(),
      editHref: `/trips/${tripId}/itinerary/items/${ti.itemId}`,
    });
  }

  for (const { pass: p } of passes) {
    entries.push({
      id: p.id,
      source: "pass",
      title: `Passe — ${p.name}`,
      category: p.category,
      status: p.status,
      amount: p.price,
      currency: p.currency,
      travelerLabel: nameOrOwner(p.travelerId),
      travelerIds: [p.travelerId],
      payerIds: [],
      createdAt: p.createdAt.toISOString(),
      editHref: p.travelerId === null ? `/trips/${tripId}/travelers/owner` : `/trips/${tripId}/travelers/${p.travelerId}`,
    });
  }

  for (const ins of insurances) {
    entries.push({
      id: ins.id,
      source: "insurance",
      title: `Seguro viagem — ${nameOrOwner(ins.travelerId)}`,
      category: ins.category,
      status: ins.status,
      amount: ins.price,
      currency: ins.currency,
      travelerLabel: nameOrOwner(ins.travelerId),
      travelerIds: [ins.travelerId],
      payerIds: [],
      createdAt: ins.createdAt.toISOString(),
      editHref: ins.travelerId === null ? `/trips/${tripId}/travelers/owner` : `/trips/${tripId}/travelers/${ins.travelerId}`,
    });
  }

  const itemTitleById = new Map(items.map((it) => [it.id, it.title]));

  for (const it of items) {
    // "costEstimate" é só informativo (planejamento) desde que o custo avulso
    // da atividade ganhou lançamentos próprios — não entra mais aqui.
    if (it.reservationPrice) {
      entries.push({
        id: `${it.id}-reservation`,
        source: "activity_reservation",
        title: `${it.title} (reserva)`,
        // Categoria agora é por pagamento (payments.category), não por origem.
        category: null,
        status: it.reservationStatus,
        amount: it.reservationPrice,
        currency: it.reservationCurrency ?? "BRL",
        travelerLabel: "Grupo",
        travelerIds: [],
      payerIds: [],
        createdAt: it.createdAt.toISOString(),
        editHref: `/trips/${tripId}/itinerary/items/${it.id}#reserva`,
      });
    }
  }

  for (const ie of itemExpenseRows) {
    entries.push({
      id: ie.id,
      source: "activity_cost",
      title: `${itemTitleById.get(ie.itemId) ?? "Atividade"} — ${ie.description}`,
      category: null,
      status: ie.status,
      amount: ie.amount,
      currency: ie.currency,
      travelerLabel: "Grupo",
      travelerIds: [],
      payerIds: [],
      createdAt: ie.createdAt.toISOString(),
      editHref: `/trips/${tripId}/itinerary/items/${ie.itemId}`,
    });
  }

  // Preenche "quem pagou" de cada lançamento a partir dos pagamentos já
  // lançados (pode ter mais de um payer num lançamento pago em partes).
  // "activity_reservation" usa um id sintético (`${itemId}-reservation`) —
  // o id real da origem (pra bater com `payments.sourceId`) é o item mesmo.
  const bySourceType = new Map<PaymentSourceType, { entry: CostEntry; sourceId: string }[]>();
  for (const entry of entries) {
    const sourceType = PAYMENT_SOURCE_BY_COST_SOURCE[entry.source];
    const sourceId = entry.source === "activity_reservation" ? entry.id.replace(/-reservation$/, "") : entry.id;
    const list = bySourceType.get(sourceType) ?? [];
    list.push({ entry, sourceId });
    bySourceType.set(sourceType, list);
  }
  await Promise.all(
    [...bySourceType.entries()].map(async ([sourceType, rows]) => {
      const payerMap = await payerIdsBySource(sourceType, rows.map((r) => r.sourceId));
      for (const { entry, sourceId } of rows) entry.payerIds = payerMap.get(sourceId) ?? [];
    }),
  );

  return entries;
}

/** Converte cada lançamento pra `baseCurrency`, buscando as cotações de uma vez só (sem N+1). */
export async function withConvertedAmounts(entries: CostEntry[], baseCurrency: string) {
  const codes = [...new Set(entries.map((e) => e.currency).filter((c): c is string => !!c))];
  const rates = await getLatestRates([...codes, baseCurrency]);
  const rateToBrl = (code: string) => (code === BRL ? 1 : Number(rates.get(code)?.rateToBrl ?? NaN));
  const baseRate = rateToBrl(baseCurrency);

  return entries.map((e) => {
    if (!e.amount || !e.currency) return { ...e, amountBase: null };
    const fromRate = rateToBrl(e.currency);
    const amountBase = Number.isFinite(fromRate) && Number.isFinite(baseRate) ? (Number(e.amount) * fromRate) / baseRate : null;
    return { ...e, amountBase };
  });
}

/** Total consolidado (todas as fontes de custo, não só custo avulso) pra cards de resumo, ex. dashboard. */
export async function getCostTotal(tripId: string, baseCurrency: string) {
  const entries = await listCostEntries(tripId);
  const converted = await withConvertedAmounts(entries, baseCurrency);
  const total = converted
    .filter((e) => e.status === "A_PAGAR" || e.status === "PAGO")
    .reduce((sum, e) => sum + (e.amountBase ?? 0), 0);
  const unconvertedCount = converted.filter((e) => e.amount && e.amountBase === null).length;
  return { total, unconvertedCount };
}
