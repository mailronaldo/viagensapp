"use server";

import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, t } from "@/db";
import { getAuth, requireMaster } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { generateTempPassword } from "@/lib/password";

// Todas as ações daqui exigem que quem fez login seja a agência (MASTER).

export type CredentialsState = {
  error?: string;
  /** Exibido uma única vez: a senha não fica guardada em texto em lugar nenhum. */
  credentials?: { name: string; email: string; tempPassword: string };
};

const clientSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do cliente."),
  email: z.string().trim().toLowerCase().pipe(z.email("E-mail inválido.")),
});

async function loadClient(clientId: string) {
  const [client] = await db
    .select()
    .from(t.users)
    .where(and(eq(t.users.id, clientId), eq(t.users.role, "CLIENT")))
    .limit(1);
  return client ?? null;
}

export async function createClientAction(
  _prev: CredentialsState,
  formData: FormData,
): Promise<CredentialsState> {
  await requireMaster();

  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { name, email } = parsed.data;

  const [existing] = await db
    .select({ id: t.users.id })
    .from(t.users)
    .where(eq(t.users.email, email))
    .limit(1);
  if (existing) return { error: "Já existe uma conta com esse e-mail." };

  const tempPassword = generateTempPassword();
  await db.insert(t.users).values({
    name,
    email,
    role: "CLIENT",
    passwordHash: await bcrypt.hash(tempPassword, 12),
    mustChangePassword: true,
  });

  return { credentials: { name, email, tempPassword } };
}

export async function resetClientPasswordAction(
  _prev: CredentialsState,
  formData: FormData,
): Promise<CredentialsState> {
  await requireMaster();
  // O id vem num campo oculto (não usamos .bind em useActionState: trava a renderização sem JS).
  const clientId = String(formData.get("clientId") ?? "");
  const client = await loadClient(clientId);
  if (!client) return { error: "Cliente não encontrado." };

  const tempPassword = generateTempPassword();
  await db
    .update(t.users)
    .set({ passwordHash: await bcrypt.hash(tempPassword, 12), mustChangePassword: true })
    .where(eq(t.users.id, client.id));

  return { credentials: { name: client.name, email: client.email, tempPassword } };
}

export async function setClientActiveAction(clientId: string, active: boolean) {
  await requireMaster();
  const client = await loadClient(clientId);
  if (!client) redirect("/agency");
  await db.update(t.users).set({ active }).where(eq(t.users.id, client.id));
  redirect(`/agency/clients/${client.id}`);
}

export async function updateClientAction(clientId: string, formData: FormData) {
  await requireMaster();
  const back = `/agency/clients/${clientId}`;
  const client = await loadClient(clientId);
  if (!client) redirect("/agency");

  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    redirect(`${back}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Dados inválidos.")}`);
  }
  const { name, email } = parsed.data;

  if (email !== client.email) {
    const [clash] = await db
      .select({ id: t.users.id })
      .from(t.users)
      .where(eq(t.users.email, email))
      .limit(1);
    if (clash) redirect(`${back}?error=${encodeURIComponent("Já existe uma conta com esse e-mail.")}`);
  }

  await db.update(t.users).set({ name, email }).where(eq(t.users.id, client.id));
  redirect(back);
}

// ---------- Acessar a área do cliente ----------

export async function startImpersonationAction(clientId: string) {
  const master = await requireMaster();
  const client = await loadClient(clientId);
  if (!client) redirect("/agency");
  await createSession(master.id, client.id);
  redirect("/");
}

export async function stopImpersonationAction() {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  // Só quem realmente é MASTER tem algo a "encerrar"; para os outros, é no-op.
  if (auth.realUser.role === "MASTER") await createSession(auth.realUser.id, null);
  redirect("/agency");
}
