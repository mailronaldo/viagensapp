import "server-only";

function apiUrl(method: string): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN não configurado.");
  return `https://api.telegram.org/bot${token}/${method}`;
}

/** Confere o header que o Telegram manda em todo webhook, configurado via `secret_token` no setWebhook. */
export function verifyWebhookSecret(headerValue: string | null): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  return !!expected && headerValue === expected;
}

export async function sendMessage(chatId: string, text: string): Promise<void> {
  const res = await fetch(apiUrl("sendMessage"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Falha ao enviar mensagem no Telegram (HTTP ${res.status}). ${body.slice(0, 200)}`);
  }
}

/** Mostra "digitando..." no chat — dura ~5s no Telegram, então precisa ser repetido durante respostas longas. */
export async function sendChatAction(chatId: string, action: "typing"): Promise<void> {
  await fetch(apiUrl("sendChatAction"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action }),
  }).catch(() => {});
}

/** Envia um arquivo (ex.: voucher) direto no chat — sem precisar expor uma URL pública. */
export async function sendDocument(chatId: string, buffer: Buffer, filename: string, mimeType: string): Promise<void> {
  const form = new FormData();
  form.set("chat_id", chatId);
  form.set("document", new Blob([new Uint8Array(buffer)], { type: mimeType }), filename);

  const res = await fetch(apiUrl("sendDocument"), { method: "POST", body: form });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Falha ao enviar documento no Telegram (HTTP ${res.status}). ${body.slice(0, 200)}`);
  }
}

export type TelegramUpdate = {
  message?: {
    chat: { id: number };
    text?: string;
  };
};

/** `text` vem `null` quando a mensagem existe mas não é texto (áudio, foto, figurinha, etc.). */
export function parseIncomingMessage(update: TelegramUpdate): { chatId: string; text: string | null } | null {
  const msg = update.message;
  if (!msg) return null;
  return { chatId: String(msg.chat.id), text: msg.text ? msg.text.trim() : null };
}
