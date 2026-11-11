import "server-only";
import { and, eq, ilike, or } from "drizzle-orm";
import { db, t } from "@/db";
import { getAgenda } from "@/services/agenda";
import { getTripCities, listNeighborhoodsForCities } from "@/services/cities";
import { listDocuments } from "@/services/documents";
import { addExpense, getExpenseSummary } from "@/services/expenses";
import { listClientTips } from "@/services/tips";
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
      "Procura e envia direto no chat um documento/voucher da viagem (reserva de hospedagem, transporte, ingresso) a partir de uma descrição livre (ex.: 'voucher do hotel', 'passagem de avião').",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "O que o viajante está procurando." } },
      required: ["query"],
    },
  },
  {
    name: "get_expenses",
    description: "Resumo dos gastos já lançados na viagem: total por categoria e por moeda.",
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
    description: "Lista as dicas (lugares) cadastradas nas cidades da viagem. Pode filtrar por um texto livre (nome ou categoria).",
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

  const candidates: VoucherCandidate[] = [...byDoc];
  for (const m of lodgingMatches) if (m.documentId) candidates.push({ documentId: m.documentId, label: `Hospedagem — ${m.label}` });
  for (const m of bookingMatches) if (m.documentId) candidates.push({ documentId: m.documentId, label: `Transporte — ${m.title}` });

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

async function execGetExpenses(ctx: AgentContext): Promise<string> {
  const summary = await getExpenseSummary(ctx.trip.id, ctx.trip.baseCurrency);
  if (summary.byCurrency.length === 0) return "Nenhuma despesa lançada ainda nessa viagem.";

  const names = toNameMap(await listExpenseCategories());
  const lines = [
    `Total (em ${summary.baseCurrency}): ${summary.totalBase.toFixed(2)}`,
    ...summary.byCategory.map((c) => `- ${names[c.category] ?? c.category}: ${c.totalBase.toFixed(2)} ${summary.baseCurrency}`),
  ];
  if (summary.byCurrency.length > 1) {
    lines.push(`Por moeda original: ${summary.byCurrency.map((c) => `${c.total.toFixed(2)} ${c.currency}`).join(", ")}`);
  }
  if (summary.unconvertedCount > 0) lines.push(`${summary.unconvertedCount} despesa(s) em outra moeda sem cotação, fora do total acima.`);
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

  const lines = filtered.slice(0, 15).map((tip) => {
    const cats = tip.categories.map((c) => c.name).join(", ");
    const place = [tip.neighborhoodName, tip.cityName].filter(Boolean).join(" — ");
    return `- ${tip.name}${cats ? ` [${cats}]` : ""}${place ? ` (${place})` : ""}`;
  });
  return lines.join("\n");
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
        default:
          return `Tool desconhecida: ${name}.`;
      }
    } catch (e) {
      return e instanceof Error ? `Erro ao executar ${name}: ${e.message}` : `Erro ao executar ${name}.`;
    }
  };
}
