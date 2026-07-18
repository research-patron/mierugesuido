import { NextResponse } from "next/server";
import { getDataSources } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = await getDataSources();
  return NextResponse.json({ items });
}
