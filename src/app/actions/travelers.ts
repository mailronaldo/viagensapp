"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, t } from "@/db";
import { requireClient } from "@/lib/auth";
import { requireTripAccess } from "@/lib/access";
import { ISO_DATE, str } from "@/lib/form";
import { generateTempPassword } from "@/lib/password";
import type { CredentialsState } from "@/app/actions/agency";

const travelerSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do viajante."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("E-mail do viajante inválido."))
    .nullable(),
  birthDate: z.string().regex(ISO_DATE, "Data de nascimento inválida.").nullable(),
});

function readTraveler(formData: FormData) {
  const parsed = travelerSchema.safeParse({
    name: formData.get("name"),
    email: str(formData, "email"),
    birthDate: str(formData, "birthDate"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  return {
    data: {
      ...parsed.data,
      phone: str(formData, "phone"),
      documentNumber: str(formData, "documentNumber"),
      notes: str(formData, "notes"),
    },
  };
}

/** Só devolve o viajante se ele pertencer ao cliente atual (isolamento entre clientes). */
async function ownTraveler(clientId: string, travelerId: string) {
  const [row] = await db
    .select()
    .from(t.travelers)
    .where(and(eq(t.travelers.id, travelerId), eq(t.travelers.clientId, clientId)))
    .limit(1);
  return row ?? null;
}

export async function addTravelerAction(formData: FormData) {
  const user = await requireClient();
  const r = readTraveler(formData);
  if (r.error) redirect(`/travelers?error=${encodeURIComponent(r.error)}`);
  await db.insert(t.travelers).values({ clientId: user.id, ...r.data! });
  redirect("/travelers");
}

export async function updateTravelerAction(travelerId: string, formData: FormData) {
  const user = await requireClient();
  const back = `/travelers/${travelerId}`;
  const current = await ownTraveler(user.id, travelerId);
  if (!current) redirect("/travelers");
  const r = readTraveler(formData);
  if (r.error) redirect(`${back}?error=${encodeURIComponent(r.error)}`);
  const data = { ...r.data! };
  // Com acesso gerado, o e-mail é o login: não muda por aqui. O nome acompanha o cadastro.
  if (current.userId) {
    data.email = current.email;
    await db.update(t.users).set({ name: data.name }).where(eq(t.users.id, current.userId));
  }
  await db.update(t.travelers).set(data).where(eq(t.travelers.id, travelerId));
  redirect("/travelers");
}

export async function deleteTravelerAction(travelerId: string) {
  const user = await requireClient();
  const tr = await ownTraveler(user.id, travelerId);
  if (tr) {
    await db.delete(t.travelers).where(eq(t.travelers.id, travelerId));
    // O login do viajante some junto (só se for mesmo uma conta de viajante).
    if (tr.userId) {
      await db.delete(t.users).where(and(eq(t.users.id, tr.userId), eq(t.users.role, "TRAVELER")));
    }
  }
  redirect("/travelers");
}

// ---------- Viajantes dentro de uma viagem ----------

export async function linkTravelerAction(tripId: string, formData: FormData) {
  const { trip } = await requireTripAccess(tripId, { write: true });
  const travelerId = str(formData, "travelerId");
  if (travelerId) {
    // O viajante precisa ser do mesmo cliente dono da viagem.
    const traveler = await ownTraveler(trip.ownerId, travelerId);
    if (traveler) {
      await db
        .insert(t.tripTravelers)
        .values({ tripId, travelerId })
        .onConflictDoNothing();
    }
  }
  redirect(`/trips/${tripId}`);
}

export async function unlinkTravelerAction(tripId: string, travelerId: string) {
  await requireTripAccess(tripId, { write: true });
  await db
    .delete(t.tripTravelers)
    .where(and(eq(t.tripTravelers.tripId, tripId), eq(t.tripTravelers.travelerId, travelerId)));
  redirect(`/trips/${tripId}`);
}

// ---------- Acesso (login) do viajante ----------

/**
 * Gera o login do viajante (e-mail do cadastro + senha temporária, mostrada uma única vez).
 * Se o acesso já existe, gera uma nova senha temporária. O id vem em campo oculto.
 */
export async function travelerAccessAction(
  _prev: CredentialsState,
  formData: FormData,
): Promise<CredentialsState> {
  const client = await requireClient();
  const tr = await ownTraveler(client.id, String(formData.get("travelerId") ?? ""));
  if (!tr) return { error: "Viajante não encontrado." };
  if (!tr.email) return { error: "Cadastre o e-mail do viajante antes de gerar o acesso." };

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  if (tr.userId) {
    await db
      .update(t.users)
      .set({ passwordHash, mustChangePassword: true, active: true })
      .where(and(eq(t.users.id, tr.userId), eq(t.users.role, "TRAVELER")));
  } else {
    const [taken] = await db
      .select({ id: t.users.id })
      .from(t.users)
      .where(eq(t.users.email, tr.email))
      .limit(1);
    if (taken) return { error: "Já existe uma conta com este e-mail no sistema." };
    await db.transaction(async (tx) => {
      const [u] = await tx
        .insert(t.users)
        .values({
          email: tr.email!,
          name: tr.name,
          passwordHash,
          role: "TRAVELER",
          mustChangePassword: true,
        })
        .returning({ id: t.users.id });
      await tx.update(t.travelers).set({ userId: u.id }).where(eq(t.travelers.id, tr.id));
    });
  }
  return { credentials: { name: tr.name, email: tr.email, tempPassword } };
}

export async function setTravelerAccessActiveAction(travelerId: string, active: boolean) {
  const client = await requireClient();
  const tr = await ownTraveler(client.id, travelerId);
  if (tr?.userId) {
    await db
      .update(t.users)
      .set({ active })
      .where(and(eq(t.users.id, tr.userId), eq(t.users.role, "TRAVELER")));
  }
  redirect(`/travelers/${travelerId}`);
}
