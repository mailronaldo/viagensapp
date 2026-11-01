"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, t } from "@/db";
import { createSession, destroySession } from "@/lib/session";

export type AuthState = { error?: string };

const registerSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome."),
  email: z.string().trim().toLowerCase().pipe(z.email("E-mail inválido.")),
  password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres."),
});

export async function registerAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { name, email, password } = parsed.data;

  const [existing] = await db
    .select({ id: t.users.id })
    .from(t.users)
    .where(eq(t.users.email, email))
    .limit(1);
  if (existing) return { error: "Já existe uma conta com esse e-mail." };

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db
    .insert(t.users)
    .values({ name, email, passwordHash })
    .returning({ id: t.users.id });

  await createSession(user.id);
  redirect("/");
}

export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const [user] = await db
    .select()
    .from(t.users)
    .where(eq(t.users.email, email))
    .limit(1);

  // Mesma mensagem para e-mail inexistente e senha errada.
  const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !ok) return { error: "E-mail ou senha incorretos." };

  await createSession(user.id);
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
