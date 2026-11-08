import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, t } from "@/db";
import { todayIn } from "@/lib/format";
import { fetchRatesToBrl } from "@/lib/exchangeRates";

export const BRL = "BRL";

/** Moedas que o cliente pode usar: BRL (padrão do sistema) + as que ele cadastrou. */
export async function listClientCurrencyCodes(clientId: string): Promise<string[]> {
  const rows = await db
    .select({ code: t.currencies.code })
    .from(t.currencies)
    .where(eq(t.currencies.clientId, clientId))
    .orderBy(asc(t.currencies.code));
  return [BRL, ...rows.map((r) => r.code)];
}

/** Moedas cadastradas pelo cliente (sem BRL — usado na tela de gestão, que já mostra BRL fixo). */
export async function listClientCurrencies(clientId: string) {
  return db.select().from(t.currencies).where(eq(t.currencies.clientId, clientId)).orderBy(asc(t.currencies.code));
}

/** Última cotação conhecida de cada código informado (sem BRL, que é sempre 1). */
export async function getLatestRates(codes: string[]): Promise<Map<string, { rateToBrl: string; asOfDate: string }>> {
  const wanted = codes.filter((c) => c !== BRL);
  const map = new Map<string, { rateToBrl: string; asOfDate: string }>();
  if (wanted.length === 0) return map;

  const rows = await db
    .select()
    .from(t.currencyRates)
    .where(inArray(t.currencyRates.code, wanted))
    .orderBy(desc(t.currencyRates.asOfDate));
  for (const r of rows) {
    if (!map.has(r.code)) map.set(r.code, { rateToBrl: r.rateToBrl, asOfDate: r.asOfDate });
  }
  return map;
}

export async function getLatestRate(code: string): Promise<{ rateToBrl: string; asOfDate: string } | null> {
  if (code === BRL) return { rateToBrl: "1", asOfDate: todayIn("America/Sao_Paulo") };
  const rates = await getLatestRates([code]);
  return rates.get(code) ?? null;
}

/**
 * Garante que as moedas informadas tenham cotação de hoje em cache; se
 * faltar alguma, busca na API pública (uma vez só, pra todas de uma vez) e
 * grava. Sem job separado: a primeira página do dia que precisar da
 * cotação dispara a busca, as seguintes usam o cache. Se a API falhar,
 * mantém o que já tinha (cotação mais recente anterior) sem lançar erro.
 */
export async function ensureTodayRates(codes: string[]): Promise<void> {
  const wanted = [...new Set(codes.filter((c) => c !== BRL))];
  if (wanted.length === 0) return;

  const today = todayIn("America/Sao_Paulo");
  const haveToday = await db
    .select({ code: t.currencyRates.code })
    .from(t.currencyRates)
    .where(and(inArray(t.currencyRates.code, wanted), eq(t.currencyRates.asOfDate, today)));
  const haveTodayCodes = new Set(haveToday.map((r) => r.code));
  const missing = wanted.filter((code) => !haveTodayCodes.has(code));
  if (missing.length === 0) return;

  const result = await fetchRatesToBrl();
  if ("error" in result) return;

  const values = missing
    .filter((code) => result.rates[code] !== undefined)
    .map((code) => ({ code, rateToBrl: String(result.rates[code]), asOfDate: today }));
  if (values.length === 0) return;

  await db.insert(t.currencyRates).values(values).onConflictDoNothing();
}

export async function convert(amount: number, fromCode: string, toCode: string): Promise<number | null> {
  if (fromCode === toCode) return amount;
  const from = await getLatestRate(fromCode);
  const to = await getLatestRate(toCode);
  if (!from || !to) return null;
  return (amount * Number(from.rateToBrl)) / Number(to.rateToBrl);
}
