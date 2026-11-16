import "server-only";
import { fail, parseDecimal, parseEnum, str } from "@/lib/form";
import type { NewErrandEntry } from "@/services/errands";

export const VALUE_STATUSES = ["ESTIMADO", "ORCAMENTO", "REALIZADO"] as const;
export const PAYMENT_STATUSES = ["A_PAGAR", "PAGO"] as const;
export const PURCHASE_STATUSES = ["AGUARDANDO_COMPRA", "PEDIDO_APROVACAO", "COMPRA_EFETUADA"] as const;

/** Lê o valor + os 3 status de um lançamento do form — usado tanto ao criar a encomenda quanto ao lançar uma atualização. */
export function parseErrandEntry(formData: FormData, back: string): NewErrandEntry {
  const priceRaw = str(formData, "price");
  const price = parseDecimal(priceRaw, { positive: true });
  if (priceRaw && price === null) fail(back, "Valor inválido.");
  const currency = str(formData, "currency");

  return {
    price,
    currency: price ? currency : null,
    valueStatus: parseEnum(str(formData, "valueStatus"), VALUE_STATUSES, "ESTIMADO"),
    paymentStatus: parseEnum(str(formData, "paymentStatus"), PAYMENT_STATUSES, "A_PAGAR"),
    purchaseStatus: parseEnum(str(formData, "purchaseStatus"), PURCHASE_STATUSES, "AGUARDANDO_COMPRA"),
  };
}
