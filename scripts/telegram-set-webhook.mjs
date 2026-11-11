// Registra (ou atualiza) o webhook do bot no Telegram — roda uma vez, manual, depois do deploy.
//
//   TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, TELEGRAM_WEBHOOK_URL
//   (ex.: https://viagens.exemplo.com/api/telegram/webhook)
//
// Uso: node scripts/telegram-set-webhook.mjs
const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const url = process.env.TELEGRAM_WEBHOOK_URL;

if (!token || !secret || !url) {
  console.error("Defina TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET e TELEGRAM_WEBHOOK_URL.");
  process.exit(1);
}

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ url, secret_token: secret, drop_pending_updates: true }),
});
const body = await res.json();
console.log(body);
if (!body.ok) process.exit(1);
