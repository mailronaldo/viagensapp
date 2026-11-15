import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, t } from "@/db";

export type NewErrand = {
  /** Nulo = o próprio dono da viagem como viajante (ver schema.ts). */
  travelerId: string | null;
  requesterId: string;
  product: string;
  price: string | null;
  currency: string | null;
  valueStatus: "ESTIMADO" | "ORCAMENTO" | "REALIZADO";
  paymentStatus: "A_PAGAR" | "PAGO";
  purchaseStatus: "AGUARDANDO_COMPRA" | "PEDIDO_APROVACAO" | "COMPRA_EFETUADA";
  details: string | null;
  receiptDocumentId?: string | null;
};

export async function addErrand(tripId: string, input: NewErrand) {
  const [row] = await db
    .insert(t.errands)
    .values({ tripId, ...input, receiptDocumentId: input.receiptDocumentId ?? null })
    .returning();
  return row;
}

/** Custo fora da Central de Custos de propósito — não é gasto da viagem em si, ver schema.ts. */
export async function listErrands(tripId: string, ownerName: string) {
  const rows = await db
    .select({
      errand: t.errands,
      travelerName: t.travelers.name,
      requesterName: t.requesters.name,
    })
    .from(t.errands)
    .leftJoin(t.travelers, eq(t.travelers.id, t.errands.travelerId))
    .innerJoin(t.requesters, eq(t.requesters.id, t.errands.requesterId))
    .where(eq(t.errands.tripId, tripId))
    .orderBy(desc(t.errands.createdAt));
  return rows.map((r) => ({ ...r, travelerName: r.travelerName ?? `${ownerName} (dono da viagem)` }));
}

export type ErrandSummary = { byCurrency: { currency: string; aPagar: number; pago: number }[] };

/** Soma simples por moeda (sem conversão pra base da viagem) — total de encomendas é à parte do custo da viagem. */
export async function getErrandSummary(tripId: string): Promise<ErrandSummary> {
  const rows = await db.select().from(t.errands).where(eq(t.errands.tripId, tripId));

  const byCurrency = new Map<string, { aPagar: number; pago: number }>();
  for (const e of rows) {
    if (!e.price || !e.currency) continue;
    const amount = Number(e.price);
    const entry = byCurrency.get(e.currency) ?? { aPagar: 0, pago: 0 };
    if (e.paymentStatus === "PAGO") entry.pago += amount;
    else entry.aPagar += amount;
    byCurrency.set(e.currency, entry);
  }

  return { byCurrency: [...byCurrency.entries()].map(([currency, totals]) => ({ currency, ...totals })) };
}
