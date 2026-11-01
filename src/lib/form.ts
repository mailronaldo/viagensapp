import "server-only";
import { redirect } from "next/navigation";

export function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed === "" ? null : trimmed;
}

export function file(fd: FormData, key: string): File | null {
  const v = fd.get(key);
  return v instanceof File && v.size > 0 ? v : null;
}

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
export const LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;

/** "1.234,56" | "1234.56" | "12,5" → "1234.56"; null se inválido. */
export function parseDecimal(input: string | null, opts: { positive?: boolean } = {}) {
  if (input === null) return null;
  let s = input.replace(/\s/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (opts.positive && n <= 0) return null;
  return n.toFixed(2);
}

export function parseRate(input: string | null) {
  if (input === null) return null;
  const s = input.replace(/\s/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n.toFixed(6) : null;
}

export function toWallClock(local: string | null) {
  return local ? `${local.replace("T", " ")}:00` : null;
}

/** Volta para a página do formulário com uma mensagem de erro. */
export function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}
