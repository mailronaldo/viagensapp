"use server";

import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { requireClient } from "@/lib/auth";
import { requireTripAccess } from "@/lib/access";
import { fail, str } from "@/lib/form";
import { parseTipCategoryIds } from "@/services/catalogs";

/**
 * O App Router do Next, numa navegação disparada por Server Action que
 * redireciona pra exatamente a mesma URL de onde o form foi enviado, às
 * vezes não busca os dados de novo (fica com a página antiga até um reload
 * manual). Um parâmetro só pra isso garante que a URL muda a cada envio.
 */
function bustCache(url: string) {
  return `${url}${url.includes("?") ? "&" : "?"}_r=${Date.now()}`;
}

/** Bairro/Região é obrigatório numa dica — confere que é do cliente informado e resolve a cidade a partir dele. */
async function parseNeighborhood(clientId: string, formData: FormData, back: string) {
  const neighborhoodId = str(formData, "neighborhoodId");
  if (!neighborhoodId) fail(back, "Selecione o Bairro/Região.");
  const [n] = await db
    .select({ id: t.cityNeighborhoods.id, cityId: t.cityNeighborhoods.cityId })
    .from(t.cityNeighborhoods)
    .innerJoin(t.cities, eq(t.cities.id, t.cityNeighborhoods.cityId))
    .where(and(eq(t.cityNeighborhoods.id, neighborhoodId), eq(t.cities.clientId, clientId)))
    .limit(1);
  if (!n) fail(back, "Bairro/região inválido.");
  return { cityId: n.cityId, neighborhoodId: n.id };
}

async function parseTip(clientId: string, formData: FormData, back: string) {
  const name = str(formData, "name");
  if (!name) fail(back, "Informe o nome da dica.");
  const { cityId, neighborhoodId } = await parseNeighborhood(clientId, formData, back);
  const categoryIds = await parseTipCategoryIds(formData.getAll("categoryIds").map(String).filter(Boolean));
  return {
    name,
    description: str(formData, "description"),
    cityId,
    neighborhoodId,
    categoryIds,
  };
}

async function setTipCategories(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], tipId: string, categoryIds: string[]) {
  await tx.delete(t.tipCategoryLinks).where(eq(t.tipCategoryLinks.tipId, tipId));
  if (categoryIds.length > 0) {
    await tx.insert(t.tipCategoryLinks).values(categoryIds.map((categoryId) => ({ tipId, categoryId })));
  }
}

// ---------- Gestor de Dicas (CRUD do repositório do cliente) ----------

export async function addTipAction(formData: FormData) {
  const user = await requireClient();
  const back = "/tips";
  const { categoryIds, ...v } = await parseTip(user.id, formData, back);
  await db.transaction(async (tx) => {
    const [created] = await tx.insert(t.tips).values({ clientId: user.id, ...v }).returning({ id: t.tips.id });
    await setTipCategories(tx, created.id, categoryIds);
  });
  redirect(bustCache(back));
}

export async function updateTipAction(tipId: string, formData: FormData) {
  const user = await requireClient();
  const back = "/tips";
  const [existing] = await db.select({ id: t.tips.id }).from(t.tips).where(and(eq(t.tips.id, tipId), eq(t.tips.clientId, user.id))).limit(1);
  if (!existing) fail(back, "Dica não encontrada.");
  const { categoryIds, ...v } = await parseTip(user.id, formData, back);
  await db.transaction(async (tx) => {
    await tx.update(t.tips).set(v).where(eq(t.tips.id, tipId));
    await setTipCategories(tx, tipId, categoryIds);
  });
  redirect(bustCache(back));
}

export async function deleteTipAction(tipId: string) {
  const user = await requireClient();
  const back = "/tips";
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(t.itineraryItemTips)
    .innerJoin(t.tips, eq(t.tips.id, t.itineraryItemTips.tipId))
    .where(and(eq(t.itineraryItemTips.tipId, tipId), eq(t.tips.clientId, user.id)));
  if (count > 0) {
    fail(back, `Essa dica está em uso em ${count} atividade${count > 1 ? "s" : ""}. Remova o vínculo antes de excluir.`);
  }
  await db.delete(t.tips).where(and(eq(t.tips.id, tipId), eq(t.tips.clientId, user.id)));
  redirect(bustCache(back));
}

// ---------- Uso da dica dentro de uma atividade ----------

function itemEditPath(tripId: string, itemId: string) {
  return `/trips/${tripId}/itinerary/items/${itemId}`;
}

async function ownItem(tripId: string, itemId: string) {
  const [row] = await db
    .select({ id: t.itineraryItems.id, cityId: t.itineraryItems.cityId, neighborhoodId: t.itineraryItems.neighborhoodId })
    .from(t.itineraryItems)
    .where(and(eq(t.itineraryItems.id, itemId), eq(t.itineraryItems.tripId, tripId)))
    .limit(1);
  return row ?? null;
}

export async function linkExistingTipAction(tripId: string, itemId: string, formData: FormData) {
  const { trip } = await requireTripAccess(tripId, { write: true });
  const back = itemEditPath(tripId, itemId);
  if (!(await ownItem(tripId, itemId))) redirect(`/trips/${tripId}/itinerary`);

  const tipId = str(formData, "tipId");
  if (!tipId) fail(back, "Selecione uma dica.");
  const [tip] = await db.select({ id: t.tips.id }).from(t.tips).where(and(eq(t.tips.id, tipId), eq(t.tips.clientId, trip.ownerId))).limit(1);
  if (!tip) fail(back, "Dica não encontrada.");

  const existing = await db.select({ id: t.itineraryItemTips.id }).from(t.itineraryItemTips).where(eq(t.itineraryItemTips.itemId, itemId));
  await db.insert(t.itineraryItemTips).values({ itemId, tipId, position: existing.length }).onConflictDoNothing();
  redirect(bustCache(back));
}

export async function createAndLinkTipAction(tripId: string, itemId: string, formData: FormData) {
  const { trip } = await requireTripAccess(tripId, { write: true });
  const back = itemEditPath(tripId, itemId);
  const item = await ownItem(tripId, itemId);
  if (!item) redirect(`/trips/${tripId}/itinerary`);
  if (!item.neighborhoodId) {
    fail(back, "Defina o Bairro/Região da atividade antes de cadastrar uma dica manualmente.");
  }

  const name = str(formData, "name");
  if (!name) fail(back, "Informe o nome da dica.");
  const categoryIds = await parseTipCategoryIds(formData.getAll("categoryIds").map(String).filter(Boolean));

  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(t.tips)
      .values({
        clientId: trip.ownerId,
        name,
        description: str(formData, "description"),
        cityId: item.cityId!,
        neighborhoodId: item.neighborhoodId!,
      })
      .returning({ id: t.tips.id });
    if (categoryIds.length > 0) {
      await tx.insert(t.tipCategoryLinks).values(categoryIds.map((categoryId) => ({ tipId: created.id, categoryId })));
    }
    const existing = await tx.select({ id: t.itineraryItemTips.id }).from(t.itineraryItemTips).where(eq(t.itineraryItemTips.itemId, itemId));
    await tx.insert(t.itineraryItemTips).values({ itemId, tipId: created.id, position: existing.length });
  });
  redirect(bustCache(back));
}

export async function unlinkTipAction(tripId: string, itemId: string, tipId: string) {
  await requireTripAccess(tripId, { write: true });
  await db
    .delete(t.itineraryItemTips)
    .where(and(eq(t.itineraryItemTips.itemId, itemId), eq(t.itineraryItemTips.tipId, tipId)));
  redirect(bustCache(itemEditPath(tripId, itemId)));
}
