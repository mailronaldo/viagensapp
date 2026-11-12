import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listClientTips } from "@/services/tips";

/** ";" é o separador do formato — escapa pra "," pra não quebrar o re-import. */
function sanitize(value: string): string {
  return value.replace(/;/g, ",");
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "CLIENT") return new NextResponse("Não autorizado", { status: 401 });

  const { searchParams } = new URL(req.url);
  const cityId = searchParams.get("cityId") || undefined;
  const neighborhoodId = searchParams.get("neighborhoodId") || undefined;
  const categoryId = searchParams.get("categoryId") || undefined;
  const q = searchParams.get("q") || undefined;

  const tips = await listClientTips(user.id, { cityId, neighborhoodId, categoryId, nameQuery: q });

  const lines = tips.map((tip) => {
    const categories = tip.categories.map((c) => c.name).join(",");
    return `${sanitize(tip.name)};${sanitize(tip.neighborhoodName ?? "")};${sanitize(tip.description ?? "")};${sanitize(categories)};;`;
  });

  return new NextResponse(lines.join("\n"), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": 'attachment; filename="dicas.txt"',
    },
  });
}
