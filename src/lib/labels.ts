// Rótulos em português para os enums do banco.

export const ITEM_TYPE_LABEL = {
  ATTRACTION: "Atração",
  TOUR: "Passeio",
  MEAL: "Refeição",
  TRANSPORT: "Transporte",
  FREE_TIME: "Tempo livre",
  OTHER: "Outro",
} as const;

export const BOOKING_TYPE_LABEL = {
  FLIGHT: "Voo",
  HOTEL: "Hotel (antigo)", // legado: hotéis agora ficam em Hospedagens

  CAR_RENTAL: "Aluguel de carro",
  TRANSFER: "Transfer",
  TRAIN: "Trem",
  OTHER: "Outro",
} as const;

/** Tipos oferecidos nos formulários de Transportes (sem Hotel). */
export const BOOKING_TYPE_OPTIONS = ["FLIGHT", "TRANSFER", "TRAIN", "CAR_RENTAL", "OTHER"] as const;

export const LODGING_TYPE_LABEL = {
  HOTEL: "Hotel",
  RENTAL: "Aluguel / Airbnb",
  HOSTEL: "Hostel / pousada",
  RESORT: "Resort",
  OTHER: "Outro",
} as const;

export const EXPENSE_CATEGORY_LABEL = {
  FLIGHT: "Passagens",
  LODGING: "Hospedagem",
  FOOD: "Alimentação",
  TRANSPORT: "Transporte",
  ATTRACTION: "Passeios e ingressos",
  SHOPPING: "Compras",
  INSURANCE: "Seguro",
  OTHER: "Outros",
} as const;

export const DOCUMENT_TYPE_LABEL = {
  PASSPORT: "Passaporte",
  VISA: "Visto",
  INSURANCE: "Seguro viagem",
  TICKET: "Ingresso",
  VOUCHER: "Voucher",
  RECEIPT: "Nota / recibo",
  RESERVATION: "Reserva",
  OTHER: "Outro",
} as const;

export const CURRENCIES = ["BRL", "USD", "EUR", "GBP", "ARS", "CLP", "JPY", "CAD", "AUD", "CHF"] as const;

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
