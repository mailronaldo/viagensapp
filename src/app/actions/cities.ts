"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db, t } from "@/db";
import { requireClient } from "@/lib/auth";
import { requireTripAccess } from "@/lib/access";
import { fail, str } from "@/lib/form";
import { countryName, stateName } from "@/lib/geo";

function readCity(formData: FormData) {
  const name = str(formData, "name");
  const countryCode = str(formData, "countryCode");
  if (!countryCode) return { error: "Selecione o país." };
  if (!name) return { error: "Selecione a cidade." };
  const stateCode = str(formData, "stateCode");
  return {
    data: {
      name,
      countryCode,
      country: countryName(countryCode),
      stateCode,
      state: stateName(countryCode, stateCode),
    },
  };
}

/** Só devolve a cidade se ela pertencer ao cliente atual (isolamento entre clientes). */
async function ownCity(clientId: string, cityId: string) {
  const [row] = await db
    .select()
    .from(t.cities)
    .where(and(eq(t.cities.id, cityId), eq(t.cities.clientId, clientId)))
    .limit(1);
  return row ?? null;
}

// ---------- Cadastro do cliente ----------

export async function addCityAction(formData: FormData) {
  const user = await requireClient();
  const r = readCity(formData);
  if (r.error) fail("/cities", r.error);
  await db.insert(t.cities).values({ clientId: user.id, ...r.data! });
  redirect("/cities");
}

/** Exclui a cidade do catálogo do cliente — só se ela não estiver vinculada a nenhuma viagem. */
export async function deleteCityAction(back: string, cityId: string) {
  const user = await requireClient();
  const city = await ownCity(user.id, cityId);
  if (city) {
    const links = await db.select({ id: t.tripCities.id }).from(t.tripCities).where(eq(t.tripCities.cityId, cityId));
    if (links.length > 0) {
      fail(
        back,
        `Essa cidade está vinculada a ${links.length} viagem${links.length > 1 ? "ns" : ""}. Remova o vínculo nas viagens antes de excluir do catálogo.`,
      );
    }
    await db.delete(t.cities).where(eq(t.cities.id, cityId));
  }
  redirect(back);
}

// ---------- Cidades dentro de uma viagem ----------

/**
 * O App Router do Next, numa navegação disparada por Server Action que
 * redireciona pra exatamente a mesma URL de onde o form foi enviado, às
 * vezes não busca os dados de novo (fica com a página antiga até um reload
 * manual). Um parâmetro só pra isso garante que a URL muda a cada envio.
 */
function bustCache(url: string) {
  return `${url}${url.includes("?") ? "&" : "?"}_r=${Date.now()}`;
}

function citiesTab(tripId: string, error?: string) {
  return `/trips/${tripId}/cities${error ? `?error=${encodeURIComponent(error)}` : ""}`;
}

/** Vincula uma ou várias cidades já cadastradas (campo `cityIds`) à viagem. */
export async function linkCityAction(tripId: string, formData: FormData) {
  const { trip } = await requireTripAccess(tripId, { write: true });
  const ids = [...new Set(formData.getAll("cityIds").map(String).filter(Boolean))];
  const existing = await db
    .select({ id: t.tripCities.id })
    .from(t.tripCities)
    .where(eq(t.tripCities.tripId, tripId));
  let position = existing.length;
  for (const cityId of ids) {
    // A cidade precisa ser do mesmo cliente dono da viagem.
    const city = await ownCity(trip.ownerId, cityId);
    if (city) {
      const [inserted] = await db
        .insert(t.tripCities)
        .values({ tripId, cityId, position })
        .onConflictDoNothing()
        .returning({ id: t.tripCities.id });
      if (inserted) position += 1;
    }
  }
  redirect(citiesTab(tripId));
}

/** Remove a cidade do roteiro desta viagem — só se ela não estiver em uso. */
export async function unlinkCityAction(tripId: string, cityId: string) {
  await requireTripAccess(tripId, { write: true });

  const days = await db.select({ id: t.tripDays.id }).from(t.tripDays).where(eq(t.tripDays.tripId, tripId));
  const [dayCity, item, lodging] = await Promise.all([
    days.length
      ? db
          .select({ id: t.tripDayCities.tripDayId })
          .from(t.tripDayCities)
          .where(and(eq(t.tripDayCities.cityId, cityId), inArray(t.tripDayCities.tripDayId, days.map((d) => d.id))))
          .limit(1)
      : Promise.resolve([]),
    db
      .select({ id: t.itineraryItems.id })
      .from(t.itineraryItems)
      .where(and(eq(t.itineraryItems.tripId, tripId), eq(t.itineraryItems.cityId, cityId)))
      .limit(1),
    db
      .select({ id: t.lodgings.id })
      .from(t.lodgings)
      .where(and(eq(t.lodgings.tripId, tripId), eq(t.lodgings.cityId, cityId)))
      .limit(1),
  ]);

  if (dayCity.length || item.length || lodging.length) {
    const parts: string[] = [];
    if (dayCity.length) parts.push("um resumo de dia");
    if (item.length) parts.push("uma atividade do roteiro");
    if (lodging.length) parts.push("uma hospedagem");
    fail(citiesTab(tripId), `Essa cidade está sendo usada em ${parts.join(" e ")}. Remova essas referências antes de tirá-la da viagem.`);
  }

  await db.delete(t.tripCities).where(and(eq(t.tripCities.tripId, tripId), eq(t.tripCities.cityId, cityId)));
  redirect(citiesTab(tripId));
}

/** Cadastra uma cidade nova (para o cliente dono da viagem) e já a vincula à viagem. */
export async function createAndLinkCityAction(tripId: string, formData: FormData) {
  const { trip } = await requireTripAccess(tripId, { write: true });
  const r = readCity(formData);
  if (r.error) fail(citiesTab(tripId), r.error);
  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(t.cities)
      .values({ clientId: trip.ownerId, ...r.data! })
      .returning({ id: t.cities.id });
    const existing = await tx.select({ id: t.tripCities.id }).from(t.tripCities).where(eq(t.tripCities.tripId, tripId));
    await tx.insert(t.tripCities).values({ tripId, cityId: created.id, position: existing.length });
  });
  redirect(citiesTab(tripId));
}

// ---------- Bairros/regiões da cidade ----------

/** Cadastra um bairro/região numa cidade do cliente (back = pra onde redirecionar depois). */
export async function addNeighborhoodAction(back: string, cityId: string, formData: FormData) {
  const user = await requireClient();
  const city = await ownCity(user.id, cityId);
  if (!city) fail(back, "Cidade não encontrada.");
  const name = str(formData, "name");
  if (!name) fail(back, "Informe o nome do bairro/região.");

  const [dup] = await db
    .select({ id: t.cityNeighborhoods.id })
    .from(t.cityNeighborhoods)
    .where(and(eq(t.cityNeighborhoods.cityId, cityId), eq(t.cityNeighborhoods.name, name)))
    .limit(1);
  if (!dup) {
    await db.insert(t.cityNeighborhoods).values({ cityId, name });
  }
  revalidatePath(back.split("?")[0]);
  redirect(bustCache(back));
}

export async function deleteNeighborhoodAction(back: string, neighborhoodId: string) {
  const user = await requireClient();
  const [row] = await db
    .select({ id: t.cityNeighborhoods.id, cityId: t.cityNeighborhoods.cityId })
    .from(t.cityNeighborhoods)
    .where(eq(t.cityNeighborhoods.id, neighborhoodId))
    .limit(1);
  if (row) {
    const city = await ownCity(user.id, row.cityId);
    if (city) await db.delete(t.cityNeighborhoods).where(eq(t.cityNeighborhoods.id, neighborhoodId));
  }
  revalidatePath(back.split("?")[0]);
  redirect(bustCache(back));
}
