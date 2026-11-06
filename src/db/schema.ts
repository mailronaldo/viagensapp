import { sql } from "drizzle-orm";
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
export const travelerPermission = pgEnum("traveler_permission", ["READ", "FULL"]);
export const chipType = pgEnum("chip_type", ["CHIP", "ESIM"]);

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
    // O cliente (dono da viagem) também viaja nela? Controla se ele aparece
    // na lista de viajantes da viagem (e pode ter chip próprio registrado).
    ownerIsTraveler: boolean("owner_is_traveler").notNull().default(false),
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

// ---------- Cadastros da agência (tipos de documento, categorias de custo) ----------

// Listas globais, mantidas pela agência (MASTER), usadas em todos os clientes/
// viagens. Os ids das linhas semeadas na migração reaproveitam os valores dos
// antigos enums (ex.: "PASSPORT"), pra não exigir remapear dado nenhum.
export const documentTypes = pgTable("document_types", {
  id: id(),
  name: text("name").notNull().unique(),
  createdAt: createdAt(),
});

export const expenseCategories = pgTable("expense_categories", {
  id: id(),
  name: text("name").notNull().unique(),
  createdAt: createdAt(),
});

// "TRANSPORT" (atividade) e "HOTEL" (transporte) ficam semeados como legado —
// não aparecem pra criar de novo, só preservam o rótulo de registros antigos.
export const activityTypes = pgTable("activity_types", {
  id: id(),
  name: text("name").notNull().unique(),
  createdAt: createdAt(),
});

export const bookingTypes = pgTable("booking_types", {
  id: id(),
  name: text("name").notNull().unique(),
  createdAt: createdAt(),
});

export const lodgingTypes = pgTable("lodging_types", {
  id: id(),
  name: text("name").notNull().unique(),
  createdAt: createdAt(),
});

// Método como a hospedagem foi reservada (Booking.com, Airbnb, direto com o
// hotel…). Começa semeado com algumas opções comuns, mas o MASTER pode criar
// outras — inclusive as que já existiam como texto livre antes deste cadastro.
export const reservationMethods = pgTable("reservation_methods", {
  id: id(),
  name: text("name").notNull().unique(),
  createdAt: createdAt(),
});

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
    type: text("type")
      .notNull()
      .default("OTHER")
      .references(() => documentTypes.id),
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

// ---------- Chip / eSIM do viajante ----------

// Escopado por viagem + viajante (não pelo cadastro global do viajante): o mesmo
// viajante pode estar em viagens diferentes com chips diferentes. `travelerId`
// nulo = chip do próprio cliente (dono da viagem), quando `trips.ownerIsTraveler`.
export const chips = pgTable(
  "chips",
  {
    id: id(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    travelerId: text("traveler_id").references(() => travelers.id, { onDelete: "cascade" }),
    provider: text("provider"),
    orderNumber: text("order_number"),
    plan: text("plan"),
    cost: numeric("cost", { precision: 12, scale: 2 }),
    currency: text("currency"),
    receiptDocumentId: text("receipt_document_id").references(() => documents.id, { onDelete: "set null" }),
    startDate: date("start_date"),
    endDate: date("end_date"),
    type: chipType("type").notNull().default("CHIP"),
    eid: text("eid"),
    imei2: text("imei2"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("chips_trip_traveler_unique").on(t.tripId, t.travelerId).where(sql`${t.travelerId} IS NOT NULL`),
    uniqueIndex("chips_trip_owner_unique").on(t.tripId).where(sql`${t.travelerId} IS NULL`),
  ],
);
export type Chip = typeof chips.$inferSelect;

// ---------- Reservas (voos, hotéis, etc.) ----------

export const bookings = pgTable(
  "bookings",
  {
    id: id(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    type: text("type")
      .notNull()
      .default("OTHER")
      .references(() => bookingTypes.id),
    title: text("title").notNull(),
    provider: text("provider"),
    confirmationCode: text("confirmation_code"),
    originAt: timestamp("origin_at", { mode: "string" }),
    destinationAt: timestamp("destination_at", { mode: "string" }),
    originLocation: text("origin_location"),
    destinationLocation: text("destination_location"),
    originCityId: text("origin_city_id").references(() => cities.id, { onDelete: "set null" }),
    destinationCityId: text("destination_city_id").references(() => cities.id, { onDelete: "set null" }),
    details: text("details"),
    totalPrice: numeric("total_price", { precision: 12, scale: 2 }),
    currency: text("currency"),
    documentId: text("document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
  },
  (t) => [index("bookings_trip_start_idx").on(t.tripId, t.originAt)],
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
    type: text("type").notNull().default("HOTEL").references(() => lodgingTypes.id),
    name: text("name").notNull(),
    provider: text("provider").references(() => reservationMethods.id), // Booking, Airbnb, direto com o hotel…
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
    type: text("type")
      .notNull()
      .default("ATTRACTION")
      .references(() => activityTypes.id),
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
    category: text("category")
      .notNull()
      .default("OTHER")
      .references(() => expenseCategories.id),
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
export type DocumentTypeRow = typeof documentTypes.$inferSelect;
export type ExpenseCategoryRow = typeof expenseCategories.$inferSelect;
export type ActivityTypeRow = typeof activityTypes.$inferSelect;
export type BookingTypeRow = typeof bookingTypes.$inferSelect;
export type LodgingTypeRow = typeof lodgingTypes.$inferSelect;
export type ReservationMethodRow = typeof reservationMethods.$inferSelect;
