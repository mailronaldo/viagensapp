"use server";

import { redirect } from "next/navigation";
import { requireTripAccess } from "@/lib/access";
import { fail, str } from "@/lib/form";
import { addStore } from "@/services/stores";
import { getTripCities } from "@/services/cities";

/** Cadastro rápido de loja (via modal "+" na encomenda) — sem gestor dedicado. */
export async function addStoreAction(tripId: string, back: string, formData: FormData) {
  const { trip } = await requireTripAccess(tripId, { write: true });
  const name = str(formData, "name");
  if (!name) fail(back, "Informe o nome da loja.");
  const type = str(formData, "type") === "ONLINE" ? "ONLINE" : "PHYSICAL";

  let cityId: string | null = null;
  if (type === "PHYSICAL") {
    cityId = str(formData, "cityId");
    if (!cityId) fail(back, "Selecione a cidade da loja.");
    const cities = await getTripCities(trip.id);
    if (!cities.some((c) => c.id === cityId)) fail(back, "Essa cidade não está nesta viagem.");
  }

  const store = await addStore(trip.ownerId, { name, type, cityId });
  redirect(`${back}${back.includes("?") ? "&" : "?"}newStoreId=${store.id}`);
}
