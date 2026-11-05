import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listCities } from "@/lib/geo";

export async function GET(req: Request) {
  await requireAuth();
  const params = new URL(req.url).searchParams;
  const country = params.get("country");
  if (!country) return NextResponse.json({ error: "Informe o país." }, { status: 400 });
  return NextResponse.json(listCities(country, params.get("state")));
}
