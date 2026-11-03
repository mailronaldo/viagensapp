"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, t } from "@/db";
import { requireAuth } from "@/lib/auth";
import { createSession, destroySession } from "@/lib/session";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { clearFailures, lockedForMinutes, registerFailure } from "@/lib/rate-limit";

export type AuthState = { error?: string };

// Hash bcrypt válido (de uma senha aleatória descartada), usado só para gastar o mesmo tempo
// quando o e-mail não existe.
let dummy: string | null = null;
function dummyHash() {
  return (dummy ??= bcrypt.hashSync(`${Math.random()}${Date.now()}`, 12));
}

// Não há cadastro público: as contas de cliente são criadas pela agência.

export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  const key = `${email}|${ip}`;

  const wait = lockedForMinutes(key);
  if (wait > 0) {
    return { error: `Muitas tentativas. Tente novamente em ${wait} minuto(s).` };
  }

  const [user] = await db
    .select()
    .from(t.users)
    .where(eq(t.users.email, email))
    .limit(1);

  // Sempre compara o hash, mesmo sem usuário, para não revelar por tempo quais e-mails existem.
  const ok = await bcrypt.compare(password, user?.passwordHash ?? dummyHash());

  if (!user || !ok) {
    registerFailure(key);
    return { error: "E-mail ou senha incorretos." };
  }
  if (!user.active) {
    return { error: "Esta conta está desativada. Fale com a agência." };
  }

  clearFailures(key);
  await createSession(user.id);
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function changePasswordAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  // Vale para quem fez login de verdade (mesmo durante a personificação).
  const { realUser } = await requireAuth();

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const [row] = await db
    .select({ hash: t.users.passwordHash })
    .from(t.users)
    .where(eq(t.users.id, realUser.id))
    .limit(1);
  if (!row || !(await bcrypt.compare(current, row.hash))) {
    return { error: "A senha atual está incorreta." };
  }
  if (next.length < MIN_PASSWORD_LENGTH) {
    return { error: `A nova senha precisa ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.` };
  }
  if (next === current) return { error: "A nova senha deve ser diferente da atual." };
  if (next !== confirm) return { error: "A confirmação não confere com a nova senha." };

  await db
    .update(t.users)
    .set({ passwordHash: await bcrypt.hash(next, 12), mustChangePassword: false })
    .where(eq(t.users.id, realUser.id));

  redirect("/");
}
