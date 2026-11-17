"use server";

import { redirect } from "next/navigation";
import { requireTripAccess } from "@/lib/access";
import { ISO_DATE, fail, parseDecimal, str } from "@/lib/form";
import { isInTripGroup } from "@/services/trip-travelers";
import { addPayment, sourceBelongsToTrip, type PaymentSourceType } from "@/services/payments";

const PAYMENT_METHODS = ["PIX", "CREDITO", "DEBITO", "DINHEIRO"] as const;
const PAYMENT_FORMS = ["AVISTA", "PARCELADO"] as const;

/**
 * Lança um pagamento novo contra qualquer origem de custo da viagem
 * (despesa, custo/reserva de atividade, ingresso, passe, voucher de
 * transporte/hospedagem, seguro) — nunca edita/apaga um pagamento anterior.
 * "OUTRO" não entra nas opções do form (só existe em pagamentos de backfill).
 */
export async function addPaymentAction(tripId: string, sourceType: PaymentSourceType, sourceId: string, back: string, formData: FormData) {
  const { trip } = await requireTripAccess(tripId, { write: true });
  if (!(await sourceBelongsToTrip(sourceType, sourceId, tripId))) redirect(`/trips/${tripId}`);

  const travelerRaw = str(formData, "payerTravelerId");
  const payerTravelerId = travelerRaw === "owner" ? null : travelerRaw;
  if (!(await isInTripGroup(trip, payerTravelerId))) fail(back, "Esse pagador não está nesta viagem.");

  const paymentDate = str(formData, "paymentDate");
  if (!paymentDate || !ISO_DATE.test(paymentDate)) fail(back, "Data de pagamento inválida.");

  const methodRaw = str(formData, "method");
  if (!methodRaw || !PAYMENT_METHODS.includes(methodRaw as (typeof PAYMENT_METHODS)[number])) fail(back, "Selecione o meio de pagamento.");
  const method = methodRaw as (typeof PAYMENT_METHODS)[number];

  const formRaw = str(formData, "form");
  const form = formRaw && PAYMENT_FORMS.includes(formRaw as (typeof PAYMENT_FORMS)[number]) ? (formRaw as (typeof PAYMENT_FORMS)[number]) : "AVISTA";

  const amount = parseDecimal(str(formData, "amount"), { positive: true });
  if (amount === null) fail(back, "Informe um valor válido maior que zero.");

  try {
    await addPayment(sourceType, sourceId, {
      payerTravelerId,
      paymentDate,
      method,
      form,
      installments: str(formData, "installments"),
      amount,
    });
  } catch {
    fail(back, "Não foi possível lançar o pagamento — registro de origem não encontrado.");
  }
  redirect(back);
}
