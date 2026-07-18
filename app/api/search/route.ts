import { NextResponse } from "next/server";
import { searchMunicipalities } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const items = await searchMunicipalities(q, 10);
  return NextResponse.json({ items });
}
