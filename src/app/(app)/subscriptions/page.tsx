import { loadData } from "@/lib/load";
import { Card, Empty, Kpi, SectionTitle, Table, Badge } from "@/components/ui";
import { GroupedBars } from "@/components/charts";
import { rmb, usd, num, pct, ratio } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SubscriptionsPage() {
  const { snap, metrics } = await loadData();
  if (!snap || !metrics) {
    return <Empty>尚无数据，请先在右上角刷新。</Empty>;
  }

  const sub = snap.subscriptions;
  const active = sub.statusCounts.find((s) => s.status === "active")?.cnt ?? 0;
  const expired = sub.statusCounts.find((s) => s.status === "expired")?.cnt ?? 0;

  const plans = [...metrics.subscriptions].sort((a, b) => a.price - b.price);
  const chartData = plans
    .filter((p) => p.breakevenUsd != null && p.monthlyLimit > 0)
    .map((p) => ({
      label: `${p.bucket === "claude" ? "Claude" : p.bucket === "gpt" ? "GPT" : "国产"}¥${p.price}`,
      盈亏平衡: Math.round(p.breakevenUsd!),
      当前人均: Math.round(p.avgMoUsed),
    }));

  const heavy = sub.heavyUsers;

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800">订阅专项</h1>
      <p className="mt-1 text-xs text-slate-400">
        套餐盈亏平衡、配额使用率、递延收入与重度用户预警
      </p>

      <div className="mt-4 rounded-xl border-l-4 border-amber-400 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="font-semibold">
          会计原则:订阅负债按「实付人民币」算，不按「美元额度」算
        </div>
        <p className="mt-1 text-[13px] leading-relaxed">
          一张 ¥1,099 的套餐给用户 $2,650 额度。未消耗时财务负债 = ¥1,099(实付、最多退款额)，
          <b>不是 $2,650</b>。美元额度只是「服务上限 / 或有成本敞口」——用户每用 $1，我们付约
          {metrics.unit.blendedCostPerDollar != null
            ? ` ¥${ratio(metrics.unit.blendedCostPerDollar)}`
            : " ¥1+"}{" "}
          成本。
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="订阅净售" value={rmb(sub.revenue.netSold)} accent="indigo" />
        <Kpi
          label="已实现收入"
          value={rmb(sub.revenue.recognized)}
          accent="emerald"
          sub="按时间分摊"
        />
        <Kpi
          label="递延收入(负债)"
          value={rmb(sub.revenue.deferred)}
          accent="amber"
          sub="服务未交付完"
        />
        <Kpi label="活跃订阅" value={num(active)} accent="sky" />
        <Kpi label="已过期" value={num(expired)} accent="slate" />
      </div>

      <SectionTitle hint="琥珀=盈亏平衡消耗，靛蓝=活跃用户人均当前消耗；靛蓝越接近琥珀越危险">
        各套餐盈亏平衡 vs 当前消耗
      </SectionTitle>
      <Card>
        {chartData.length > 0 ? (
          <GroupedBars
            data={chartData}
            keyA="盈亏平衡"
            keyB="当前人均"
            unit="$"
          />
        ) : (
          <p className="py-8 text-center text-sm text-slate-400">
            录入 Claude / GPT 上游成本后，这里显示各套餐盈亏平衡点。
          </p>
        )}
      </Card>

      <SectionTitle hint="平衡点 = 卡价 ÷ 平台单位成本；占额度越低越脆弱">
        套餐盈亏平衡表
      </SectionTitle>
      <Card>
        <Table
          head={[
            "套餐",
            "卡价",
            "月额度",
            "平衡点",
            "平衡点占额度",
            "活跃卡",
            "人均已耗",
            "状态",
          ]}
        >
          {plans.map((p) => (
            <tr
              key={p.planId}
              className={`border-b border-slate-100 last:border-0 ${
                p.status === "danger" ? "bg-red-50" : ""
              }`}
            >
              <td className="min-w-[180px] px-3 py-2 text-left font-medium text-slate-700">
                {p.name}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right">
                {rmb(p.price)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right text-slate-500">
                {usd(p.monthlyLimit)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right">
                {p.breakevenUsd != null ? usd(p.breakevenUsd) : "—"}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right">
                {p.breakevenPctQuota != null ? pct(p.breakevenPctQuota, 0) : "—"}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right">
                {num(p.activeCnt)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right">
                {usd(p.avgMoUsed)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right">
                {p.status === "danger" ? (
                  <Badge color="red">危险</Badge>
                ) : p.status === "tight" ? (
                  <Badge color="amber">偏紧</Badge>
                ) : p.status === "safe" ? (
                  <Badge color="green">安全</Badge>
                ) : (
                  <Badge color="slate">待录成本</Badge>
                )}
              </td>
            </tr>
          ))}
        </Table>
        <p className="mt-2 text-xs text-slate-400">
          状态:人均已耗 ≥ 平衡点为「危险」，≥ 平衡点 60% 为「偏紧」。当前消耗为本月窗口数，月底前仍会上涨。
        </p>
      </Card>

      <SectionTitle hint="本月窗口消耗最高的活跃订阅用户">
        重度订阅用户预警（Top 25）
      </SectionTitle>
      <Card>
        <Table
          head={["用户", "套餐", "本月已耗", "月额度上限", "额度使用率"]}
        >
          {heavy.map((h, i) => {
            const rate = h.moLimit > 0 ? h.moUsed / h.moLimit : 0;
            return (
              <tr key={i} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-2 text-left text-slate-700">
                  {h.email}
                </td>
                <td className="px-3 py-2 text-right text-xs text-slate-500">
                  {h.groupName}
                </td>
                <td className="px-3 py-2 text-right">{usd(h.moUsed)}</td>
                <td className="px-3 py-2 text-right text-slate-500">
                  {h.moLimit > 0 ? usd(h.moLimit) : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <span
                    className={
                      rate >= 0.7
                        ? "font-semibold text-red-600"
                        : rate >= 0.4
                          ? "font-semibold text-amber-600"
                          : "text-slate-600"
                    }
                  >
                    {h.moLimit > 0 ? pct(rate, 0) : "—"}
                  </span>
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>
    </div>
  );
}
