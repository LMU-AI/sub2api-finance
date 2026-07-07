import { NextResponse, type NextRequest } from "next/server";
import { deleteBankBatch, importBankPdf } from "@/lib/bank";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "未收到文件" },
        { status: 400 },
      );
    }
    if (file.type && file.type !== "application/pdf") {
      return NextResponse.json(
        { ok: false, error: "仅支持 PDF 文件" },
        { status: 400 },
      );
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const result = await importBankPdf(file.name || "未命名.pdf", buf);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = Number(new URL(req.url).searchParams.get("batchId"));
  if (!Number.isFinite(id)) {
    return NextResponse.json({ ok: false, error: "无效 id" }, { status: 400 });
  }
  await deleteBankBatch(id);
  return NextResponse.json({ ok: true });
}
