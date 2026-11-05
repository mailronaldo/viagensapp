import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listStates } from "@/lib/geo";

export async function GET(req: Request) {
  await requireAuth();
  const country = new URL(req.url).searchParams.get("country");
  if (!country) return NextResponse.json({ error: "Informe o país." }, { status: 400 });
  return NextResponse.json(listStates(country));
}
