import { BOOKING_TYPE_LABEL, ITEM_TYPE_LABEL, LODGING_TYPE_LABEL } from "@/lib/labels";
import type { AgendaEntry } from "@/services/agenda";

/** Agenda do dia, somente leitura e sem valores (o painel do viajante não mostra custos). */
export function TravelerAgenda({
  tripId,
  entries,
  docName,
}: {
  tripId: string;
  entries: AgendaEntry[];
  docName: Map<string, string>;
}) {
  const link = (docId: string | null, fallback: string, icon = "📎") =>
    docId ? (
      <a
        href={`/api/files/${tripId}/${docId}`}
        target="_blank"
        rel="noreferrer"
        className="mr-3 inline-block text-xs text-teal-700 hover:underline"
      >
        {icon} {docName.get(docId) ?? fallback}
      </a>
    ) : null;

  return (
    <ol className="divide-y divide-slate-100">
      {entries.map((e) => (
        <li key={`${e.kind}-${e.id}`} className="flex gap-4 py-3">
          <span className="w-12 shrink-0 text-sm tabular-nums text-slate-500">{e.time ?? "—"}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {e.title}
              {e.kind === "booking" && (
                <span className="ml-2 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-normal uppercase text-sky-800">
                  transporte
                </span>
              )}
              {e.kind === "lodging" && (
                <span className="ml-2 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-normal uppercase text-violet-800">
                  hospedagem
                </span>
              )}
              {e.kind === "item" && e.reservation && (
                <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-normal uppercase text-emerald-800">
                  reservado
                </span>
              )}
            </p>
            <p className="text-xs text-slate-500">
              {e.kind === "item"
                ? ITEM_TYPE_LABEL[e.type as keyof typeof ITEM_TYPE_LABEL]
                : e.kind === "lodging"
                  ? LODGING_TYPE_LABEL[e.type as keyof typeof LODGING_TYPE_LABEL]
                  : BOOKING_TYPE_LABEL[e.type as keyof typeof BOOKING_TYPE_LABEL]}
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
