import { NextResponse } from "next/server";
import { runAggregation } from "@/lib/aggregate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const snap = await runAggregation();
    return NextResponse.json({ ok: true, generatedAt: snap.generatedAt });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
