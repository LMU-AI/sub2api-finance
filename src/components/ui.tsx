import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  hint,
}: {
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="mt-8 mb-3 flex items-baseline gap-3">
      <h2 className="border-l-4 border-indigo-600 pl-2.5 text-base font-bold text-slate-800">
        {children}
      </h2>
      {hint ? <span className="text-xs text-slate-400">{hint}</span> : null}
    </div>
  );
}

const ACCENT: Record<string, string> = {
  indigo: "border-t-indigo-500",
  emerald: "border-t-emerald-500",
  red: "border-t-red-500",
  amber: "border-t-amber-500",
  sky: "border-t-sky-500",
  slate: "border-t-slate-400",
};

export function Kpi({
  label,
  value,
  sub,
  accent = "indigo",
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: keyof typeof ACCENT;
  tone?: "pos" | "neg";
}) {
  const valColor =
    tone === "pos"
      ? "text-emerald-600"
      : tone === "neg"
        ? "text-red-600"
        : "text-slate-900";
  return (
    <div
      className={`rounded-xl border border-slate-200 border-t-[3px] ${ACCENT[accent]} bg-white p-4 shadow-sm`}
    >
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1.5 text-2xl font-bold ${valColor}`}>{value}</div>
      {sub ? <div className="mt-1 text-[11px] text-slate-400">{sub}</div> : null}
    </div>
  );
}

const BADGE: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
};

export function Badge({
  children,
  color = "slate",
}: {
  children: ReactNode;
  color?: keyof typeof BADGE;
}) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${BADGE[color]}`}
    >
      {children}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

export function Table({
  head,
  children,
}: {
  head: ReactNode[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs text-slate-500">
            {head.map((h, i) => (
              <th
                key={i}
                className={`whitespace-nowrap px-3 py-2 font-semibold ${
                  i === 0 ? "text-left" : "text-right"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
