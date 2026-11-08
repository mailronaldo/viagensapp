import "server-only";

const API_URL = "https://open.er-api.com/v6/latest/BRL";

/**
 * API pública gratuita, sem chave, ancorada em BRL (`rates[code]` = quantos
 * `code` vale 1 BRL). A gente guarda o inverso (`rateToBrl`), então inverte
 * aqui pra já devolver "quanto vale 1 unidade de cada moeda em BRL".
 */
export async function fetchRatesToBrl(): Promise<{ rates: Record<string, number> } | { error: string }> {
  let res: Response;
  try {
    res = await fetch(API_URL, { cache: "no-store" });
  } catch (e) {
    return { error: e instanceof Error ? `Falha ao consultar cotações: ${e.message}` : "Falha ao consultar cotações." };
  }

  if (!res.ok) {
    return { error: `Falha ao consultar cotações (HTTP ${res.status}).` };
  }

  let json: { result?: string; rates?: Record<string, number> };
  try {
    json = await res.json();
  } catch {
    return { error: "A API de cotações devolveu uma resposta inválida." };
  }

  if (json.result !== "success" || !json.rates) {
    return { error: "A API de cotações não retornou dados válidos." };
  }

  const rates: Record<string, number> = { BRL: 1 };
  for (const [code, perBrl] of Object.entries(json.rates)) {
    if (perBrl > 0) rates[code] = 1 / perBrl;
  }
  return { rates };
}
