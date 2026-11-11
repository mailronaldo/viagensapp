"use server";

import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db, t } from "@/db";
import { requireClient } from "@/lib/auth";

export type TelegramLinkState = { error?: string; link?: string };

const TELEGRAM_LINK_TTL_MS = 30 * 60 * 1000;

async function ownTraveler(clientId: string, travelerId: string) {
  const [tr] = await db
    .select()
    .from(t.travelers)
    .where(and(eq(t.travelers.id, travelerId), eq(t.travelers.clientId, clientId)))
    .limit(1);
  return tr ?? null;
}

async function createLinkToken(clientId: string, travelerId: string | null): Promise<TelegramLinkState> {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  if (!botUsername) return { error: "O agente no Telegram ainda não foi configurado (falta TELEGRAM_BOT_USERNAME)." };

  const token = randomBytes(24).toString("base64url");
  await db.insert(t.telegramLinkTokens).values({
    clientId,
    travelerId,
    token,
    expiresAt: new Date(Date.now() + TELEGRAM_LINK_TTL_MS),
  });

  return { link: `https://t.me/${botUsername}?start=${token}` };
}

/** Gera um link de convite de uso único pro viajante vincular o próprio chat do Telegram ao cadastro. */
export async function generateTelegramLinkAction(
  _prev: TelegramLinkState,
  formData: FormData,
): Promise<TelegramLinkState> {
  const client = await requireClient();
  const tr = await ownTraveler(client.id, String(formData.get("travelerId") ?? ""));
  if (!tr) return { error: "Viajante não encontrado." };
  return createLinkToken(client.id, tr.id);
}

export async function unlinkTelegramAction(travelerId: string) {
  const client = await requireClient();
  const tr = await ownTraveler(client.id, travelerId);
  if (tr) await db.delete(t.telegramLinks).where(eq(t.telegramLinks.travelerId, tr.id));
  redirect(`/travelers/${travelerId}`);
}

/** Mesma coisa, mas pro próprio dono da viagem (conta CLIENT) — "Minha conta". */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- assinatura exigida por useActionState
export async function generateTelegramLinkForOwnerAction(_prev: TelegramLinkState, _formData: FormData): Promise<TelegramLinkState> {
  const client = await requireClient();
  return createLinkToken(client.id, null);
}

export async function unlinkTelegramForOwnerAction() {
  const client = await requireClient();
  await db.delete(t.telegramLinks).where(and(eq(t.telegramLinks.clientId, client.id), isNull(t.telegramLinks.travelerId)));
  redirect("/account");
}
