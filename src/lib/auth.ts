import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { getSession } from "./session";

export type Role = "MASTER" | "CLIENT";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  mustChangePassword: boolean;
};

export type AuthContext = {
  /** Usuário "efetivo": é com ele que dados e permissões são resolvidos. */
  user: CurrentUser;
  /** Quem realmente fez login (a agência, quando está acessando a área de um cliente). */
  realUser: CurrentUser;
  impersonating: boolean;
};

async function findActiveUser(id: string, opts: { requireActive: boolean }) {
  const [u] = await db
    .select({
      id: t.users.id,
      name: t.users.name,
      email: t.users.email,
      role: t.users.role,
      active: t.users.active,
      mustChangePassword: t.users.mustChangePassword,
    })
    .from(t.users)
    .where(eq(t.users.id, id))
    .limit(1);
  if (!u) return null;
  if (opts.requireActive && !u.active) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    mustChangePassword: u.mustChangePassword,
  } satisfies CurrentUser;
}

/**
 * Resolve a sessão. A personificação só vale se QUEM LOGOU for MASTER no banco (não basta
 * o cookie dizer) e o alvo for um CLIENT. Usuário desativado perde a sessão na hora.
 */
export const getAuth = cache(async (): Promise<AuthContext | null> => {
  const session = await getSession();
  if (!session) return null;

  const realUser = await findActiveUser(session.userId, { requireActive: true });
  if (!realUser) return null;

  if (session.impersonatingId && realUser.role === "MASTER") {
    // A agência pode ver clientes desativados (os dados são dela).
    const target = await findActiveUser(session.impersonatingId, { requireActive: false });
    if (target && target.role === "CLIENT") {
      return { user: target, realUser, impersonating: true };
    }
  }
  return { user: realUser, realUser, impersonating: false };
});

/** Usuário efetivo (ou null). */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  return (await getAuth())?.user ?? null;
}

export async function requireAuth(): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  return auth;
}

/** Qualquer usuário logado (efetivo). */
export async function requireUser(): Promise<CurrentUser> {
  return (await requireAuth()).user;
}

/** Área do cliente: o usuário efetivo precisa ser CLIENT (a agência entra via personificação). */
export async function requireClient(): Promise<CurrentUser> {
  const { user } = await requireAuth();
  if (user.role !== "CLIENT") redirect("/agency");
  return user;
}

/** Área da agência: quem fez login precisa ser MASTER. Para os demais, a página "não existe". */
export async function requireMaster(): Promise<CurrentUser> {
  const { realUser } = await requireAuth();
  if (realUser.role !== "MASTER") notFound();
  return realUser;
}
