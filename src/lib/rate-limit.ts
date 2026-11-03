import "server-only";

// Limite simples de tentativas de login, em memória (serve para 1 instância do app).
// Se um dia houver várias instâncias, troque por uma tabela no banco ou Redis.
const MAX_FAILURES = 8;
const WINDOW_MS = 15 * 60 * 1000;

type Entry = { failures: number; resetAt: number };
const attempts = new Map<string, Entry>();

function current(key: string): Entry | null {
  const e = attempts.get(key);
  if (!e) return null;
  if (e.resetAt <= Date.now()) {
    attempts.delete(key);
    return null;
  }
  return e;
}

/** Minutos até poder tentar de novo; 0 se liberado. */
export function lockedForMinutes(key: string): number {
  const e = current(key);
  if (!e || e.failures < MAX_FAILURES) return 0;
  return Math.max(1, Math.ceil((e.resetAt - Date.now()) / 60000));
}

export function registerFailure(key: string) {
  const e = current(key);
  if (e) e.failures += 1;
  else attempts.set(key, { failures: 1, resetAt: Date.now() + WINDOW_MS });
  // Evita crescimento sem limite se alguém varrer e-mails aleatórios.
  if (attempts.size > 5000) {
    for (const [k, v] of attempts) if (v.resetAt <= Date.now()) attempts.delete(k);
  }
}

export function clearFailures(key: string) {
  attempts.delete(key);
}
