import "server-only";
import { and, eq, ilike, or } from "drizzle-orm";
import { db, t } from "@/db";
import { getAgenda } from "@/services/agenda";
import { getTripCities } from "@/services/cities";
import { listDocuments } from "@/services/documents";
import { travelerCanReadDocument } from "@/lib/traveler-access";
import { readStoredFile } from "@/lib/storage";
import { sendDocument } from "@/lib/telegram";
import { formatDate, formatWeekday, todayIn } from "@/lib/format";
import type { AgentTool } from "./claude";

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
        default:
          return `Tool desconhecida: ${name}.`;
      }
    } catch (e) {
      return e instanceof Error ? `Erro ao executar ${name}: ${e.message}` : `Erro ao executar ${name}.`;
    }
  };
}
