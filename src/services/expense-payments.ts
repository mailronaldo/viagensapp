import "server-only";
import { desc, eq, inArray } from "drizzle-orm";
import { db, t } from "@/db";
import { listTripTravelerOptions, type TripTravelerOption } from "./trip-travelers";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type NewExpensePayment = {
  payerTravelerId: string | null;
  paymentDate: string;
  method: "PIX" | "CREDITO" | "DEBITO" | "DINHEIRO";
  form: "AVISTA" | "PARCELADO";
  installments: string | null;
  amount: string;
};

/** Recalcula o status da despesa a partir da soma dos pagamentos já lançados (nunca escolhido à mão). */
export async function recomputeExpenseStatus(expenseId: string, tx: Tx | typeof db = db) {
  const [expense] = await tx.select().from(t.expenses).where(eq(t.expenses.id, expenseId)).limit(1);
  if (!expense) return;
  const payments = await tx.select({ amount: t.expensePayments.amount }).from(t.expensePayments).where(eq(t.expensePayments.expenseId, expenseId));
  const paid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const status = paid >= Number(expense.amount) ? "PAGO" : "A_PAGAR";
  if (status !== expense.status) {
    await tx.update(t.expenses).set({ status }).where(eq(t.expenses.id, expenseId));
  }
}

/** Pagamento novo contra uma despesa — a moeda é sempre a da despesa, nunca a do formulário. */
export async function addExpensePayment(expenseId: string, input: NewExpensePayment) {
  return db.transaction(async (tx) => {
    const [expense] = await tx.select().from(t.expenses).where(eq(t.expenses.id, expenseId)).limit(1);
    if (!expense) throw new Error("Despesa não encontrada.");
    const [row] = await tx
      .insert(t.expensePayments)
      .values({ expenseId, ...input, currency: expense.currency })
      .returning();
    await recomputeExpenseStatus(expenseId, tx);
    return row;
  });
}

export async function listExpensePayments(expenseId: string) {
  return db.select().from(t.expensePayments).where(eq(t.expensePayments.expenseId, expenseId)).orderBy(desc(t.expensePayments.createdAt));
}

/** Pra cada expenseId, os ids distintos de quem pagou (null = dono da viagem) — alimenta o filtro por pagador. */
export async function payerIdsByExpense(expenseIds: string[]): Promise<Map<string, (string | null)[]>> {
  if (expenseIds.length === 0) return new Map();
  const rows = await db
    .select({ expenseId: t.expensePayments.expenseId, payerTravelerId: t.expensePayments.payerTravelerId })
    .from(t.expensePayments)
    .where(inArray(t.expensePayments.expenseId, expenseIds));
  const byExpense = new Map<string, Set<string | null>>();
  for (const row of rows) {
    const set = byExpense.get(row.expenseId) ?? new Set<string | null>();
    set.add(row.payerTravelerId);
    byExpense.set(row.expenseId, set);
  }
  return new Map([...byExpense.entries()].map(([id, set]) => [id, [...set]]));
}

export type ExpensePayerSummary = { payer: TripTravelerOption; byCurrency: { currency: string; total: number }[] };

/** Quanto cada viajante pagou na viagem (relatório "por pagador"). */
export async function getExpenseSummaryByPayer(trip: { id: string; ownerId: string; ownerIsTraveler: boolean }): Promise<ExpensePayerSummary[]> {
  const rows = await db
    .select({ payerTravelerId: t.expensePayments.payerTravelerId, currency: t.expensePayments.currency, amount: t.expensePayments.amount })
    .from(t.expensePayments)
    .innerJoin(t.expenses, eq(t.expenses.id, t.expensePayments.expenseId))
    .where(eq(t.expenses.tripId, trip.id));

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
