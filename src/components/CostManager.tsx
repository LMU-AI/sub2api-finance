"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MonthlyCost, Platform } from "@/lib/types";
import { PLATFORMS, PLATFORM_LABEL } from "@/lib/types";
import { fmtTime } from "@/lib/format";

function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function CostManager({ costs }: { costs: MonthlyCost[] }) {
  const router = useRouter();
  const [ym, setYm] = useState(thisMonth());
  const [platform, setPlatform] = useState<Platform>("claude");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function save() {
    const amt = Number(amount);
    if (!ym || !Number.isFinite(amt) || amt < 0) {
      setMsg("请填写正确的月份和金额");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/costs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ yearMonth: ym, platform, amountRmb: amt, note }),
      });
      const j = await r.json();
      if (j.ok) {
        setAmount("");
        setNote("");
        setMsg("已新增一条明细");
        router.refresh();
      } else {
        setMsg("保存失败:" + (j.error || ""));
      }
    } catch (e) {
      setMsg("保存失败:" + String(e));
    } finally {
      setBusy(false);
    }
  }

  async function del(id: number) {
    if (!confirm("确认删除这条成本明细?")) return;
    await fetch(`/api/costs?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  const inputCls =
    "rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500";

  return (
    <div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-sm font-semibold text-slate-700">新增成本明细</div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            月份
            <input
              type="month"
              value={ym}
              onChange={(e) => setYm(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            平台
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Platform)}
              className={inputCls}
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {PLATFORM_LABEL[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            金额(人民币)
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className={`${inputCls} w-36`}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs text-slate-500">
            备注(可选)
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="如:Claude MAX 账号 ×30"
              className={`${inputCls} w-full`}
            />
          </label>
          <button
            onClick={save}
            disabled={busy}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "保存中…" : "新增"}
          </button>
        </div>
        {msg ? (
          <p className="mt-2 text-xs text-slate-500">{msg}</p>
        ) : (
          <p className="mt-2 text-xs text-slate-400">
            追加模式:每次保存新增一条明细,不覆盖。同一月份、同一平台可多次录入,系统按平台自动累加。服务器/RDS
            等固定支出请归到「服务器」平台。
          </p>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-2 text-sm font-semibold text-slate-700">
          成本明细 · 共 {costs.length} 条
        </div>
        {costs.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            尚未录入任何成本明细。
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="whitespace-nowrap px-3 py-2 text-left font-semibold">
                    月份
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-left font-semibold">
                    平台
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                    金额(元)
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-left font-semibold">
                    备注
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-left font-semibold">
                    录入时间
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {costs.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="whitespace-nowrap px-3 py-2">
                      {c.yearMonth}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {PLATFORM_LABEL[c.platform]}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      ¥{c.amountRmb.toLocaleString("zh-CN")}
                    </td>
                    <td className="px-3 py-2 text-slate-400">
                      {c.note || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-400">
                      {fmtTime(c.updatedAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <button
                        onClick={() => del(c.id)}
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
