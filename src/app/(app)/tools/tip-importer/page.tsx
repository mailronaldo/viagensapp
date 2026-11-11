import { requireClient } from "@/lib/auth";
import { getClientCities } from "@/services/cities";
import { importTipsAction, type TipImportSummary } from "@/app/actions/tips";
import { Card, ErrorBanner, Field, btnOutline, btnPrimary, inputCls } from "@/components/ui";

export const metadata = { title: "Importar dicas" };

function ImportSummaryCard({ summary }: { summary: TipImportSummary }) {
  return (
    <Card className="mb-4 border-emerald-200 bg-emerald-50">
      <p className="text-sm font-medium text-emerald-900">
        {summary.created} dica{summary.created === 1 ? "" : "s"} importada{summary.created === 1 ? "" : "s"}
        {summary.duplicates > 0 ? `, ${summary.duplicates} já existia${summary.duplicates === 1 ? "" : "m"} (pulada${summary.duplicates === 1 ? "" : "s"})` : ""}.
      </p>
      {summary.neighborhoodsCreated.length > 0 && (
        <p className="mt-2 text-xs text-emerald-800">Bairros/regiões criados: {summary.neighborhoodsCreated.join(", ")}.</p>
      )}
      {summary.categoriesNotFound.length > 0 && (
        <p className="mt-2 text-xs text-amber-800">
          Categorias não encontradas no catálogo (dica criada sem elas): {summary.categoriesNotFound.join(", ")}.
        </p>
      )}
      {summary.lineErrors.length > 0 && (
        <ul className="mt-2 list-inside list-disc text-xs text-rose-800">
          {summary.lineErrors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default async function TipImporterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; cityId?: string; result?: string }>;
}) {
  const user = await requireClient();
  const { error, cityId, result } = await searchParams;

  const cities = await getClientCities(user.id);
  let summary: TipImportSummary | null = null;
  if (result) {
    try {
      summary = JSON.parse(result);
    } catch {
      summary = null;
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold">Importar dicas</h1>
      <p className="mb-4 text-sm text-slate-500">
        Importa várias dicas de uma vez a partir de um arquivo .txt ou .csv, uma por linha, no formato{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">nome;bairro/região;descrição;categoria1,categoria2</code>. Bairro/região é criado
        automaticamente se não existir; categoria precisa já estar cadastrada no catálogo — se não achar, a dica entra sem ela.
      </p>

      <ErrorBanner message={error} />
      {summary && <ImportSummaryCard summary={summary} />}

      <Card>
        <form action={importTipsAction} encType="multipart/form-data" className="grid gap-3 sm:grid-cols-2">
          <Field label="Cidade" className="sm:col-span-2">
            <select name="cityId" defaultValue={cityId ?? ""} required className={inputCls}>
              <option value="">Selecione…</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Arquivo (.txt ou .csv)" className="sm:col-span-2">
            <input name="file" type="file" required accept=".txt,.csv,text/plain,text/csv" className={inputCls} />
          </Field>
          <div className="sm:col-span-2 flex gap-2">
            <button className={btnPrimary}>Importar dicas</button>
            <a href="/tips" className={btnOutline}>
              Ver gestor de dicas
            </a>
          </div>
        </form>
      </Card>
    </div>
  );
}
