"use server";

import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { requireClient } from "@/lib/auth";

const myAccountSchema = z.object({
  name: z.string().trim().min(2, "Informe o seu nome."),
  email: z.string().trim().toLowerCase().pipe(z.email("E-mail inválido.")),
});

export async function updateMyAccountAction(formData: FormData) {
  const user = await requireClient();
  const back = "/account";

  const parsed = myAccountSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    redirect(`${back}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Dados inválidos.")}`);
  }
  const { name, email } = parsed.data;

  if (email !== user.email) {
    const [clash] = await db
      .select({ id: t.users.id })
      .from(t.users)
      .where(and(eq(t.users.email, email), ne(t.users.id, user.id)))
      .limit(1);
    if (clash) redirect(`${back}?error=${encodeURIComponent("Já existe uma conta com esse e-mail.")}`);
  }

  await db.update(t.users).set({ name, email }).where(eq(t.users.id, user.id));
  redirect(`${back}?saved=1`);
}
