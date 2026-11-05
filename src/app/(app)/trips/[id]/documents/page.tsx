import Link from "next/link";
import { requireTripAccess } from "@/lib/access";
import { formatDate } from "@/lib/format";
import { listDocuments } from "@/services/documents";
import { listDocumentTypes, toNameMap } from "@/services/catalogs";
import { db, t } from "@/db";
import { asc, eq } from "drizzle-orm";
import { deleteDocumentAction, setDocumentVisibilityAction, uploadDocumentAction } from "@/app/actions/documents";
import {
  AddPanel,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  btnDanger,
  btnPrimary,
  inputCls,
} from "@/components/ui";

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function DocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string; error?: string }>;
}) {
  const { id } = await params;
  const { type, error } = await searchParams;
  const { trip, canWrite } = await requireTripAccess(id);

  const types = await listDocumentTypes();
  const typeNames = toNameMap(types);
  const filter = type && types.some((dt) => dt.id === type) ? type : undefined;
  const [docs, group] = await Promise.all([
    listDocuments(trip.id, filter),
    db
      .select({ id: t.travelers.id, name: t.travelers.name })
      .from(t.tripTravelers)
      .innerJoin(t.travelers, eq(t.travelers.id, t.tripTravelers.travelerId))
      .where(eq(t.tripTravelers.tripId, trip.id))
      .orderBy(asc(t.travelers.name)),
  ]);
  const groupName = new Map(group.map((g) => [g.id, g.name]));
  const visLabel = (d: { visibility: string; travelerId: string | null }) =>
    d.visibility === "GROUP"
      ? "Grupo da viagem"
      : d.visibility === "TRAVELER"
        ? `Só ${groupName.get(d.travelerId ?? "") ?? "viajante removido"}`
        : "Só o dono";
  const visValue = (d: { visibility: string; travelerId: string | null }) =>
    d.visibility === "TRAVELER" && d.travelerId ? `TRAVELER:${d.travelerId}` : d.visibility;
  const visibilityOptions = (
    <>
      <option value="OWNER">Somente eu (dono da viagem)</option>
      <option value="GROUP">Grupo da viagem (todos os viajantes)</option>
      {group.map((g) => (
        <option key={g.id} value={`TRAVELER:${g.id}`}>
          Só {g.name}
        </option>
      ))}
    </>
  );

  return (
    <>
      <ErrorBanner message={error} />

      {canWrite && (
        <AddPanel title="Enviar documento" defaultOpen={docs.length === 0 && !filter}>
          <form
            action={uploadDocumentAction.bind(null, trip.id)}
            className="grid gap-3 sm:grid-cols-6"
          >
            <Field label="Arquivo (PDF ou imagem, até 10 MB)" className="sm:col-span-6">
              <input name="file" type="file" required accept="application/pdf,image/*" className={inputCls} />
            </Field>
            <Field label="Tipo" className="sm:col-span-2">
              <select name="type" defaultValue="OTHER" className={inputCls}>
                {types.map((dt) => (
                  <option key={dt.id} value={dt.id}>
                    {dt.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Título (opcional)" className="sm:col-span-4">
              <input name="title" placeholder="Padrão: nome do arquivo" className={inputCls} />
            </Field>
            <Field
              label="Quem pode ver"
              hint="O dono da viagem sempre vê tudo. Viajantes só veem o que for liberado aqui."
              className="sm:col-span-6"
            >
              <select name="visibility" defaultValue="OWNER" className={inputCls}>
                {visibilityOptions}
              </select>
            </Field>
            <div className="sm:col-span-6">
              <button className={btnPrimary}>Enviar</button>
            </div>
          </form>
        </AddPanel>
      )}

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <Link
          href={`/trips/${trip.id}/documents`}
          className={`rounded-full px-3 py-1 ${!filter ? "bg-brand-700 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}
        >
          Todos
        </Link>
        {types.map((dt) => (
          <Link
            key={dt.id}
            href={`/trips/${trip.id}/documents?type=${dt.id}`}
            className={`rounded-full px-3 py-1 ${filter === dt.id ? "bg-brand-700 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}
          >
            {dt.name}
          </Link>
        ))}
      </div>

      {docs.length === 0 ? (
        <EmptyState>Nenhum documento {filter ? "deste tipo" : "enviado"} ainda.</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {docs.map((d) => (
            <li key={d.id}>
              <Card className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <a
                    href={`/api/files/${trip.id}/${d.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-sm font-medium text-brand-800 hover:underline"
                  >
                    {d.title}
                  </a>
                  <p className="text-xs text-slate-500">
                    {typeNames[d.type] ?? d.type} · {humanSize(d.sizeBytes)} ·{" "}
                    {formatDate(d.createdAt.toISOString().slice(0, 10))}
                  </p>
                  <p className="mt-1 text-xs">
                    <span
                      className={`rounded px-1.5 py-0.5 ${
                        d.visibility === "OWNER" ? "bg-slate-100 text-slate-600" : "bg-brand-50 text-brand-800"
                      }`}
                    >
                      👁 {visLabel(d)}
                    </span>
                  </p>
                  {canWrite && (
                    <form
                      action={setDocumentVisibilityAction.bind(null, trip.id, d.id)}
                      className="mt-2 flex gap-2"
                    >
                      <select name="visibility" defaultValue={visValue(d)} className={`${inputCls} py-1 text-xs`}>
                        {visibilityOptions}
                      </select>
                      <button className="cursor-pointer text-xs text-brand-700 hover:underline">Salvar</button>
                    </form>
                  )}
                </div>
                {canWrite && (
                  <form action={deleteDocumentAction.bind(null, trip.id, d.id)}>
                    <button className={btnDanger}>Remover</button>
                  </form>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
