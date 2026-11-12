import "server-only";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { getAgenda } from "@/services/agenda";
import { getTripCities, listNeighborhoodsForCities } from "@/services/cities";
import { listDocuments } from "@/services/documents";
import { addExpense } from "@/services/expenses";
import { listCostEntries, withConvertedAmounts, SOURCE_LABEL } from "@/services/cost-center";
import { ensureTodayRates, listClientCurrencyCodes } from "@/services/currencies";
import { listClientTips } from "@/services/tips";
import { googleMapsDirectionsUrl } from "@/lib/maps";
import { getActivityRouteUrls } from "@/services/routes";
import { listTravelerTickets, listTripTickets } from "@/services/tickets";
import { listTravelerPasses, listTripPasses, listUsagesForPasses } from "@/services/passes";
import { listExpenseCategories, listTipCategories, toNameMap } from "@/services/catalogs";
import { travelerCanReadDocument } from "@/lib/traveler-access";
import { readStoredFile } from "@/lib/storage";
import { sendDocument } from "@/lib/telegram";
import { ISO_DATE, parseDecimal } from "@/lib/form";
import { formatDate, formatWeekday, todayIn } from "@/lib/format";
import type { AgentTool } from "./claude";

/** O dono da viagem sempre pode; um viajante só se o cliente deu permissão FULL a ele nesta viagem. */
async function canWrite(ctx: AgentContext): Promise<boolean> {
  if (!ctx.travelerId) return true;
  const [row] = await db
    .select({ id: t.tripTravelers.id })
    .from(t.tripTravelers)
    .where(and(eq(t.tripTravelers.tripId, ctx.trip.id), eq(t.tripTravelers.travelerId, ctx.travelerId), eq(t.tripTravelers.permission, "FULL")))
    .limit(1);
  return !!row;
}

/** Quem "pagou" pro lançamento de despesa: o próprio dono, ou o login do viajante (se tiver), senão o dono como fallback. */
async function resolvePaidBy(ctx: AgentContext): Promise<string> {
  if (!ctx.travelerId) return ctx.trip.ownerId;
  const [tr] = await db.select({ userId: t.travelers.userId }).from(t.travelers).where(eq(t.travelers.id, ctx.travelerId)).limit(1);
  return tr?.userId ?? ctx.trip.ownerId;
}

export type AgentContext = {
  chatId: string;
  // null = o próprio dono da viagem (vínculo feito em "Minha conta") — tem acesso
  // irrestrito aos documentos da viagem, igual a um membro da viagem na web.
  travelerId: string | null;
  trip: typeof t.trips.$inferSelect;
};

export const AGENT_TOOLS: AgentTool[] = [
  {
    name: "get_trip_overview",
    description: "Visão geral da viagem ativa: destino, datas, moeda e cidades do roteiro. Use para perguntas gerais sobre a viagem.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_agenda",
    description:
      "Agenda de um dia da viagem (atividades, transportes e check-in/check-out de hospedagem), em ordem de horário. Sem 'date', devolve a agenda de hoje.",
    input_schema: {
      type: "object",
      properties: { date: { type: "string", description: "Data no formato AAAA-MM-DD. Opcional." } },
    },
  },
  {
    name: "get_voucher",
    description:
      "Procura e envia direto no chat qualquer documento/voucher anexado na viagem — reserva de hospedagem, transporte (inclusive voucher por viajante), ingresso ou reserva de atividade, seguro viagem, recibo de despesa — a partir de uma descrição livre (ex.: 'voucher do hotel', 'reserva do museu', 'apólice do seguro').",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "O que o viajante está procurando." } },
      required: ["query"],
    },
  },
  {
    name: "get_expenses",
    description:
      "Resumo de TODOS os custos da viagem (igual à Central de Custos do app): despesas avulsas, transporte, hospedagem, chip, ingressos, passes, seguro e estimativas de atividade — total a pagar/pago e por categoria.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "add_expense",
    description:
      "Lança uma nova despesa na viagem, sempre na moeda base da viagem. Categoria é texto livre (ex.: 'comida', 'transporte') — casada com o catálogo, ou 'Outro' se não achar.",
    input_schema: {
      type: "object",
      properties: {
        description: { type: "string", description: "O que foi o gasto." },
        amount: { type: "string", description: "Valor, ex.: '123.45' ou '123,45'." },
        date: { type: "string", description: "Data no formato AAAA-MM-DD. Sem isso, usa hoje." },
        category: { type: "string", description: "Nome livre da categoria. Opcional." },
        status: { type: "string", enum: ["ESTIMADO", "A_PAGAR", "PAGO"], description: "Opcional, padrão ESTIMADO." },
      },
      required: ["description", "amount"],
    },
  },
  {
    name: "get_tips",
    description:
      "Lista as dicas (lugares) cadastradas nas cidades da viagem e sempre informa o total encontrado (mesmo quando a lista é truncada). Pode filtrar por um texto livre (nome ou categoria) — use pra refinar quando o total for grande.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Filtro livre. Opcional." } },
    },
  },
  {
    name: "add_tip",
    description: "Cadastra uma nova dica (lugar) num bairro/região que já exista cadastrado numa das cidades da viagem.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome do lugar." },
        neighborhood: { type: "string", description: "Nome do bairro/região (precisa já existir cadastrado numa cidade da viagem)." },
        description: { type: "string", description: "Observações sobre o lugar. Opcional." },
        categories: { type: "array", items: { type: "string" }, description: "Nomes livres de categorias (ex.: comida, cultura). Opcional." },
      },
      required: ["name", "neighborhood"],
    },
  },
  {
    name: "get_tickets_and_passes",
    description:
      "Lista os ingressos de atividades e os passes (tipo Go City) — ambos com número/status/preço e observações/detalhes — além dos usos restantes de cada passe e EM QUAIS atividades (com data) ele já foi usado. O dono da viagem e viajantes com permissão total veem os ingressos/passes de TODOS os viajantes da viagem; um viajante só com leitura vê apenas os seus. Pode filtrar por um texto livre (nome da atividade, provider ou nome do passe).",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Filtro livre. Opcional." } },
    },
  },
  {
    name: "link_tip_to_activity",
    description: "Vincula uma dica já cadastrada (repositório de dicas) a uma atividade do roteiro.",
    input_schema: {
      type: "object",
      properties: {
        activity: { type: "string", description: "Nome (ou trecho do nome) da atividade do roteiro." },
        tip: { type: "string", description: "Nome (ou trecho do nome) da dica já cadastrada." },
      },
      required: ["activity", "tip"],
    },
  },
  {
    name: "get_route",
    description:
      "Monta link(s) de rota no Google Maps para uma atividade do roteiro, um transporte ou uma hospedagem, a partir de uma descrição livre (ex.: 'rota pra torre de belém', 'como chego no hotel'). Para atividade com dicas (lojas/pontos) vinculadas, a rota passa por elas. Quando não informa origem, o link deixa o próprio Maps usar a localização atual de quem abrir — ótimo durante a viagem.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Nome (ou trecho do nome) da atividade, transporte ou hospedagem." } },
      required: ["query"],
    },
  },
];

async function execTripOverview(ctx: AgentContext): Promise<string> {
  const cities = await getTripCities(ctx.trip.id);
  const lines = [
    `Viagem: ${ctx.trip.title} — ${ctx.trip.destination}`,
    `Período: ${formatDate(ctx.trip.startDate)} a ${formatDate(ctx.trip.endDate)}`,
    `Moeda base: ${ctx.trip.baseCurrency}`,
    cities.length > 0 ? `Cidades do roteiro: ${cities.map((c) => c.name).join(", ")}` : "Nenhuma cidade cadastrada no roteiro.",
  ];
  return lines.join("\n");
}

function formatAgendaEntry(entry: Awaited<ReturnType<typeof getAgenda>>["entries"][number]): string {
  const time = entry.time ? `${entry.time}${entry.endTime ? `–${entry.endTime}` : ""}` : "sem horário";
  const parts = [`[${time}] ${entry.title} (${entry.type})`];
  if (entry.location) parts.push(`local: ${entry.location}`);
  if (entry.cityName) parts.push(`cidade: ${entry.cityName}`);
  if (entry.reservation?.code) parts.push(`reserva: ${entry.reservation.code}`);
  if (entry.hasTicket) parts.push("tem ingresso/documento anexado");
  return parts.join(" — ");
}

async function execGetAgenda(ctx: AgentContext, input: Record<string, unknown>): Promise<string> {
  const date = typeof input.date === "string" && input.date ? input.date : todayIn(ctx.trip.timezone);
  const agenda = await getAgenda(ctx.trip, date);
  if (agenda.entries.length === 0) {
    return `Agenda de ${formatWeekday(agenda.date)} (${formatDate(agenda.date)}): nada planejado nesse dia.`;
  }
  const lines = agenda.entries.map(formatAgendaEntry);
  return `Agenda de ${formatWeekday(agenda.date)} (${formatDate(agenda.date)}):\n${lines.join("\n")}`;
}

type VoucherCandidate = { documentId: string; label: string };

/**
 * Cobre toda fonte de anexo da viagem, não só a tabela `documents` genérica — senão o
 * agente não acha vouchers de transporte por viajante, ingresso/reserva anexados direto
 * na atividade, seguro viagem ou recibo de despesa, mesmo que estejam lá no app.
 */
async function findVoucherCandidates(tripId: string, query: string): Promise<VoucherCandidate[]> {
  const pattern = `%${query}%`;

  const docs = await listDocuments(tripId);
  const byDoc = docs
    .filter((d) => d.title.toLowerCase().includes(query.toLowerCase()) || d.fileName.toLowerCase().includes(query.toLowerCase()))
    .map((d) => ({ documentId: d.id, label: d.title }));

  const lodgingMatches = await db
    .select({ documentId: t.lodgingVouchers.voucherDocumentId, label: t.lodgingVouchers.name })
    .from(t.lodgingVouchers)
    .innerJoin(t.lodgings, eq(t.lodgings.id, t.lodgingVouchers.lodgingId))
    .where(and(eq(t.lodgings.tripId, tripId), ilike(t.lodgingVouchers.name, pattern)));

  const bookingMatches = await db
    .select({ documentId: t.bookings.documentId, title: t.bookings.title, provider: t.bookings.provider })
    .from(t.bookings)
    .where(and(eq(t.bookings.tripId, tripId), or(ilike(t.bookings.title, pattern), ilike(t.bookings.provider, pattern))));

  const transportVoucherMatches = await db
    .select({ documentId: t.transportVouchers.voucherDocumentId, title: t.bookings.title, provider: t.transportVouchers.provider })
    .from(t.transportVouchers)
    .innerJoin(t.bookings, eq(t.bookings.id, t.transportVouchers.bookingId))
    .where(
      and(
        eq(t.bookings.tripId, tripId),
        or(ilike(t.bookings.title, pattern), ilike(t.transportVouchers.provider, pattern), ilike(t.transportVouchers.reservationCode, pattern)),
      ),
    );

  const itemMatches = await db
    .select({
      ticketDocumentId: t.itineraryItems.ticketDocumentId,
      reservationDocumentId: t.itineraryItems.reservationDocumentId,
      title: t.itineraryItems.title,
    })
    .from(t.itineraryItems)
    .where(
      and(
        eq(t.itineraryItems.tripId, tripId),
        or(ilike(t.itineraryItems.title, pattern), ilike(t.itineraryItems.reservationProvider, pattern)),
      ),
    );

  const ticketVoucherMatches = await db
    .select({ documentId: t.activityTickets.voucherDocumentId, title: t.itineraryItems.title, provider: t.activityTickets.provider })
    .from(t.activityTickets)
    .innerJoin(t.itineraryItems, eq(t.itineraryItems.id, t.activityTickets.itemId))
    .where(
      and(eq(t.activityTickets.tripId, tripId), or(ilike(t.itineraryItems.title, pattern), ilike(t.activityTickets.provider, pattern))),
    );

  const mentionsInsurance = ["seguro", "apólice", "apolice", "insurance"].some((w) => query.toLowerCase().includes(w));
  const insuranceMatches = mentionsInsurance
    ? await db.select({ documentId: t.travelInsurances.policyDocumentId, provider: t.travelInsurances.provider }).from(t.travelInsurances).where(eq(t.travelInsurances.tripId, tripId))
    : await db
        .select({ documentId: t.travelInsurances.policyDocumentId, provider: t.travelInsurances.provider })
        .from(t.travelInsurances)
        .where(and(eq(t.travelInsurances.tripId, tripId), ilike(t.travelInsurances.provider, pattern)));

  const expenseMatches = await db
    .select({ documentId: t.expenses.receiptDocumentId, description: t.expenses.description })
    .from(t.expenses)
    .where(and(eq(t.expenses.tripId, tripId), ilike(t.expenses.description, pattern)));

  const candidates: VoucherCandidate[] = [...byDoc];
  for (const m of lodgingMatches) if (m.documentId) candidates.push({ documentId: m.documentId, label: `Hospedagem — ${m.label}` });
  for (const m of bookingMatches) if (m.documentId) candidates.push({ documentId: m.documentId, label: `Transporte — ${m.title}` });
  for (const m of transportVoucherMatches)
    if (m.documentId) candidates.push({ documentId: m.documentId, label: `Transporte (voucher) — ${m.title}${m.provider ? ` — ${m.provider}` : ""}` });
  for (const m of itemMatches) {
    if (m.ticketDocumentId) candidates.push({ documentId: m.ticketDocumentId, label: `Ingresso — ${m.title}` });
    if (m.reservationDocumentId) candidates.push({ documentId: m.reservationDocumentId, label: `Reserva da atividade — ${m.title}` });
  }
  for (const m of ticketVoucherMatches)
    if (m.documentId) candidates.push({ documentId: m.documentId, label: `Ingresso — ${m.title}${m.provider ? ` — ${m.provider}` : ""}` });
  for (const m of insuranceMatches) if (m.documentId) candidates.push({ documentId: m.documentId, label: `Seguro viagem${m.provider ? ` — ${m.provider}` : ""}` });
  for (const m of expenseMatches) if (m.documentId) candidates.push({ documentId: m.documentId, label: `Recibo — ${m.description}` });

  const seen = new Set<string>();
  return candidates.filter((c) => (seen.has(c.documentId) ? false : (seen.add(c.documentId), true)));
}

async function execGetVoucher(ctx: AgentContext, input: Record<string, unknown>): Promise<string> {
  const query = typeof input.query === "string" ? input.query.trim() : "";
  if (!query) return "Preciso de uma descrição do que procurar (ex.: 'voucher do hotel').";

  const candidates = await findVoucherCandidates(ctx.trip.id, query);
  if (candidates.length === 0) return `Não encontrei nenhum documento/voucher relacionado a "${query}".`;

  // Confere visibilidade (mesma regra do painel do viajante) antes de considerar o candidato.
  // O dono da viagem (travelerId nulo) não é filtrado — vê tudo, igual a um membro na web.
  const allowed: VoucherCandidate[] = [];
  for (const c of candidates) {
    const [doc] = await db.select().from(t.documents).where(eq(t.documents.id, c.documentId)).limit(1);
    if (!doc) continue;
    if (!ctx.travelerId || (await travelerCanReadDocument(ctx.trip.id, ctx.travelerId, doc))) allowed.push(c);
  }
  if (allowed.length === 0) return `Não encontrei nenhum documento/voucher relacionado a "${query}" que você tenha acesso.`;

  if (allowed.length > 1) {
    return `Encontrei mais de um resultado para "${query}":\n${allowed.map((c, i) => `${i + 1}) ${c.label}`).join("\n")}\nQual deles?`;
  }

  const [doc] = await db.select().from(t.documents).where(eq(t.documents.id, allowed[0].documentId)).limit(1);
  if (!doc) return "O documento encontrado não existe mais.";
  const buffer = await readStoredFile(doc.storageKey);
  await sendDocument(ctx.chatId, buffer, doc.fileName, doc.mimeType);
  return `Documento "${doc.title}" enviado no chat.`;
}

/**
 * Mesma fonte da Central de Custos (`src/app/(app)/trips/[id]/costs/page.tsx`): todas as
 * origens de valor da viagem (despesa avulsa, transporte, hospedagem, chip, ingresso, passe,
 * seguro, atividade), não só a tabela de despesas — senão o total nunca bate com o que o
 * cliente vê no app.
 */
async function execGetExpenses(ctx: AgentContext): Promise<string> {
  const entries = await listCostEntries(ctx.trip.id);
  if (entries.length === 0) return "Nenhum custo lançado ainda nessa viagem.";

  const currencies = await listClientCurrencyCodes(ctx.trip.ownerId);
  await ensureTodayRates(currencies);
  const converted = await withConvertedAmounts(entries, ctx.trip.baseCurrency);

  const aPagar = converted.filter((e) => e.status === "A_PAGAR").reduce((sum, e) => sum + (e.amountBase ?? 0), 0);
  const pago = converted.filter((e) => e.status === "PAGO").reduce((sum, e) => sum + (e.amountBase ?? 0), 0);
  const unconvertedCount = converted.filter((e) => e.amount && e.amountBase === null).length;

  const categoryNames = toNameMap(await listExpenseCategories());
  const byCategory = new Map<string, number>();
  for (const e of converted) {
    if ((e.status !== "A_PAGAR" && e.status !== "PAGO") || e.amountBase === null) continue;
    const key = e.category ? (categoryNames[e.category] ?? e.category) : SOURCE_LABEL[e.source];
    byCategory.set(key, (byCategory.get(key) ?? 0) + e.amountBase);
  }

  const lines = [
    `Total (${ctx.trip.baseCurrency}): ${(aPagar + pago).toFixed(2)}`,
    `- A pagar: ${aPagar.toFixed(2)}`,
    `- Pago: ${pago.toFixed(2)}`,
    ...[...byCategory.entries()].sort((a, b) => b[1] - a[1]).map(([name, total]) => `- ${name}: ${total.toFixed(2)} ${ctx.trip.baseCurrency}`),
  ];
  if (unconvertedCount > 0) lines.push(`${unconvertedCount} lançamento(s) sem cotação, fora do total acima.`);
  return lines.join("\n");
}

async function execAddExpense(ctx: AgentContext, input: Record<string, unknown>): Promise<string> {
  if (!(await canWrite(ctx))) return "Você não tem permissão para lançar despesas nesta viagem.";

  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (!description) return "Preciso de uma descrição do gasto.";
  const amount = parseDecimal(typeof input.amount === "string" ? input.amount : null, { positive: true });
  if (!amount) return "Preciso de um valor válido, maior que zero.";
  const date = typeof input.date === "string" && ISO_DATE.test(input.date) ? input.date : todayIn(ctx.trip.timezone);

  const categories = await listExpenseCategories();
  const categoryQuery = typeof input.category === "string" ? input.category.trim().toLowerCase() : "";
  const match = categoryQuery ? categories.find((c) => c.name.toLowerCase().includes(categoryQuery)) : undefined;
  const category = match ?? categories.find((c) => c.id === "OTHER") ?? categories[0];
  if (!category) return "Não há categorias de despesa cadastradas.";

  const status =
    typeof input.status === "string" && ["ESTIMADO", "A_PAGAR", "PAGO"].includes(input.status)
      ? (input.status as "ESTIMADO" | "A_PAGAR" | "PAGO")
      : "ESTIMADO";

  const paidById = await resolvePaidBy(ctx);
  await addExpense(ctx.trip.id, paidById, { date, category: category.id, status, description, amount, currency: ctx.trip.baseCurrency }, "telegram");
  return `Despesa lançada: "${description}" — ${amount} ${ctx.trip.baseCurrency} (${category.name}).`;
}

async function execGetTips(ctx: AgentContext, input: Record<string, unknown>): Promise<string> {
  const cities = await getTripCities(ctx.trip.id);
  const cityIds = new Set(cities.map((c) => c.id));
  const query = typeof input.query === "string" ? input.query.trim().toLowerCase() : "";

  const all = await listClientTips(ctx.trip.ownerId);
  const filtered = all.filter((tip) => {
    if (!tip.cityId || !cityIds.has(tip.cityId)) return false;
    if (!query) return true;
    return tip.name.toLowerCase().includes(query) || tip.categories.some((c) => c.name.toLowerCase().includes(query));
  });
  if (filtered.length === 0) return "Nenhuma dica encontrada para essa viagem.";

  const LIMIT = 30;
  const shown = filtered.slice(0, LIMIT);
  const lines = shown.map((tip) => {
    const cats = tip.categories.map((c) => c.name).join(", ");
    const place = [tip.neighborhoodName, tip.cityName].filter(Boolean).join(" — ");
    return `- ${tip.name}${cats ? ` [${cats}]` : ""}${place ? ` (${place})` : ""}`;
  });

  const header =
    filtered.length > LIMIT
      ? `${filtered.length} dicas encontradas — mostrando as ${LIMIT} primeiras (use um texto de busca mais específico pra refinar):`
      : `${filtered.length} dica${filtered.length === 1 ? "" : "s"} encontrada${filtered.length === 1 ? "" : "s"}:`;
  return `${header}\n${lines.join("\n")}`;
}

async function execAddTip(ctx: AgentContext, input: Record<string, unknown>): Promise<string> {
  if (!(await canWrite(ctx))) return "Você não tem permissão para cadastrar dicas nesta viagem.";

  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) return "Preciso do nome do lugar.";
  const neighborhoodQuery = typeof input.neighborhood === "string" ? input.neighborhood.trim() : "";
  if (!neighborhoodQuery) return "Preciso saber o bairro/região.";

  const cities = await getTripCities(ctx.trip.id);
  const neighborhoods = await listNeighborhoodsForCities(cities.map((c) => c.id));
  const match = neighborhoods.find((n) => n.name.toLowerCase().includes(neighborhoodQuery.toLowerCase()));
  if (!match) {
    const list = neighborhoods.map((n) => `${n.name} (${n.cityName})`).join(", ") || "nenhum bairro cadastrado nas cidades da viagem";
    return `Não encontrei o bairro "${neighborhoodQuery}" nas cidades da viagem. Bairros disponíveis: ${list}.`;
  }

  const allCategories = await listTipCategories();
  const wantedNames = Array.isArray(input.categories) ? input.categories.filter((c): c is string => typeof c === "string") : [];
  const categoryIds = allCategories.filter((c) => wantedNames.some((w) => c.name.toLowerCase().includes(w.toLowerCase()))).map((c) => c.id);

  const [tip] = await db
    .insert(t.tips)
    .values({
      clientId: ctx.trip.ownerId,
      name,
      description: typeof input.description === "string" ? input.description : null,
      cityId: match.cityId,
      neighborhoodId: match.id,
    })
    .returning({ id: t.tips.id });
  if (categoryIds.length > 0) {
    await db.insert(t.tipCategoryLinks).values(categoryIds.map((categoryId) => ({ tipId: tip.id, categoryId })));
  }
  return `Dica "${name}" cadastrada em ${match.name} (${match.cityName}).`;
}

/**
 * Dono vê tudo da viagem (todos os viajantes); viajante com permissão FULL (gestor) também —
 * mesma regra de `canWrite`. Viajante com permissão só de leitura vê apenas o que é dele.
 */
async function execGetTicketsAndPasses(ctx: AgentContext, input: Record<string, unknown>): Promise<string> {
  const query = typeof input.query === "string" ? input.query.trim().toLowerCase() : "";
  const seeAll = await canWrite(ctx);

  let tickets: (Omit<Awaited<ReturnType<typeof listTripTickets>>[number], "travelerName"> & { travelerName: string | null })[];
  let passes: (Omit<Awaited<ReturnType<typeof listTripPasses>>[number], "travelerName"> & { travelerName: string | null })[];
  if (seeAll) {
    const [owner] = await db.select({ name: t.users.name }).from(t.users).where(eq(t.users.id, ctx.trip.ownerId)).limit(1);
    const ownerName = owner?.name ?? "Dono da viagem";
    tickets = await listTripTickets(ctx.trip.id, ownerName);
    passes = await listTripPasses(ctx.trip.id, ownerName);
  } else {
    tickets = (await listTravelerTickets(ctx.trip.id, ctx.travelerId)).map((r) => ({ ...r, travelerName: null }));
    passes = (await listTravelerPasses(ctx.trip.id, ctx.travelerId)).map((p) => ({ ...p, travelerName: null }));
  }

  const ticketLines = tickets
    .filter((r) => !query || r.itemTitle.toLowerCase().includes(query) || (r.ticket.provider ?? "").toLowerCase().includes(query))
    .map((r) => {
      const parts = [`${formatDate(r.itemDate)} — ${r.itemTitle}`];
      if (seeAll) parts.push(`viajante: ${r.travelerName}`);
      if (r.ticket.provider) parts.push(r.ticket.provider);
      parts.push(r.ticket.status);
      if (r.ticket.price) parts.push(`${r.ticket.price} ${r.ticket.currency ?? ctx.trip.baseCurrency}`);
      if (r.ticket.ticketNumber) parts.push(`nº ${r.ticket.ticketNumber}`);
      let line = `- ${parts.join(" — ")}`;
      if (r.ticket.details) line += `\n  Detalhes: ${r.ticket.details}`;
      return line;
    });

  const matchingPasses = passes.filter((p) => !query || p.name.toLowerCase().includes(query));
  const usagesByPass = await listUsagesForPasses(matchingPasses.map((p) => p.id));
  const passLines = matchingPasses.map((p) => {
    const remaining = p.maxUses === null ? "ilimitado" : `${Math.max(p.maxUses - p.usedCount, 0)} de ${p.maxUses} usos restantes`;
    const parts = [p.name];
    if (p.provider) parts.push(p.provider);
    parts.push(p.status);
    if (p.price) parts.push(`${p.price} ${p.currency ?? ctx.trip.baseCurrency}`);
    if (p.passNumber) parts.push(`nº ${p.passNumber}`);
    parts.push(remaining);
    if (seeAll) parts.push(`viajante: ${p.travelerName}`);
    let line = `- ${parts.join(" — ")}`;
    if (p.details) line += `\n  Detalhes: ${p.details}`;
    const usages = usagesByPass.get(p.id) ?? [];
    if (usages.length > 0) {
      line += `\n  Usado em: ${usages.map((u) => `${formatDate(u.itemDate)} — ${u.itemTitle}`).join(", ")}`;
    }
    return line;
  });

  if (ticketLines.length === 0 && passLines.length === 0) return "Nenhum ingresso ou passe encontrado.";

  const lines: string[] = [];
  if (ticketLines.length > 0) lines.push("Ingressos:", ...ticketLines);
  if (passLines.length > 0) lines.push(passLines.length > 0 && ticketLines.length > 0 ? "" : "", "Passes:", ...passLines);
  return lines.join("\n");
}

type ActivityCandidate = { id: string; title: string; date: string };

async function findActivityCandidates(tripId: string, query: string): Promise<ActivityCandidate[]> {
  return db
    .select({ id: t.itineraryItems.id, title: t.itineraryItems.title, date: t.itineraryItems.date })
    .from(t.itineraryItems)
    .where(and(eq(t.itineraryItems.tripId, tripId), ilike(t.itineraryItems.title, `%${query}%`)));
}

async function execLinkTipToActivity(ctx: AgentContext, input: Record<string, unknown>): Promise<string> {
  if (!(await canWrite(ctx))) return "Você não tem permissão para editar atividades nesta viagem.";

  const activityQuery = typeof input.activity === "string" ? input.activity.trim() : "";
  const tipQuery = typeof input.tip === "string" ? input.tip.trim() : "";
  if (!activityQuery || !tipQuery) return "Preciso do nome da atividade e do nome da dica.";

  const activities = await findActivityCandidates(ctx.trip.id, activityQuery);
  if (activities.length === 0) return `Não encontrei nenhuma atividade com "${activityQuery}" no roteiro.`;
  if (activities.length > 1) {
    return `Encontrei mais de uma atividade para "${activityQuery}":\n${activities.map((a, i) => `${i + 1}) ${formatDate(a.date)} — ${a.title}`).join("\n")}\nQual delas?`;
  }

  const tips = (await listClientTips(ctx.trip.ownerId)).filter((tip) => tip.name.toLowerCase().includes(tipQuery.toLowerCase()));
  if (tips.length === 0) return `Não encontrei nenhuma dica cadastrada com "${tipQuery}".`;
  if (tips.length > 1) {
    return `Encontrei mais de uma dica para "${tipQuery}":\n${tips.map((tp, i) => `${i + 1}) ${tp.name}`).join("\n")}\nQual delas?`;
  }

  const activity = activities[0];
  const tip = tips[0];
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(t.itineraryItemTips)
    .where(eq(t.itineraryItemTips.itemId, activity.id));
  await db.insert(t.itineraryItemTips).values({ itemId: activity.id, tipId: tip.id, position: count }).onConflictDoNothing();
  return `Dica "${tip.name}" vinculada à atividade "${activity.title}".`;
}

type RouteCandidate =
  | { kind: "activity"; id: string; title: string; date: string }
  | { kind: "booking"; id: string; title: string }
  | { kind: "lodging"; id: string; title: string };

async function findRouteCandidates(tripId: string, query: string): Promise<RouteCandidate[]> {
  const pattern = `%${query}%`;

  const activities = await db
    .select({ id: t.itineraryItems.id, title: t.itineraryItems.title, date: t.itineraryItems.date })
    .from(t.itineraryItems)
    .where(and(eq(t.itineraryItems.tripId, tripId), ilike(t.itineraryItems.title, pattern)));

  const bookings = await db
    .select({ id: t.bookings.id, title: t.bookings.title })
    .from(t.bookings)
    .where(and(eq(t.bookings.tripId, tripId), or(ilike(t.bookings.title, pattern), ilike(t.bookings.provider, pattern))));

  const lodgings = await db
    .select({ id: t.lodgings.id, title: t.lodgings.name })
    .from(t.lodgings)
    .where(and(eq(t.lodgings.tripId, tripId), ilike(t.lodgings.name, pattern)));

  return [
    ...activities.map((a): RouteCandidate => ({ kind: "activity", id: a.id, title: a.title, date: a.date })),
    ...bookings.map((b): RouteCandidate => ({ kind: "booking", id: b.id, title: b.title })),
    ...lodgings.map((l): RouteCandidate => ({ kind: "lodging", id: l.id, title: l.title })),
  ];
}

async function execGetRoute(ctx: AgentContext, input: Record<string, unknown>): Promise<string> {
  const query = typeof input.query === "string" ? input.query.trim() : "";
  if (!query) return "Preciso de uma descrição do que procurar (ex.: 'rota pra torre de belém').";

  const candidates = await findRouteCandidates(ctx.trip.id, query);
  if (candidates.length === 0) return `Não encontrei nenhuma atividade, transporte ou hospedagem com "${query}".`;
  if (candidates.length > 1) {
    const list = candidates
      .map((c, i) => {
        const label = c.kind === "activity" ? `${formatDate(c.date)} — ${c.title}` : c.kind === "booking" ? `Transporte — ${c.title}` : `Hospedagem — ${c.title}`;
        return `${i + 1}) ${label}`;
      })
      .join("\n");
    return `Encontrei mais de uma coisa para "${query}":\n${list}\nQual delas?`;
  }

  const candidate = candidates[0];

  if (candidate.kind === "booking") {
    const [leg] = await db
      .select({
        originLocation: t.bookingLegs.originLocation,
        originCityName: t.cities.name,
        destinationLocation: t.bookingLegs.destinationLocation,
        destinationCityId: t.bookingLegs.destinationCityId,
      })
      .from(t.bookingLegs)
      .leftJoin(t.cities, eq(t.cities.id, t.bookingLegs.originCityId))
      .where(eq(t.bookingLegs.bookingId, candidate.id))
      .orderBy(asc(t.bookingLegs.legOrder))
      .limit(1);
    if (!leg) return `"${candidate.title}" não tem nenhum trecho com origem/destino cadastrado.`;
    const [destinationCity] = leg.destinationCityId
      ? await db.select({ name: t.cities.name }).from(t.cities).where(eq(t.cities.id, leg.destinationCityId)).limit(1)
      : [null];
    const origin = [leg.originLocation, leg.originCityName].filter(Boolean).join(", ");
    const destination = [leg.destinationLocation, destinationCity?.name].filter(Boolean).join(", ");
    if (!destination) return `"${candidate.title}" não tem destino cadastrado no trecho.`;
    const url = googleMapsDirectionsUrl({ origin: origin || null, destination });
    return `Rota de "${candidate.title}":\n${url}`;
  }

  if (candidate.kind === "lodging") {
    const [lodging] = await db
      .select({ name: t.lodgings.name, address: t.lodgings.address, cityName: t.cities.name })
      .from(t.lodgings)
      .leftJoin(t.cities, eq(t.cities.id, t.lodgings.cityId))
      .where(eq(t.lodgings.id, candidate.id))
      .limit(1);
    if (!lodging) return `Não encontrei "${candidate.title}".`;
    const destination = [lodging.name, lodging.address, lodging.cityName].filter(Boolean).join(", ");
    const url = googleMapsDirectionsUrl({ destination });
    return `Rota pra "${candidate.title}" (a partir de onde você estiver):\n${url}`;
  }

  // Atividade: destino é o próprio local, com as dicas vinculadas como paradas no meio do caminho.
  const route = await getActivityRouteUrls(ctx.trip.id, candidate.id);
  if (!route) return `Não encontrei local/endereço cadastrado para "${candidate.title}".`;

  const lines = [`Rota pra "${candidate.title}":`];
  lines.push(`📍 A partir de onde você estiver: ${route.liveUrl}`);
  if (route.mapUrl) lines.push(`📍 ${route.mapLabel}: ${route.mapUrl}`);
  return lines.join("\n");
}

export function buildToolExecutor(ctx: AgentContext) {
  return async function execute(name: string, input: Record<string, unknown>): Promise<string> {
    try {
      switch (name) {
        case "get_trip_overview":
          return await execTripOverview(ctx);
        case "get_agenda":
          return await execGetAgenda(ctx, input);
        case "get_voucher":
          return await execGetVoucher(ctx, input);
        case "get_expenses":
          return await execGetExpenses(ctx);
        case "add_expense":
          return await execAddExpense(ctx, input);
        case "get_tips":
          return await execGetTips(ctx, input);
        case "add_tip":
          return await execAddTip(ctx, input);
        case "get_tickets_and_passes":
          return await execGetTicketsAndPasses(ctx, input);
        case "link_tip_to_activity":
          return await execLinkTipToActivity(ctx, input);
        case "get_route":
          return await execGetRoute(ctx, input);
        default:
          return `Tool desconhecida: ${name}.`;
      }
    } catch (e) {
      return e instanceof Error ? `Erro ao executar ${name}: ${e.message}` : `Erro ao executar ${name}.`;
    }
  };
}
