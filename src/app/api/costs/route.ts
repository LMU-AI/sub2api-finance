import { NextResponse, type NextRequest } from "next/server";
import { addCost, deleteCost } from "@/lib/costs";
import type { Platform } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      yearMonth?: string;
      platform?: string;
      amountRmb?: unknown;
      note?: string;
    };
    await addCost(
      String(body.yearMonth || ""),
      String(body.platform || "") as Platform,
      Number(body.amountRmb),
      String(body.note || ""),
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isFinite(id)) {
    return NextResponse.json({ ok: false, error: "无效 id" }, { status: 400 });
  }
  deleteCost(id);
  return NextResponse.json({ ok: true });
}
