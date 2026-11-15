"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { requireClient } from "@/lib/auth";
import { str } from "@/lib/form";

const requesterSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do solicitante."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("E-mail do solicitante inválido."))
    .nullable(),
});

function readRequester(formData: FormData) {
  const parsed = requesterSchema.safeParse({
    name: formData.get("name"),
    email: str(formData, "email"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  return { data: { ...parsed.data, phone: str(formData, "phone") } };
}

/** Só devolve o solicitante se ele pertencer ao cliente atual (isolamento entre clientes). */
async function ownRequester(clientId: string, requesterId: string) {
  const [row] = await db
    .select()
    .from(t.requesters)
    .where(and(eq(t.requesters.id, requesterId), eq(t.requesters.clientId, clientId)))
    .limit(1);
  return row ?? null;
}

export async function addRequesterAction(formData: FormData) {
  const user = await requireClient();
  const r = readRequester(formData);
  if (r.error) redirect(`/requesters?error=${encodeURIComponent(r.error)}`);
  await db.insert(t.requesters).values({ clientId: user.id, ...r.data! });
  redirect("/requesters");
}

export async function updateRequesterAction(requesterId: string, formData: FormData) {
  const user = await requireClient();
  const back = `/requesters/${requesterId}`;
  const current = await ownRequester(user.id, requesterId);
  if (!current) redirect("/requesters");
  const r = readRequester(formData);
  if (r.error) redirect(`${back}?error=${encodeURIComponent(r.error)}`);
  await db.update(t.requesters).set(r.data!).where(eq(t.requesters.id, requesterId));
  redirect("/requesters");
}

export async function deleteRequesterAction(requesterId: string) {
  const user = await requireClient();
  const current = await ownRequester(user.id, requesterId);
  if (current) await db.delete(t.requesters).where(eq(t.requesters.id, requesterId));
  redirect("/requesters");
}
