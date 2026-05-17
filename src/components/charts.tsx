"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Stripe 配色
const C = {
  blue: "#517bdf",
  green: "#2f8f5b",
  peach: "#e0a368",
  loss: "#c8324b",
  grid: "#e3e8ee",
  axis: "#8792a2",
};
const DONUT_COLORS = ["#517bdf", "#2f8f5b", "#e0a368", "#8b9cec", "#5ba8c4"];

const fmtK = (v: number) =>
  Math.abs(v) >= 1000 ? (v / 1000).toFixed(0) + "k" : String(v);
const fmtFull = (v: number) =>
  v.toLocaleString("zh-CN", { maximumFractionDigits: 0 });

const AXIS = { fontSize: 11, fill: C.axis };
const tooltipStyle = {
  borderRadius: 13,
  border: "1px solid " + C.grid,
  fontSize: 12,
};

/** 月度趋势:收款/成本柱 + 利润折线 */
export function MonthlyTrend({
  data,
}: {
  data: { month: string; 收款: number; 成本: number; 利润: number }[];
}) {
  return (
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="month" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis
            tick={AXIS}
            axisLine={false}
            tickLine={false}
            tickFormatter={fmtK}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v) => "¥" + fmtFull(Number(v) || 0)}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="收款" fill={C.blue} radius={[6, 6, 0, 0]} barSize={26} />
          <Bar dataKey="成本" fill={C.peach} radius={[6, 6, 0, 0]} barSize={26} />
          <Line
            dataKey="利润"
            stroke={C.green}
            strokeWidth={3}
            dot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Donut({
  data,
  unit = "¥",
}: {
  data: { name: string; value: number }[];
  unit?: string;
}) {
  return (
    <div style={{ width: "100%", height: 270 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={56}
            outerRadius={84}
            paddingAngle={2}
            label={(e: { percent?: number }) =>
              `${((e.percent ?? 0) * 100).toFixed(1)}%`
            }
            labelLine={false}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v) => unit + fmtFull(Number(v) || 0)}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/** 单序列柱状图，可按阈值上色 */
export function ThresholdBars({
  data,
  threshold,
  height = 280,
  unit = "",
}: {
  data: { label: string; value: number }[];
  threshold?: number;
  height?: number;
  unit?: string;
}) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 10, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis
            tick={AXIS}
            axisLine={false}
            tickLine={false}
            tickFormatter={fmtK}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v) => unit + fmtFull(Number(v) || 0)}
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={
                  threshold !== undefined && d.value < threshold
                    ? C.loss
                    : C.blue
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** 双序列对比柱状图 */
export function GroupedBars({
  data,
  keyA,
  keyB,
  colorA = C.peach,
  colorB = C.blue,
  height = 320,
  unit = "$",
}: {
  data: Record<string, string | number>[];
  keyA: string;
  keyB: string;
  colorA?: string;
  colorB?: string;
  height?: number;
  unit?: string;
}) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 10, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: C.axis }}
            axisLine={false}
            tickLine={false}
            interval={0}
            angle={-12}
            textAnchor="end"
            height={56}
          />
          <YAxis
            tick={AXIS}
            axisLine={false}
            tickLine={false}
            tickFormatter={fmtK}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v) => unit + fmtFull(Number(v) || 0)}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey={keyA} fill={colorA} radius={[6, 6, 0, 0]} />
          <Bar dataKey={keyB} fill={colorB} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** 日趋势折线（多序列） */
export function DailyLines({
  data,
  series,
}: {
  data: Record<string, string | number>[];
  series: { key: string; color: string }[];
}) {
  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="day" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis
            tick={AXIS}
            axisLine={false}
            tickLine={false}
            tickFormatter={fmtK}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v) => "¥" + fmtFull(Number(v) || 0)}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((s) => (
            <Line
              key={s.key}
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
