import { NextResponse, type NextRequest } from "next/server";
import {
  addPayrollDividend,
  deletePayrollDividend,
  generateDividendsFromProject,
  updatePayrollDividend,
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
    if (body.action === "generateFromProject") {
      const count = await generateDividendsFromProject(
        body as unknown as Parameters<typeof generateDividendsFromProject>[0],
      );
      return NextResponse.json({ ok: true, count });
    }
    await addPayrollDividend(
      body as unknown as Parameters<typeof addPayrollDividend>[0],
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return err(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as Parameters<
      typeof updatePayrollDividend
    >[0];
    await updatePayrollDividend({ ...body, id: Number(body.id) });
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
  await deletePayrollDividend(id);
  return NextResponse.json({ ok: true });
}
