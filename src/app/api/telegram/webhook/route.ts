import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, or } from "drizzle-orm";
import { db, t } from "@/db";
import { formatDate } from "@/lib/format";
import { parseIncomingMessage, sendMessage, verifyWebhookSecret, type TelegramUpdate } from "@/lib/telegram";
import { checkAgentRateLimit } from "@/lib/agent/rate-limit";
import { runAgentForMessage } from "@/lib/agent/run";

/** Viagens em curso/futuras vinculadas a este viajante, na ordem em que começam. */
async function listTravelerTrips(travelerId: string) {
  const today = new Date().toISOString().slice(0, 10);
  return db
    .select({ id: t.trips.id, title: t.trips.title, destination: t.trips.destination, startDate: t.trips.startDate, endDate: t.trips.endDate })
    .from(t.tripTravelers)
    .innerJoin(t.trips, eq(t.trips.id, t.tripTravelers.tripId))
    .where(and(eq(t.tripTravelers.travelerId, travelerId), gte(t.trips.endDate, today)))
    .orderBy(t.trips.startDate);
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

  const [traveler] = await db.select({ id: t.travelers.id, name: t.travelers.name }).from(t.travelers).where(eq(t.travelers.id, row.travelerId)).limit(1);
  if (!traveler) {
    await sendMessage(chatId, "Viajante não encontrado.");
    return;
  }

  await db.transaction(async (tx) => {
    await tx.delete(t.telegramLinks).where(or(eq(t.telegramLinks.travelerId, traveler.id), eq(t.telegramLinks.chatId, chatId)));
    await tx.insert(t.telegramLinks).values({ travelerId: traveler.id, chatId });
    await tx.update(t.telegramLinkTokens).set({ usedAt: new Date() }).where(eq(t.telegramLinkTokens.id, row.id));
  });

  await sendMessage(chatId, `Vinculado! Oi, ${traveler.name.split(" ")[0]} 👋 Pode me perguntar sobre sua viagem (agenda, vouchers, etc.).`);
}

async function handleSwitchTrip(chatId: string, linkId: string, travelerId: string) {
  await db.update(t.telegramLinks).set({ activeTripId: null }).where(eq(t.telegramLinks.id, linkId));
  const candidates = await listTravelerTrips(travelerId);
  if (candidates.length === 0) {
    await sendMessage(chatId, "Não encontrei nenhuma viagem em curso ou futura vinculada a você.");
    return;
  }
  if (candidates.length === 1) {
    await db.update(t.telegramLinks).set({ activeTripId: candidates[0].id }).where(eq(t.telegramLinks.id, linkId));
    await sendMessage(chatId, `Você só tem uma viagem: ${candidates[0].title}. Continuando com ela.`);
    return;
  }
  const list = candidates.map((c, i) => `${i + 1}) ${c.title} — ${c.destination} (${formatDate(c.startDate)} a ${formatDate(c.endDate)})`).join("\n");
  await sendMessage(chatId, `Qual viagem?\n${list}\nResponda com o número.`);
}

async function handleMessage(chatId: string, text: string) {
  const [link] = await db.select().from(t.telegramLinks).where(eq(t.telegramLinks.chatId, chatId)).limit(1);
  if (!link) {
    await sendMessage(chatId, "Você ainda não está vinculado. Peça o link de convite ao seu agente de viagens.");
    return;
  }

  if (text === "/trocar") {
    await handleSwitchTrip(chatId, link.id, link.travelerId);
    return;
  }

  if (!checkAgentRateLimit(link.travelerId)) {
    await sendMessage(chatId, "Você atingiu o limite de mensagens por hoje. Tente de novo mais tarde.");
    return;
  }

  let tripId = link.activeTripId;
  if (!tripId) {
    const candidates = await listTravelerTrips(link.travelerId);
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
  const [traveler] = await db.select({ name: t.travelers.name }).from(t.travelers).where(eq(t.travelers.id, link.travelerId)).limit(1);
  if (!trip || !traveler) {
    await sendMessage(chatId, "Não encontrei a viagem vinculada. Fale com seu agente de viagens.");
    return;
  }

  const reply = await runAgentForMessage(link, traveler.name, trip, text);
  await sendMessage(chatId, reply);
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
