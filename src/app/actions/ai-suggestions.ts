"use server";

import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { askAiForJsonArray, checkAiRateLimit } from "@/lib/ai";
import { toNameMap } from "@/services/catalogs";
import { formatDate } from "@/lib/format";

export type AiPoint = {
  name: string;
  description: string | null;
  url: string | null;
  category?: string | null;
};

const TIP_CATEGORIES = ["COMIDA", "ARTE", "CULTURA", "ATRACOES", "LOJAS", "CURIOSIDADES", "OUTROS"] as const;
type TipCategory = (typeof TIP_CATEGORIES)[number];

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

function parsePoints(data: unknown, allowCategory: boolean): AiPoint[] {
  if (!Array.isArray(data)) return [];
  const out: AiPoint[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim() : "";
    if (!name) continue;
    const category =
      allowCategory && typeof r.category === "string" && (TIP_CATEGORIES as readonly string[]).includes(r.category)
        ? r.category
        : null;
    out.push({
      name,
      description: typeof r.description === "string" && r.description.trim() ? r.description.trim() : null,
      url: typeof r.url === "string" && /^https?:\/\//i.test(r.url) ? r.url : null,
      category,
    });
  }
  return out;
}

export async function suggestPoiAction(tripId: string, itemId: string): Promise<{ suggestions: AiPoint[] } | { error: string }> {
  await requireTripAccess(tripId, { write: true });
  if (!checkAiRateLimit(tripId)) {
    return { error: "Limite de sugestões de IA desta viagem atingido por hoje. Tente novamente mais tarde." };
  }
  const ctx = await loadItemContext(tripId, itemId);
  if (!ctx) return { error: "Atividade não encontrada." };

  const prompt = `Você ajuda viajantes a planejar roteiros. A atividade é "${ctx.title}" (${ctx.typeName}), no dia ${ctx.date}, em ${placeDescription(ctx)}.
Busque na web e sugira de 5 a 8 pontos de interesse reais e próximos (monumentos, ruas, praças, mirantes, lugares bons pra foto) relevantes pra essa atividade.
Responda em português, só com um array JSON, sem nenhum texto antes ou depois, no formato:
[{"name": "...", "description": "uma frase curta explicando por que vale a pena", "url": "link oficial ou de informação, só se tiver certeza que existe, senão null"}]
Não invente lugares nem links.`;

  const result = await askAiForJsonArray(prompt);
  if ("error" in result) return result;
  return { suggestions: parsePoints(result.data, false) };
}

export async function suggestTipAction(
  tripId: string,
  itemId: string,
  context: string,
): Promise<{ suggestions: AiPoint[] } | { error: string }> {
  await requireTripAccess(tripId, { write: true });
  if (!checkAiRateLimit(tripId)) {
    return { error: "Limite de sugestões de IA desta viagem atingido por hoje. Tente novamente mais tarde." };
  }
  const ctx = await loadItemContext(tripId, itemId);
  if (!ctx) return { error: "Atividade não encontrada." };
  const trimmedContext = context.trim();
  if (!trimmedContext) return { error: "Descreva o que você procura." };

  const prompt = `Você ajuda viajantes a planejar roteiros. A atividade é "${ctx.title}" (${ctx.typeName}), no dia ${ctx.date}, em ${placeDescription(ctx)}.
O viajante quer dicas sobre: "${trimmedContext}".
Busque na web e sugira de 5 a 8 dicas reais e específicas (nomes de lugares, eventos ou recomendações), relevantes pro que ele descreveu.
Responda em português, só com um array JSON, sem nenhum texto antes ou depois, no formato:
[{"name": "...", "description": "uma frase curta explicando a dica", "url": "link oficial ou de informação, só se tiver certeza que existe, senão null", "category": "uma destas: ${TIP_CATEGORIES.join(", ")}"}]
Não invente lugares nem links.`;

  const result = await askAiForJsonArray(prompt);
  if ("error" in result) return result;
  return { suggestions: parsePoints(result.data, true) };
}

export async function saveSuggestedPointsAction(
  tripId: string,
  itemId: string,
  kind: "POI" | "TIP",
  items: AiPoint[],
): Promise<{ ok: true } | { error: string }> {
  await requireTripAccess(tripId, { write: true });
  const [owned] = await db
    .select({ id: t.itineraryItems.id })
    .from(t.itineraryItems)
    .where(and(eq(t.itineraryItems.id, itemId), eq(t.itineraryItems.tripId, tripId)))
    .limit(1);
  if (!owned) return { error: "Atividade não encontrada." };
  if (items.length === 0) return { ok: true };

  const existing = await db
    .select({ id: t.itineraryItemPoints.id })
    .from(t.itineraryItemPoints)
    .where(and(eq(t.itineraryItemPoints.itemId, itemId), eq(t.itineraryItemPoints.kind, kind)));

  await db.insert(t.itineraryItemPoints).values(
    items.map((item, i) => ({
      itemId,
      kind,
      name: item.name,
      description: item.description,
      url: item.url,
      category: kind === "TIP" ? ((item.category as TipCategory | null) ?? null) : null,
      position: existing.length + i,
    })),
  );
  return { ok: true };
}
