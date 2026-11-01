import Link from "next/link";
import { requireTripAccess } from "@/lib/access";
import { formatDate } from "@/lib/format";
import { DOCUMENT_TYPE_LABEL } from "@/lib/labels";
import { listDocuments, type DocType } from "@/services/documents";
import { deleteDocumentAction, uploadDocumentAction } from "@/app/actions/documents";
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

  const filter = type && type in DOCUMENT_TYPE_LABEL ? (type as DocType) : undefined;
  const docs = await listDocuments(trip.id, filter);

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
                {Object.entries(DOCUMENT_TYPE_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Título (opcional)" className="sm:col-span-4">
              <input name="title" placeholder="Padrão: nome do arquivo" className={inputCls} />
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
          className={`rounded-full px-3 py-1 ${!filter ? "bg-teal-700 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}
        >
          Todos
        </Link>
        {Object.entries(DOCUMENT_TYPE_LABEL).map(([v, l]) => (
          <Link
            key={v}
            href={`/trips/${trip.id}/documents?type=${v}`}
            className={`rounded-full px-3 py-1 ${filter === v ? "bg-teal-700 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}
          >
            {l}
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
                    className="block truncate text-sm font-medium text-teal-800 hover:underline"
                  >
                    {d.title}
                  </a>
                  <p className="text-xs text-slate-500">
                    {DOCUMENT_TYPE_LABEL[d.type]} · {humanSize(d.sizeBytes)} ·{" "}
                    {formatDate(d.createdAt.toISOString().slice(0, 10))}
                  </p>
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
