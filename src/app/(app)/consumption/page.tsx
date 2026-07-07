import { loadData } from "@/lib/load";
import { Card, Empty, Kpi, SectionTitle, Table, Badge } from "@/components/ui";
import { ThresholdBars } from "@/components/charts";
import { rmb, usd, pct, num, ratio } from "@/lib/format";
import { PLATFORM_LABEL } from "@/lib/types";

export const dynamic = "force-dynamic";

const bt = (n: number) => (n === 0 ? "余额" : n === 1 ? "订阅" : "其他");

export default async function ConsumptionPage() {
  const { snap, metrics } = await loadData();
  if (!snap || !metrics) {
    return <Empty>尚无数据，请先在右上角刷新。</Empty>;
  }

  const multData = snap.usage.multiplierDist.map((m) => ({
    label: String(m.multiplier),
    value: m.cnt,
  }));

  const models = [...metrics.models]
    .sort((a, b) => b.charged - a.charged)
    .slice(0, 30);

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800">消耗与毛利</h1>
      <p className="mt-1 text-xs text-slate-400">
        total_cost = 美元官方价值 · actual_cost(计费额)= 官方价值 × 倍率 = 人民币
      </p>

      <SectionTitle hint="总成本以银行流水为准；分平台单位成本来自手工录入(可能不完整，仅供参考)">
        按上游平台拆分
      </SectionTitle>
      <div className="grid gap-3 md:grid-cols-3">
        {metrics.platforms.map((p) => (
          <Card key={p.bucket}>
            <div className="text-sm font-semibold text-slate-700">
              {PLATFORM_LABEL[p.bucket]}
            </div>
            <div className="mt-3 space-y-1.5 text-sm">
              <Row k="交付官方价值" v={usd(p.official)} />
              <Row k="计费额" v={rmb(p.charged)} />
              <Row k="录入成本" v={p.cost != null ? rmb(p.cost) : "未录入"} />
              <div className="flex justify-between border-t border-slate-100 pt-1.5">
                <span className="text-slate-500">单位成本</span>
                <span className="font-bold text-slate-800">
                  {p.costPerDollar != null
                    ? `${ratio(p.costPerDollar)} 元/$`
                    : "—"}
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <SectionTitle hint="倍率 = 每 $1 官方价值收多少元">
        售价倍率分布
      </SectionTitle>
      <Card>
        <ThresholdBars
          data={multData}
          threshold={metrics.unit.blendedCostPerDollar ?? undefined}
          unit=""
        />
        <p className="mt-2 text-xs text-slate-400">
          {metrics.unit.blendedCostPerDollar != null
            ? `红色 = 倍率低于综合成本线 ${ratio(metrics.unit.blendedCostPerDollar)} 元/$，这些档位在贴钱。`
            : "录入成本后，低于成本线的亏损档位会标红。"}
        </p>
      </Card>

      <SectionTitle hint="估算成本 = 官方价值 × 该平台单位成本">
        分模型售价与毛利（按计费额前 30）
      </SectionTitle>
      <Card>
        <Table
          head={[
            "模型",
            "业务",
            "调用次数",
            "计费额",
            "官方价值",
            "售价(元/$)",
            "估算毛利",
            "评估",
          ]}
        >
          {models.map((m, i) => {
            const showMargin = m.billingType === 0 && m.estMargin != null;
            return (
              <tr
                key={i}
                className={`border-b border-slate-100 last:border-0 ${
                  m.billingType === 0 && m.loss ? "bg-red-50" : ""
                }`}
              >
                <td className="px-3 py-2 text-left font-medium text-slate-700">
                  {m.model}
                </td>
                <td className="px-3 py-2 text-right text-slate-500">
                  {bt(m.billingType)}
                </td>
                <td className="px-3 py-2 text-right">{num(m.cnt)}</td>
                <td className="px-3 py-2 text-right">{rmb(m.charged)}</td>
                <td className="px-3 py-2 text-right text-slate-500">
                  {usd(m.official)}
                </td>
                <td className="px-3 py-2 text-right font-medium">
                  {ratio(m.sellPerDollar)}
                </td>
                <td
                  className={`px-3 py-2 text-right ${
                    showMargin && m.estMargin! < 0
                      ? "text-red-600"
                      : "text-slate-600"
                  }`}
                >
                  {showMargin ? rmb(m.estMargin!) : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  {m.billingType !== 0 ? (
                    <Badge color="slate">订阅·见专项</Badge>
                  ) : m.estMargin == null ? (
                    <Badge color="slate">待录成本</Badge>
                  ) : m.loss ? (
                    <Badge color="red">亏损</Badge>
                  ) : (m.marginPct ?? 0) < 0.15 ? (
                    <Badge color="amber">偏薄</Badge>
                  ) : (
                    <Badge color="green">健康</Badge>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
        <p className="mt-2 text-xs text-slate-400">
          余额业务的计费额即真实收入，可直接判断盈亏；订阅业务的计费额为配额计价，盈亏请见「订阅专项」。
        </p>
      </Card>

      <SectionTitle>消耗汇总</SectionTitle>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="余额业务计费额"
          value={rmb(metrics.consumption.balanceCharged)}
          accent="indigo"
          sub={`官方价值 ${usd(metrics.consumption.balanceOfficial)}`}
        />
        <Kpi
          label="订阅业务计费额"
          value={rmb(metrics.consumption.subCharged)}
          accent="emerald"
          sub={`官方价值 ${usd(metrics.consumption.subOfficial)}`}
        />
        <Kpi
          label="余额售价"
          value={`${ratio(metrics.unit.balanceSellPerDollar)} 元/$`}
          accent="sky"
        />
        <Kpi
          label="综合成本"
          value={
            metrics.unit.blendedCostPerDollar != null
              ? `${ratio(metrics.unit.blendedCostPerDollar)} 元/$`
              : "—"
          }
          accent="red"
          sub={
            metrics.cost.bank > 0
              ? `银行流水 ${rmb(metrics.cost.total)} ÷ 官方价值`
              : undefined
          }
        />
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{k}</span>
      <span className="text-slate-700">{v}</span>
    </div>
  );
}
