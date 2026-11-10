import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, t } from "@/db";

export type TipFilters = {
  cityId?: string;
  neighborhoodId?: string;
  categoryId?: string;
  cost?: string;
};

function tipRow() {
  return {
    id: t.tips.id,
    name: t.tips.name,
    description: t.tips.description,
    cost: t.tips.cost,
    cityId: t.tips.cityId,
    cityName: t.cities.name,
    neighborhoodId: t.tips.neighborhoodId,
    neighborhoodName: t.cityNeighborhoods.name,
  };
}

/** Busca a nuvem de categorias de cada dica e devolve um mapa tipId -> categorias. */
async function loadCategoriesByTip(tipIds: string[]) {
  const map = new Map<string, { id: string; name: string }[]>();
  if (tipIds.length === 0) return map;
  const rows = await db
    .select({ tipId: t.tipCategoryLinks.tipId, id: t.tipCategories.id, name: t.tipCategories.name })
    .from(t.tipCategoryLinks)
    .innerJoin(t.tipCategories, eq(t.tipCategories.id, t.tipCategoryLinks.categoryId))
    .where(inArray(t.tipCategoryLinks.tipId, tipIds))
    .orderBy(asc(t.tipCategories.name));
  for (const r of rows) {
    const list = map.get(r.tipId) ?? [];
    list.push({ id: r.id, name: r.name });
    map.set(r.tipId, list);
  }
  return map;
}

async function withCategories<T extends { id: string }>(rows: T[]) {
  const byTip = await loadCategoriesByTip(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, categories: byTip.get(r.id) ?? [] }));
}

/** Repositório de Dicas do cliente, com filtros opcionais — pro Gestor de Dicas. */
export async function listClientTips(clientId: string, filters: TipFilters = {}) {
  const conditions = [eq(t.tips.clientId, clientId)];
  if (filters.cityId) conditions.push(eq(t.tips.cityId, filters.cityId));
  if (filters.neighborhoodId) conditions.push(eq(t.tips.neighborhoodId, filters.neighborhoodId));
  if (filters.cost) conditions.push(eq(t.tips.cost, filters.cost as "BAIXO" | "MEDIO" | "ALTO" | "GRATIS"));

  let tipIdsWithCategory: string[] | null = null;
  if (filters.categoryId) {
    const rows = await db
      .select({ tipId: t.tipCategoryLinks.tipId })
      .from(t.tipCategoryLinks)
      .where(eq(t.tipCategoryLinks.categoryId, filters.categoryId));
    tipIdsWithCategory = rows.map((r) => r.tipId);
    if (tipIdsWithCategory.length === 0) return [];
    conditions.push(inArray(t.tips.id, tipIdsWithCategory));
  }

  const rows = await db
    .select(tipRow())
    .from(t.tips)
    .leftJoin(t.cities, eq(t.cities.id, t.tips.cityId))
    .leftJoin(t.cityNeighborhoods, eq(t.cityNeighborhoods.id, t.tips.neighborhoodId))
    .where(and(...conditions))
    .orderBy(asc(t.tips.name));
  return withCategories(rows);
}

/** Dicas já cadastradas numa cidade, pra oferecer "usar uma dica existente" na atividade. */
export async function searchTipsForCity(clientId: string, cityId: string) {
  const rows = await db
    .select(tipRow())
    .from(t.tips)
    .leftJoin(t.cities, eq(t.cities.id, t.tips.cityId))
    .leftJoin(t.cityNeighborhoods, eq(t.cityNeighborhoods.id, t.tips.neighborhoodId))
    .where(and(eq(t.tips.clientId, clientId), eq(t.tips.cityId, cityId)))
    .orderBy(asc(t.tips.name));
  return withCategories(rows);
}

/** Dicas vinculadas a uma atividade, na ordem em que foram adicionadas. */
export async function listItemTips(itemId: string) {
  const rows = await db
    .select({ linkId: t.itineraryItemTips.id, ...tipRow() })
    .from(t.itineraryItemTips)
    .innerJoin(t.tips, eq(t.tips.id, t.itineraryItemTips.tipId))
    .leftJoin(t.cities, eq(t.cities.id, t.tips.cityId))
    .leftJoin(t.cityNeighborhoods, eq(t.cityNeighborhoods.id, t.tips.neighborhoodId))
    .where(eq(t.itineraryItemTips.itemId, itemId))
    .orderBy(asc(t.itineraryItemTips.position));
  return withCategories(rows);
}

export async function getTip(clientId: string, tipId: string) {
  const [row] = await db
    .select()
    .from(t.tips)
    .where(and(eq(t.tips.id, tipId), eq(t.tips.clientId, clientId)))
    .limit(1);
  if (!row) return null;
  const categories = await db
    .select({ id: t.tipCategories.id, name: t.tipCategories.name })
    .from(t.tipCategoryLinks)
    .innerJoin(t.tipCategories, eq(t.tipCategories.id, t.tipCategoryLinks.categoryId))
    .where(eq(t.tipCategoryLinks.tipId, tipId));
  return { ...row, categories };
}
