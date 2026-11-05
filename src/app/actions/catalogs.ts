"use server";

import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { requireMaster } from "@/lib/auth";
import { fail, str } from "@/lib/form";

export async function addDocumentTypeAction(formData: FormData) {
  await requireMaster();
  const back = "/agency/document-types";
  const name = str(formData, "name");
  if (!name) fail(back, "Informe o nome do tipo de documento.");
  await db.insert(t.documentTypes).values({ name });
  redirect(back);
}

export async function deleteDocumentTypeAction(id: string) {
  await requireMaster();
  const back = "/agency/document-types";
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(t.documents)
    .where(eq(t.documents.type, id));
  if (count > 0) {
    fail(back, `Esse tipo está em uso em ${count} documento${count > 1 ? "s" : ""}. Não dá pra excluir.`);
  }
  await db.delete(t.documentTypes).where(eq(t.documentTypes.id, id));
  redirect(back);
}

export async function addExpenseCategoryAction(formData: FormData) {
  await requireMaster();
  const back = "/agency/expense-categories";
  const name = str(formData, "name");
  if (!name) fail(back, "Informe o nome da categoria de custo.");
  await db.insert(t.expenseCategories).values({ name });
  redirect(back);
}

export async function deleteExpenseCategoryAction(id: string) {
  await requireMaster();
  const back = "/agency/expense-categories";
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(t.expenses)
    .where(eq(t.expenses.category, id));
  if (count > 0) {
    fail(back, `Essa categoria está em uso em ${count} custo${count > 1 ? "s" : ""}. Não dá pra excluir.`);
  }
  await db.delete(t.expenseCategories).where(eq(t.expenseCategories.id, id));
  redirect(back);
}
