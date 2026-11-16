import "server-only";
import { desc, eq, inArray } from "drizzle-orm";
import { db, t } from "@/db";
import type { ErrandEntry } from "@/db/schema";
import { addDocument } from "./documents";

export type NewErrandEntry = {
  price: string | null;
  currency: string | null;
  valueStatus: "ESTIMADO" | "ORCAMENTO" | "REALIZADO";
  paymentStatus: "A_PAGAR" | "PAGO";
  purchaseStatus: "AGUARDANDO_COMPRA" | "PEDIDO_APROVACAO" | "COMPRA_EFETUADA";
};

export type NewErrand = {
  /** Nulo = o próprio dono da viagem como viajante (ver schema.ts). */
  travelerId: string | null;
  requesterId: string;
  product: string;
  storeId: string | null;
  details: string | null;
  receiptDocumentId?: string | null;
  /** Primeiro lançamento do histórico de valor/status. */
  entry: NewErrandEntry;
};

export async function addErrand(tripId: string, input: NewErrand) {
  const { entry, ...base } = input;
  return db.transaction(async (tx) => {
    const [errand] = await tx
      .insert(t.errands)
      .values({ tripId, ...base, receiptDocumentId: base.receiptDocumentId ?? null })
      .returning();
    await tx.insert(t.errandEntries).values({ errandId: errand.id, ...entry });
    return errand;
  });
}

/** Lançamento novo no histórico — nunca edita/apaga um lançamento anterior. */
export async function addErrandEntry(errandId: string, input: NewErrandEntry) {
  const [row] = await db.insert(t.errandEntries).values({ errandId, ...input }).returning();
  return row;
}

export async function listErrandEntries(errandId: string) {
  return db.select().from(t.errandEntries).where(eq(t.errandEntries.errandId, errandId)).orderBy(desc(t.errandEntries.createdAt));
}

/** Fotos do produto — só pra consulta, diferente do recibo de compra. */
export async function addErrandPhoto(tripId: string, errandId: string, file: File) {
  const doc = await addDocument(tripId, file, { type: "PRODUCT_PHOTO", title: file.name });
  await db.insert(t.errandPhotos).values({ errandId, documentId: doc.id });
  return doc;
}

export async function listErrandPhotos(errandId: string) {
  const rows = await db
    .select({ document: t.documents })
    .from(t.errandPhotos)
    .innerJoin(t.documents, eq(t.documents.id, t.errandPhotos.documentId))
    .where(eq(t.errandPhotos.errandId, errandId))
    .orderBy(desc(t.documents.createdAt));
  return rows.map((r) => r.document);
}

/** Pra cada errandId, o lançamento mais recente (ou nenhum, se ainda não tiver). */
async function latestEntriesByErrand(errandIds: string[]): Promise<Map<string, ErrandEntry>> {
  if (errandIds.length === 0) return new Map();
  const rows = await db
    .select()
    .from(t.errandEntries)
    .where(inArray(t.errandEntries.errandId, errandIds))
    .orderBy(desc(t.errandEntries.createdAt));
  const latest = new Map<string, ErrandEntry>();
  for (const row of rows) {
    if (!latest.has(row.errandId)) latest.set(row.errandId, row);
  }
  return latest;
}

/** Custo fora da Central de Custos de propósito — não é gasto da viagem em si, ver schema.ts. */
export async function listErrands(tripId: string, ownerName: string) {
  const rows = await db
    .select({
      errand: t.errands,
      travelerName: t.travelers.name,
      requesterName: t.requesters.name,
      storeName: t.stores.name,
    })
    .from(t.errands)
    .leftJoin(t.travelers, eq(t.travelers.id, t.errands.travelerId))
    .innerJoin(t.requesters, eq(t.requesters.id, t.errands.requesterId))
    .leftJoin(t.stores, eq(t.stores.id, t.errands.storeId))
    .where(eq(t.errands.tripId, tripId))
    .orderBy(desc(t.errands.createdAt));
  const latestByErrand = await latestEntriesByErrand(rows.map((r) => r.errand.id));
  return rows.map((r) => ({
    ...r,
    travelerName: r.travelerName ?? `${ownerName} (dono da viagem)`,
    latest: latestByErrand.get(r.errand.id) ?? null,
  }));
}

export type ErrandSummary = { byCurrency: { currency: string; aPagar: number; pago: number }[] };

/** Soma simples por moeda (sem conversão pra base da viagem), usando só o lançamento mais recente de cada encomenda. */
export async function getErrandSummary(tripId: string): Promise<ErrandSummary> {
  const errandIds = (await db.select({ id: t.errands.id }).from(t.errands).where(eq(t.errands.tripId, tripId))).map((r) => r.id);
  const latestByErrand = await latestEntriesByErrand(errandIds);

  const byCurrency = new Map<string, { aPagar: number; pago: number }>();
  for (const entry of latestByErrand.values()) {
    if (!entry.price || !entry.currency) continue;
    const amount = Number(entry.price);
    const totals = byCurrency.get(entry.currency) ?? { aPagar: 0, pago: 0 };
    if (entry.paymentStatus === "PAGO") totals.pago += amount;
    else totals.aPagar += amount;
    byCurrency.set(entry.currency, totals);
  }

  return { byCurrency: [...byCurrency.entries()].map(([currency, totals]) => ({ currency, ...totals })) };
}
