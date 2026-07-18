import { NextResponse } from "next/server";
import { getMunicipalityDetail } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ municipalityCode: string }> }
) {
  const { municipalityCode } = await params;
  const municipality = await getMunicipalityDetail(municipalityCode);
  if (!municipality) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ municipality });
}
