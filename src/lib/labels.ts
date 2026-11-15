// Rótulos em português para os enums do banco.

export const VALUE_STATUS_LABEL = {
  ESTIMADO: "Estimado",
  A_PAGAR: "A pagar",
  PAGO: "Pago",
} as const;

export const VALUE_STATUS_TONE = {
  ESTIMADO: "warn",
  A_PAGAR: "info",
  PAGO: "ok",
} as const;

export const ERRAND_VALUE_STATUS_LABEL = {
  ESTIMADO: "Estimado",
  ORCAMENTO: "Orçamento",
  REALIZADO: "Realizado",
} as const;

export const ERRAND_VALUE_STATUS_TONE = {
  ESTIMADO: "warn",
  ORCAMENTO: "info",
  REALIZADO: "ok",
} as const;

export const ERRAND_PAYMENT_STATUS_LABEL = {
  A_PAGAR: "A pagar",
  PAGO: "Pago",
} as const;

export const ERRAND_PAYMENT_STATUS_TONE = {
  A_PAGAR: "warn",
  PAGO: "ok",
} as const;

export const ERRAND_PURCHASE_STATUS_LABEL = {
  AGUARDANDO_COMPRA: "Aguardando compra",
  PEDIDO_APROVACAO: "Pedido de aprovação",
  COMPRA_EFETUADA: "Compra efetuada",
} as const;

export const ERRAND_PURCHASE_STATUS_TONE = {
  AGUARDANDO_COMPRA: "neutral",
  PEDIDO_APROVACAO: "warn",
  COMPRA_EFETUADA: "ok",
} as const;


export const TRIP_TYPE_LABEL = {
  ONE_WAY: "Somente ida",
  ROUND_TRIP: "Ida e volta",
  MULTI_LEG: "Múltiplos trechos",
} as const;

export const TIMEZONES = [
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "America/Santiago",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Europe/Lisbon",
  "Europe/Madrid",
  "Europe/Paris",
  "Europe/Rome",
  "Europe/London",
  "Asia/Tokyo",
  "Australia/Sydney",
] as const;
