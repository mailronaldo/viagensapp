import "server-only";
import { and, asc, eq } from "drizzle-orm";
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
    url: t.tips.url,
    cost: t.tips.cost,
    cityId: t.tips.cityId,
    cityName: t.cities.name,
    neighborhoodId: t.tips.neighborhoodId,
    neighborhoodName: t.cityNeighborhoods.name,
    categoryId: t.tips.categoryId,
    categoryName: t.tipCategories.name,
  };
}

/** Repositório de Dicas do cliente, com filtros opcionais — pro Gestor de Dicas. */
export async function listClientTips(clientId: string, filters: TipFilters = {}) {
  const conditions = [eq(t.tips.clientId, clientId)];
  if (filters.cityId) conditions.push(eq(t.tips.cityId, filters.cityId));
  if (filters.neighborhoodId) conditions.push(eq(t.tips.neighborhoodId, filters.neighborhoodId));
  if (filters.categoryId) conditions.push(eq(t.tips.categoryId, filters.categoryId));
  if (filters.cost) conditions.push(eq(t.tips.cost, filters.cost as "BAIXO" | "MEDIO" | "ALTO" | "GRATIS"));

  return db
    .select(tipRow())
    .from(t.tips)
    .leftJoin(t.cities, eq(t.cities.id, t.tips.cityId))
    .leftJoin(t.cityNeighborhoods, eq(t.cityNeighborhoods.id, t.tips.neighborhoodId))
    .leftJoin(t.tipCategories, eq(t.tipCategories.id, t.tips.categoryId))
    .where(and(...conditions))
    .orderBy(asc(t.tips.name));
}

/** Dicas já cadastradas numa cidade, pra oferecer "usar uma dica existente" na atividade. */
export async function searchTipsForCity(clientId: string, cityId: string) {
  return db
    .select(tipRow())
    .from(t.tips)
    .leftJoin(t.cities, eq(t.cities.id, t.tips.cityId))
    .leftJoin(t.cityNeighborhoods, eq(t.cityNeighborhoods.id, t.tips.neighborhoodId))
    .leftJoin(t.tipCategories, eq(t.tipCategories.id, t.tips.categoryId))
    .where(and(eq(t.tips.clientId, clientId), eq(t.tips.cityId, cityId)))
    .orderBy(asc(t.tips.name));
}

/** Dicas vinculadas a uma atividade, na ordem em que foram adicionadas. */
export async function listItemTips(itemId: string) {
  return db
    .select({ linkId: t.itineraryItemTips.id, ...tipRow() })
    .from(t.itineraryItemTips)
    .innerJoin(t.tips, eq(t.tips.id, t.itineraryItemTips.tipId))
    .leftJoin(t.cities, eq(t.cities.id, t.tips.cityId))
    .leftJoin(t.cityNeighborhoods, eq(t.cityNeighborhoods.id, t.tips.neighborhoodId))
    .leftJoin(t.tipCategories, eq(t.tipCategories.id, t.tips.categoryId))
    .where(eq(t.itineraryItemTips.itemId, itemId))
    .orderBy(asc(t.itineraryItemTips.position));
}

export async function getTip(clientId: string, tipId: string) {
  const [row] = await db
    .select()
    .from(t.tips)
    .where(and(eq(t.tips.id, tipId), eq(t.tips.clientId, clientId)))
    .limit(1);
  return row ?? null;
}
