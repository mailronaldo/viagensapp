import "server-only";
import { asc } from "drizzle-orm";
import { db, t } from "@/db";

/** Tipos de documento cadastrados pela agência (lista única, usada em todos os clientes). */
export async function listDocumentTypes() {
  return db.select().from(t.documentTypes).orderBy(asc(t.documentTypes.name));
}

/** Categorias de custo cadastradas pela agência (lista única, usada em todos os clientes). */
export async function listExpenseCategories() {
  return db.select().from(t.expenseCategories).orderBy(asc(t.expenseCategories.name));
}

/** Monta um mapa id → nome, pra exibir o rótulo salvo sem repetir a busca. */
export function toNameMap(rows: { id: string; name: string }[]) {
  return Object.fromEntries(rows.map((r) => [r.id, r.name]));
}
