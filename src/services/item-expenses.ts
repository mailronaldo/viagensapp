import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, t } from "@/db";

/** Ids dos custos avulsos de uma atividade — usado pra limpar pagamentos órfãos quando a atividade é apagada. */
export async function listItemExpenseIdsForItem(itemId: string): Promise<string[]> {
  const rows = await db.select({ id: t.itemExpenses.id }).from(t.itemExpenses).where(eq(t.itemExpenses.itemId, itemId));
  return rows.map((r) => r.id);
}

/** Lançamentos de custo avulso de uma atividade, mais antigo primeiro. */
export async function listItemExpenses(itemId: string) {
  return db.select().from(t.itemExpenses).where(eq(t.itemExpenses.itemId, itemId)).orderBy(asc(t.itemExpenses.createdAt));
}
