import "server-only";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { runAgentTurn, type AgentHistoryEntry } from "./claude";
import { AGENT_TOOLS, buildToolExecutor } from "./tools";

const MAX_HISTORY = 10;

function systemPrompt(travelerName: string, tripTitle: string): string {
  return [
    `Você é o agente de viagens do sistema, conversando no Telegram com ${travelerName}.`,
    `A viagem ativa agora é "${tripTitle}". Responda só sobre essa viagem.`,
    "Use as tools disponíveis para buscar informação real — nunca invente datas, lugares ou códigos de reserva.",
    "Seja direto e objetivo, em português, como numa conversa de WhatsApp (sem formatação markdown pesada).",
  ].join("\n");
}

/** Roda uma mensagem do viajante pelo agente e devolve o texto de resposta, já atualizando o histórico curto do vínculo. */
export async function runAgentForMessage(link: {
  id: string;
  chatId: string;
  travelerId: string;
  history: unknown;
}, travelerName: string, trip: typeof t.trips.$inferSelect, userText: string): Promise<string> {
  const history: AgentHistoryEntry[] = Array.isArray(link.history) ? (link.history as AgentHistoryEntry[]) : [];

  const ctx = { chatId: link.chatId, travelerId: link.travelerId, trip };
  const result = await runAgentTurn({
    system: systemPrompt(travelerName, trip.title),
    history,
    userText,
    tools: AGENT_TOOLS,
    execute: buildToolExecutor(ctx),
  });

  const replyText = "text" in result ? result.text : result.error;

  const nextHistory = [...history, { role: "user", text: userText }, { role: "assistant", text: replyText }].slice(-MAX_HISTORY);
  await db.update(t.telegramLinks).set({ history: nextHistory }).where(eq(t.telegramLinks.id, link.id));

  return replyText;
}
