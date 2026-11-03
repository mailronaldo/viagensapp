"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { requireClient } from "@/lib/auth";
import { requireTripAccess } from "@/lib/access";
import { ISO_DATE, str } from "@/lib/form";

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
  if (!(await ownTraveler(user.id, travelerId))) redirect("/travelers");
  const r = readTraveler(formData);
  if (r.error) redirect(`${back}?error=${encodeURIComponent(r.error)}`);
  await db.update(t.travelers).set(r.data!).where(eq(t.travelers.id, travelerId));
  redirect("/travelers");
}

export async function deleteTravelerAction(travelerId: string) {
  const user = await requireClient();
  if (await ownTraveler(user.id, travelerId)) {
    await db.delete(t.travelers).where(eq(t.travelers.id, travelerId));
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
