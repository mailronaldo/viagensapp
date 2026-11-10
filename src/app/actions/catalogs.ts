"use server";

import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { requireMaster } from "@/lib/auth";
import { fail, str } from "@/lib/form";
import {
  RESERVED_ACTIVITY_TYPE_NAMES,
  RESERVED_DOCUMENT_TYPE_IDS,
  RESERVED_EXPENSE_CATEGORY_NAMES,
} from "@/services/catalogs";

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
  if (RESERVED_DOCUMENT_TYPE_IDS.includes(id)) {
    fail(back, "Esse tipo é usado automaticamente pelo sistema (ícones, vouchers, ingressos, reservas, recibos) e não pode ser excluído.");
  }
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
  const [category] = await db.select({ name: t.expenseCategories.name }).from(t.expenseCategories).where(eq(t.expenseCategories.id, id)).limit(1);
  if (category && RESERVED_EXPENSE_CATEGORY_NAMES.includes(category.name)) {
    fail(back, "Essa categoria é reservada pelo sistema (usada automaticamente em ingressos) e não pode ser excluída.");
  }
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

export async function addTipCategoryAction(formData: FormData) {
  await requireMaster();
  const back = "/agency/system/tip-categories";
  const name = str(formData, "name");
  if (!name) fail(back, "Informe o nome da categoria de dica.");
  await db.insert(t.tipCategories).values({ name });
  redirect(back);
}

export async function deleteTipCategoryAction(id: string) {
  await requireMaster();
  const back = "/agency/system/tip-categories";
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(t.tipCategoryLinks)
    .where(eq(t.tipCategoryLinks.categoryId, id));
  if (count > 0) {
    fail(back, `Essa categoria está em uso em ${count} dica${count > 1 ? "s" : ""}. Não dá pra excluir.`);
  }
  await db.delete(t.tipCategories).where(eq(t.tipCategories.id, id));
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

export async function addLodgingTypeSubcategoryAction(lodgingTypeId: string, formData: FormData) {
  await requireMaster();
  const back = "/agency/system/lodging-types";
  const name = str(formData, "name");
  if (!name) fail(back, "Informe o nome da subcategoria.");
  const [lodgingType] = await db.select({ id: t.lodgingTypes.id }).from(t.lodgingTypes).where(eq(t.lodgingTypes.id, lodgingTypeId)).limit(1);
  if (!lodgingType) fail(back, "Tipo de hospedagem inválido.");
  try {
    await db.insert(t.lodgingTypeSubcategories).values({ lodgingTypeId, name });
  } catch {
    fail(back, "Essa subcategoria já existe para este tipo.");
  }
  redirect(back);
}

export async function deleteLodgingTypeSubcategoryAction(id: string) {
  await requireMaster();
  const back = "/agency/system/lodging-types";
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(t.lodgingVouchers)
    .where(eq(t.lodgingVouchers.subcategoryId, id));
  if (count > 0) {
    fail(back, `Essa subcategoria está em uso em ${count === 1 ? "1 voucher" : `${count} vouchers`}. Não dá pra excluir.`);
  }
  await db.delete(t.lodgingTypeSubcategories).where(eq(t.lodgingTypeSubcategories.id, id));
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
    .from(t.lodgingVouchers)
    .where(eq(t.lodgingVouchers.provider, id));
  if (count > 0) {
    fail(back, `Esse método está em uso em ${count === 1 ? "1 voucher" : `${count} vouchers`}. Não dá pra excluir.`);
  }
  await db.delete(t.reservationMethods).where(eq(t.reservationMethods.id, id));
  redirect(back);
}
