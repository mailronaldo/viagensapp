// Datas "YYYY-MM-DD" são tratadas como datas de calendário (sem fuso),
// para nunca "andarem um dia" por causa de timezone.

export function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    ...(opts ?? { day: "2-digit", month: "short", year: "numeric" }),
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function formatWeekday(iso: string) {
  return formatDate(iso, { weekday: "long", day: "2-digit", month: "long" });
}

export function formatDateTime(wallClock: string | null) {
  if (!wallClock) return "";
  // "YYYY-MM-DD HH:MM:SS" ou "YYYY-MM-DDTHH:MM"
  const [date, time = ""] = wallClock.replace("T", " ").split(" ");
  return `${formatDate(date)}${time ? ` · ${time.slice(0, 5)}` : ""}`;
}

export function formatMoney(value: number | string, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(Number(value));
}

export function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function eachDay(startIso: string, endIso: string): string[] {
  const days: string[] = [];
  for (let d = startIso; d <= endIso && days.length < 366; d = addDays(d, 1)) {
    days.push(d);
  }
  return days;
}

/** Data de "hoje" no fuso informado, em YYYY-MM-DD. */
export function todayIn(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
