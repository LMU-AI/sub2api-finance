"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ManualRevenue } from "@/lib/types";
import { fmtTime, rmb } from "@/lib/format";

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function RevenueManager({ entries }: { entries: ManualRevenue[] }) {
  const router = useRouter();
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [client, setClient] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function save() {
    const amt = Number(amount);
    if (!date || !Number.isFinite(amt) || amt < 0) {
      setMsg("请填写正确的日期和金额");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/revenue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date, amountRmb: amt, client, note }),
      });
      const j = await r.json();
      if (j.ok) {
        setAmount("");
        setClient("");
        setNote("");
        setMsg("已新增一条对公转账明细");
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
    if (!confirm("确认删除这条对公转账明细?")) return;
    await fetch(`/api/revenue?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  const inputCls =
    "rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500";

  return (
    <div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-sm font-semibold text-slate-700">
          新增对公转账收款
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            到账日期
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputCls}
            />
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
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            客户(可选)
            <input
              type="text"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder="如:某某科技有限公司"
              className={`${inputCls} w-52`}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs text-slate-500">
            备注(可选)
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="如:对公转账 / 合同编号"
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
            对公转账等线下打款不进 sub2api
            支付流水,需在此手工录入。录入后只计入「现金口径」收入与利润;客户的
            API 消耗已走 sub2api,合同/权责口径无需重复计入。
          </p>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-2 text-sm font-semibold text-slate-700">
          对公转账明细 · 共 {entries.length} 条
        </div>
        {entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            尚未录入任何对公转账明细。
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="whitespace-nowrap px-3 py-2 text-left font-semibold">
                    到账日期
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                    金额(元)
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-left font-semibold">
                    客户
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
                {entries.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="whitespace-nowrap px-3 py-2">{e.date}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      {rmb(e.amountRmb)}
                    </td>
                    <td className="px-3 py-2">{e.client || "—"}</td>
                    <td className="px-3 py-2 text-slate-400">
                      {e.note || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-400">
                      {fmtTime(e.updatedAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <button
                        onClick={() => del(e.id)}
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
