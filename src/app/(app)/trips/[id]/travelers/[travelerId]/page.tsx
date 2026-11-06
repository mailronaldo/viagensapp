import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { deleteChipAction, upsertChipAction } from "@/app/actions/chips";
import { ChipFields } from "@/components/TripFields";
import { SavedModal } from "@/components/SavedModal";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { Card, ErrorBanner, btnGhost, btnPrimary } from "@/components/ui";

export const metadata = { title: "Internet / Telefonia do viajante" };

export default async function TravelerChipPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; travelerId: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id, travelerId } = await params;
  const { error, saved } = await searchParams;
  const { trip, role, canWrite } = await requireTripAccess(id);

  const [linked] = await db
    .select({ traveler: t.travelers })
    .from(t.tripTravelers)
    .innerJoin(t.travelers, eq(t.travelers.id, t.tripTravelers.travelerId))
    .where(and(eq(t.tripTravelers.tripId, trip.id), eq(t.tripTravelers.travelerId, travelerId)))
    .limit(1);
  if (!linked) notFound();
  const { traveler } = linked;

  const [chip] = await db
    .select()
    .from(t.chips)
    .where(and(eq(t.chips.tripId, trip.id), eq(t.chips.travelerId, travelerId)))
    .limit(1);
  const attachment = chip?.receiptDocumentId
    ? await db
        .select({ fileName: t.documents.fileName })
        .from(t.documents)
        .where(eq(t.documents.id, chip.receiptDocumentId))
        .limit(1)
        .then(([doc]) => (doc ? { name: doc.fileName, href: `/api/files/${trip.id}/${chip.receiptDocumentId}` } : null))
    : null;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/trips/${trip.id}/travelers`} className="text-xs text-slate-500 hover:underline">
        ← Viajantes
      </Link>
      <h1 className="mb-4 mt-2 text-xl font-semibold">
        Internet / Telefonia — {traveler.name}
      </h1>
      {saved === "1" && (
        <SavedModal
          key={saved}
          show
          title="Chip salvo ✓"
          body="As informações de internet / telefonia foram salvas."
          cleanUrl={`/trips/${trip.id}/travelers/${travelerId}`}
        />
      )}
      {role === "OWNER" && (
        <p className="mb-4 text-xs text-slate-500">
          <Link href={`/travelers/${travelerId}`} className="text-brand-700 hover:underline">
            Editar cadastro e acesso deste viajante
          </Link>
        </p>
      )}
      <Card>
        {chip && (
          <div className="mb-3 flex items-center justify-end">
            <ConfirmDeleteButton
              label="Remover chip"
              confirmTitle="Remover este chip?"
              confirmDescription="Isso remove o registro de internet / telefonia deste viajante nesta viagem."
              deleteAction={deleteChipAction.bind(null, trip.id, travelerId)}
            />
          </div>
        )}
        <ErrorBanner message={error} />
        {canWrite ? (
          <form action={upsertChipAction.bind(null, trip.id, travelerId)} className="grid gap-3 sm:grid-cols-6">
            <ChipFields trip={trip} chip={chip} attachment={attachment} />
            <div className="flex gap-2 sm:col-span-6">
              <button className={btnPrimary}>Salvar</button>
              <Link href={`/trips/${trip.id}/travelers`} className={btnGhost}>
                Cancelar
              </Link>
            </div>
          </form>
        ) : (
          <p className="text-sm text-slate-500">Você não tem permissão para editar esta viagem.</p>
        )}
      </Card>
    </div>
  );
}
