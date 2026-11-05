import {
  pgTable,
  pgEnum,
  text,
  integer,
  doublePrecision,
  boolean,
  numeric,
  date,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createId } from "./id";

const id = () => text("id").primaryKey().$defaultFn(createId);
const createdAt = () => timestamp("created_at").notNull().defaultNow();

// ---------- Enums ----------

export const memberRole = pgEnum("member_role", ["OWNER", "EDITOR", "VIEWER"]);
export const itemType = pgEnum("item_type", [
  "ATTRACTION",
  "TOUR",
  "MEAL",
  "TRANSPORT",
  "FREE_TIME",
  "OTHER",
]);
export const bookingType = pgEnum("booking_type", [
  "FLIGHT",
  "HOTEL",
  "CAR_RENTAL",
  "TRANSFER",
  "TRAIN",
  "OTHER",
]);
export const lodgingType = pgEnum("lodging_type", [
  "HOTEL",
  "RENTAL",
  "HOSTEL",
  "RESORT",
  "OTHER",
]);
export const expenseCategory = pgEnum("expense_category", [
  "FLIGHT",
  "LODGING",
  "FOOD",
  "TRANSPORT",
  "ATTRACTION",
  "SHOPPING",
  "INSURANCE",
  "OTHER",
]);
export const documentType = pgEnum("document_type", [
  "PASSPORT",
  "VISA",
  "INSURANCE",
  "TICKET",
  "VOUCHER",
  "RECEIPT",
  "RESERVATION",
  "OTHER",
]);
export const travelerPermission = pgEnum("traveler_permission", ["READ", "FULL"]);

// ---------- Contas e acesso ----------

// MASTER = a agência de turismo (dona do sistema); CLIENT = cliente da agência.
// Viajantes não são usuários: são cadastros (tabela travelers) de cada cliente.
export const userRole = pgEnum("user_role", ["MASTER", "CLIENT", "TRAVELER"]);
// Quem enxerga o documento além do dono da viagem: ninguém, todo o grupo ou um viajante.
export const docVisibility = pgEnum("doc_visibility", ["OWNER", "GROUP", "TRAVELER"]);

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull().default("CLIENT"),
  // Cliente desativado não consegue entrar (sessões existentes também caem).
  active: boolean("active").notNull().default(true),
  // Senha temporária criada pela agência: força a troca no primeiro acesso.
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  // Preparado para o WhatsApp: número em E.164 (ex.: +5511999998888)
  whatsappPhone: text("whatsapp_phone").unique(),
  createdAt: createdAt(),
});

export const trips = pgTable(
  "trips",
  {
    id: id(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    // Rótulo "Breve descrição" na tela; o nome da coluna ficou como estava.
    destination: text("destination").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    // Fuso do destino, usado para "agenda de hoje" (ex.: Europe/Lisbon)
    timezone: text("timezone").notNull().default("America/Sao_Paulo"),
    baseCurrency: text("base_currency").notNull().default("BRL"),
    notes: text("notes"),
    // Ícone da viagem (mostrado no card do dashboard). Sem upload, usa o padrão.
    iconKey: text("icon_key"),
    iconMimeType: text("icon_mime_type"),
    createdAt: createdAt(),
  },
  (t) => [index("trips_owner_idx").on(t.ownerId)],
);

// ---------- Viajantes (cadastros do cliente) ----------

export const travelers = pgTable(
  "travelers",
  {
    id: id(),
    clientId: text("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    // Passaporte, RG ou CPF — texto livre por enquanto.
    documentNumber: text("document_number"),
    birthDate: date("birth_date"),
    notes: text("notes"),
    // Reservado para o futuro: viajante com login próprio.
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("travelers_client_idx").on(t.clientId)],
);

export const tripTravelers = pgTable(
  "trip_travelers",
  {
    id: id(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    travelerId: text("traveler_id")
      .notNull()
      .references(() => travelers.id, { onDelete: "cascade" }),
    // FULL: o viajante (quando tem login) vira editor da viagem, igual ao cliente.
    // READ: só enxerga o painel do viajante, somente leitura (padrão).
    permission: travelerPermission("permission").notNull().default("READ"),
  },
  (t) => [uniqueIndex("trip_travelers_unique").on(t.tripId, t.travelerId)],
);

export const tripMembers = pgTable(
  "trip_members",
  {
    id: id(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull().default("EDITOR"),
  },
  (t) => [
    uniqueIndex("trip_members_unique").on(t.tripId, t.userId),
    index("trip_members_user_idx").on(t.userId),
  ],
);

// Cidades são um cadastro do cliente (como viajantes): cadastra-se uma vez,
// reutiliza-se em quantas viagens quiser, vinculando via trip_cities.
export const cities = pgTable(
  "cities",
  {
    id: id(),
    clientId: text("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    country: text("country"),
    // Código ISO 3166-1 alpha-2 do país (ex.: "BR"), usado pra bandeira e pra
    // evitar duplicidade/erro de digitação — escolhido num combo em cascata.
    countryCode: text("country_code"),
    state: text("state"),
    stateCode: text("state_code"),
    createdAt: createdAt(),
  },
  (t) => [index("cities_client_idx").on(t.clientId)],
);

export const tripCities = pgTable(
  "trip_cities",
  {
    id: id(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    cityId: text("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    // Ordem de exibição das cidades dentro desta viagem (ex.: ordem do roteiro).
    position: integer("position").notNull().default(0),
  },
  (t) => [uniqueIndex("trip_cities_unique").on(t.tripId, t.cityId)],
);

// ---------- Roteiro resumido (um registro por dia) ----------

export const tripDays = pgTable(
  "trip_days",
  {
    id: id(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    title: text("title"),
    summary: text("summary"),
  },
  (t) => [uniqueIndex("trip_days_trip_date_idx").on(t.tripId, t.date)],
);

/** Cidades em que o viajante está em cada dia (uma ou mais). */
export const tripDayCities = pgTable(
  "trip_day_cities",
  {
    tripDayId: text("trip_day_id")
      .notNull()
      .references(() => tripDays.id, { onDelete: "cascade" }),
    cityId: text("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("trip_day_cities_idx").on(t.tripDayId, t.cityId)],
);

// ---------- Central de documentos ----------

export const documents = pgTable(
  "documents",
  {
    id: id(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    type: documentType("type").notNull().default("OTHER"),
    title: text("title").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    // Chave no storage (disco local no dev; S3/R2 em produção)
    storageKey: text("storage_key").notNull(),
    visibility: docVisibility("visibility").notNull().default("OWNER"),
    // Só quando visibility = TRAVELER: o viajante dono do documento.
    travelerId: text("traveler_id").references(() => travelers.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("documents_trip_type_idx").on(t.tripId, t.type)],
);

// ---------- Reservas (voos, hotéis, etc.) ----------

export const bookings = pgTable(
  "bookings",
  {
    id: id(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    type: bookingType("type").notNull(),
    title: text("title").notNull(),
    provider: text("provider"),
    confirmationCode: text("confirmation_code"),
    startAt: timestamp("start_at", { mode: "string" }),
    endAt: timestamp("end_at", { mode: "string" }),
    origin: text("origin"),
    destination: text("destination"),
    address: text("address"),
    details: text("details"),
    totalPrice: numeric("total_price", { precision: 12, scale: 2 }),
    currency: text("currency"),
    documentId: text("document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
  },
  (t) => [index("bookings_trip_start_idx").on(t.tripId, t.startAt)],
);

// ---------- Hospedagens (hotéis, aluguéis, Airbnb…) ----------

export const lodgings = pgTable(
  "lodgings",
  {
    id: id(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    cityId: text("city_id").references(() => cities.id, { onDelete: "set null" }),
    type: lodgingType("type").notNull().default("HOTEL"),
    name: text("name").notNull(),
    provider: text("provider"), // Booking, Airbnb, direto com o hotel…
    address: text("address"),
    checkInDate: date("check_in_date"),
    checkInTime: text("check_in_time"), // "HH:MM"
    checkOutDate: date("check_out_date"),
    checkOutTime: text("check_out_time"),
    confirmationCode: text("confirmation_code"),
    totalPrice: numeric("total_price", { precision: 12, scale: 2 }),
    currency: text("currency"),
    notes: text("notes"),
    documentId: text("document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
  },
  (t) => [index("lodgings_trip_checkin_idx").on(t.tripId, t.checkInDate)],
);

// ---------- Roteiro dia a dia ----------

export const itineraryItems = pgTable(
  "itinerary_items",
  {
    id: id(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    cityId: text("city_id").references(() => cities.id, {
      onDelete: "set null",
    }),
    date: date("date").notNull(),
    // "HH:MM" no fuso do destino; null = sem horário definido
    startTime: text("start_time"),
    endTime: text("end_time"),
    type: itemType("type").notNull().default("ATTRACTION"),
    title: text("title").notNull(),
    location: text("location"),
    address: text("address"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    notes: text("notes"),
    costEstimate: numeric("cost_estimate", { precision: 12, scale: 2 }),
    // Ingresso/voucher e reserva vinculados
    ticketDocumentId: text("ticket_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    bookingId: text("booking_id").references(() => bookings.id, {
      onDelete: "set null",
    }),
    // Reserva da atividade (opcional): existe quando qualquer um destes campos está preenchido.
    reservationProvider: text("reservation_provider"),
    reservationCode: text("reservation_code"),
    reservationPrice: numeric("reservation_price", { precision: 12, scale: 2 }),
    reservationCurrency: text("reservation_currency"),
    reservationDetails: text("reservation_details"),
    reservationDocumentId: text("reservation_document_id").references(
      () => documents.id,
      { onDelete: "set null" },
    ),
  },
  (t) => [index("items_trip_date_idx").on(t.tripId, t.date)],
);

// Pontos de apoio de uma atividade: POI (lugares pra visitar na atividade ou
// nas redondezas) e Tips (opções alternativas, pra quando não há reserva/
// certeza do que fazer). Mesmo formato pros dois — só muda o rótulo na tela.
export const activityPointKind = pgEnum("activity_point_kind", ["POI", "TIP"]);

export const itineraryItemPoints = pgTable(
  "itinerary_item_points",
  {
    id: id(),
    itemId: text("item_id")
      .notNull()
      .references(() => itineraryItems.id, { onDelete: "cascade" }),
    kind: activityPointKind("kind").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    url: text("url"),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("itinerary_item_points_item_idx").on(t.itemId)],
);

/** Região/bairro/zona associado à atividade — nuvem de tags, só o nome por enquanto. */
export const itineraryItemRegions = pgTable(
  "itinerary_item_regions",
  {
    id: id(),
    itemId: text("item_id")
      .notNull()
      .references(() => itineraryItems.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("itinerary_item_regions_item_idx").on(t.itemId)],
);

// ---------- Central de custos ----------

export const expenses = pgTable(
  "expenses",
  {
    id: id(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    paidById: text("paid_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    date: date("date").notNull(),
    category: expenseCategory("category").notNull().default("OTHER"),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull(),
    // Cotação para a moeda base da viagem (opcional)
    exchangeRate: numeric("exchange_rate", { precision: 14, scale: 6 }),
    paymentMethod: text("payment_method"),
    receiptDocumentId: text("receipt_document_id").references(
      () => documents.id,
      { onDelete: "set null" },
    ),
    // Origem do lançamento: "web" hoje, "whatsapp" no futuro
    source: text("source").notNull().default("web"),
    createdAt: createdAt(),
  },
  (t) => [index("expenses_trip_date_idx").on(t.tripId, t.date)],
);

export type User = typeof users.$inferSelect;
export type TripDay = typeof tripDays.$inferSelect;
export type Traveler = typeof travelers.$inferSelect;
export type Trip = typeof trips.$inferSelect;
export type City = typeof cities.$inferSelect;
export type ItineraryItem = typeof itineraryItems.$inferSelect;
export type Lodging = typeof lodgings.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Document = typeof documents.$inferSelect;
