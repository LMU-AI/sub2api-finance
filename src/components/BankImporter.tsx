"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BankBatch, BankImportResult } from "@/lib/types";
import { fmtTime } from "@/lib/format";

export function BankImporter({ batches }: { batches: BankBatch[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [result, setResult] = useState<BankImportResult | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setMsg("");
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/bank", { method: "POST", body: fd });
      const j = (await r.json()) as
        | ({ ok: true } & BankImportResult)
        | { ok: false; error: string };
      if (j.ok) {
        setResult(j);
        setMsg(
          `解析 ${j.parsed} 笔 · 新增 ${j.inserted} · 重复跳过 ${j.skipped}`,
        );
        router.refresh();
      } else {
        setMsg("导入失败：" + j.error);
      }
    } catch (e) {
      setMsg("导入失败：" + String(e));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function del(id: number) {
    if (!confirm("删除这次导入？将移除该批次首次录入的交易（可重新上传恢复）"))
      return;
    await fetch(`/api/bank?batchId=${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-sm font-semibold text-slate-700">
          上传银行流水 PDF
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
            className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-indigo-700"
          />
          {busy ? (
            <span className="text-sm text-slate-500">解析中…</span>
          ) : null}
        </div>
        {msg ? (
          <p className="mt-2 text-sm font-medium text-slate-700">{msg}</p>
        ) : (
          <p className="mt-2 text-xs text-slate-400">
            支持中国银行「交易流水明细清单」PDF 原件。所有支出（流出）计为成本，进账仅存档参考。
            同一笔交易按内容去重，重复上传或区间重叠不会重复计入。
          </p>
        )}
        {result ? (
          <p className="mt-1 text-xs text-slate-400">
            卡号 {result.cardNo || "—"} · 区间 {result.periodStart || "—"} 至{" "}
            {result.periodEnd || "—"}
          </p>
        ) : null}
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-2 text-sm font-semibold text-slate-700">
          导入记录 · 共 {batches.length} 次
        </div>
        {batches.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            尚未导入任何银行流水。
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="px-3 py-2 text-left font-semibold">文件</th>
                  <th className="px-3 py-2 text-left font-semibold">卡号</th>
                  <th className="px-3 py-2 text-left font-semibold">区间</th>
                  <th className="px-3 py-2 text-right font-semibold">解析</th>
                  <th className="px-3 py-2 text-right font-semibold">新增</th>
                  <th className="px-3 py-2 text-right font-semibold">跳过</th>
                  <th className="px-3 py-2 text-left font-semibold">导入时间</th>
                  <th className="px-3 py-2 text-right font-semibold">操作</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr
                    key={b.id}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="max-w-[180px] truncate px-3 py-2">
                      {b.filename || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-500">
                      {b.cardNo
                        ? "尾号" + b.cardNo.slice(-4)
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-500">
                      {b.periodStart || "—"}~{b.periodEnd || "—"}
                    </td>
                    <td className="px-3 py-2 text-right">{b.parsedCount}</td>
                    <td className="px-3 py-2 text-right font-semibold text-emerald-600">
                      {b.insertedCount}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-400">
                      {b.skippedCount}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-400">
                      {fmtTime(b.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <button
                        onClick={() => del(b.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
