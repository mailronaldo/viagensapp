"use server";

import { redirect } from "next/navigation";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { and, asc, count, eq, gt, isNotNull, lt, or } from "drizzle-orm";
import { db, t } from "@/db";
import { requireClient } from "@/lib/auth";
import { requireTripAccess } from "@/lib/access";
import { CURRENCIES, TIMEZONES } from "@/lib/labels";
import { ISO_DATE, fail, str } from "@/lib/form";
import { formatDate } from "@/lib/format";
import { removeDocument } from "@/services/documents";

export async function createTripAction(formData: FormData) {
  // Só clientes têm viagens; a agência cria viagens "como" um cliente (área do cliente).
  const user = await requireClient();
  const back = "/trips/new";

  const title = str(formData, "title");
  const destination = str(formData, "destination");
  const startDate = str(formData, "startDate");
  const endDate = str(formData, "endDate");
  const timezone = str(formData, "timezone") ?? "America/Sao_Paulo";
  const baseCurrency = str(formData, "baseCurrency") ?? "BRL";
  const notes = str(formData, "notes");

  if (!title) fail(back, "Informe um nome para a viagem.");
  if (!destination) fail(back, "Informe o destino.");
  if (!startDate || !ISO_DATE.test(startDate)) fail(back, "Data de ida inválida.");
  if (!endDate || !ISO_DATE.test(endDate)) fail(back, "Data de volta inválida.");
  if (endDate < startDate) fail(back, "A volta não pode ser antes da ida.");
  if (!(TIMEZONES as readonly string[]).includes(timezone)) fail(back, "Fuso horário inválido.");
  if (!(CURRENCIES as readonly string[]).includes(baseCurrency)) fail(back, "Moeda inválida.");

  const tripId = await db.transaction(async (tx) => {
    const [trip] = await tx
      .insert(t.trips)
      .values({
        ownerId: user.id,
        title,
        destination,
        startDate,
        endDate,
        timezone,
        baseCurrency,
        notes,
      })
      .returning({ id: t.trips.id });
    await tx
      .insert(t.tripMembers)
      .values({ tripId: trip.id, userId: user.id, role: "OWNER" });
    return trip.id;
  });

  redirect(`/trips/${tripId}`);
}

export async function updateTripAction(tripId: string, formData: FormData) {
  const { role, trip } = await requireTripAccess(tripId, { write: true });
  const back = `/trips/${tripId}/edit`;
  if (role !== "OWNER") fail(`/trips/${tripId}`, "Só o dono da viagem pode alterar o cadastro.");

  const title = str(formData, "title");
  const destination = str(formData, "destination");
  const startDate = str(formData, "startDate");
  const endDate = str(formData, "endDate");
  const timezone = str(formData, "timezone") ?? trip.timezone;
  const baseCurrency = str(formData, "baseCurrency") ?? trip.baseCurrency;

  if (!title) fail(back, "Informe um nome para a viagem.");
  if (!destination) fail(back, "Informe o destino.");
  if (!startDate || !ISO_DATE.test(startDate)) fail(back, "Data de ida inválida.");
  if (!endDate || !ISO_DATE.test(endDate)) fail(back, "Data de volta inválida.");
  if (endDate < startDate) fail(back, "A volta não pode ser antes da ida.");
  if (!(TIMEZONES as readonly string[]).includes(timezone)) fail(back, "Fuso horário inválido.");
  if (!(CURRENCIES as readonly string[]).includes(baseCurrency)) fail(back, "Moeda inválida.");

  // Ao encurtar/mover o período, nada do roteiro pode ficar de fora das novas datas.
  if (startDate !== trip.startDate || endDate !== trip.endDate) {
    const outside = (col: AnyPgColumn) => or(lt(col, startDate), gt(col, endDate));

    const [items, plans] = await Promise.all([
      db
        .select({ date: t.itineraryItems.date })
        .from(t.itineraryItems)
        .where(and(eq(t.itineraryItems.tripId, tripId), outside(t.itineraryItems.date)))
        .orderBy(asc(t.itineraryItems.date)),
      db
        .select({ date: t.tripDays.date })
        .from(t.tripDays)
        .where(
          and(
            eq(t.tripDays.tripId, tripId),
            outside(t.tripDays.date),
            or(isNotNull(t.tripDays.title), isNotNull(t.tripDays.summary)),
          ),
        )
        .orderBy(asc(t.tripDays.date))
    ]);

    const problems: string[] = [];
    if (items.length) {
      problems.push(
        `${items.length} atividade(s) do roteiro fora do novo período (a partir de ${formatDate(items[0].date)})`,
      );
    }
    if (plans.length) {
      problems.push(`${plans.length} resumo(s) de dia fora do novo período (${formatDate(plans[0].date)})`);
    }
    if (problems.length) {
      fail(
        back,
        `Não dá para alterar as datas: ${problems.join("; ")}. Mova ou exclua esses itens no roteiro e tente de novo.`,
      );
    }
  }

  // Trocar a moeda base reinterpretaria cotações já lançadas.
  if (baseCurrency !== trip.baseCurrency) {
    const [{ n }] = await db
      .select({ n: count() })
      .from(t.expenses)
      .where(eq(t.expenses.tripId, tripId));
    if (n > 0) {
      fail(
        back,
        "Não dá para trocar a moeda base com custos já lançados (as cotações perderiam o sentido). Exclua os custos ou mantenha a moeda.",
      );
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(t.trips)
      .set({ title, destination, startDate, endDate, timezone, baseCurrency, notes: str(formData, "notes") })
      .where(eq(t.trips.id, tripId));
    // Dias vazios que ficaram fora do período não têm utilidade.
    await tx
      .delete(t.tripDays)
      .where(
        and(eq(t.tripDays.tripId, tripId), or(lt(t.tripDays.date, startDate), gt(t.tripDays.date, endDate))),
      );
  });

  redirect(`/trips/${tripId}`);
}

export async function deleteTripAction(tripId: string) {
  const { role, trip } = await requireTripAccess(tripId);
  if (role !== "OWNER") throw new Error("Só o dono da viagem pode excluí-la.");
  // Os arquivos em disco são removidos antes; o banco apaga o resto em cascata.
  const docs = await db
    .select({ id: t.documents.id })
    .from(t.documents)
    .where(eq(t.documents.tripId, trip.id));
  for (const d of docs) await removeDocument(trip.id, d.id);
  await db.delete(t.trips).where(eq(t.trips.id, trip.id));
  redirect("/");
}

// ---------- Cidades ----------

export async function addCityAction(tripId: string, formData: FormData) {
  await requireTripAccess(tripId, { write: true });
  const back = `/trips/${tripId}/itinerary`;
  const name = str(formData, "name");
  if (!name) fail(back, "Informe o nome da cidade.");

  const existing = await db
    .select({ id: t.cities.id })
    .from(t.cities)
    .where(eq(t.cities.tripId, tripId));

  await db.insert(t.cities).values({
    tripId,
    name,
    country: str(formData, "country"),
    position: existing.length,
  });
  redirect(back);
}

export async function deleteCityAction(tripId: string, cityId: string) {
  await requireTripAccess(tripId, { write: true });
  await db
    .delete(t.cities)
    .where(and(eq(t.cities.id, cityId), eq(t.cities.tripId, tripId)));
  redirect(`/trips/${tripId}/itinerary`);
}
