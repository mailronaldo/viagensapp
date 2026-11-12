import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, isNull, or } from "drizzle-orm";
import { db, t } from "@/db";
import { formatDate } from "@/lib/format";
import { parseIncomingMessage, sendChatAction, sendMessage, verifyWebhookSecret, type LinkButton, type TelegramUpdate } from "@/lib/telegram";
import { checkAgentRateLimit } from "@/lib/agent/rate-limit";
import { runAgentForMessage } from "@/lib/agent/run";

type Link = typeof t.telegramLinks.$inferSelect;

/**
 * Viagens em curso/futuras vinculadas a este chat, na ordem em que começam.
 * `travelerId` nulo = o próprio dono da viagem (mesma convenção de
 * chips/passes): aí é "as viagens que ele mesmo viaja", não "gerencia".
 */
async function listLinkedTrips(link: { clientId: string; travelerId: string | null }) {
  const today = new Date().toISOString().slice(0, 10);
  const cols = { id: t.trips.id, title: t.trips.title, destination: t.trips.destination, startDate: t.trips.startDate, endDate: t.trips.endDate };

  if (link.travelerId) {
    return db
      .select(cols)
      .from(t.tripTravelers)
      .innerJoin(t.trips, eq(t.trips.id, t.tripTravelers.tripId))
      .where(and(eq(t.tripTravelers.travelerId, link.travelerId), gte(t.trips.endDate, today)))
      .orderBy(t.trips.startDate);
  }
  return db
    .select(cols)
    .from(t.trips)
    .where(and(eq(t.trips.ownerId, link.clientId), eq(t.trips.ownerIsTraveler, true), gte(t.trips.endDate, today)))
    .orderBy(t.trips.startDate);
}

async function resolveLinkName(link: { clientId: string; travelerId: string | null }): Promise<string | null> {
  if (link.travelerId) {
    const [tr] = await db.select({ name: t.travelers.name }).from(t.travelers).where(eq(t.travelers.id, link.travelerId)).limit(1);
    return tr?.name ?? null;
  }
  const [u] = await db.select({ name: t.users.name }).from(t.users).where(eq(t.users.id, link.clientId)).limit(1);
  return u?.name ?? null;
}

async function handleStart(chatId: string, text: string) {
  const token = text.slice("/start".length).trim();
  if (!token) {
    await sendMessage(chatId, "Link inválido. Peça um novo link ao seu agente de viagens.");
    return;
  }

  const [row] = await db.select().from(t.telegramLinkTokens).where(eq(t.telegramLinkTokens.token, token)).limit(1);
  if (!row || row.usedAt || row.expiresAt < new Date()) {
    await sendMessage(chatId, "Esse link não é mais válido (já usado ou expirado). Peça um novo link ao seu agente de viagens.");
    return;
  }

  const name = await resolveLinkName(row);
  if (!name) {
    await sendMessage(chatId, "Cadastro não encontrado.");
    return;
  }

  await db.transaction(async (tx) => {
    const sameSubject = row.travelerId ? eq(t.telegramLinks.travelerId, row.travelerId) : and(eq(t.telegramLinks.clientId, row.clientId), isNull(t.telegramLinks.travelerId));
    await tx.delete(t.telegramLinks).where(or(sameSubject, eq(t.telegramLinks.chatId, chatId)));
    await tx.insert(t.telegramLinks).values({ clientId: row.clientId, travelerId: row.travelerId, chatId });
    await tx.update(t.telegramLinkTokens).set({ usedAt: new Date() }).where(eq(t.telegramLinkTokens.id, row.id));
  });

  await sendMessage(chatId, `Vinculado! Oi, ${name.split(" ")[0]} 👋 Pode me perguntar sobre sua viagem (agenda, vouchers, etc.).`);
}

async function handleSwitchTrip(chatId: string, link: Link) {
  await db.update(t.telegramLinks).set({ activeTripId: null }).where(eq(t.telegramLinks.id, link.id));
  const candidates = await listLinkedTrips(link);
  if (candidates.length === 0) {
    await sendMessage(chatId, "Não encontrei nenhuma viagem em curso ou futura vinculada a você.");
    return;
  }
  if (candidates.length === 1) {
    await db.update(t.telegramLinks).set({ activeTripId: candidates[0].id }).where(eq(t.telegramLinks.id, link.id));
    await sendMessage(chatId, `Você só tem uma viagem: ${candidates[0].title}. Continuando com ela.`);
    return;
  }
  const list = candidates.map((c, i) => `${i + 1}) ${c.title} — ${c.destination} (${formatDate(c.startDate)} a ${formatDate(c.endDate)})`).join("\n");
  await sendMessage(chatId, `Qual viagem?\n${list}\nResponda com o número.`);
}

const MAPS_URL_RE = /https:\/\/www\.google\.com\/maps\/\S+/;

/**
 * O bot responde com texto livre (o modelo decide a redação), mas qualquer
 * link de rota que ele gere sempre segue o formato "rótulo: URL" — então
 * extraímos cada linha com link do texto e virão botão ("Ver rota no mapa")
 * em vez de uma URL enorme solta na conversa.
 */
function extractMapButtons(text: string): { text: string; buttons: LinkButton[] } {
  const buttons: LinkButton[] = [];
  const keptLines: string[] = [];
  for (const line of text.split("\n")) {
    const match = line.match(MAPS_URL_RE);
    if (!match) {
      keptLines.push(line);
      continue;
    }
    const label = line
      .slice(0, match.index)
      .replace(/^[\s📍🗺️-]+/, "")
      .replace(/[\s:–-]+$/, "")
      .trim();
    buttons.push({ text: `🗺️ ${label || `Ver rota ${buttons.length + 1}`}`.slice(0, 64), url: match[0] });
  }
  return { text: keptLines.join("\n").replace(/\n{3,}/g, "\n\n").trim(), buttons };
}

async function handleMessage(chatId: string, text: string) {
  const [link] = await db.select().from(t.telegramLinks).where(eq(t.telegramLinks.chatId, chatId)).limit(1);
  if (!link) {
    await sendMessage(chatId, "Você ainda não está vinculado. Peça o link de convite ao seu agente de viagens.");
    return;
  }

  if (text === "/trocar") {
    await handleSwitchTrip(chatId, link);
    return;
  }

  if (!checkAgentRateLimit(link.id)) {
    await sendMessage(chatId, "Você atingiu o limite de mensagens por hoje. Tente de novo mais tarde.");
    return;
  }

  let tripId = link.activeTripId;
  if (!tripId) {
    const candidates = await listLinkedTrips(link);
    if (candidates.length === 0) {
      await sendMessage(chatId, "Não encontrei nenhuma viagem em curso ou futura vinculada a você. Fale com seu agente de viagens.");
      return;
    }
    if (candidates.length === 1) {
      tripId = candidates[0].id;
      await db.update(t.telegramLinks).set({ activeTripId: tripId }).where(eq(t.telegramLinks.id, link.id));
    } else {
      const choiceIndex = /^\d+$/.test(text) ? Number(text) - 1 : -1;
      const choice = choiceIndex >= 0 ? candidates[choiceIndex] : undefined;
      if (!choice) {
        const list = candidates.map((c, i) => `${i + 1}) ${c.title} — ${c.destination} (${formatDate(c.startDate)} a ${formatDate(c.endDate)})`).join("\n");
        await sendMessage(chatId, `Você tem ${candidates.length} viagens:\n${list}\nResponda com o número de qual você quer falar.`);
        return;
      }
      tripId = choice.id;
      await db.update(t.telegramLinks).set({ activeTripId: tripId }).where(eq(t.telegramLinks.id, link.id));
      await sendMessage(chatId, `Prontinho, viagem ativa: ${choice.title}. Pode perguntar!`);
      return;
    }
  }

  const [trip] = await db.select().from(t.trips).where(eq(t.trips.id, tripId)).limit(1);
  const name = await resolveLinkName(link);
  if (!trip || !name) {
    await sendMessage(chatId, "Não encontrei a viagem vinculada. Fale com seu agente de viagens.");
    return;
  }

  await sendChatAction(chatId, "typing");
  const typingInterval = setInterval(() => sendChatAction(chatId, "typing"), 4000);
  let reply: string;
  try {
    reply = await runAgentForMessage(link, name, trip, text);
  } finally {
    clearInterval(typingInterval);
  }
  const { text: cleanedReply, buttons } = extractMapButtons(reply);
  await sendMessage(chatId, cleanedReply || reply, buttons);
}

export async function POST(req: NextRequest) {
  if (!verifyWebhookSecret(req.headers.get("x-telegram-bot-api-secret-token"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const incoming = parseIncomingMessage(update);
  if (!incoming) return NextResponse.json({ ok: true });
  const { chatId, text } = incoming;

  if (text === null) {
    // Áudio, foto, figurinha, etc. — ainda não suportado (fica pra um próximo lote).
    await sendMessage(chatId, "Por enquanto eu só entendo mensagens de texto — manda sua pergunta digitada que eu te ajudo 🙂").catch(() => {});
    return NextResponse.json({ ok: true });
  }

  try {
    if (text.startsWith("/start")) {
      await handleStart(chatId, text);
    } else {
      await handleMessage(chatId, text);
    }
  } catch (e) {
    console.error("[telegram webhook]", e);
    await sendMessage(chatId, "Deu um erro aqui do nosso lado. Tente de novo em um instante.").catch(() => {});
  }

  // Sempre 200: evita o Telegram reenviar o update em loop por causa de um erro já tratado.
  return NextResponse.json({ ok: true });
}
