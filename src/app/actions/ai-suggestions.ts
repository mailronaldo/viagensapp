"use server";

import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { askAiForJsonArray, checkAiRateLimit } from "@/lib/ai";
import { listTipCategories, toNameMap } from "@/services/catalogs";
import { formatDate } from "@/lib/format";

export type AiPoint = {
  name: string;
  description: string | null;
  /** Nomes das categorias (não os ids) — resolvidos pros ids do catálogo só ao salvar. */
  categories: string[];
};

type ItemContext = {
  title: string;
  typeName: string;
  date: string;
  cityName: string | null;
  country: string | null;
  state: string | null;
  neighborhoodName: string | null;
};

async function loadItemContext(tripId: string, itemId: string): Promise<ItemContext | null> {
  const [row] = await db
    .select({
      title: t.itineraryItems.title,
      date: t.itineraryItems.date,
      typeId: t.itineraryItems.type,
      cityName: t.cities.name,
      country: t.cities.country,
      state: t.cities.state,
      neighborhoodName: t.cityNeighborhoods.name,
    })
    .from(t.itineraryItems)
    .leftJoin(t.cities, eq(t.cities.id, t.itineraryItems.cityId))
    .leftJoin(t.cityNeighborhoods, eq(t.cityNeighborhoods.id, t.itineraryItems.neighborhoodId))
    .where(and(eq(t.itineraryItems.id, itemId), eq(t.itineraryItems.tripId, tripId)))
    .limit(1);
  if (!row) return null;

  const activityTypes = await db.select().from(t.activityTypes);
  const typeName = toNameMap(activityTypes)[row.typeId] ?? row.typeId;

  return {
    title: row.title,
    typeName,
    date: formatDate(row.date),
    cityName: row.cityName,
    country: row.country,
    state: row.state,
    neighborhoodName: row.neighborhoodName,
  };
}

function placeDescription(ctx: ItemContext): string {
  const parts = [ctx.cityName, ctx.state, ctx.country].filter(Boolean);
  const place = parts.length > 0 ? parts.join(", ") : "um local não especificado — não invente a cidade";
  const regionPart = ctx.neighborhoodName ? ` na região de ${ctx.neighborhoodName}` : "";
  return `${place}${regionPart}`;
}

function parsePoints(data: unknown, categoryNames: string[]): AiPoint[] {
  if (!Array.isArray(data)) return [];
  const out: AiPoint[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim() : "";
    if (!name) continue;
    const rawCategories = Array.isArray(r.categories) ? r.categories : [];
    const categories = rawCategories.filter((c): c is string => typeof c === "string" && categoryNames.includes(c));
    out.push({
      name,
      description: typeof r.description === "string" && r.description.trim() ? r.description.trim() : null,
      categories,
    });
  }
  return out;
}

/**
 * Sugestões de IA pro card único de Dicas: "POI" busca pontos de interesse
 * próximos (sem contexto do usuário, sem categoria); "TEMA" busca dicas sobre
 * o que o viajante descreveu, com categoria (do catálogo do cliente).
 */
export async function suggestTipsAction(
  tripId: string,
  itemId: string,
  mode: "POI" | "TEMA",
  context?: string,
): Promise<{ suggestions: AiPoint[] } | { error: string }> {
  await requireTripAccess(tripId, { write: true });
  if (!checkAiRateLimit(tripId)) {
    return { error: "Limite de sugestões de IA desta viagem atingido por hoje. Tente novamente mais tarde." };
  }
  const ctx = await loadItemContext(tripId, itemId);
  if (!ctx) return { error: "Atividade não encontrada." };

  const categories = await listTipCategories();
  const categoryNames = categories.map((c) => c.name);

  if (mode === "POI") {
    const prompt = `Você ajuda viajantes a planejar roteiros. A atividade é "${ctx.title}" (${ctx.typeName}), no dia ${ctx.date}, em ${placeDescription(ctx)}.
Busque na web e sugira de 5 a 8 pontos de interesse reais e próximos (monumentos, ruas, praças, mirantes, lugares bons pra foto) relevantes pra essa atividade.
Responda em português, só com um array JSON, sem nenhum texto antes ou depois, no formato:
[{"name": "...", "description": "uma frase curta explicando por que vale a pena", "categories": ["uma ou mais destas, as que fizerem sentido: ${categoryNames.join(", ")}"]}]
Não invente lugares nem links.`;

    const result = await askAiForJsonArray(prompt);
    if ("error" in result) return result;
    return { suggestions: parsePoints(result.data, categoryNames) };
  }

  const trimmedContext = (context ?? "").trim();
  if (!trimmedContext) return { error: "Descreva o que você procura." };

  const prompt = `Você ajuda viajantes a planejar roteiros. A atividade é "${ctx.title}" (${ctx.typeName}), no dia ${ctx.date}, em ${placeDescription(ctx)}.
O viajante quer dicas sobre: "${trimmedContext}".
Busque na web e sugira de 5 a 8 dicas reais e específicas (nomes de lugares, eventos ou recomendações), relevantes pro que ele descreveu.
Responda em português, só com um array JSON, sem nenhum texto antes ou depois, no formato:
[{"name": "...", "description": "uma frase curta explicando a dica", "categories": ["uma ou mais destas, as que fizerem sentido: ${categoryNames.join(", ")}"]}]
Um lugar pode se encaixar em mais de uma categoria (ex. um parque com food trucks pode ser Atrações e Comida ao mesmo tempo) — liste todas que se aplicarem.
Não invente lugares nem links.`;

  const result = await askAiForJsonArray(prompt);
  if ("error" in result) return result;
  return { suggestions: parsePoints(result.data, categoryNames) };
}

export async function saveSuggestedTipsAction(
  tripId: string,
  itemId: string,
  items: AiPoint[],
): Promise<{ ok: true } | { error: string }> {
  const { trip } = await requireTripAccess(tripId, { write: true });
  const [owned] = await db
    .select({ id: t.itineraryItems.id, cityId: t.itineraryItems.cityId, neighborhoodId: t.itineraryItems.neighborhoodId })
    .from(t.itineraryItems)
    .where(and(eq(t.itineraryItems.id, itemId), eq(t.itineraryItems.tripId, tripId)))
    .limit(1);
  if (!owned) return { error: "Atividade não encontrada." };
  const { cityId, neighborhoodId } = owned;
  if (!cityId || !neighborhoodId) {
    return { error: "Defina o Bairro/Região da atividade antes de salvar sugestões como dica." };
  }
  if (items.length === 0) return { ok: true };

  const categories = await listTipCategories();
  const categoryIdByName = new Map(categories.map((c) => [c.name, c.id]));

  await db.transaction(async (tx) => {
    const existing = await tx.select({ id: t.itineraryItemTips.id }).from(t.itineraryItemTips).where(eq(t.itineraryItemTips.itemId, itemId));
    let position = existing.length;
    for (const item of items) {
      const [created] = await tx
        .insert(t.tips)
        .values({
          clientId: trip.ownerId,
          name: item.name,
          description: item.description,
          cityId,
          neighborhoodId,
        })
        .returning({ id: t.tips.id });
      const categoryIds = item.categories.map((name) => categoryIdByName.get(name)).filter((id): id is string => !!id);
      if (categoryIds.length > 0) {
        await tx.insert(t.tipCategoryLinks).values(categoryIds.map((categoryId) => ({ tipId: created.id, categoryId })));
      }
      await tx.insert(t.itineraryItemTips).values({ itemId, tipId: created.id, position });
      position += 1;
    }
  });
  return { ok: true };
}
