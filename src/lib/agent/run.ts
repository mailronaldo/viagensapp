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
    "",
    "Quando a mensagem trouxer uma foto ou um PDF de documento (o texto vem como '[Foto recebida. id_documento=...]' ou '[PDF recebido. id_documento=...]'):",
    "1. Leia a imagem/PDF e extraia os campos visíveis. Identifique o tipo: gasto avulso (recibo/nota), voucher de hospedagem, voucher de transporte ou ingresso de atividade.",
    "2. NÃO chame nenhuma tool de gravação (add_expense, fill_lodging_voucher, fill_transport_voucher, fill_activity_ticket) nesse turno. Em vez disso, responda listando os campos extraídos de forma clara e pergunte se está tudo certo.",
    "3. Termine essa resposta com uma linha sozinha, exatamente no formato `[[doc_pendente:ID]]`, usando o id_documento da mensagem. Essa linha é removida antes do viajante ver, então sempre inclua.",
    "4. Na mensagem seguinte, se o viajante confirmar ou pedir ajuste nos campos que você propôs, chame agora a tool certa com os campos (já ajustados, se for o caso) e o mesmo documentId — sem repetir a linha `[[doc_pendente:...]]`. Se o viajante mudar de assunto ou cancelar, não chame tool nenhuma.",
  ].join("\n");
}

/** Roda uma mensagem do viajante pelo agente e devolve o texto de resposta, já atualizando o histórico curto do vínculo. */
export async function runAgentForMessage(
  link: {
    id: string;
    chatId: string;
    travelerId: string | null;
    history: unknown;
  },
  travelerName: string,
  trip: typeof t.trips.$inferSelect,
  userText: string,
  attachment?: { kind: "image" | "document"; base64: string; mediaType: string },
): Promise<string> {
  const history: AgentHistoryEntry[] = Array.isArray(link.history) ? (link.history as AgentHistoryEntry[]) : [];

  const ctx = { chatId: link.chatId, travelerId: link.travelerId, trip };
  const result = await runAgentTurn({
    system: systemPrompt(travelerName, trip.title),
    history,
    userText,
    attachment,
    tools: AGENT_TOOLS,
    execute: buildToolExecutor(ctx),
  });

  const replyText = "text" in result ? result.text : result.error;

  const nextHistory = [...history, { role: "user", text: userText }, { role: "assistant", text: replyText }].slice(-MAX_HISTORY);
  await db.update(t.telegramLinks).set({ history: nextHistory }).where(eq(t.telegramLinks.id, link.id));

  return replyText;
}
