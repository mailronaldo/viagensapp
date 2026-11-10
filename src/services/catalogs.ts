import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, t } from "@/db";

/** Tipos de documento cadastrados pela agência (lista única, usada em todos os clientes). */
export async function listDocumentTypes() {
  return db.select().from(t.documentTypes).orderBy(asc(t.documentTypes.name));
}

/**
 * Ids reservados pro sistema: usados por baixo dos panos (ícone de hospedagem,
 * voucher, ingresso, reserva, recibo de custo avulso) mesmo quando não aparecem
 * em nenhum documento ainda, então não podem ser excluídos.
 */
export const RESERVED_DOCUMENT_TYPE_IDS = ["TICKET", "RESERVATION", "RECEIPT", "OTHER"];

/** Categorias de custo cadastradas pela agência (lista única, usada em todos os clientes). */
export async function listExpenseCategories() {
  return db.select().from(t.expenseCategories).orderBy(asc(t.expenseCategories.name));
}

/** Categorias de dica cadastradas pela agência (lista única, usada em todos os clientes). */
export async function listTipCategories() {
  return db.select().from(t.tipCategories).orderBy(asc(t.tipCategories.name));
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

export async function listLodgingTypes() {
  return db.select().from(t.lodgingTypes).orderBy(asc(t.lodgingTypes.name));
}

/** Subcategorias de um tipo de hospedagem (ex.: Hotel → Standard, Suíte…), usadas no tipo do voucher. */
export async function listLodgingTypeSubcategories(lodgingTypeId: string) {
  return db
    .select()
    .from(t.lodgingTypeSubcategories)
    .where(eq(t.lodgingTypeSubcategories.lodgingTypeId, lodgingTypeId))
    .orderBy(asc(t.lodgingTypeSubcategories.name));
}

/** Todas as subcategorias de todos os tipos, pra exibir na tela de gestão. */
export async function listAllLodgingTypeSubcategories() {
  return db.select().from(t.lodgingTypeSubcategories).orderBy(asc(t.lodgingTypeSubcategories.name));
}

export async function listReservationMethods() {
  return db.select().from(t.reservationMethods).orderBy(asc(t.reservationMethods.name));
}

/** Categoria é opcional em todo registro de valor exceto custo avulso; null/"" é válido. */
export async function parseOptionalCategory(categoryId: string | null) {
  if (!categoryId) return null;
  const [cat] = await db.select({ id: t.expenseCategories.id }).from(t.expenseCategories).where(eq(t.expenseCategories.id, categoryId)).limit(1);
  return cat ? categoryId : null;
}

/** Idem, pra categoria de dica. */
export async function parseOptionalTipCategory(categoryId: string | null) {
  if (!categoryId) return null;
  const [cat] = await db.select({ id: t.tipCategories.id }).from(t.tipCategories).where(eq(t.tipCategories.id, categoryId)).limit(1);
  return cat ? categoryId : null;
}

/** Categorias reservadas pro sistema: não aparecem pra excluir no gestor da agência. */
export const RESERVED_EXPENSE_CATEGORY_NAMES = ["Ingressos", "Transporte", "Hospedagem", "Telefonia", "Seguro"];

async function getCategoryIdByName(name: string) {
  const [cat] = await db.select({ id: t.expenseCategories.id }).from(t.expenseCategories).where(eq(t.expenseCategories.name, name)).limit(1);
  return cat?.id ?? null;
}

/** Categorias fixas de cada tipo de custo — criadas pela migração, buscadas pelo nome (não pelo id). */
export const getTicketCategoryId = () => getCategoryIdByName("Ingressos");
export const getTransportCategoryId = () => getCategoryIdByName("Transporte");
export const getLodgingCategoryId = () => getCategoryIdByName("Hospedagem");
export const getChipCategoryId = () => getCategoryIdByName("Telefonia");
export const getInsuranceCategoryId = () => getCategoryIdByName("Seguro");

/** Monta um mapa id → nome, pra exibir o rótulo salvo sem repetir a busca. */
export function toNameMap(rows: { id: string; name: string }[]) {
  return Object.fromEntries(rows.map((r) => [r.id, r.name]));
}
