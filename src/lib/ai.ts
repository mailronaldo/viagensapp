import "server-only";

const MODEL = "claude-sonnet-5-5";
const API_URL = "https://api.anthropic.com/v1/messages";

/**
 * Chama a Anthropic direto via fetch (sem SDK: é uma única chamada, não vale
 * a dependência extra). Usa a tool de busca na web, executada pelo próprio
 * servidor da Anthropic, pra não inventar lugares/links. O prompt pede que a
 * resposta final seja só um array JSON; aqui a gente extrai e faz o parse.
 */
export async function askAiForJsonArray(prompt: string): Promise<{ data: unknown } | { error: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { error: "A integração de IA ainda não foi configurada (falta ANTHROPIC_API_KEY)." };
  }

  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch (e) {
    return { error: e instanceof Error ? `Falha ao consultar a IA: ${e.message}` : "Falha ao consultar a IA." };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { error: `Falha ao consultar a IA (HTTP ${res.status}). ${body.slice(0, 200)}` };
  }

  type ContentBlock = { type: string; text?: string };
  let json: { content?: ContentBlock[] };
  try {
    json = await res.json();
  } catch {
    return { error: "A IA devolveu uma resposta inválida." };
  }

  const text = (json.content ?? [])
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("\n");

  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return { error: "A IA não devolveu uma lista válida. Tente de novo." };

  try {
    return { data: JSON.parse(match[0]) };
  } catch {
    return { error: "A IA devolveu uma lista em formato inválido. Tente de novo." };
  }
}

// Limite simples em memória (mesmo padrão de src/lib/rate-limit.ts) pra não
// deixar o custo de IA sem teto — vale por instância do app, o suficiente
// pra um primeiro teste.
const MAX_CALLS_PER_DAY = 20;
const WINDOW_MS = 24 * 60 * 60 * 1000;
const calls = new Map<string, { count: number; resetAt: number }>();

export function checkAiRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = calls.get(key);
  if (!entry || entry.resetAt <= now) {
    calls.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_CALLS_PER_DAY) return false;
  entry.count += 1;
  return true;
}
