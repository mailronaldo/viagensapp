"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { ISO_DATE, fail, parseDecimal, str } from "@/lib/form";
import { isInTripGroup } from "@/services/trip-travelers";
import {
  addPayment,
  sourceBelongsToTrip,
  updatePayment,
  type PaymentSourceType,
} from "@/services/payments";

const PAYMENT_METHODS = ["PIX", "CREDITO", "DEBITO", "DINHEIRO"] as const;
const PAYMENT_FORMS = ["AVISTA", "PARCELADO"] as const;

/**
 * Parse comum entre lançar e editar um pagamento — confere acesso de
 * escrita, que a origem pertence à viagem, pagador, quem gerou o custo
 * (grupo ou viajante), data, meio, forma, parcelas, valor e categoria
 * (categoria é ignorada pela origem quando ela já tem categoria própria —
 * ver `addPayment`/`updatePayment`).
 */
async function parsePaymentInput(tripId: string, sourceType: PaymentSourceType, sourceId: string, back: string, formData: FormData) {
  const { trip } = await requireTripAccess(tripId, { write: true });
  if (!(await sourceBelongsToTrip(sourceType, sourceId, tripId))) redirect(`/trips/${tripId}`);

  const travelerRaw = str(formData, "payerTravelerId");
  const payerTravelerId = travelerRaw === "owner" ? null : travelerRaw;
  if (!(await isInTripGroup(trip, payerTravelerId))) fail(back, "Esse pagador não está nesta viagem.");

  const costWhoRaw = str(formData, "costWho");
  const costIsGroup = costWhoRaw === "group";
  const costTravelerId = costIsGroup ? null : costWhoRaw === "owner" ? null : costWhoRaw;
  if (!costIsGroup && !(await isInTripGroup(trip, costTravelerId))) fail(back, "Esse responsável pelo custo não está nesta viagem.");

  const paymentDate = str(formData, "paymentDate");
  if (!paymentDate || !ISO_DATE.test(paymentDate)) fail(back, "Data de pagamento inválida.");

  const methodRaw = str(formData, "method");
  if (!methodRaw || !PAYMENT_METHODS.includes(methodRaw as (typeof PAYMENT_METHODS)[number])) fail(back, "Selecione o meio de pagamento.");
  const method = methodRaw as (typeof PAYMENT_METHODS)[number];

  const formRaw = str(formData, "form");
  const form = formRaw && PAYMENT_FORMS.includes(formRaw as (typeof PAYMENT_FORMS)[number]) ? (formRaw as (typeof PAYMENT_FORMS)[number]) : "AVISTA";

  const amount = parseDecimal(str(formData, "amount"), { positive: true });
  if (amount === null) fail(back, "Informe um valor válido maior que zero.");

  const categoryRaw = str(formData, "category");
  let category: string | null = null;
  if (categoryRaw) {
    const [cat] = await db.select({ id: t.expenseCategories.id }).from(t.expenseCategories).where(eq(t.expenseCategories.id, categoryRaw)).limit(1);
    if (!cat) fail(back, "Categoria inválida.");
    category = categoryRaw;
  }

  return {
    payerTravelerId,
    costIsGroup,
    costTravelerId,
    paymentDate,
    method,
    form,
    installments: str(formData, "installments"),
    amount,
    category,
  };
}

/**
 * Lança um pagamento novo contra qualquer origem de custo da viagem
 * (despesa, reserva/voucher de atividade, custo avulso, ingresso, passe,
 * voucher de transporte/hospedagem, seguro).
 * "OUTRO" não entra nas opções do form (só existe em pagamentos de backfill).
 */
export async function addPaymentAction(tripId: string, sourceType: PaymentSourceType, sourceId: string, back: string, formData: FormData) {
  const input = await parsePaymentInput(tripId, sourceType, sourceId, back, formData);
  try {
    await addPayment(sourceType, sourceId, input);
  } catch {
    fail(back, "Não foi possível lançar o pagamento — registro de origem não encontrado.");
  }
  redirect(back);
}

/** Edita um pagamento já lançado — pagador, data, meio, forma, parcelas, valor e categoria. */
export async function updatePaymentAction(
  tripId: string,
  sourceType: PaymentSourceType,
  sourceId: string,
  paymentId: string,
  back: string,
  formData: FormData,
) {
  const input = await parsePaymentInput(tripId, sourceType, sourceId, back, formData);
  try {
    await updatePayment(paymentId, sourceType, sourceId, input);
  } catch {
    fail(back, "Não foi possível editar o pagamento.");
  }
  redirect(back);
}
