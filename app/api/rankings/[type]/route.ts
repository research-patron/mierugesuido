import { NextResponse } from "next/server";
import { getRankings, rankingLabels, type RankingType } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  if (!(type in rankingLabels)) {
    return NextResponse.json({ error: "unknown_ranking_type" }, { status: 404 });
  }
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? 50);
  const items = await getRankings(type as RankingType, limit);
  return NextResponse.json({ type, items });
}
