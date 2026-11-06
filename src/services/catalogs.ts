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

/**
 * Tipos de atividade do roteiro, cadastrados pela agência. "TRANSPORT" é
 * semeado como legado (preserva o rótulo de atividades antigas) e nunca deve
 * ser oferecido pra criar atividade nova — deslocamentos entram pelo
 * cadastro de Transportes e vão pra agenda automaticamente.
 */
export const LEGACY_ACTIVITY_TYPE_IDS = ["TRANSPORT"];

export async function listActivityTypes() {
  return db.select().from(t.activityTypes).orderBy(asc(t.activityTypes.name));
}

/** Nomes reservados: não podem ser usados pra um novo tipo de atividade. */
export const RESERVED_ACTIVITY_TYPE_NAMES = ["hospedagem", "transporte"];

/**
 * Tipos de transporte, cadastrados pela agência. "HOTEL" é legado (de antes
 * de hospedagem ter cadastro próprio) e não deve ser oferecido pra criação.
 */
export const LEGACY_BOOKING_TYPE_IDS = ["HOTEL"];

export async function listBookingTypes() {
  return db.select().from(t.bookingTypes).orderBy(asc(t.bookingTypes.name));
}

/** Monta um mapa id → nome, pra exibir o rótulo salvo sem repetir a busca. */
export function toNameMap(rows: { id: string; name: string }[]) {
  return Object.fromEntries(rows.map((r) => [r.id, r.name]));
}
