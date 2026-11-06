import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { deleteOwnerChipAction, upsertOwnerChipAction } from "@/app/actions/chips";
import { ChipFields } from "@/components/TripFields";
import { SavedModal } from "@/components/SavedModal";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { Card, ErrorBanner, btnGhost, btnPrimary } from "@/components/ui";

export const metadata = { title: "Internet / Telefonia do cliente" };

export default async function OwnerChipPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const { error, saved } = await searchParams;
  const { trip, canWrite } = await requireTripAccess(id);
  if (!trip.ownerIsTraveler) redirect(`/trips/${trip.id}/travelers`);

  const [owner] = await db.select({ name: t.users.name }).from(t.users).where(eq(t.users.id, trip.ownerId)).limit(1);

  const [chip] = await db
    .select()
    .from(t.chips)
    .where(and(eq(t.chips.tripId, trip.id), isNull(t.chips.travelerId)))
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
      <h1 className="mb-4 mt-2 text-xl font-semibold">Internet / Telefonia — {owner?.name ?? "Dono da viagem"}</h1>
      {saved === "1" && (
        <SavedModal
          key={saved}
          show
          title="Chip salvo ✓"
          body="As informações de internet / telefonia foram salvas."
          cleanUrl={`/trips/${trip.id}/travelers/owner`}
        />
      )}
      <Card>
        {chip && (
          <div className="mb-3 flex items-center justify-end">
            <ConfirmDeleteButton
              label="Remover chip"
              confirmTitle="Remover este chip?"
              confirmDescription="Isso remove o registro de internet / telefonia do cliente nesta viagem."
              deleteAction={deleteOwnerChipAction.bind(null, trip.id)}
            />
          </div>
        )}
        <ErrorBanner message={error} />
        {canWrite ? (
          <form action={upsertOwnerChipAction.bind(null, trip.id)} className="grid gap-3 sm:grid-cols-6">
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
