import "server-only";

// Mesmo padrão de `checkAiRateLimit` em `src/lib/ai.ts` — em memória, por
// instância, só pra não deixar o custo de LLM sem teto num primeiro teste.
const MAX_MESSAGES_PER_DAY = 60;
const WINDOW_MS = 24 * 60 * 60 * 1000;
const calls = new Map<string, { count: number; resetAt: number }>();

export function checkAgentRateLimit(travelerId: string): boolean {
  const now = Date.now();
  const entry = calls.get(travelerId);
  if (!entry || entry.resetAt <= now) {
    calls.set(travelerId, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_MESSAGES_PER_DAY) return false;
  entry.count += 1;
  return true;
}
