import "server-only";
import { headers } from "next/headers";

/** Endereço público do app (para montar o link de login enviado ao cliente). */
export async function getLoginUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return process.env.APP_URL ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto.split(",")[0].trim()}://${host.split(",")[0].trim()}/login`;
}
