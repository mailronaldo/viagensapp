import { LODGING_TYPE_LABEL } from "@/lib/labels";
import { Tag } from "@/components/ui";
import type { AgendaEntry } from "@/services/agenda";

/** Agenda do dia, somente leitura e sem valores (o painel do viajante não mostra custos). */
export function TravelerAgenda({
  tripId,
  entries,
  docName,
  activityTypeName,
  bookingTypeName,
}: {
  tripId: string;
  entries: AgendaEntry[];
  docName: Map<string, string>;
  activityTypeName: Record<string, string>;
  bookingTypeName: Record<string, string>;
}) {
  const link = (docId: string | null, fallback: string, icon = "📎") =>
    docId ? (
      <a
        href={`/api/files/${tripId}/${docId}`}
        target="_blank"
        rel="noreferrer"
        className="mr-3 inline-block text-xs text-brand-700 hover:underline"
      >
        {icon} {docName.get(docId) ?? fallback}
      </a>
    ) : null;

  return (
    <ol className="space-y-2">
      {entries.map((e) => (
        <li key={`${e.kind}-${e.id}`} className="flex gap-3">
          <span className="w-12 shrink-0 pt-3 text-sm font-medium tabular-nums">{e.time ?? "—"}</span>
          <div className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
              <p className="text-sm font-medium">{e.title}</p>
              {e.kind === "booking" && <Tag tone="info">transporte</Tag>}
              {e.kind === "lodging" && <Tag tone="info">hospedagem</Tag>}
              {e.kind === "item" && e.reservation && <Tag tone="ok">reservado</Tag>}
            </div>
            <p className="text-xs text-slate-500">
              {e.kind === "item"
                ? activityTypeName[e.type]
                : e.kind === "lodging"
                  ? LODGING_TYPE_LABEL[e.type as keyof typeof LODGING_TYPE_LABEL]
                  : bookingTypeName[e.type]}
              {e.cityName ? ` · ${e.cityName}` : ""}
              {e.location ? ` · ${e.location}` : ""}
            </p>
            {e.address && <p className="text-xs text-slate-400">{e.address}</p>}
            {e.reservation && (
              <p className="text-xs text-emerald-800">
                Reserva:{" "}
                {[e.reservation.provider, e.reservation.code ? `cód. ${e.reservation.code}` : null]
                  .filter(Boolean)
                  .join(" · ") || "confirmada"}
              </p>
            )}
            {e.notes && <p className="mt-1 text-xs text-slate-500">{e.notes}</p>}
            <p className="mt-1">
              {link(e.ticketDocumentId, e.kind === "item" ? "Ingresso" : "Voucher")}
              {e.reservation && link(e.reservation.documentId, "Voucher da reserva")}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
