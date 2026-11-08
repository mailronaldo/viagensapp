import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, t } from "@/db";

export type NewExpense = {
  date: string;
  /** Id de uma linha de `expense_categories` (cadastro da agência, não mais um enum fixo). */
  category: string;
  status: "ESTIMADO" | "A_PAGAR" | "PAGO";
  description: string;
  amount: string; // decimal em string, ex.: "123.45"
  currency: string;
  exchangeRate?: string | null;
  paymentMethod?: string | null;
  receiptDocumentId?: string | null;
};

export async function addExpense(
  tripId: string,
  paidById: string,
  input: NewExpense,
  source: "web" | "whatsapp" = "web",
) {
  const [row] = await db
    .insert(t.expenses)
    .values({
      tripId,
      paidById,
      date: input.date,
      category: input.category,
      status: input.status,
      description: input.description,
      amount: input.amount,
      currency: input.currency,
      exchangeRate: input.exchangeRate || null,
      paymentMethod: input.paymentMethod || null,
      receiptDocumentId: input.receiptDocumentId || null,
      source,
    })
    .returning();
  return row;
}

export async function listExpenses(tripId: string) {
  return db
    .select({
      expense: t.expenses,
      paidByName: t.users.name,
      receiptTitle: t.documents.title,
    })
    .from(t.expenses)
    .leftJoin(t.users, eq(t.users.id, t.expenses.paidById))
    .leftJoin(t.documents, eq(t.documents.id, t.expenses.receiptDocumentId))
    .where(eq(t.expenses.tripId, tripId))
    .orderBy(desc(t.expenses.date), desc(t.expenses.createdAt));
}

export type ExpenseSummary = {
  baseCurrency: string;
  /** Total convertido para a moeda base (só despesas com cotação ou na moeda base). */
  totalBase: number;
  /** Despesas em outra moeda sem cotação informada — ficam fora do total convertido. */
  unconvertedCount: number;
  byCategory: { category: string; totalBase: number }[];
  byCurrency: { currency: string; total: number }[];
};

export async function getExpenseSummary(
  tripId: string,
  baseCurrency: string,
): Promise<ExpenseSummary> {
  const rows = await db
    .select()
    .from(t.expenses)
    .where(eq(t.expenses.tripId, tripId));

  const byCategory = new Map<string, number>();
  const byCurrency = new Map<string, number>();
  let totalBase = 0;
  let unconvertedCount = 0;

  for (const e of rows) {
    const amount = Number(e.amount);
    byCurrency.set(e.currency, (byCurrency.get(e.currency) ?? 0) + amount);

    let inBase: number | null = null;
    if (e.currency === baseCurrency) inBase = amount;
    else if (e.exchangeRate) inBase = amount * Number(e.exchangeRate);

    if (inBase === null) {
      unconvertedCount++;
      continue;
    }
    totalBase += inBase;
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + inBase);
  }

  return {
    baseCurrency,
    totalBase,
    unconvertedCount,
    byCategory: [...byCategory.entries()]
      .map(([category, total]) => ({ category, totalBase: total }))
      .sort((a, b) => b.totalBase - a.totalBase),
    byCurrency: [...byCurrency.entries()].map(([currency, total]) => ({
      currency,
      total,
    })),
  };
}
