import "server-only";
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { eachDay, formatDate, formatMoney, formatWeekday } from "@/lib/format";
import { getAgenda, type AgendaEntry } from "./agenda";
import { getDayPlan } from "./itinerary";
import { getDocument } from "./documents";
import { readStoredFile } from "@/lib/storage";
import { listActivityTypes, listBookingTypes, listLodgingTypes, toNameMap } from "./catalogs";

// Desliga a hifenização (que carregaria dicionários por idioma só pra inglês)
// — o roteiro é sempre em pt-BR, não precisa dessa quebra de palavra.
Font.registerHyphenationCallback((word) => [word]);

type Trip = {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  timezone: string;
};

export type TripExportScope = { scope: "day"; date: string } | { scope: "full" };

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
  coverTitle: { fontSize: 22, marginBottom: 8 },
  coverSubtitle: { fontSize: 12, color: "#555", marginBottom: 4 },
  dayHeader: { fontSize: 14, marginBottom: 2 },
  dayMeta: { fontSize: 9, color: "#888", marginBottom: 6, textTransform: "uppercase" },
  daySummary: { fontSize: 10, color: "#444", marginBottom: 10 },
  entry: { marginBottom: 8, borderBottom: "1px solid #e5e5e5", paddingBottom: 6 },
  entryHeader: { flexDirection: "row", justifyContent: "space-between" },
  entryTime: { fontSize: 10, fontWeight: 700, width: 70 },
  entryTitle: { fontSize: 11, fontWeight: 700, flex: 1 },
  entryMeta: { fontSize: 9, color: "#666", marginTop: 2 },
  entryNotes: { fontSize: 9, color: "#444", marginTop: 2 },
  entryReservation: { fontSize: 9, color: "#166534", marginTop: 2 },
  entryAttachment: { fontSize: 8, color: "#1d4ed8", marginTop: 2 },
  empty: { fontSize: 10, color: "#888", fontStyle: "italic" },
});

function RoteiroDocument({
  trip,
  days,
  typeLabel,
}: {
  trip: Trip;
  days: {
    date: string;
    number: number;
    plan: { title: string | null; summary: string | null; cities: { id: string; name: string }[] };
    agenda: AgendaEntry[];
  }[];
  typeLabel: Record<string, string>;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.coverTitle}>{trip.title}</Text>
        <Text style={styles.coverSubtitle}>{trip.destination}</Text>
        <Text style={styles.coverSubtitle}>
          {formatDate(trip.startDate)} – {formatDate(trip.endDate)}
        </Text>
      </Page>
      {days.map((d) => (
        <Page key={d.date} size="A4" style={styles.page}>
          <Text style={styles.dayMeta}>
            Dia {d.number} · {formatDate(d.date)}
          </Text>
          <Text style={styles.dayHeader}>
            {d.plan.title ? `${capitalize(formatWeekday(d.date))} — ${d.plan.title}` : capitalize(formatWeekday(d.date))}
          </Text>
          {d.plan.cities.length > 0 && (
            <Text style={styles.dayMeta}>{d.plan.cities.map((c) => c.name).join(" · ")}</Text>
          )}
          {d.plan.summary && <Text style={styles.daySummary}>{d.plan.summary}</Text>}

          {d.agenda.length === 0 ? (
            <Text style={styles.empty}>Nada planejado para este dia.</Text>
          ) : (
            d.agenda.map((e, i) => (
              <View key={`${e.kind}-${e.id}-${e.legId ?? ""}-${i}`} style={styles.entry}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryTime}>
                    {e.time ?? "—"}
                    {e.endTime ? ` – ${e.endTime}` : ""}
                  </Text>
                  <Text style={styles.entryTitle}>{e.title}</Text>
                </View>
                <Text style={styles.entryMeta}>
                  {[typeLabel[e.type] ?? e.type, e.cityName, e.location, e.address].filter(Boolean).join(" · ")}
                </Text>
                {e.notes && <Text style={styles.entryNotes}>{e.notes}</Text>}
                {e.reservation && (
                  <Text style={styles.entryReservation}>
                    Reserva:{" "}
                    {[
                      e.reservation.provider,
                      e.reservation.code ? `cód. ${e.reservation.code}` : null,
                      e.reservation.price && e.reservation.currency
                        ? formatMoney(e.reservation.price, e.reservation.currency)
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "dados no detalhe"}
                  </Text>
                )}
                {e.hasTicket && <Text style={styles.entryAttachment}>📎 anexo incluído no fim deste PDF</Text>}
              </View>
            ))
          )}
        </Page>
      ))}
    </Document>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function collectAttachmentIds(agendas: AgendaEntry[][]): string[] {
  const ids = new Set<string>();
  for (const entries of agendas) {
    for (const e of entries) {
      if (e.ticketDocumentId) ids.add(e.ticketDocumentId);
      if (e.reservation?.documentId) ids.add(e.reservation.documentId);
    }
  }
  return [...ids];
}

const EMBEDDABLE_IMAGE = new Set(["image/jpeg", "image/png"]);

async function appendAttachments(pdf: PDFDocument, tripId: string, documentIds: string[]) {
  if (documentIds.length === 0) return;
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const docId of documentIds) {
    const doc = await getDocument(tripId, docId);
    if (!doc) continue;
    let bytes: Buffer;
    try {
      bytes = await readStoredFile(doc.storageKey);
    } catch {
      continue;
    }

    try {
      if (doc.mimeType === "application/pdf") {
        const attached = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pages = await pdf.copyPages(attached, attached.getPageIndices());
        for (const p of pages) pdf.addPage(p);
        continue;
      }

      if (EMBEDDABLE_IMAGE.has(doc.mimeType)) {
        const image = doc.mimeType === "image/jpeg" ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
        const margin = 32;
        const maxW = 595 - margin * 2;
        const maxH = 842 - margin * 2 - 24;
        const scale = Math.min(maxW / image.width, maxH / image.height, 1);
        const w = image.width * scale;
        const h = image.height * scale;
        const page = pdf.addPage([595, 842]);
        page.drawText(doc.title, { x: margin, y: 842 - margin, size: 10, font });
        page.drawImage(image, { x: margin, y: 842 - margin - 24 - h, width: w, height: h });
        continue;
      }
    } catch {
      // Anexo corrompido ou num formato que o pdf-lib não consegue abrir
      // (ex.: JPEG progressivo) — cai pra página de aviso abaixo em vez de
      // derrubar a exportação inteira.
    }

    const page = pdf.addPage([595, 842]);
    page.drawText(`Anexo: ${doc.title}`, { x: 32, y: 800, size: 12, font });
    page.drawText(
      `Formato (${doc.mimeType}) não pôde ser incluído neste PDF. Disponível em Documentos no app.`,
      { x: 32, y: 780, size: 10, font },
    );
  }
}

export async function buildTripExportPdf(
  trip: Trip,
  opts: TripExportScope,
  includeAttachments: boolean,
): Promise<Uint8Array> {
  const dates = opts.scope === "day" ? [opts.date] : eachDay(trip.startDate, trip.endDate);
  const offset = opts.scope === "day" ? Math.round((Date.parse(opts.date) - Date.parse(trip.startDate)) / 86_400_000) : 0;

  const [activityTypes, bookingTypes, lodgingTypes] = await Promise.all([
    listActivityTypes(),
    listBookingTypes(),
    listLodgingTypes(),
  ]);
  const typeLabel = { ...toNameMap(activityTypes), ...toNameMap(bookingTypes), ...toNameMap(lodgingTypes) };

  const days = await Promise.all(
    dates.map(async (date, i) => {
      const [plan, agenda] = await Promise.all([getDayPlan(trip.id, date), getAgenda(trip, date)]);
      return { date, number: offset + i + 1, plan, agenda: agenda.entries };
    }),
  );

  const baseBuffer = await renderToBuffer(<RoteiroDocument trip={trip} days={days} typeLabel={typeLabel} />);
  const pdf = await PDFDocument.load(baseBuffer);

  if (includeAttachments) {
    const documentIds = collectAttachmentIds(days.map((d) => d.agenda));
    await appendAttachments(pdf, trip.id, documentIds);
  }

  return pdf.save();
}
