import Link from "next/link";
import { redirect } from "next/navigation";
import { requireTripAccess } from "@/lib/access";
import { updateTripAction } from "@/app/actions/trips";
import { CURRENCIES, TIMEZONES } from "@/lib/labels";
import { Card, ErrorBanner, Field, btnGhost, btnPrimary, inputCls } from "@/components/ui";

export const metadata = { title: "Editar viagem" };

export default async function EditTripPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { trip, role } = await requireTripAccess(id);
  if (role !== "OWNER") redirect(`/trips/${id}`);

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-3 text-lg font-medium">Editar viagem</h2>
      <Card>
        <ErrorBanner message={error} />
        <form action={updateTripAction.bind(null, trip.id)} className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome da viagem" className="sm:col-span-2">
            <input name="title" required defaultValue={trip.title} className={inputCls} />
          </Field>
          <Field label="Breve descrição" className="sm:col-span-2">
            <input name="destination" required defaultValue={trip.destination} className={inputCls} />
          </Field>
          <Field
            label={trip.iconKey ? "Trocar ícone da viagem" : "Ícone da viagem"}
            className="sm:col-span-2"
            hint="Opcional. PNG, JPG ou WEBP, até 2 MB. Formato quadrado (ex.: 400×400px) fica melhor. Sem envio, usa o ícone padrão."
          >
            <div className="flex items-center gap-3">
              {trip.iconKey && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/trip-icons/${trip.id}`}
                  alt=""
                  className="size-12 shrink-0 rounded-lg object-cover"
                />
              )}
              <input name="icon" type="file" accept="image/png,image/jpeg,image/webp" className={inputCls} />
            </div>
            {trip.iconKey && (
              <label className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-500">
                <input type="checkbox" name="removeIcon" /> remover ícone (volta ao padrão)
              </label>
            )}
          </Field>
          <Field label="Ida">
            <input name="startDate" type="date" required defaultValue={trip.startDate} className={inputCls} />
          </Field>
          <Field label="Volta">
            <input name="endDate" type="date" required defaultValue={trip.endDate} className={inputCls} />
          </Field>
          <p className="text-xs text-slate-500 sm:col-span-2">
            Para encurtar ou mover o período, o roteiro não pode ter atividades ou resumos de dia fora das novas datas.
          </p>
          <Field label="Fuso horário do destino" hint="Define o que é “hoje” na agenda.">
            <select name="timezone" defaultValue={trip.timezone} className={inputCls}>
              {[...new Set([...TIMEZONES, trip.timezone])].map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace("_", " ")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Moeda base dos custos" hint="Só pode mudar enquanto não houver custos lançados.">
            <select name="baseCurrency" defaultValue={trip.baseCurrency} className={inputCls}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field
            label="Você é viajante ou está apenas planejando a viagem?"
            className="sm:col-span-2"
            hint="Se marcar que é viajante, você entra no grupo de viajantes desta viagem (e pode registrar chip/eSIM próprio)."
          >
            <select name="ownerIsTraveler" defaultValue={trip.ownerIsTraveler ? "yes" : "no"} className={inputCls}>
              <option value="no">Só estou planejando (não vou viajar)</option>
              <option value="yes">Sou viajante nesta viagem</option>
            </select>
          </Field>
          <Field label="Observações" className="sm:col-span-2">
            <textarea name="notes" rows={3} defaultValue={trip.notes ?? ""} className={inputCls} />
          </Field>
          <div className="flex gap-2 sm:col-span-2">
            <button className={btnPrimary}>Salvar alterações</button>
            <Link href={`/trips/${trip.id}`} className={btnGhost}>
              Cancelar
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
