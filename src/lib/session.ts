import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "viagens_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 dias

export type SessionData = {
  /** Quem de fato fez login. */
  userId: string;
  /** Preenchido quando a agência (MASTER) está acessando a área de um cliente. */
  impersonatingId: string | null;
};

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 16) {
    throw new Error("AUTH_SECRET não configurado (mínimo 16 caracteres).");
  }
  return new TextEncoder().encode(value);
}

export async function createSession(userId: string, impersonatingId: string | null = null) {
  const token = await new SignJWT(impersonatingId ? { imp: impersonatingId } : {})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());

  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    // Em produção o cookie só trafega por HTTPS. Para self-host em HTTP puro
    // (rede local, testes), defina COOKIE_SECURE=false.
    secure:
      process.env.COOKIE_SECURE !== undefined
        ? process.env.COOKIE_SECURE === "true"
        : process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getSession(): Promise<SessionData | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    return {
      userId: payload.sub,
      impersonatingId: typeof payload.imp === "string" ? payload.imp : null,
    };
  } catch {
    return null;
  }
}

export async function destroySession() {
  (await cookies()).delete(COOKIE_NAME);
}
