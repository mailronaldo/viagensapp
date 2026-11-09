import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { formatMoney } from "@/lib/format";
import { getTripCities } from "@/services/cities";
import { listLodgingTypeSubcategories, listLodgingTypes, listReservationMethods } from "@/services/catalogs";
import { listClientCurrencyCodes } from "@/services/currencies";
import { listTripTravelerOptions } from "@/services/trip-travelers";
import { listLodgingVouchers } from "@/services/lodging-vouchers";
import { deleteLodgingAction, updateLodgingAction } from "@/app/actions/lodgings";
import { addVoucherAction, deleteVoucherAction, updateVoucherAction } from "@/app/actions/lodging-vouchers";
import { LodgingFields, LodgingVoucherFields } from "@/components/TripFields";
import { SavedModal } from "@/components/SavedModal";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { AddPanel, Card, ErrorBanner, Tag, btnGhost, btnPrimary } from "@/components/ui";
import { VALUE_STATUS_LABEL, VALUE_STATUS_TONE } from "@/lib/labels";

export const metadata = { title: "Editar hospedagem" };

export default async function EditLodgingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; lodgingId: string }>;
  searchParams: Promise<{ error?: string; saved?: string; day?: string }>;
}) {
  const { id, lodgingId } = await params;
  const { error, saved, day } = await searchParams;
  const { trip, canWrite } = await requireTripAccess(id);
  if (!canWrite) redirect(`/trips/${id}/lodgings`);
  const cancelHref = day ? `/trips/${id}/itinerary/day/${day}` : `/trips/${id}/lodgings`;

  const [lodging] = await db
    .select()
    .from(t.lodgings)
    .where(and(eq(t.lodgings.id, lodgingId), eq(t.lodgings.tripId, trip.id)))
    .limit(1);
  if (!lodging) notFound();

  const [cities, types, methods, doc, currencies, travelerOptions, subcategories, owner] = await Promise.all([
    getTripCities(trip.id),
    listLodgingTypes(),
    listReservationMethods(),
    lodging.documentId
      ? db.select({ fileName: t.documents.fileName }).from(t.documents).where(eq(t.documents.id, lodging.documentId)).limit(1)
      : Promise.resolve([]),
    listClientCurrencyCodes(trip.ownerId),
    listTripTravelerOptions(trip),
    listLodgingTypeSubcategories(lodging.type),
    db.select({ name: t.users.name }).from(t.users).where(eq(t.users.id, trip.ownerId)).limit(1).then(([o]) => o),
  ]);
  const attachment = doc[0] ? { name: doc[0].fileName, href: `/api/files/${trip.id}/${lodging.documentId}` } : null;
  const vouchers = await listLodgingVouchers(lodgingId, owner?.name ?? "Dono");
  const voucherDocIds = vouchers.map((v) => v.voucherDocumentId).filter((docId): docId is string => !!docId);
  const voucherDocs = voucherDocIds.length
    ? await db.select({ id: t.documents.id, fileName: t.documents.fileName }).from(t.documents).where(inArray(t.documents.id, voucherDocIds))
    : [];
  const voucherDocById = new Map(voucherDocs.map((d) => [d.id, d.fileName]));

  return (
    <div className="mx-auto max-w-3xl">
      {saved === "1" && (
        <SavedModal
          key={saved}
          show
          title="Hospedagem salva ✓"
          body="As alterações da hospedagem foram salvas."
          cleanUrl={`/trips/${trip.id}/lodgings/${lodging.id}${day ? `?day=${day}` : ""}`}
        />
      )}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium">Editar hospedagem</h2>
          <div className="flex items-center gap-1">
            <Link
              href={cancelHref}
              aria-label="Voltar"
              title="Voltar"
              className="flex size-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <ConfirmDeleteButton
              label="Excluir hospedagem"
              confirmTitle="Excluir esta hospedagem?"
              confirmDescription="Isso remove a hospedagem e o voucher anexado a ela. Não dá pra desfazer."
              deleteAction={deleteLodgingAction.bind(null, trip.id, lodging.id)}
            />
          </div>
        </div>
        <ErrorBanner message={error} />
        <form action={updateLodgingAction.bind(null, trip.id, lodging.id)} className="grid gap-3 sm:grid-cols-6">
          <input type="hidden" name="day" value={day ?? ""} />
          <LodgingFields cities={cities} types={types} methods={methods} lodging={lodging} attachment={attachment} />
          <div className="flex gap-2 sm:col-span-6">
            <button className={btnPrimary}>Salvar alterações</button>
            <Link href={cancelHref} className={btnGhost}>
              Cancelar
            </Link>
          </div>
        </form>
      </Card>

      <div className="mt-6">
        <AddPanel title={`Voucher${vouchers.length > 0 ? ` (${vouchers.length})` : ""}`} defaultOpen={vouchers.length === 0}>
          {vouchers.length > 0 && (
            <ul className="mb-4 space-y-2">
              {vouchers.map((v) => (
                <li key={v.id} className="rounded-lg border border-slate-200">
                  <details className="group">
                    <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">{v.name}</p>
                        <p className="text-xs text-slate-500">
                          {[v.scopeLabel, v.subcategoryName, v.price ? formatMoney(v.price, v.currency ?? "BRL") : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <span className="flex items-center gap-3">
                        <Tag tone={VALUE_STATUS_TONE[v.status]}>{VALUE_STATUS_LABEL[v.status]}</Tag>
                        <span className="text-xs text-brand-700 group-open:hidden">editar</span>
                        <span className="hidden text-xs text-brand-700 group-open:inline">fechar</span>
                      </span>
                    </summary>
                    <div className="border-t border-slate-100 p-3">
                      <div className="mb-3 flex items-center justify-end">
                        <ConfirmDeleteButton
                          label="Excluir"
                          confirmTitle="Excluir este voucher?"
                          confirmDescription="Isso remove este voucher de custo da hospedagem."
                          deleteAction={deleteVoucherAction.bind(null, trip.id, lodging.id, v.id)}
                          size="sm"
                        />
                      </div>
                      <form action={updateVoucherAction.bind(null, trip.id, lodging.id, v.id)} className="grid gap-3 sm:grid-cols-6">
                        <LodgingVoucherFields
                          trip={trip}
                          travelers={travelerOptions}
                          currencies={currencies}
                          subcategories={subcategories}
                          voucher={v}
                          travelerIds={v.travelerIds}
                          attachment={
                            v.voucherDocumentId
                              ? { name: voucherDocById.get(v.voucherDocumentId) ?? "voucher", href: `/api/files/${trip.id}/${v.voucherDocumentId}` }
                              : null
                          }
                        />
                        <div className="sm:col-span-6">
                          <button className={btnPrimary}>Salvar voucher</button>
                        </div>
                      </form>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
          <form action={addVoucherAction.bind(null, trip.id, lodging.id)} className="grid gap-3 sm:grid-cols-6">
            <LodgingVoucherFields trip={trip} travelers={travelerOptions} currencies={currencies} subcategories={subcategories} />
            <div className="sm:col-span-6">
              <button className={btnPrimary}>Adicionar voucher</button>
            </div>
          </form>
        </AddPanel>
      </div>
    </div>
  );
}
