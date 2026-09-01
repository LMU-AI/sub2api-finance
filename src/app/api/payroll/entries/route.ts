import { NextResponse, type NextRequest } from "next/server";
import {
  addPayrollEntry,
  deletePayrollEntry,
  generateMonthlyDraft,
  markMonthPaid,
  updatePayrollEntry,
} from "@/lib/payroll";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function err(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return NextResponse.json({ ok: false, error: msg }, { status: 400 });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    if (body.action === "generate") {
      const count = await generateMonthlyDraft(String(body.yearMonth || ""));
      return NextResponse.json({ ok: true, count });
    }
    if (body.action === "markMonthPaid") {
      const count = await markMonthPaid(
        String(body.yearMonth || ""),
        String(body.paidAt || ""),
      );
      return NextResponse.json({ ok: true, count });
    }
    await addPayrollEntry(
      body as unknown as Parameters<typeof addPayrollEntry>[0],
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return err(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as Parameters<
      typeof updatePayrollEntry
    >[0];
    await updatePayrollEntry({ ...body, id: Number(body.id) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return err(e);
  }
}

export async function DELETE(req: NextRequest) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isFinite(id)) {
    return NextResponse.json({ ok: false, error: "无效 id" }, { status: 400 });
  }
  await deletePayrollEntry(id);
  return NextResponse.json({ ok: true });
}
