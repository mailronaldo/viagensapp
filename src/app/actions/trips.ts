"use server";

import { redirect } from "next/navigation";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { and, asc, count, eq, gt, inArray, isNotNull, lt, or } from "drizzle-orm";
import { db, t } from "@/db";
import { requireClient } from "@/lib/auth";
import { requireTripAccess } from "@/lib/access";
import { TIMEZONES } from "@/lib/labels";
import { listClientCurrencyCodes } from "@/services/currencies";
import { ISO_DATE, fail, file, str } from "@/lib/form";
import { formatDate } from "@/lib/format";
import { removeDocument } from "@/services/documents";
import { deleteStoredFile, saveFile } from "@/lib/storage";

const MAX_ICON_BYTES = 2 * 1024 * 1024;
const ICON_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

function validateIcon(icon: File | null) {
  if (!icon) return;
  if (icon.size > MAX_ICON_BYTES) throw new Error("O ícone pode ter até 2 MB.");
  if (!ICON_MIME.has(icon.type)) throw new Error("Formato de ícone não suportado. Use PNG, JPG ou WEBP.");
}

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
  const ownerIsTraveler = str(formData, "ownerIsTraveler") === "yes";
  const cityIds = [...new Set(formData.getAll("cityIds").map(String).filter(Boolean))];
  const icon = file(formData, "icon");

  if (!title) fail(back, "Informe um nome para a viagem.");
  if (!destination) fail(back, "Informe a breve descrição.");
  if (!startDate || !ISO_DATE.test(startDate)) fail(back, "Data de ida inválida.");
  if (!endDate || !ISO_DATE.test(endDate)) fail(back, "Data de volta inválida.");
  if (endDate < startDate) fail(back, "A volta não pode ser antes da ida.");
  if (!(TIMEZONES as readonly string[]).includes(timezone)) fail(back, "Fuso horário inválido.");
  if (!(await listClientCurrencyCodes(user.id)).includes(baseCurrency)) fail(back, "Moeda inválida.");
  if (cityIds.length === 0) fail(back, "Selecione ao menos uma cidade.");
  try {
    validateIcon(icon);
  } catch (e) {
    fail(back, e instanceof Error ? e.message : "Ícone inválido.");
  }

  const ownedCities = await db
    .select({ id: t.cities.id })
    .from(t.cities)
    .where(and(eq(t.cities.clientId, user.id), inArray(t.cities.id, cityIds)));
  if (ownedCities.length !== cityIds.length) fail(back, "Cidade inválida.");

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
        ownerIsTraveler,
      })
      .returning({ id: t.trips.id });
    await tx
      .insert(t.tripMembers)
      .values({ tripId: trip.id, userId: user.id, role: "OWNER" });
    await tx
      .insert(t.tripCities)
      .values(cityIds.map((cityId, position) => ({ tripId: trip.id, cityId, position })));
    return trip.id;
  });

  if (icon) {
    const iconKey = await saveFile(tripId, icon);
    await db.update(t.trips).set({ iconKey, iconMimeType: icon.type }).where(eq(t.trips.id, tripId));
  }

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
  const ownerIsTraveler = str(formData, "ownerIsTraveler") === "yes";
  const icon = file(formData, "icon");
  const removeIcon = formData.get("removeIcon") === "on";

  if (!title) fail(back, "Informe um nome para a viagem.");
  if (!destination) fail(back, "Informe a breve descrição.");
  if (!startDate || !ISO_DATE.test(startDate)) fail(back, "Data de ida inválida.");
  if (!endDate || !ISO_DATE.test(endDate)) fail(back, "Data de volta inválida.");
  if (endDate < startDate) fail(back, "A volta não pode ser antes da ida.");
  if (!(TIMEZONES as readonly string[]).includes(timezone)) fail(back, "Fuso horário inválido.");
  if (!(await listClientCurrencyCodes(trip.ownerId)).includes(baseCurrency)) fail(back, "Moeda inválida.");
  try {
    validateIcon(icon);
  } catch (e) {
    fail(back, e instanceof Error ? e.message : "Ícone inválido.");
  }

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
      .set({
        title,
        destination,
        startDate,
        endDate,
        timezone,
        baseCurrency,
        notes: str(formData, "notes"),
        ownerIsTraveler,
      })
      .where(eq(t.trips.id, tripId));
    // Dias vazios que ficaram fora do período não têm utilidade.
    await tx
      .delete(t.tripDays)
      .where(
        and(eq(t.tripDays.tripId, tripId), or(lt(t.tripDays.date, startDate), gt(t.tripDays.date, endDate))),
      );
  });

  if (icon) {
    const iconKey = await saveFile(tripId, icon);
    await db.update(t.trips).set({ iconKey, iconMimeType: icon.type }).where(eq(t.trips.id, tripId));
    if (trip.iconKey) await deleteStoredFile(trip.iconKey);
  } else if (removeIcon && trip.iconKey) {
    await db.update(t.trips).set({ iconKey: null, iconMimeType: null }).where(eq(t.trips.id, tripId));
    await deleteStoredFile(trip.iconKey);
  }

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
  if (trip.iconKey) await deleteStoredFile(trip.iconKey);
  await db.delete(t.trips).where(eq(t.trips.id, trip.id));
  redirect("/");
}

