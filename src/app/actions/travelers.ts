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

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type Permission = "READ" | "FULL";
function readPermission(formData: FormData): Permission {
  return formData.get("permission") === "FULL" ? "FULL" : "READ";
}

/**
 * Mantém `trip_members` coerente com a permissão do viajante naquela viagem:
 * FULL + login existente vira editor da viagem; qualquer outro caso, sem acesso de edição.
 */
async function syncTravelerMembership(tx: Tx, tripId: string, travelerId: string) {
  const [row] = await tx
    .select({ permission: t.tripTravelers.permission, userId: t.travelers.userId })
    .from(t.tripTravelers)
    .innerJoin(t.travelers, eq(t.travelers.id, t.tripTravelers.travelerId))
    .where(and(eq(t.tripTravelers.tripId, tripId), eq(t.tripTravelers.travelerId, travelerId)))
    .limit(1);

  if (row?.permission === "FULL" && row.userId) {
    await tx
      .insert(t.tripMembers)
      .values({ tripId, userId: row.userId, role: "EDITOR" })
      .onConflictDoUpdate({ target: [t.tripMembers.tripId, t.tripMembers.userId], set: { role: "EDITOR" } });
  } else if (row?.userId) {
    await tx.delete(t.tripMembers).where(and(eq(t.tripMembers.tripId, tripId), eq(t.tripMembers.userId, row.userId)));
  }
}

/** Reaplica a sincronização em todas as viagens em que o viajante está — usado quando o login dele muda. */
async function syncAllTripMembershipsForTraveler(tx: Tx, travelerId: string) {
  const links = await tx
    .select({ tripId: t.tripTravelers.tripId })
    .from(t.tripTravelers)
    .where(eq(t.tripTravelers.travelerId, travelerId));
  for (const { tripId } of links) await syncTravelerMembership(tx, tripId, travelerId);
}

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

/** Mesma coisa que `updateTravelerAction`, mas volta pro hub do viajante dentro da viagem. */
export async function updateTravelerFromTripAction(tripId: string, travelerId: string, formData: FormData) {
  const user = await requireClient();
  const back = `/trips/${tripId}/travelers/${travelerId}`;
  const current = await ownTraveler(user.id, travelerId);
  if (!current) redirect(back);
  const r = readTraveler(formData);
  if (r.error) redirect(`${back}?error=${encodeURIComponent(r.error)}`);
  const data = { ...r.data! };
  if (current.userId) {
    data.email = current.email;
    await db.update(t.users).set({ name: data.name }).where(eq(t.users.id, current.userId));
  }
  await db.update(t.travelers).set(data).where(eq(t.travelers.id, travelerId));
  redirect(`${back}?saved=cadastro`);
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

function travelersTab(tripId: string, error?: string) {
  return `/trips/${tripId}/travelers${error ? `?error=${encodeURIComponent(error)}` : ""}`;
}

/** Inclui um ou vários viajantes (campo `travelerIds`) no grupo da viagem, com a permissão escolhida. */
export async function linkTravelerAction(tripId: string, formData: FormData) {
  const { trip } = await requireTripAccess(tripId, { write: true });
  const ids = [...new Set(formData.getAll("travelerIds").map(String).filter(Boolean))];
  const permission = readPermission(formData);
  await db.transaction(async (tx) => {
    for (const travelerId of ids) {
      // O viajante precisa ser do mesmo cliente dono da viagem.
      const traveler = await ownTraveler(trip.ownerId, travelerId);
      if (!traveler) continue;
      await tx.insert(t.tripTravelers).values({ tripId, travelerId, permission }).onConflictDoNothing();
      await syncTravelerMembership(tx, tripId, travelerId);
    }
  });
  redirect(travelersTab(tripId));
}

export async function unlinkTravelerAction(tripId: string, travelerId: string) {
  await requireTripAccess(tripId, { write: true });
  await db.transaction(async (tx) => {
    const [tr] = await tx.select({ userId: t.travelers.userId }).from(t.travelers).where(eq(t.travelers.id, travelerId)).limit(1);
    await tx
      .delete(t.tripTravelers)
      .where(and(eq(t.tripTravelers.tripId, tripId), eq(t.tripTravelers.travelerId, travelerId)));
    if (tr?.userId) {
      await tx.delete(t.tripMembers).where(and(eq(t.tripMembers.tripId, tripId), eq(t.tripMembers.userId, tr.userId)));
    }
  });
  redirect(travelersTab(tripId));
}

/** Cadastra um viajante novo (para o cliente dono da viagem) e já o inclui no grupo, com a permissão escolhida. */
export async function createAndLinkTravelerAction(tripId: string, formData: FormData) {
  const { trip } = await requireTripAccess(tripId, { write: true });
  const r = readTraveler(formData);
  if (r.error) redirect(travelersTab(tripId, r.error));
  const permission = readPermission(formData);
  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(t.travelers)
      .values({ clientId: trip.ownerId, ...r.data! })
      .returning({ id: t.travelers.id });
    await tx.insert(t.tripTravelers).values({ tripId, travelerId: created.id, permission });
    // Viajante recém-criado ainda não tem login, então o sync aqui não tem efeito
    // prático ainda — mas mantém o comportamento único quando o acesso for gerado depois.
    await syncTravelerMembership(tx, tripId, created.id);
  });
  redirect(travelersTab(tripId));
}

/** Troca a permissão do viajante numa viagem específica (leitura ou total). */
export async function setTravelerPermissionAction(tripId: string, travelerId: string, formData: FormData) {
  await requireTripAccess(tripId, { write: true });
  const permission = readPermission(formData);
  await db.transaction(async (tx) => {
    await tx
      .update(t.tripTravelers)
      .set({ permission })
      .where(and(eq(t.tripTravelers.tripId, tripId), eq(t.tripTravelers.travelerId, travelerId)));
    await syncTravelerMembership(tx, tripId, travelerId);
  });
  redirect(travelersTab(tripId));
}

/** Mesma coisa que `setTravelerPermissionAction`, mas volta pro hub do viajante dentro da viagem. */
export async function setTravelerPermissionFromTripAction(tripId: string, travelerId: string, formData: FormData) {
  await requireTripAccess(tripId, { write: true });
  const permission = readPermission(formData);
  await db.transaction(async (tx) => {
    await tx
      .update(t.tripTravelers)
      .set({ permission })
      .where(and(eq(t.tripTravelers.tripId, tripId), eq(t.tripTravelers.travelerId, travelerId)));
    await syncTravelerMembership(tx, tripId, travelerId);
  });
  redirect(`/trips/${tripId}/travelers/${travelerId}`);
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
    await db.transaction((tx) => syncAllTripMembershipsForTraveler(tx, tr.id));
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
      await syncAllTripMembershipsForTraveler(tx, tr.id);
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

/** Mesma coisa que `setTravelerAccessActiveAction`, mas volta pro hub do viajante dentro da viagem. */
export async function setTravelerAccessActiveFromTripAction(tripId: string, travelerId: string, active: boolean) {
  const client = await requireClient();
  const tr = await ownTraveler(client.id, travelerId);
  if (tr?.userId) {
    await db
      .update(t.users)
      .set({ active })
      .where(and(eq(t.users.id, tr.userId), eq(t.users.role, "TRAVELER")));
  }
  redirect(`/trips/${tripId}/travelers/${travelerId}`);
}
