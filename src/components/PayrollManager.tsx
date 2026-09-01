"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Employee,
  PayrollAnnual,
  PayrollDividend,
  PayrollEntry,
} from "@/lib/types";
import { rmb } from "@/lib/format";

const inputCls =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500";
const btnPrimary =
  "rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50";
const btnLight =
  "rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function currentYm(): string {
  return todayStr().slice(0, 7);
}
/** 与 lib/payroll.ts 同口径的前端预览计算 */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function calcEntry(
  base: number,
  days: number | null,
  payrollDays: number,
  rate: number,
  mode: "gross" | "net",
) {
  const b = days == null ? base : (base * days) / payrollDays;
  return {
    cost: round2(mode === "net" ? b / (1 - rate) : b),
    net: round2(mode === "net" ? b : b * (1 - rate)),
  };
}

type Tab = "entries" | "dividends" | "employees" | "annual";

async function api(
  path: string,
  method: string,
  body?: unknown,
): Promise<{ ok: boolean; error?: string; count?: number }> {
  try {
    const r = await fetch(path, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return await r.json();
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export function PayrollManager({
  employees,
  entries,
  dividends,
  annual,
}: {
  employees: Employee[];
  entries: PayrollEntry[];
  dividends: PayrollDividend[];
  annual: PayrollAnnual;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("entries");
  const [msg, setMsg] = useState("");

  function done(m: string) {
    setMsg(m);
    router.refresh();
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "entries", label: `工资条 (${entries.length})` },
    { key: "dividends", label: `分红 (${dividends.length})` },
    { key: "employees", label: `员工主档 (${employees.length})` },
    { key: "annual", label: "年度视图" },
  ];

  return (
    <div>
      <div className="mt-6 flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setMsg("");
              // 切 tab 强制重取服务端数据：保证工资/分红调整后，汇总与年度视图同步最新
              router.refresh();
            }}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === t.key
                ? "bg-indigo-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {msg ? (
        <p className="mt-2 text-xs text-indigo-600">{msg}</p>
      ) : null}

      <div className="mt-4">
        {tab === "entries" && (
          <EntriesTab employees={employees} entries={entries} done={done} />
        )}
        {tab === "dividends" && (
          <DividendsTab
            employees={employees}
            dividends={dividends}
            done={done}
          />
        )}
        {tab === "employees" && (
          <EmployeesTab employees={employees} done={done} />
        )}
        {tab === "annual" && <AnnualTab annual={annual} />}
      </div>
    </div>
  );
}

// ================= 工资条 =================

function EntriesTab({
  employees,
  entries,
  done,
}: {
  employees: Employee[];
  entries: PayrollEntry[];
  done: (m: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [genYm, setGenYm] = useState(currentYm());
  const [editId, setEditId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  async function generate() {
    setBusy(true);
    const r = await api("/api/payroll/entries", "POST", {
      action: "generate",
      yearMonth: genYm,
    });
    setBusy(false);
    done(
      r.ok
        ? `已生成 ${r.count} 条草稿（已存在的自动跳过），请核对考勤`
        : `生成失败：${r.error}`,
    );
  }

  async function markMonthPaid() {
    if (!confirm(`确认把 ${genYm} 月所有未付工资条+分红标记为今日已发？`))
      return;
    setBusy(true);
    const r = await api("/api/payroll/entries", "POST", {
      action: "markMonthPaid",
      yearMonth: genYm,
      paidAt: todayStr(),
    });
    setBusy(false);
    done(r.ok ? `已标记 ${r.count} 条为已发` : `失败：${r.error}`);
  }

  async function del(id: number) {
    if (!confirm("确认删除这条工资条?")) return;
    await api(`/api/payroll/entries?id=${id}`, "DELETE");
    done("已删除");
  }

  async function togglePaid(e: PayrollEntry) {
    const r = await api("/api/payroll/entries", "PATCH", {
      id: e.id,
      paidAt: e.paidAt ? null : todayStr(),
    });
    done(r.ok ? (e.paidAt ? "已改回未发" : "已标记已发") : `失败：${r.error}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/40 p-3">
        <span className="text-xs font-semibold text-indigo-700">快捷操作</span>
        <input
          type="month"
          value={genYm}
          onChange={(e) => setGenYm(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-indigo-500"
        />
        <button onClick={generate} disabled={busy} className={btnLight}>
          ⚡ 一键生成该月工资条草稿
        </button>
        <button onClick={markMonthPaid} disabled={busy} className={btnLight}>
          ✓ 该月全部标已发
        </button>
        <button onClick={() => setShowAdd((v) => !v)} className={btnLight}>
          {showAdd ? "收起新增" : "+ 新增单条"}
        </button>
      </div>

      {showAdd && (
        <AddEntryForm employees={employees} done={done} />
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-2 text-sm font-semibold text-slate-700">
          工资条明细 · 共 {entries.length} 条
        </div>
        {entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            尚无工资条。先到「员工主档」录入员工与默认基数，再用「一键生成」。
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  {[
                    "月份",
                    "员工",
                    "模式",
                    "基数",
                    "考勤/计薪",
                    "税率",
                    "公司成本",
                    "到手",
                    "实付",
                    "备注",
                    "操作",
                  ].map((h, i) => (
                    <th
                      key={h}
                      className={`whitespace-nowrap px-2 py-2 font-semibold ${i >= 3 && i <= 7 ? "text-right" : "text-left"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) =>
                  editId === e.id ? (
                    <EditEntryRow
                      key={e.id}
                      entry={e}
                      onDone={(m) => {
                        setEditId(null);
                        done(m);
                      }}
                      onCancel={() => setEditId(null)}
                    />
                  ) : (
                    <tr
                      key={e.id}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="whitespace-nowrap px-2 py-2">
                        {e.yearMonth}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 font-medium">
                        {e.employeeName}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                            e.payoutMode === "net"
                              ? "bg-sky-50 text-sky-700 ring-sky-200"
                              : "bg-slate-100 text-slate-600 ring-slate-200"
                          }`}
                        >
                          {e.payoutMode === "net" ? "包税" : "税前"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right">
                        {rmb(e.baseSalary, 2)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right text-slate-500">
                        {e.attendanceDays == null
                          ? "满月"
                          : `${e.attendanceDays}/${e.payrollDays}`}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right text-slate-500">
                        {(e.taxRate * 100).toFixed(1)}%
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right">
                        {rmb(e.costRmb, 2)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right font-semibold text-emerald-600">
                        {rmb(e.netRmb, 2)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2">
                        {e.paidAt ? (
                          <span className="text-[11px] text-emerald-600">
                            {e.paidAt}
                          </span>
                        ) : (
                          <span className="inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                            未发
                          </span>
                        )}
                      </td>
                      <td className="max-w-[10rem] truncate px-2 py-2 text-xs text-slate-400">
                        {e.note || "—"}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right text-xs">
                        <button
                          onClick={() => setEditId(e.id)}
                          className="text-indigo-600 hover:underline"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => togglePaid(e)}
                          className="ml-2 text-slate-500 hover:underline"
                        >
                          {e.paidAt ? "改未发" : "标已发"}
                        </button>
                        <button
                          onClick={() => del(e.id)}
                          className="ml-2 text-red-600 hover:underline"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[11px] text-slate-400">
          公司成本口径：税前给付 = 折算税前；包税 = 折算税后 ÷ (1−税率)。税率为内部核算口径，非法定累进个税，不可用于申报。
        </p>
      </div>
    </div>
  );
}

function AddEntryForm({
  employees,
  done,
}: {
  employees: Employee[];
  done: (m: string) => void;
}) {
  const active = employees.filter((e) => e.status === "active");
  const [ym, setYm] = useState(currentYm());
  const [empId, setEmpId] = useState(active[0]?.id ?? 0);
  const emp = active.find((e) => e.id === empId);
  const [base, setBase] = useState("");
  const [days, setDays] = useState("");
  const [payrollDays, setPayrollDays] = useState("21.75");
  const [rate, setRate] = useState("");
  const [mode, setMode] = useState<"" | "gross" | "net">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const effBase = base !== "" ? Number(base) : (emp?.defaultBaseSalary ?? 0);
  const effRate = rate !== "" ? Number(rate) : (emp?.defaultTaxRate ?? 0.08);
  const effMode = mode || emp?.defaultPayoutMode || "gross";
  const preview =
    effBase > 0 && Number(payrollDays) > 0
      ? calcEntry(
          effBase,
          days === "" ? null : Number(days),
          Number(payrollDays),
          effRate,
          effMode,
        )
      : null;

  async function save() {
    if (!empId) return done("请选择员工");
    if (!Number.isFinite(effBase) || effBase <= 0) return done("基数无效");
    setBusy(true);
    const r = await api("/api/payroll/entries", "POST", {
      yearMonth: ym,
      employeeId: empId,
      baseSalary: effBase,
      attendanceDays: days === "" ? null : Number(days),
      payrollDays: Number(payrollDays),
      taxRate: effRate,
      payoutMode: effMode,
      note,
    });
    setBusy(false);
    done(r.ok ? "已新增工资条" : `保存失败：${r.error}`);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-slate-700">新增工资条</div>
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
          员工
          <select
            value={empId}
            onChange={(e) => setEmpId(Number(e.target.value))}
            className={inputCls}
          >
            {active.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          基数（默认取主档）
          <input
            type="number"
            value={base}
            onChange={(e) => setBase(e.target.value)}
            placeholder={String(emp?.defaultBaseSalary ?? 0)}
            className={`${inputCls} w-32`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          考勤天数（空=满月）
          <input
            type="number"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            placeholder="满月"
            className={`${inputCls} w-28`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          计薪天数
          <input
            type="number"
            value={payrollDays}
            onChange={(e) => setPayrollDays(e.target.value)}
            className={`${inputCls} w-24`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          税率（默认取主档）
          <input
            type="number"
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder={String(emp?.defaultTaxRate ?? 0.08)}
            className={`${inputCls} w-24`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          模式
          <select
            value={effMode}
            onChange={(e) => setMode(e.target.value as "gross" | "net")}
            className={inputCls}
          >
            <option value="gross">税前给付</option>
            <option value="net">包税（约定税后）</option>
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs text-slate-500">
          备注
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={`${inputCls} w-full`}
          />
        </label>
        <button onClick={save} disabled={busy} className={btnPrimary}>
          {busy ? "保存中…" : "新增"}
        </button>
      </div>
      {preview && (
        <p className="mt-2 text-xs text-slate-500">
          预览：公司成本 <b>{rmb(preview.cost, 2)}</b> · 员工到手{" "}
          <b className="text-emerald-600">{rmb(preview.net, 2)}</b>
        </p>
      )}
    </div>
  );
}

function EditEntryRow({
  entry,
  onDone,
  onCancel,
}: {
  entry: PayrollEntry;
  onDone: (m: string) => void;
  onCancel: () => void;
}) {
  const [base, setBase] = useState(String(entry.baseSalary));
  const [days, setDays] = useState(
    entry.attendanceDays == null ? "" : String(entry.attendanceDays),
  );
  const [payrollDays, setPayrollDays] = useState(String(entry.payrollDays));
  const [rate, setRate] = useState(String(entry.taxRate));
  const [mode, setMode] = useState(entry.payoutMode);
  const [note, setNote] = useState(entry.note ?? "");
  const [busy, setBusy] = useState(false);

  const preview =
    Number(base) > 0 && Number(payrollDays) > 0
      ? calcEntry(
          Number(base),
          days === "" ? null : Number(days),
          Number(payrollDays),
          Number(rate),
          mode,
        )
      : null;

  async function save() {
    setBusy(true);
    const r = await api("/api/payroll/entries", "PATCH", {
      id: entry.id,
      baseSalary: Number(base),
      attendanceDays: days === "" ? null : Number(days),
      payrollDays: Number(payrollDays),
      taxRate: Number(rate),
      payoutMode: mode,
      note,
    });
    setBusy(false);
    onDone(r.ok ? "已更新" : `更新失败：${r.error}`);
  }

  const cell = "whitespace-nowrap px-2 py-2";
  const mini =
    "w-20 rounded border border-indigo-300 px-1.5 py-1 text-xs outline-none focus:border-indigo-500";
  return (
    <tr className="border-b border-slate-100 bg-indigo-50/40 last:border-0">
      <td className={cell}>{entry.yearMonth}</td>
      <td className={`${cell} font-medium`}>{entry.employeeName}</td>
      <td className={cell}>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as "gross" | "net")}
          className={mini}
        >
          <option value="gross">税前</option>
          <option value="net">包税</option>
        </select>
      </td>
      <td className={`${cell} text-right`}>
        <input
          type="number"
          value={base}
          onChange={(e) => setBase(e.target.value)}
          className={`${mini} text-right`}
        />
      </td>
      <td className={`${cell} text-right`}>
        <input
          type="number"
          value={days}
          onChange={(e) => setDays(e.target.value)}
          placeholder="满月"
          className={`${mini} w-14 text-right`}
        />
        /
        <input
          type="number"
          value={payrollDays}
          onChange={(e) => setPayrollDays(e.target.value)}
          className={`${mini} w-14 text-right`}
        />
      </td>
      <td className={`${cell} text-right`}>
        <input
          type="number"
          step="0.01"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          className={`${mini} w-14 text-right`}
        />
      </td>
      <td className={`${cell} text-right`}>
        {preview ? rmb(preview.cost, 2) : "—"}
      </td>
      <td className={`${cell} text-right font-semibold text-emerald-600`}>
        {preview ? rmb(preview.net, 2) : "—"}
      </td>
      <td className={cell}>
        <span className="text-[11px] text-slate-400">
          {entry.paidAt || "未发"}
        </span>
      </td>
      <td className={cell}>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={`${mini} w-24`}
        />
      </td>
      <td className={`${cell} text-right text-xs`}>
        <button
          onClick={save}
          disabled={busy}
          className="font-semibold text-indigo-600 hover:underline"
        >
          保存
        </button>
        <button
          onClick={onCancel}
          className="ml-2 text-slate-500 hover:underline"
        >
          取消
        </button>
      </td>
    </tr>
  );
}

// ================= 分红 =================

function DividendsTab({
  employees,
  dividends,
  done,
}: {
  employees: Employee[];
  dividends: PayrollDividend[];
  done: (m: string) => void;
}) {
  const [showCalc, setShowCalc] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  async function del(id: number) {
    if (!confirm("确认删除这条分红?")) return;
    await api(`/api/payroll/dividends?id=${id}`, "DELETE");
    done("已删除");
  }

  async function togglePaid(d: PayrollDividend) {
    const r = await api("/api/payroll/dividends", "PATCH", {
      id: d.id,
      paidAt: d.paidAt ? null : todayStr(),
    });
    done(r.ok ? (d.paidAt ? "已改回未发" : "已标记已发") : `失败：${r.error}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-amber-300 bg-amber-50/40 p-3">
        <span className="text-xs font-semibold text-amber-700">快捷操作</span>
        <button onClick={() => setShowCalc((v) => !v)} className={btnLight}>
          🧮 {showCalc ? "收起分红计算器" : "打开分红计算器"}
        </button>
        <button onClick={() => setShowAdd((v) => !v)} className={btnLight}>
          {showAdd ? "收起新增" : "+ 新增单条"}
        </button>
        <span className="ml-auto text-[11px] text-slate-500">
          分红是税后利润分配：只进现金口径，不减合同/权责利润
        </span>
      </div>

      {showCalc && (
        <DividendCalculator
          employees={employees}
          done={(m) => {
            setShowCalc(false);
            done(m);
          }}
        />
      )}
      {showAdd && <AddDividendForm employees={employees} done={done} />}

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-2 text-sm font-semibold text-slate-700">
          分红明细 · 共 {dividends.length} 条
        </div>
        {dividends.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            尚无分红明细。可用「分红计算器」按项目一键生成。
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  {[
                    "月份",
                    "员工",
                    "项目",
                    "公式",
                    "税前",
                    "税率",
                    "到手",
                    "实付",
                    "操作",
                  ].map((h, i) => (
                    <th
                      key={h}
                      className={`whitespace-nowrap px-2 py-2 font-semibold ${i >= 4 && i <= 6 ? "text-right" : "text-left"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dividends.map((d) =>
                  editId === d.id ? (
                    <EditDividendRow
                      key={d.id}
                      dividend={d}
                      onDone={(m) => {
                        setEditId(null);
                        done(m);
                      }}
                      onCancel={() => setEditId(null)}
                    />
                  ) : (
                    <tr
                      key={d.id}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="whitespace-nowrap px-2 py-2">
                        {d.yearMonth}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 font-medium">
                        {d.employeeName}
                      </td>
                      <td className="max-w-[12rem] truncate px-2 py-2">
                        {d.projectName || "—"}
                      </td>
                      <td className="max-w-[10rem] truncate px-2 py-2 font-mono text-xs text-slate-500">
                        {d.formula || "—"}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right">
                        {rmb(d.amountPreTax, 2)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right text-slate-500">
                        {(d.taxRate * 100).toFixed(1)}%
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right font-semibold text-emerald-600">
                        {rmb(d.netRmb, 2)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2">
                        {d.paidAt ? (
                          <span className="text-[11px] text-emerald-600">
                            {d.paidAt}
                          </span>
                        ) : (
                          <span className="inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                            未发
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right text-xs">
                        <button
                          onClick={() => setEditId(d.id)}
                          className="text-indigo-600 hover:underline"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => togglePaid(d)}
                          className="ml-2 text-slate-500 hover:underline"
                        >
                          {d.paidAt ? "改未发" : "标已发"}
                        </button>
                        <button
                          onClick={() => del(d.id)}
                          className="ml-2 text-red-600 hover:underline"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AddDividendForm({
  employees,
  done,
}: {
  employees: Employee[];
  done: (m: string) => void;
}) {
  const active = employees.filter((e) => e.status === "active");
  const [ym, setYm] = useState(currentYm());
  const [empId, setEmpId] = useState(active[0]?.id ?? 0);
  const [project, setProject] = useState("");
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("0.08");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const net =
    Number(amount) > 0 ? round2(Number(amount) * (1 - Number(rate))) : null;

  async function save() {
    const amt = Number(amount);
    if (!empId) return done("请选择员工");
    if (!Number.isFinite(amt) || amt <= 0) return done("税前金额无效");
    setBusy(true);
    const r = await api("/api/payroll/dividends", "POST", {
      yearMonth: ym,
      employeeId: empId,
      projectName: project,
      amountPreTax: amt,
      taxRate: Number(rate),
      note,
    });
    setBusy(false);
    done(r.ok ? "已新增分红" : `保存失败：${r.error}`);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-slate-700">新增分红</div>
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
          员工
          <select
            value={empId}
            onChange={(e) => setEmpId(Number(e.target.value))}
            className={inputCls}
          >
            {active.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          项目/来源
          <input
            type="text"
            value={project}
            onChange={(e) => setProject(e.target.value)}
            placeholder="如：灵眸 AI · 8月分成"
            className={`${inputCls} w-44`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          税前金额
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className={`${inputCls} w-32`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          税率
          <input
            type="number"
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className={`${inputCls} w-24`}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs text-slate-500">
          备注
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={`${inputCls} w-full`}
          />
        </label>
        <button onClick={save} disabled={busy} className={btnPrimary}>
          {busy ? "保存中…" : "新增"}
        </button>
      </div>
      {net != null && (
        <p className="mt-2 text-xs text-slate-500">
          预览：到手 <b className="text-emerald-600">{rmb(net, 2)}</b>
        </p>
      )}
    </div>
  );
}

function EditDividendRow({
  dividend,
  onDone,
  onCancel,
}: {
  dividend: PayrollDividend;
  onDone: (m: string) => void;
  onCancel: () => void;
}) {
  const [project, setProject] = useState(dividend.projectName ?? "");
  const [amount, setAmount] = useState(String(dividend.amountPreTax));
  const [rate, setRate] = useState(String(dividend.taxRate));
  const [formula, setFormula] = useState(dividend.formula ?? "");
  const [busy, setBusy] = useState(false);

  const net =
    Number(amount) > 0 ? round2(Number(amount) * (1 - Number(rate))) : null;

  async function save() {
    setBusy(true);
    const r = await api("/api/payroll/dividends", "PATCH", {
      id: dividend.id,
      projectName: project,
      amountPreTax: Number(amount),
      taxRate: Number(rate),
      formula,
    });
    setBusy(false);
    onDone(r.ok ? "已更新" : `更新失败：${r.error}`);
  }

  const cell = "whitespace-nowrap px-2 py-2";
  const mini =
    "rounded border border-indigo-300 px-1.5 py-1 text-xs outline-none focus:border-indigo-500";
  return (
    <tr className="border-b border-slate-100 bg-indigo-50/40 last:border-0">
      <td className={cell}>{dividend.yearMonth}</td>
      <td className={`${cell} font-medium`}>{dividend.employeeName}</td>
      <td className={cell}>
        <input
          type="text"
          value={project}
          onChange={(e) => setProject(e.target.value)}
          className={`${mini} w-32`}
        />
      </td>
      <td className={cell}>
        <input
          type="text"
          value={formula}
          onChange={(e) => setFormula(e.target.value)}
          className={`${mini} w-28 font-mono`}
        />
      </td>
      <td className={`${cell} text-right`}>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={`${mini} w-24 text-right`}
        />
      </td>
      <td className={`${cell} text-right`}>
        <input
          type="number"
          step="0.01"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          className={`${mini} w-14 text-right`}
        />
      </td>
      <td className={`${cell} text-right font-semibold text-emerald-600`}>
        {net != null ? rmb(net, 2) : "—"}
      </td>
      <td className={cell}>
        <span className="text-[11px] text-slate-400">
          {dividend.paidAt || "未发"}
        </span>
      </td>
      <td className={`${cell} text-right text-xs`}>
        <button
          onClick={save}
          disabled={busy}
          className="font-semibold text-indigo-600 hover:underline"
        >
          保存
        </button>
        <button
          onClick={onCancel}
          className="ml-2 text-slate-500 hover:underline"
        >
          取消
        </button>
      </td>
    </tr>
  );
}

interface CalcRow {
  employeeId: number;
  shareRatio: string;
  baseShare: string;
  taxRate: string; // 行内明示税率；空/0 = 该行不扣税
}

function DividendCalculator({
  employees,
  done,
}: {
  employees: Employee[];
  done: (m: string) => void;
}) {
  const active = employees.filter((e) => e.status === "active");
  const [ym, setYm] = useState(currentYm());
  const [project, setProject] = useState("");
  const [amount, setAmount] = useState("");
  const [poolRatio, setPoolRatio] = useState("0.6");
  // 行内税率预填员工主档默认（看得见、可改、可清零），提交按行内明示值
  const newRow = (empId?: number): CalcRow => {
    const emp = active.find((e) => e.id === empId) ?? active[0];
    return {
      employeeId: emp?.id ?? 0,
      shareRatio: "",
      baseShare: "",
      taxRate: emp ? String(emp.defaultTaxRate) : "0",
    };
  };
  const [rows, setRows] = useState<CalcRow[]>(() =>
    active.slice(0, 1).map((e) => newRow(e.id)),
  );
  const [busy, setBusy] = useState(false);

  const pool = Number(amount) > 0 ? Number(amount) * Number(poolRatio) : 0;

  // 税点只按行内明示的值计一次（空/0 = 不扣税）；总额层不计税
  const preview = rows.map((r) => {
    const emp = active.find((e) => e.id === r.employeeId);
    const share = Number(r.shareRatio) || 0;
    const base = Number(r.baseShare) || 0;
    const preTax = round2(pool * share + base);
    const rate = Number(r.taxRate) || 0;
    return {
      ...r,
      name: emp?.name ?? "?",
      rate,
      preTax,
      net: round2(preTax * (1 - rate)),
    };
  });
  const validCount = preview.filter((p) => p.preTax > 0).length;

  async function generate() {
    if (!project.trim()) return done("请填写项目名");
    if (validCount === 0) return done("没有有效参与人（税前金额都为 0）");
    setBusy(true);
    const r = await api("/api/payroll/dividends", "POST", {
      action: "generateFromProject",
      yearMonth: ym,
      projectName: project,
      projectAmount: Number(amount),
      poolRatio: Number(poolRatio),
      participants: rows.map((row) => ({
        employeeId: row.employeeId,
        shareRatio: Number(row.shareRatio) || 0,
        baseShare: Number(row.baseShare) || 0,
        taxRate: Number(row.taxRate) || 0,
      })),
    });
    setBusy(false);
    done(r.ok ? `已生成 ${r.count} 条分红明细` : `生成失败：${r.error}`);
  }

  function setRow(i: number, patch: Partial<CalcRow>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm">
      <div className="text-sm font-semibold text-slate-700">
        分红计算器 · 项目额 → 提成池 → 分成
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          月份
          <input
            type="month"
            value={ym}
            onChange={(e) => setYm(e.target.value)}
            className={`${inputCls} bg-white`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          项目名
          <input
            type="text"
            value={project}
            onChange={(e) => setProject(e.target.value)}
            placeholder="如：灵眸 AI · 8月分成"
            className={`${inputCls} w-44 bg-white`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          项目额（元）
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="350000"
            className={`${inputCls} w-32 bg-white`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          提成池比例
          <input
            type="number"
            step="0.05"
            value={poolRatio}
            onChange={(e) => setPoolRatio(e.target.value)}
            className={`${inputCls} w-24 bg-white`}
          />
        </label>
        <div className="pb-2 text-xs text-slate-600">
          提成池 = <b>{rmb(pool, 2)}</b>
          <span className="ml-2 text-slate-400">
            税点在每人行内单独计，总额不重复计税
          </span>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg bg-white p-3">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-500">
              <th className="px-2 py-1.5 text-left font-semibold">员工</th>
              <th className="px-2 py-1.5 text-right font-semibold">
                分成比例
              </th>
              <th className="px-2 py-1.5 text-right font-semibold">基础分</th>
              <th className="px-2 py-1.5 text-right font-semibold">
                = 税前分红
              </th>
              <th className="px-2 py-1.5 text-right font-semibold">税率</th>
              <th className="px-2 py-1.5 text-right font-semibold">到手</th>
              <th className="px-2 py-1.5 text-right font-semibold">操作</th>
            </tr>
          </thead>
          <tbody>
            {preview.map((p, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0">
                <td className="px-2 py-1.5">
                  <select
                    value={p.employeeId}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      const emp = active.find((x) => x.id === id);
                      // 换人时税率跟着换成该员工主档值（仍显式可改）
                      setRow(i, {
                        employeeId: id,
                        taxRate: emp ? String(emp.defaultTaxRate) : "0",
                      });
                    }}
                    className="rounded border border-slate-300 px-1.5 py-1 text-xs outline-none focus:border-indigo-500"
                  >
                    {active.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1.5 text-right">
                  <input
                    type="number"
                    step="0.05"
                    value={p.shareRatio}
                    onChange={(e) => setRow(i, { shareRatio: e.target.value })}
                    placeholder="0"
                    className="w-20 rounded border border-slate-300 px-1.5 py-1 text-right text-xs outline-none focus:border-indigo-500"
                  />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <input
                    type="number"
                    value={p.baseShare}
                    onChange={(e) => setRow(i, { baseShare: e.target.value })}
                    placeholder="0"
                    className="w-24 rounded border border-slate-300 px-1.5 py-1 text-right text-xs outline-none focus:border-indigo-500"
                  />
                </td>
                <td className="px-2 py-1.5 text-right font-semibold">
                  {rmb(p.preTax, 2)}
                </td>
                <td className="px-2 py-1.5 text-right">
                  <input
                    type="number"
                    step="0.01"
                    value={p.taxRate}
                    onChange={(e) => setRow(i, { taxRate: e.target.value })}
                    placeholder="0"
                    className="w-16 rounded border border-slate-300 px-1.5 py-1 text-right text-xs outline-none focus:border-indigo-500"
                  />
                </td>
                <td className="px-2 py-1.5 text-right text-emerald-600">
                  {rmb(p.net, 2)}
                </td>
                <td className="px-2 py-1.5 text-right">
                  <button
                    onClick={() =>
                      setRows((rs) => rs.filter((_, j) => j !== i))
                    }
                    className="text-xs text-red-600 hover:underline"
                  >
                    移除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() => setRows((rs) => [...rs, newRow()])}
          className={btnLight}
        >
          + 添加参与人
        </button>
        <button
          onClick={generate}
          disabled={busy || validCount === 0}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "生成中…" : `✓ 一键生成 ${validCount} 条分红明细`}
        </button>
        <span className="text-[11px] text-slate-500">
          每人税前 = 提成池 × 分成比例 + 基础分；税点只按每行填写的值计（0 = 不扣税）；公式自动写入明细
        </span>
      </div>
    </div>
  );
}

// ================= 员工主档 =================

function EmployeesTab({
  employees,
  done,
}: {
  employees: Employee[];
  done: (m: string) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  async function del(id: number) {
    if (!confirm("确认删除该员工?（有工资条/分红记录时会被拒绝）")) return;
    const r = await api(`/api/employees?id=${id}`, "DELETE");
    done(r.ok ? "已删除" : `${r.error}`);
  }

  async function toggleStatus(e: Employee) {
    const r = await api("/api/employees", "PATCH", {
      id: e.id,
      status: e.status === "active" ? "left" : "active",
      leftAt: e.status === "active" ? todayStr() : null,
    });
    done(r.ok ? (e.status === "active" ? "已标记离职" : "已恢复在职") : `失败：${r.error}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">
          调薪只需改「默认基数」；历史工资条存快照不受影响，下次一键生成用新值。
        </p>
        <button onClick={() => setShowAdd((v) => !v)} className={btnLight}>
          {showAdd ? "收起" : "+ 新增员工"}
        </button>
      </div>

      {showAdd && <AddEmployeeForm done={done} />}

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-2 text-sm font-semibold text-slate-700">
          在职 {employees.filter((e) => e.status === "active").length} · 离职{" "}
          {employees.filter((e) => e.status === "left").length}
        </div>
        {employees.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            尚无员工，请先新增。
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  {[
                    "姓名",
                    "角色",
                    "默认基数",
                    "默认税率",
                    "模式",
                    "状态",
                    "入职",
                    "备注",
                    "操作",
                  ].map((h, i) => (
                    <th
                      key={h}
                      className={`whitespace-nowrap px-2 py-2 font-semibold ${i === 2 || i === 3 ? "text-right" : "text-left"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((e) =>
                  editId === e.id ? (
                    <EditEmployeeRow
                      key={e.id}
                      emp={e}
                      onDone={(m) => {
                        setEditId(null);
                        done(m);
                      }}
                      onCancel={() => setEditId(null)}
                    />
                  ) : (
                    <tr
                      key={e.id}
                      className={`border-b border-slate-100 last:border-0 ${e.status === "left" ? "opacity-50" : ""}`}
                    >
                      <td className="whitespace-nowrap px-2 py-2 font-medium">
                        {e.name}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-slate-500">
                        {e.role || "—"}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right">
                        {e.defaultBaseSalary
                          ? rmb(e.defaultBaseSalary, 2)
                          : "—（仅分红）"}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right text-slate-500">
                        {(e.defaultTaxRate * 100).toFixed(1)}%
                      </td>
                      <td className="whitespace-nowrap px-2 py-2">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                            e.defaultPayoutMode === "net"
                              ? "bg-sky-50 text-sky-700 ring-sky-200"
                              : "bg-slate-100 text-slate-600 ring-slate-200"
                          }`}
                        >
                          {e.defaultPayoutMode === "net" ? "包税" : "税前"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                            e.status === "active"
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                              : "bg-slate-100 text-slate-500 ring-slate-200"
                          }`}
                        >
                          {e.status === "active" ? "在职" : "离职"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-slate-500">
                        {e.joinedAt || "—"}
                      </td>
                      <td className="max-w-[10rem] truncate px-2 py-2 text-xs text-slate-400">
                        {e.note || "—"}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right text-xs">
                        <button
                          onClick={() => setEditId(e.id)}
                          className="text-indigo-600 hover:underline"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => toggleStatus(e)}
                          className="ml-2 text-slate-500 hover:underline"
                        >
                          {e.status === "active" ? "标记离职" : "恢复在职"}
                        </button>
                        <button
                          onClick={() => del(e.id)}
                          className="ml-2 text-red-600 hover:underline"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AddEmployeeForm({ done }: { done: (m: string) => void }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [base, setBase] = useState("");
  const [rate, setRate] = useState("0.08");
  const [mode, setMode] = useState<"gross" | "net">("gross");
  const [joined, setJoined] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) return done("姓名不能为空");
    setBusy(true);
    const r = await api("/api/employees", "POST", {
      name,
      role,
      defaultBaseSalary: base === "" ? null : Number(base),
      defaultTaxRate: Number(rate),
      defaultPayoutMode: mode,
      joinedAt: joined || undefined,
      note,
    });
    setBusy(false);
    done(r.ok ? `已新增员工「${name}」` : `保存失败：${r.error}`);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-slate-700">新增员工</div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          姓名
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${inputCls} w-28`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          角色
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="如：合伙人"
            className={`${inputCls} w-28`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          默认月薪基数（空=仅分红）
          <input
            type="number"
            value={base}
            onChange={(e) => setBase(e.target.value)}
            placeholder="仅分红"
            className={`${inputCls} w-36`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          默认税率
          <input
            type="number"
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className={`${inputCls} w-24`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          发放模式
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "gross" | "net")}
            className={inputCls}
          >
            <option value="gross">税前给付</option>
            <option value="net">包税（约定税后）</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          入职日期
          <input
            type="date"
            value={joined}
            onChange={(e) => setJoined(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs text-slate-500">
          备注
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={`${inputCls} w-full`}
          />
        </label>
        <button onClick={save} disabled={busy} className={btnPrimary}>
          {busy ? "保存中…" : "新增"}
        </button>
      </div>
    </div>
  );
}

function EditEmployeeRow({
  emp,
  onDone,
  onCancel,
}: {
  emp: Employee;
  onDone: (m: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(emp.name);
  const [role, setRole] = useState(emp.role ?? "");
  const [base, setBase] = useState(
    emp.defaultBaseSalary == null ? "" : String(emp.defaultBaseSalary),
  );
  const [rate, setRate] = useState(String(emp.defaultTaxRate));
  const [mode, setMode] = useState(emp.defaultPayoutMode);
  const [note, setNote] = useState(emp.note ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const r = await api("/api/employees", "PATCH", {
      id: emp.id,
      name,
      role,
      defaultBaseSalary: base === "" ? null : Number(base),
      defaultTaxRate: Number(rate),
      defaultPayoutMode: mode,
      note,
    });
    setBusy(false);
    onDone(r.ok ? "已更新" : `更新失败：${r.error}`);
  }

  const cell = "whitespace-nowrap px-2 py-2";
  const mini =
    "rounded border border-indigo-300 px-1.5 py-1 text-xs outline-none focus:border-indigo-500";
  return (
    <tr className="border-b border-slate-100 bg-indigo-50/40 last:border-0">
      <td className={cell}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`${mini} w-20`}
        />
      </td>
      <td className={cell}>
        <input
          type="text"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className={`${mini} w-20`}
        />
      </td>
      <td className={`${cell} text-right`}>
        <input
          type="number"
          value={base}
          onChange={(e) => setBase(e.target.value)}
          placeholder="仅分红"
          className={`${mini} w-24 text-right`}
        />
      </td>
      <td className={`${cell} text-right`}>
        <input
          type="number"
          step="0.01"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          className={`${mini} w-16 text-right`}
        />
      </td>
      <td className={cell}>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as "gross" | "net")}
          className={mini}
        >
          <option value="gross">税前</option>
          <option value="net">包税</option>
        </select>
      </td>
      <td className={cell}>
        <span className="text-[11px] text-slate-400">
          {emp.status === "active" ? "在职" : "离职"}
        </span>
      </td>
      <td className={cell}>
        <span className="text-[11px] text-slate-400">{emp.joinedAt || "—"}</span>
      </td>
      <td className={cell}>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={`${mini} w-24`}
        />
      </td>
      <td className={`${cell} text-right text-xs`}>
        <button
          onClick={save}
          disabled={busy}
          className="font-semibold text-indigo-600 hover:underline"
        >
          保存
        </button>
        <button
          onClick={onCancel}
          className="ml-2 text-slate-500 hover:underline"
        >
          取消
        </button>
      </td>
    </tr>
  );
}

// ================= 年度视图 =================
// 数据由服务端 buildPayrollAnnual 与工资条/分红同批派生（annual prop），
// 本组件纯展示——前置数据更新 → router.refresh → props 变 → 必然同步。

function AnnualTab({ annual }: { annual: PayrollAnnual }) {
  const fallbackYear = String(new Date().getFullYear());
  const [picked, setPicked] = useState<string | null>(null);
  // 不把年份锁进 state：默认永远跟随最新数据的第一年，仅当用户手选且仍有效时保留
  const year =
    picked && annual.years.includes(picked)
      ? picked
      : (annual.years[0] ?? fallbackYear);
  const yearMap = annual.matrix[year] ?? {};
  const names = Object.keys(yearMap).sort();

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <div className="text-sm font-semibold text-slate-700">
          年度视图 · 每人每月税后到手（工资 + 分红）
        </div>
        <select
          value={year}
          onChange={(e) => setPicked(e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1 text-xs outline-none focus:border-indigo-500"
        >
          {(annual.years.length ? annual.years : [year]).map((y) => (
            <option key={y} value={y}>
              {y} 年
            </option>
          ))}
        </select>
      </div>
      {names.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          {year} 年尚无数据。
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500">
                <th className="whitespace-nowrap px-2 py-2 text-left font-semibold">
                  员工
                </th>
                {Array.from({ length: 12 }, (_, i) => (
                  <th
                    key={i}
                    className="whitespace-nowrap px-2 py-2 text-right font-semibold"
                  >
                    {i + 1}月
                  </th>
                ))}
                <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">
                  全年合计
                </th>
              </tr>
            </thead>
            <tbody>
              {names.map((n) => (
                <tr key={n} className="border-b border-slate-100 last:border-0">
                  <td className="whitespace-nowrap px-2 py-2 font-medium">
                    {n}
                  </td>
                  {yearMap[n].map((net, i) => (
                    <td
                      key={i}
                      className="whitespace-nowrap px-2 py-2 text-right text-xs"
                    >
                      {net > 0 ? rmb(net) : "—"}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-2 py-2 text-right font-semibold text-emerald-600">
                    {rmb(annual.totals[year]?.[n] ?? 0, 2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
