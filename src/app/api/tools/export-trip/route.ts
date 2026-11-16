import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getTripAccessFor } from "@/lib/access";
import { ISO_DATE, str } from "@/lib/form";
import { buildTripExportPdf } from "@/services/trip-export";

function slugify(s: string) {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "viagem"
  );
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Não autenticado", { status: 401 });

  const formData = await req.formData();
  const tripId = str(formData, "tripId");
  if (!tripId) return new NextResponse("Viagem não informada.", { status: 400 });

  const access = await getTripAccessFor(user.id, tripId);
  if (!access) return new NextResponse("Não encontrado", { status: 404 });
  const { trip } = access;

  const scope = str(formData, "scope") === "day" ? "day" : "full";
  const includeAttachments = str(formData, "includeAttachments") === "on";

  let opts: Parameters<typeof buildTripExportPdf>[1];
  if (scope === "day") {
    const date = str(formData, "date");
    if (!date || !ISO_DATE.test(date) || date < trip.startDate || date > trip.endDate) {
      return new NextResponse("Data inválida para esta viagem.", { status: 400 });
    }
    opts = { scope: "day", date };
  } else {
    opts = { scope: "full" };
  }

  const bytes = await buildTripExportPdf(trip, opts, includeAttachments);
  const filename = `roteiro-${slugify(trip.title)}${scope === "day" ? `-${(opts as { date: string }).date}` : ""}.pdf`;

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.length),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
