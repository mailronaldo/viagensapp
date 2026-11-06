"use server";

import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { requireMaster } from "@/lib/auth";
import { fail, str } from "@/lib/form";
import { RESERVED_ACTIVITY_TYPE_NAMES } from "@/services/catalogs";

export async function addDocumentTypeAction(formData: FormData) {
  await requireMaster();
  const back = "/agency/system/document-types";
  const name = str(formData, "name");
  if (!name) fail(back, "Informe o nome do tipo de documento.");
  await db.insert(t.documentTypes).values({ name });
  redirect(back);
}

export async function deleteDocumentTypeAction(id: string) {
  await requireMaster();
  const back = "/agency/system/document-types";
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(t.documents)
    .where(eq(t.documents.type, id));
  if (count > 0) {
    fail(back, `Esse tipo está em uso em ${count} documento${count > 1 ? "s" : ""}. Não dá pra excluir.`);
  }
  await db.delete(t.documentTypes).where(eq(t.documentTypes.id, id));
  redirect(back);
}

export async function addExpenseCategoryAction(formData: FormData) {
  await requireMaster();
  const back = "/agency/system/expense-categories";
  const name = str(formData, "name");
  if (!name) fail(back, "Informe o nome da categoria de custo.");
  await db.insert(t.expenseCategories).values({ name });
  redirect(back);
}

export async function deleteExpenseCategoryAction(id: string) {
  await requireMaster();
  const back = "/agency/system/expense-categories";
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(t.expenses)
    .where(eq(t.expenses.category, id));
  if (count > 0) {
    fail(back, `Essa categoria está em uso em ${count} custo${count > 1 ? "s" : ""}. Não dá pra excluir.`);
  }
  await db.delete(t.expenseCategories).where(eq(t.expenseCategories.id, id));
  redirect(back);
}

export async function addActivityTypeAction(formData: FormData) {
  await requireMaster();
  const back = "/agency/system/activity-types";
  const name = str(formData, "name");
  if (!name) fail(back, "Informe o nome do tipo de atividade.");
  if (RESERVED_ACTIVITY_TYPE_NAMES.includes(name.trim().toLowerCase())) {
    fail(
      back,
      "Esse nome é reservado: hospedagens e transportes têm cadastro próprio e entram na agenda automaticamente.",
    );
  }
  await db.insert(t.activityTypes).values({ name });
  redirect(back);
}

export async function deleteActivityTypeAction(id: string) {
  await requireMaster();
  const back = "/agency/system/activity-types";
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(t.itineraryItems)
    .where(eq(t.itineraryItems.type, id));
  if (count > 0) {
    fail(back, `Esse tipo está em uso em ${count} atividade${count > 1 ? "s" : ""}. Não dá pra excluir.`);
  }
  await db.delete(t.activityTypes).where(eq(t.activityTypes.id, id));
  redirect(back);
}

export async function addBookingTypeAction(formData: FormData) {
  await requireMaster();
  const back = "/agency/system/booking-types";
  const name = str(formData, "name");
  if (!name) fail(back, "Informe o nome do tipo de transporte.");
  await db.insert(t.bookingTypes).values({ name });
  redirect(back);
}

export async function deleteBookingTypeAction(id: string) {
  await requireMaster();
  const back = "/agency/system/booking-types";
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(t.bookings)
    .where(eq(t.bookings.type, id));
  if (count > 0) {
    fail(back, `Esse tipo está em uso em ${count} transporte${count > 1 ? "s" : ""}. Não dá pra excluir.`);
  }
  await db.delete(t.bookingTypes).where(eq(t.bookingTypes.id, id));
  redirect(back);
}

export async function addLodgingTypeAction(formData: FormData) {
  await requireMaster();
  const back = "/agency/system/lodging-types";
  const name = str(formData, "name");
  if (!name) fail(back, "Informe o nome do tipo de hospedagem.");
  await db.insert(t.lodgingTypes).values({ name });
  redirect(back);
}

export async function deleteLodgingTypeAction(id: string) {
  await requireMaster();
  const back = "/agency/system/lodging-types";
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(t.lodgings)
    .where(eq(t.lodgings.type, id));
  if (count > 0) {
    fail(back, `Esse tipo está em uso em ${count === 1 ? "1 hospedagem" : `${count} hospedagens`}. Não dá pra excluir.`);
  }
  await db.delete(t.lodgingTypes).where(eq(t.lodgingTypes.id, id));
  redirect(back);
}

export async function addReservationMethodAction(formData: FormData) {
  await requireMaster();
  const back = "/agency/system/reservation-methods";
  const name = str(formData, "name");
  if (!name) fail(back, "Informe o nome do método de reserva.");
  await db.insert(t.reservationMethods).values({ name });
  redirect(back);
}

export async function deleteReservationMethodAction(id: string) {
  await requireMaster();
  const back = "/agency/system/reservation-methods";
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(t.lodgings)
    .where(eq(t.lodgings.provider, id));
  if (count > 0) {
    fail(back, `Esse método está em uso em ${count === 1 ? "1 hospedagem" : `${count} hospedagens`}. Não dá pra excluir.`);
  }
  await db.delete(t.reservationMethods).where(eq(t.reservationMethods.id, id));
  redirect(back);
}
