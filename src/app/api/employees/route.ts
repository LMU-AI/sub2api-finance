import { NextResponse, type NextRequest } from "next/server";
import {
  addEmployee,
  deleteEmployee,
  updateEmployee,
} from "@/lib/payroll";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function err(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return NextResponse.json({ ok: false, error: msg }, { status: 400 });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Parameters<typeof addEmployee>[0];
    await addEmployee(body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return err(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as Parameters<typeof updateEmployee>[0];
    await updateEmployee({ ...body, id: Number(body.id) });
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
  try {
    await deleteEmployee(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return err(e);
  }
}
