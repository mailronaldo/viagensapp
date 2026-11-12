import "server-only";

const MODEL = "claude-sonnet-5-5";
const API_URL = "https://api.anthropic.com/v1/messages";
const MAX_TOOL_ITERATIONS = 4;

export type AgentTool = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

export type AgentHistoryEntry = { role: "user" | "assistant"; text: string };

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };

// Content aceita texto simples ou uma lista de blocos (texto/tool_use/tool_result) — a
// Anthropic é tolerante com blocos extras que ela mesma não devolveu, então não vale
// tipar cada formato de mensagem que só enviamos, nunca recebemos.
type AnthropicMessage = { role: "user" | "assistant"; content: unknown };

/**
 * Loop de tool-calling sobre a Anthropic Messages API (fetch direto, mesmo
 * espírito de `src/lib/ai.ts`: é uma integração pontual, não vale a
 * dependência do SDK). Executa a tool chamada pelo modelo via `execute` e
 * devolve o resultado pra ele continuar, até no máximo MAX_TOOL_ITERATIONS
 * rodadas — depois disso, encerra com o que tiver de texto.
 */
export async function runAgentTurn({
  system,
  history,
  userText,
  tools,
  execute,
}: {
  system: string;
  history: AgentHistoryEntry[];
  userText: string;
  tools: AgentTool[];
  execute: (name: string, input: Record<string, unknown>) => Promise<string>;
}): Promise<{ text: string } | { error: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "A integração de IA ainda não foi configurada (falta ANTHROPIC_API_KEY)." };

  const messages: AnthropicMessage[] = [
    ...history.map((h) => ({ role: h.role, content: h.text })),
    { role: "user", content: userText },
  ];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    let res: Response;
    try {
      res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        // 1024 não bastava pra respostas com link(s) de rota de várias paradas — a URL
        // codificada de um roteiro com várias dicas sozinha já passa de 1k caracteres,
        // e duas delas (GPS + origem fixa) estouravam o limite antes de sair texto nenhum.
        body: JSON.stringify({ model: MODEL, max_tokens: 2048, system, messages, tools }),
      });
    } catch (e) {
      return { error: e instanceof Error ? `Falha ao consultar a IA: ${e.message}` : "Falha ao consultar a IA." };
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { error: `Falha ao consultar a IA (HTTP ${res.status}). ${body.slice(0, 200)}` };
    }

    const json: { content?: AnthropicContentBlock[]; stop_reason?: string } = await res.json();
    const content = json.content ?? [];
    const toolUses = content.filter((b): b is { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } => b.type === "tool_use");

    if (json.stop_reason !== "tool_use" || toolUses.length === 0) {
      const text = content
        .filter((b): b is { type: "text"; text: string } => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return { text: text || "Não consegui gerar uma resposta agora. Tente de novo." };
    }

    messages.push({ role: "assistant", content });
    const toolResults = [];
    for (const use of toolUses) {
      const result = await execute(use.name, use.input);
      toolResults.push({ type: "tool_result", tool_use_id: use.id, content: result });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return { error: "O agente não concluiu a resposta a tempo. Tente reformular a pergunta." };
}
