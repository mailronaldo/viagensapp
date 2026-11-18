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
  jsonb,
} from "drizzle-orm/pg-core";
import { createId } from "./id";

const id = () => text("id").primaryKey().$defaultFn(createId);
const createdAt = () => timestamp("created_at").notNull().defaultNow();

// ---------- Enums ----------

export const memberRole = pgEnum("member_role", ["OWNER", "EDITOR", "VIEWER"]);
export const travelerPermission = pgEnum("traveler_permission", ["READ", "FULL"]);
export const chipType = pgEnum("chip_type", ["CHIP", "ESIM"]);
// Status de um valor lançado: estimado (ainda sem compromisso), a pagar
// (já certo, pendente) ou pago (liquidado).
export const valueStatus = pgEnum("value_status", ["ESTIMADO", "A_PAGAR", "PAGO"]);
// Somente ida (1 trecho), ida e volta (2 trechos) ou múltiplos trechos
// (N trechos, ex.: pacote com várias pernas) — ver tabela `booking_legs`.
export const bookingTripType = pgEnum("booking_trip_type", ["ONE_WAY", "ROUND_TRIP", "MULTI_LEG"]);
// Encomendas (tabela `errands`) têm três dimensões de status independentes,
// diferente do resto do app (que usa `valueStatus` combinando valor+pagamento
// num só campo): quanto o valor é conhecido, se já foi pago, e em que ponto
// da compra em si está.
export const errandValueStatus = pgEnum("errand_value_status", ["ESTIMADO", "ORCAMENTO", "REALIZADO"]);
export const errandPaymentStatus = pgEnum("errand_payment_status", ["A_PAGAR", "PAGO"]);
export const errandPurchaseStatus = pgEnum("errand_purchase_status", ["AGUARDANDO_COMPRA", "PEDIDO_APROVACAO", "COMPRA_EFETUADA"]);
// Pagamentos de uma despesa (tabela `expense_payments`): meio usado e se foi
// à vista ou parcelado.
// "OUTRO" só é usado em pagamentos de backfill (migração de registros
// antigos sem meio de pagamento conhecido) — nunca escolhido à mão.
export const paymentMethodType = pgEnum("payment_method_type", ["PIX", "CREDITO", "DEBITO", "DINHEIRO", "OUTRO"]);
export const paymentForm = pgEnum("payment_form", ["AVISTA", "PARCELADO"]);

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

// Quem pede uma encomenda (tabela `errands`) — amigo/família do cliente, não
// necessariamente um viajante da viagem. Mesma forma de `travelers` de
// propósito: se um dia isso se fundir num cadastro único de "pessoas" (a
// mesma pessoa pode ser viajante numa viagem e solicitante em outra), a
// migração é só de dados, não de estrutura.
export const requesters = pgTable(
  "requesters",
  {
    id: id(),
    clientId: text("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    createdAt: createdAt(),
  },
  (t) => [index("requesters_client_idx").on(t.clientId)],
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

// Bairro/região dentro de uma cidade — cadastro do cliente, reaproveitado
// em qualquer viagem que use essa cidade (atividade, transporte, dicas).
export const cityNeighborhoods = pgTable(
  "city_neighborhoods",
  {
    id: id(),
    cityId: text("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("city_neighborhoods_city_idx").on(t.cityId),
    uniqueIndex("city_neighborhoods_city_name_unique").on(t.cityId, t.name),
  ],
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
    status: valueStatus("status").notNull().default("ESTIMADO"),
    category: text("category").references(() => expenseCategories.id),
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
    // Número do pedido (ex.: da agência/site) — muitas vezes diferente do
    // código de confirmação do fornecedor.
    orderNumber: text("order_number"),
    tripType: bookingTripType("trip_type").notNull().default("ONE_WAY"),
    details: text("details"),
  },
  (t) => [index("bookings_trip_idx").on(t.tripId)],
);

// Trechos do transporte: 1 pra somente ida, 2 (ida/volta) pra ida e volta, ou
// N pra múltiplos trechos (pacote com várias pernas, ex.: SP→Roma→Paris→SP).
// `legOrder` define a ordem de exibição/edição; cada trecho aparece na
// agenda do seu próprio dia (ver services/agenda.ts).
export const bookingLegs = pgTable(
  "booking_legs",
  {
    id: id(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    legOrder: integer("leg_order").notNull(),
    originAt: timestamp("origin_at", { mode: "string" }),
    destinationAt: timestamp("destination_at", { mode: "string" }),
    originLocation: text("origin_location"),
    destinationLocation: text("destination_location"),
    originCityId: text("origin_city_id").references(() => cities.id, { onDelete: "set null" }),
    destinationCityId: text("destination_city_id").references(() => cities.id, { onDelete: "set null" }),
    originNeighborhoodId: text("origin_neighborhood_id").references(() => cityNeighborhoods.id, { onDelete: "set null" }),
    destinationNeighborhoodId: text("destination_neighborhood_id").references(() => cityNeighborhoods.id, { onDelete: "set null" }),
    // Genérico de propósito ("Código da viagem"): número do voo, linha de
    // trem, número do ônibus etc. — por trecho, porque ida/volta/cada perna
    // de um multi-trechos pode ter um código diferente.
    code: text("code"),
  },
  (t) => [
    index("booking_legs_booking_idx").on(t.bookingId, t.legOrder),
    index("booking_legs_origin_idx").on(t.originAt),
    index("booking_legs_destination_idx").on(t.destinationAt),
  ],
);

// Custo do transporte, lançado por partes: um voucher do grupo (custo
// compartilhado) e/ou um voucher por viajante (custo individual, com seu
// próprio código de reserva). `travelerId` nulo com `isGroup` falso = dono da
// viagem como viajante — mesma convenção de chips/ingressos/seguro.
export const transportVouchers = pgTable(
  "transport_vouchers",
  {
    id: id(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    isGroup: boolean("is_group").notNull().default(false),
    travelerId: text("traveler_id").references(() => travelers.id, { onDelete: "cascade" }),
    provider: text("provider"),
    reservationCode: text("reservation_code"),
    price: numeric("price", { precision: 12, scale: 2 }),
    currency: text("currency"),
    status: valueStatus("status").notNull().default("ESTIMADO"),
    category: text("category").references(() => expenseCategories.id),
    voucherDocumentId: text("voucher_document_id").references(() => documents.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("transport_vouchers_group_unique").on(t.bookingId).where(sql`${t.isGroup} = true`),
    uniqueIndex("transport_vouchers_traveler_unique")
      .on(t.bookingId, t.travelerId)
      .where(sql`${t.isGroup} = false AND ${t.travelerId} IS NOT NULL`),
    uniqueIndex("transport_vouchers_owner_unique")
      .on(t.bookingId)
      .where(sql`${t.isGroup} = false AND ${t.travelerId} IS NULL`),
  ],
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
    address: text("address"),
    checkInDate: date("check_in_date"),
    checkInTime: text("check_in_time"), // "HH:MM"
    checkOutDate: date("check_out_date"),
    checkOutTime: text("check_out_time"),
    notes: text("notes"),
    iconDocumentId: text("icon_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
  },
  (t) => [index("lodgings_trip_checkin_idx").on(t.tripId, t.checkInDate)],
);

// Subcategoria do tipo de hospedagem (ex.: Hotel → Standard, Suíte…), usada
// no campo "tipo" de cada voucher de hospedagem. Gerenciada na mesma tela de
// "Tipos de hospedagem" (Agência → Sistema), aninhada por tipo.
export const lodgingTypeSubcategories = pgTable(
  "lodging_type_subcategories",
  {
    id: id(),
    lodgingTypeId: text("lodging_type_id")
      .notNull()
      .references(() => lodgingTypes.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("lodging_type_subcategories_type_name_unique").on(t.lodgingTypeId, t.name)],
);

// Custo da hospedagem, lançado por voucher: uma hospedagem pode ter vários
// (ex.: hotel com 2-3 suítes reservadas separadamente), cada um do grupo
// inteiro ou de 1+ viajantes específicos (ver `lodgingVoucherTravelers`).
export const lodgingVouchers = pgTable("lodging_vouchers", {
  id: id(),
  lodgingId: text("lodging_id")
    .notNull()
    .references(() => lodgings.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  subcategoryId: text("subcategory_id").references(() => lodgingTypeSubcategories.id, { onDelete: "set null" }),
  isGroup: boolean("is_group").notNull().default(false),
  provider: text("provider").references(() => reservationMethods.id), // Booking, Airbnb, direto com o hotel…
  confirmationCode: text("confirmation_code"),
  pin: text("pin"),
  price: numeric("price", { precision: 12, scale: 2 }),
  currency: text("currency"),
  status: valueStatus("status").notNull().default("ESTIMADO"),
  category: text("category").references(() => expenseCategories.id),
  voucherDocumentId: text("voucher_document_id").references(() => documents.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: createdAt(),
});

// Quais viajantes um voucher (não-grupo) cobre — pode ser 1 ou mais.
// `travelerId` nulo = dono da viagem como viajante (mesma convenção de
// chips/ingressos/seguro/voucher de transporte).
export const lodgingVoucherTravelers = pgTable(
  "lodging_voucher_travelers",
  {
    voucherId: text("voucher_id")
      .notNull()
      .references(() => lodgingVouchers.id, { onDelete: "cascade" }),
    travelerId: text("traveler_id").references(() => travelers.id, { onDelete: "cascade" }),
  },
  (t) => [
    uniqueIndex("lodging_voucher_travelers_traveler_unique")
      .on(t.voucherId, t.travelerId)
      .where(sql`${t.travelerId} IS NOT NULL`),
    uniqueIndex("lodging_voucher_travelers_owner_unique")
      .on(t.voucherId)
      .where(sql`${t.travelerId} IS NULL`),
  ],
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
    neighborhoodId: text("neighborhood_id").references(() => cityNeighborhoods.id, { onDelete: "set null" }),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    notes: text("notes"),
    // Informativo só pra planejamento/orçamento (módulo futuro) — sem status,
    // sem categoria, sem pagamento vinculado.
    costEstimate: numeric("cost_estimate", { precision: 12, scale: 2 }),
    bookingId: text("booking_id").references(() => bookings.id, {
      onDelete: "set null",
    }),
    // Voucher/Reserva da atividade (opcional, único — existe quando qualquer
    // um destes campos está preenchido). Categoria do pagamento vive em
    // `payments.category`, não aqui.
    reservationProvider: text("reservation_provider"),
    reservationCode: text("reservation_code"),
    reservationPrice: numeric("reservation_price", { precision: 12, scale: 2 }),
    reservationCurrency: text("reservation_currency"),
    reservationStatus: valueStatus("reservation_status").notNull().default("ESTIMADO"),
    reservationDetails: text("reservation_details"),
    reservationDocumentId: text("reservation_document_id").references(
      () => documents.id,
      { onDelete: "set null" },
    ),
    createdAt: createdAt(),
  },
  (t) => [index("items_trip_date_idx").on(t.tripId, t.date)],
);

/** Categorias de dica, cadastradas pela agência (lista única, usada em todos os clientes). */
export const tipCategories = pgTable("tip_categories", {
  id: id(),
  name: text("name").notNull().unique(),
  createdAt: createdAt(),
});

// Repositório de Dicas do cliente: lugares por cidade/bairro (ex-"POI" e
// ex-"Tips" da atividade viraram a mesma coisa aqui — só um lugar com nome,
// categoria, custo e link, que pode ser reaproveitado em várias atividades).
export const tips = pgTable(
  "tips",
  {
    id: id(),
    clientId: text("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    cityId: text("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    neighborhoodId: text("neighborhood_id")
      .notNull()
      .references(() => cityNeighborhoods.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [index("tips_client_idx").on(t.clientId), index("tips_city_idx").on(t.cityId)],
);

// Nuvem de tags: uma dica pode se encaixar em várias categorias (ex. um
// parque pode ser "Atrações" + "Esportes" + "Comida" por ter um mercado).
export const tipCategoryLinks = pgTable(
  "tip_category_links",
  {
    id: id(),
    tipId: text("tip_id")
      .notNull()
      .references(() => tips.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => tipCategories.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("tip_category_links_unique").on(t.tipId, t.categoryId),
    index("tip_category_links_tip_idx").on(t.tipId),
    index("tip_category_links_category_idx").on(t.categoryId),
  ],
);

// Vínculo N:N — a mesma dica pode ser usada em várias atividades (mesma
// viagem ou viagens diferentes do cliente).
export const itineraryItemTips = pgTable(
  "itinerary_item_tips",
  {
    id: id(),
    itemId: text("item_id")
      .notNull()
      .references(() => itineraryItems.id, { onDelete: "cascade" }),
    tipId: text("tip_id")
      .notNull()
      .references(() => tips.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("itinerary_item_tips_unique").on(t.itemId, t.tipId),
    index("itinerary_item_tips_item_idx").on(t.itemId),
  ],
);

// ---------- Custos avulsos da atividade (1 atividade → N lançamentos) ----------

// Lançamento manual de custo dentro de uma atividade (ex.: guia, aluguel de
// equipamento) — vários por atividade, cada um com seus próprios pagamentos
// (sourceType "ITEM_EXPENSE"). Sem categoria própria: a categoria vive no
// pagamento (`payments.category`), igual à Reserva/Voucher da atividade.
export const itemExpenses = pgTable(
  "item_expenses",
  {
    id: id(),
    itemId: text("item_id")
      .notNull()
      .references(() => itineraryItems.id, { onDelete: "cascade" }),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull(),
    status: valueStatus("status").notNull().default("ESTIMADO"),
    createdAt: createdAt(),
  },
  (t) => [index("item_expenses_item_idx").on(t.itemId), index("item_expenses_trip_idx").on(t.tripId)],
);
export type ItemExpense = typeof itemExpenses.$inferSelect;

// ---------- Ingressos (1 atividade → N ingressos, 1 por viajante) ----------

// `travelerId` nulo = ingresso do próprio cliente (dono da viagem), mesma
// convenção de `chips`. `tripId` duplicado (já dá pra chegar nele via
// itemId → itineraryItems → tripId) evita um join extra pra listar os
// ingressos de um viajante na viagem toda, no hub do viajante.
export const activityTickets = pgTable(
  "activity_tickets",
  {
    id: id(),
    itemId: text("item_id")
      .notNull()
      .references(() => itineraryItems.id, { onDelete: "cascade" }),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    travelerId: text("traveler_id").references(() => travelers.id, { onDelete: "cascade" }),
    provider: text("provider"),
    ticketNumber: text("ticket_number"),
    price: numeric("price", { precision: 12, scale: 2 }),
    currency: text("currency"),
    status: valueStatus("status").notNull().default("ESTIMADO"),
    category: text("category").references(() => expenseCategories.id),
    voucherDocumentId: text("voucher_document_id").references(() => documents.id, { onDelete: "set null" }),
    details: text("details"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("activity_tickets_item_traveler_unique").on(t.itemId, t.travelerId).where(sql`${t.travelerId} IS NOT NULL`),
    uniqueIndex("activity_tickets_item_owner_unique").on(t.itemId).where(sql`${t.travelerId} IS NULL`),
    index("activity_tickets_trip_traveler_idx").on(t.tripId, t.travelerId),
  ],
);

// ---------- Passes (estoque de usos, tipo Go City / passe explorer) ----------

// Cadastrado uma vez por viajante na viagem (igual chips), com um limite de
// usos (`maxUses`) gasto ao longo de várias atividades via `activityPassUsages`.
// `firstUsedAt` grava a data da atividade em que foi usado a primeira vez —
// informativo por ora (não trava nada por validade, só por limite de usos).
export const passes = pgTable(
  "passes",
  {
    id: id(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    travelerId: text("traveler_id").references(() => travelers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    provider: text("provider"),
    validityDays: integer("validity_days"),
    maxUses: integer("max_uses"),
    price: numeric("price", { precision: 12, scale: 2 }),
    currency: text("currency"),
    status: valueStatus("status").notNull().default("ESTIMADO"),
    category: text("category").references(() => expenseCategories.id),
    passNumber: text("pass_number"),
    details: text("details"),
    firstUsedAt: date("first_used_at"),
    createdAt: createdAt(),
  },
  (t) => [index("passes_trip_traveler_idx").on(t.tripId, t.travelerId)],
);

/** Um uso do passe numa atividade — soma pro limite `passes.maxUses`. */
export const activityPassUsages = pgTable(
  "activity_pass_usages",
  {
    id: id(),
    itemId: text("item_id")
      .notNull()
      .references(() => itineraryItems.id, { onDelete: "cascade" }),
    passId: text("pass_id")
      .notNull()
      .references(() => passes.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("activity_pass_usages_unique").on(t.itemId, t.passId)],
);

// ---------- Seguro viagem ----------

// Escopado por viagem + viajante (mesmo padrão de `chips`/`passes`): uma
// apólice por viajante por viagem. `travelerId` nulo = seguro do próprio
// cliente (dono da viagem), quando `trips.ownerIsTraveler`.
export const travelInsurances = pgTable(
  "travel_insurances",
  {
    id: id(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    travelerId: text("traveler_id").references(() => travelers.id, { onDelete: "cascade" }),
    provider: text("provider"),
    policyNumber: text("policy_number"),
    coverageAmount: numeric("coverage_amount", { precision: 12, scale: 2 }),
    coverageCurrency: text("coverage_currency"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    price: numeric("price", { precision: 12, scale: 2 }),
    currency: text("currency"),
    status: valueStatus("status").notNull().default("ESTIMADO"),
    category: text("category").references(() => expenseCategories.id),
    policyDocumentId: text("policy_document_id").references(() => documents.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("travel_insurances_trip_traveler_unique").on(t.tripId, t.travelerId).where(sql`${t.travelerId} IS NOT NULL`),
    uniqueIndex("travel_insurances_trip_owner_unique").on(t.tripId).where(sql`${t.travelerId} IS NULL`),
  ],
);
export type TravelInsurance = typeof travelInsurances.$inferSelect;

// ---------- Moedas (cadastro do cliente + cotação diária) ----------

// BRL é o padrão do sistema e não precisa de linha aqui (fica implícito em
// todo lugar que lista moedas). O cliente cadastra as demais que vai usar
// (ex.: USD) — mesmo padrão de `cities` (cadastro do cliente, reusado nas
// viagens).
export const currencies = pgTable(
  "currencies",
  {
    id: id(),
    clientId: text("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    code: text("code").notNull(), // ISO 4217, ex. "USD"
    name: text("name"), // rótulo livre opcional, ex. "Dólar americano"
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("currencies_client_code_unique").on(t.clientId, t.code)],
);

// Cotação é de mercado, não muda por cliente — por isso não tem clientId.
// `rateToBrl` é sempre a âncora (quantos BRL vale 1 unidade da moeda);
// conversão entre duas moedas quaisquer passa por BRL.
export const currencyRates = pgTable(
  "currency_rates",
  {
    id: id(),
    code: text("code").notNull(),
    rateToBrl: numeric("rate_to_brl", { precision: 14, scale: 6 }).notNull(),
    asOfDate: date("as_of_date").notNull(),
    fetchedAt: createdAt(),
  },
  (t) => [uniqueIndex("currency_rates_code_date_unique").on(t.code, t.asOfDate)],
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
    status: valueStatus("status").notNull().default("ESTIMADO"),
    // Cotação para a moeda base da viagem (opcional)
    exchangeRate: numeric("exchange_rate", { precision: 14, scale: 6 }),
    receiptDocumentId: text("receipt_document_id").references(
      () => documents.id,
      { onDelete: "set null" },
    ),
    // Origem do lançamento: "web", "telegram" (agente) ou "whatsapp" no futuro
    source: text("source").notNull().default("web"),
    createdAt: createdAt(),
  },
  (t) => [index("expenses_trip_date_idx").on(t.tripId, t.date)],
);

// De onde um pagamento vem — cada módulo de custo da viagem tem seu próprio
// registro "mestre" (expenses, itineraryItems, activityTickets, passes,
// transportVouchers, lodgingVouchers, travelInsurances); `payments.sourceId`
// aponta pro id da linha certa conforme `sourceType`, sem FK de banco (é
// polimórfico) — por isso toda ação que apaga uma dessas linhas (ou que
// apaga em cascata linhas filhas, ex.: apagar uma atividade apaga seus
// ingressos) precisa chamar `deletePaymentsFor` (services/payments.ts) pra
// não deixar pagamento órfão.
// "ITEM_COST" continua existindo no enum do Postgres por causa de pagamentos
// antigos já migrados pra "ITEM_EXPENSE" (ver 0052) — nunca mais é inserido,
// por isso nem aparece no union TS `PaymentSourceType` em services/payments.ts.
export const paymentSourceType = pgEnum("payment_source_type", [
  "EXPENSE",
  "ITEM_COST",
  "ITEM_RESERVATION",
  "ACTIVITY_TICKET",
  "PASS",
  "TRANSPORT_VOUCHER",
  "LODGING_VOUCHER",
  "TRAVEL_INSURANCE",
  "ITEM_EXPENSE",
  "CHIP",
]);

// Pagamentos lançados contra um custo de qualquer módulo da viagem: cada um
// é um retrato de quem pagou (viajante), quando, por qual meio e quanto —
// nunca editado nem apagado, só acumulado. O status do registro de origem é
// recalculado a partir da soma destes pagamentos (ver `addPayment`/
// `recomputeStatus` em services/payments.ts), não é mais escolhido
// manualmente.
export const payments = pgTable(
  "payments",
  {
    id: id(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    sourceType: paymentSourceType("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    // null = dono da viagem, mesma convenção de errands.travelerId
    payerTravelerId: text("payer_traveler_id").references(() => travelers.id, { onDelete: "set null" }),
    // Quem gerou o custo (distinto de quem pagou, acima). `costIsGroup` true
    // = custo do grupo inteiro (ignora `costTravelerId`); false + nulo = dono
    // da viagem como viajante; false + preenchido = aquele viajante — mesma
    // convenção de isGroup/travelerId já usada em bookings/vouchers.
    costIsGroup: boolean("cost_is_group").notNull().default(false),
    costTravelerId: text("cost_traveler_id").references(() => travelers.id, { onDelete: "set null" }),
    paymentDate: date("payment_date").notNull(),
    method: paymentMethodType("method").notNull(),
    form: paymentForm("form").notNull().default("AVISTA"),
    installments: text("installments"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    // Sempre igual à moeda da origem no momento do lançamento (sem câmbio por pagamento).
    currency: text("currency").notNull(),
    // Pra origens sem categoria própria (reserva/voucher da atividade, custo
    // avulso) é escolhida no formulário; pras demais é copiada automaticamente
    // da categoria da origem (ver `addPayment` em services/payments.ts).
    category: text("category").references(() => expenseCategories.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("payments_source_idx").on(t.sourceType, t.sourceId), index("payments_trip_idx").on(t.tripId)],
);
export type Payment = typeof payments.$inferSelect;

export const storeType = pgEnum("store_type", ["PHYSICAL", "ONLINE"]);

// Catálogo do cliente (reutilizável entre viagens, como cities/travelers/
// requesters) — de onde um produto de encomenda foi/será comprado. `cityId`
// só faz sentido pra type=PHYSICAL (fica nulo em ONLINE); ao vincular a loja
// numa encomenda, só entram as físicas cuja cidade está nesta viagem, mais
// as online (ver `listStoresForTrip` em services/stores.ts).
export const stores = pgTable(
  "stores",
  {
    id: id(),
    clientId: text("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: storeType("type").notNull().default("PHYSICAL"),
    cityId: text("city_id").references(() => cities.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("stores_client_idx").on(t.clientId), index("stores_city_idx").on(t.cityId)],
);

// ---------- Encomendas (pedidos de compra de amigos/família) ----------

// Custo fica fora da Central de Custos da viagem de propósito — não é gasto
// da viagem em si, é um favor cobrado à parte. `travelerId` referencia o
// cadastro global do viajante; nulo = o próprio dono da viagem como viajante
// (mesma convenção de `chips`/`activityTickets`) — o formulário sempre exige
// escolher alguém, só que "o próprio dono" é uma escolha válida que vira nulo
// aqui, já que o dono não tem linha em `travelers`.
export const errands = pgTable(
  "errands",
  {
    id: id(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    travelerId: text("traveler_id").references(() => travelers.id, { onDelete: "cascade" }),
    requesterId: text("requester_id")
      .notNull()
      .references(() => requesters.id, { onDelete: "cascade" }),
    product: text("product").notNull(),
    storeId: text("store_id").references(() => stores.id, { onDelete: "set null" }),
    details: text("details"),
    receiptDocumentId: text("receipt_document_id").references(() => documents.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("errands_trip_idx").on(t.tripId),
    index("errands_traveler_idx").on(t.travelerId),
    index("errands_requester_idx").on(t.requesterId),
    index("errands_store_idx").on(t.storeId),
  ],
);

// Histórico de valor/status de uma encomenda: cada lançamento é um
// "retrato" (preço + os 3 status) num momento — nunca editado nem apagado,
// só acumulado. A lista/tela principal mostra o lançamento mais recente
// (ver `services/errands.ts`); produto/viajante/solicitante/recibo ficam no
// cadastro em `errands`, não aqui.
export const errandEntries = pgTable(
  "errand_entries",
  {
    id: id(),
    errandId: text("errand_id")
      .notNull()
      .references(() => errands.id, { onDelete: "cascade" }),
    price: numeric("price", { precision: 12, scale: 2 }),
    currency: text("currency"),
    valueStatus: errandValueStatus("value_status").notNull().default("ESTIMADO"),
    paymentStatus: errandPaymentStatus("payment_status").notNull().default("A_PAGAR"),
    purchaseStatus: errandPurchaseStatus("purchase_status").notNull().default("AGUARDANDO_COMPRA"),
    createdAt: createdAt(),
  },
  (t) => [index("errand_entries_errand_idx").on(t.errandId)],
);

// Fotos do produto — só pra consulta, diferente do recibo de compra
// (`receiptDocumentId`). Vínculo N:1 com um documento cada (mesmo padrão de
// `itineraryItemTips`): uma tabela de junção em vez de uma coluna
// `errandId` direto em `documents`, pra não criar referência circular entre
// as duas tabelas (`documents.receiptDocumentId`-like já aponta pra lá).
export const errandPhotos = pgTable(
  "errand_photos",
  {
    id: id(),
    errandId: text("errand_id")
      .notNull()
      .references(() => errands.id, { onDelete: "cascade" }),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [index("errand_photos_errand_idx").on(t.errandId), index("errand_photos_document_idx").on(t.documentId)],
);

// ---------- Agente via Telegram (viajante conversa com o sistema) ----------

export const telegramLinks = pgTable(
  "telegram_links",
  {
    id: id(),
    clientId: text("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // null = o próprio dono da viagem (mesma convenção de `travelerId` nulo
    // usada em chips/passes: o dono também pode viajar e usar o agente).
    travelerId: text("traveler_id").references(() => travelers.id, { onDelete: "cascade" }),
    chatId: text("chat_id").notNull(),
    // Viagem que o agente assume por padrão nesta conversa (resolvida
    // automaticamente quando só há uma, ou escolhida pelo viajante).
    activeTripId: text("active_trip_id").references(() => trips.id, { onDelete: "set null" }),
    // Últimas trocas (role + texto), só pra dar continuidade a perguntas
    // de seguimento — não é um histórico completo nem auditável.
    history: jsonb("history").notNull().default([]),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("telegram_links_chat_unique").on(t.chatId), index("telegram_links_traveler_idx").on(t.travelerId)],
);

// Token de uso único pro viajante (ou o dono da viagem, travelerId nulo)
// vincular o próprio chat do Telegram (consumido no /start do bot).
export const telegramLinkTokens = pgTable("telegram_link_tokens", {
  id: id(),
  clientId: text("client_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  travelerId: text("traveler_id").references(() => travelers.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: createdAt(),
});

export type User = typeof users.$inferSelect;
export type TripDay = typeof tripDays.$inferSelect;
export type Traveler = typeof travelers.$inferSelect;
export type Requester = typeof requesters.$inferSelect;
export type Errand = typeof errands.$inferSelect;
export type ErrandEntry = typeof errandEntries.$inferSelect;
export type Store = typeof stores.$inferSelect;
export type Trip = typeof trips.$inferSelect;
export type City = typeof cities.$inferSelect;
export type ItineraryItem = typeof itineraryItems.$inferSelect;
export type Lodging = typeof lodgings.$inferSelect;
export type LodgingVoucher = typeof lodgingVouchers.$inferSelect;
export type LodgingTypeSubcategory = typeof lodgingTypeSubcategories.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type BookingLeg = typeof bookingLegs.$inferSelect;
export type TransportVoucher = typeof transportVouchers.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type DocumentTypeRow = typeof documentTypes.$inferSelect;
export type ExpenseCategoryRow = typeof expenseCategories.$inferSelect;
export type ActivityTypeRow = typeof activityTypes.$inferSelect;
export type BookingTypeRow = typeof bookingTypes.$inferSelect;
export type LodgingTypeRow = typeof lodgingTypes.$inferSelect;
export type ReservationMethodRow = typeof reservationMethods.$inferSelect;
export type CurrencyRow = typeof currencies.$inferSelect;
export type CurrencyRateRow = typeof currencyRates.$inferSelect;
