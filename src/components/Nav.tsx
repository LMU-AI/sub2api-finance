"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type SVGProps } from "react";

const svg: SVGProps<SVGSVGElement> = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function IconOverview() {
  return (
    <svg {...svg}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}
function IconConsumption() {
  return (
    <svg {...svg}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
function IconSubscription() {
  return (
    <svg {...svg}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
      <line x1="6" y1="15" x2="10" y2="15" />
    </svg>
  );
}
function IconRevenue() {
  return (
    <svg {...svg}>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg {...svg}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function IconCost() {
  return (
    <svg {...svg}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}
function IconTransfer() {
  return (
    <svg {...svg}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <line x1="6" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="18" y2="12" />
    </svg>
  );
}
function IconBank() {
  return (
    <svg {...svg}>
      <path d="M3 21h18" />
      <path d="M3 10h18" />
      <path d="M5 10v11M19 10v11M9 10v11M15 10v11" />
      <path d="M12 3 3 8h18l-9-5Z" />
    </svg>
  );
}
function IconPayroll() {
  return (
    <svg {...svg}>
      <path d="M20 7H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <circle cx="12" cy="13" r="2.5" />
    </svg>
  );
}

const LINKS = [
  { href: "/", label: "经营总览", Icon: IconOverview },
  { href: "/consumption", label: "消耗与毛利", Icon: IconConsumption },
  { href: "/subscriptions", label: "订阅专项", Icon: IconSubscription },
  { href: "/revenue", label: "收入分析", Icon: IconRevenue },
  { href: "/manual-revenue", label: "对公转账", Icon: IconTransfer },
  { href: "/users", label: "用户分析", Icon: IconUsers },
  { href: "/costs", label: "成本录入", Icon: IconCost },
  { href: "/payroll", label: "薪资/工资条", Icon: IconPayroll },
  { href: "/bank", label: "银行流水成本", Icon: IconBank },
];

export function Nav({ generatedAt }: { generatedAt: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setBusy(true);
    try {
      const r = await fetch("/api/refresh", { method: "POST" });
      const j = await r.json();
      if (!j.ok) alert("刷新失败:" + (j.error || "未知错误"));
    } catch (e) {
      alert("刷新失败:" + String(e));
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <aside className="sticky top-0 flex h-dvh w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2.5 border-b border-slate-200 px-5 py-4">
        <span className="flex size-9 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
          灵
        </span>
        <div>
          <div className="text-sm font-bold text-slate-800">灵眸 AI</div>
          <div className="text-[11px] text-slate-400">财务管理系统</div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {LINKS.map((l) => {
          const active =
            l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span className={active ? "text-white" : "text-slate-400"}>
                <l.Icon />
              </span>
              {l.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-slate-200 p-3">
        <div className="px-1 text-[11px] leading-tight text-slate-400">
          数据更新于
          <br />
          {generatedAt
            ? new Date(generatedAt).toLocaleString("zh-CN", {
                timeZone: "Asia/Shanghai",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "尚无"}
        </div>
        <button
          onClick={refresh}
          disabled={busy}
          className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "刷新中…" : "刷新数据"}
        </button>
        <button
          onClick={logout}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
        >
          退出登录
        </button>
      </div>
    </aside>
  );
}
