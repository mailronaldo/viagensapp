import { asc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireClient } from "@/lib/auth";
import { addCityAction, deleteCityAction } from "@/app/actions/cities";
import { AddPanel, Card, EmptyState, ErrorBanner, Field, btnDanger, btnPrimary, inputCls } from "@/components/ui";

export const metadata = { title: "Cidades" };

export default async function CitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireClient();
  const { error } = await searchParams;

  const cities = await db.select().from(t.cities).where(eq(t.cities.clientId, user.id)).orderBy(asc(t.cities.name));

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Cidades</h1>
      <p className="mb-6 text-sm text-slate-500">
        Cadastre aqui as cidades que você costuma visitar. Depois é só vincular cada uma às viagens.
      </p>

      <ErrorBanner message={error} />

      <AddPanel title="Nova cidade" defaultOpen={cities.length === 0}>
        <form action={addCityAction} className="grid gap-3 sm:grid-cols-3">
          <Field label="Cidade" className="sm:col-span-2">
            <input name="name" required className={inputCls} />
          </Field>
          <Field label="País">
            <input name="country" className={inputCls} />
          </Field>
          <div className="sm:col-span-3">
            <button className={btnPrimary}>Salvar cidade</button>
          </div>
        </form>
      </AddPanel>

      {cities.length === 0 ? (
        <EmptyState>Nenhuma cidade cadastrada ainda.</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {cities.map((c) => (
            <li key={c.id}>
              <Card className="flex items-center justify-between gap-3 !p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.name}</p>
                  {c.country && <p className="text-xs text-slate-500">{c.country}</p>}
                </div>
                <form action={deleteCityAction.bind(null, c.id)}>
                  <button className={btnDanger}>Remover</button>
                </form>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
