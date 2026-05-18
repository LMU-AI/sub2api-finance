import { NextResponse, type NextRequest } from "next/server";
import { addManualRevenue, deleteManualRevenue } from "@/lib/revenue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      date?: string;
      amountRmb?: unknown;
      client?: string;
      note?: string;
    };
    await addManualRevenue(
      String(body.date || ""),
      Number(body.amountRmb),
      String(body.client || ""),
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
  await deleteManualRevenue(id);
  return NextResponse.json({ ok: true });
}
