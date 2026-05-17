import { loadData } from "@/lib/load";
import { Card, Empty, Kpi, SectionTitle, Table, Badge } from "@/components/ui";
import { Donut, DailyLines } from "@/components/charts";
import { rmb, num } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_CN: Record<string, string> = {
  COMPLETED: "已完成",
  PARTIALLY_REFUNDED: "部分退款",
  REFUNDED: "已退款",
  REFUND_REQUESTED: "退款申请中",
  CANCELLED: "已取消",
  EXPIRED: "已过期",
  FAILED: "失败",
  PENDING: "待支付",
};

export default async function RevenuePage() {
  const { snap, metrics } = await loadData();
  if (!snap || !metrics) {
    return <Empty>尚无数据，请先在右上角刷新。</Empty>;
  }

  const dailyData = snap.payments.daily.map((d) => ({
    day: d.day.slice(5),
    收款: Math.round(d.net),
  }));

  const grossPaid = snap.payments.byStatus
    .filter((r) =>
      ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED", "REFUND_REQUESTED"].includes(
        r.status,
      ),
    )
    .reduce((a, b) => a + b.amount, 0);

  const paidStatuses = snap.payments.byStatus.filter((r) =>
    ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED", "REFUND_REQUESTED"].includes(
      r.status,
    ),
  );

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800">收入分析</h1>
      <p className="mt-1 text-xs text-slate-400">充值、订阅、退款与支付明细</p>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="累计支付(毛)" value={rmb(grossPaid)} accent="indigo" />
        <Kpi
          label="累计净收款"
          value={rmb(metrics.revenue.balanceRecharged + metrics.revenue.subSold)}
          accent="emerald"
        />
        <Kpi
          label="余额充值净额"
          value={rmb(metrics.revenue.balanceRecharged)}
          accent="sky"
        />
        <Kpi
          label="订阅卡净额"
          value={rmb(metrics.revenue.subSold)}
          accent="sky"
        />
        <Kpi
          label="累计退款"
          value={rmb(snap.payments.totalRefund)}
          accent="red"
          sub={`退款率 ${grossPaid > 0 ? ((snap.payments.totalRefund / grossPaid) * 100).toFixed(1) : "0"}%`}
        />
      </div>

      <SectionTitle hint="余额充值与订阅卡销售净额占比">
        收款构成
      </SectionTitle>
      <Card>
        <div className="mx-auto max-w-md">
          <Donut
            data={[
              {
                name: "余额充值",
                value: Math.round(metrics.revenue.balanceRecharged),
              },
              {
                name: "订阅卡销售",
                value: Math.round(metrics.revenue.subSold),
              },
            ]}
          />
        </div>
      </Card>

      <SectionTitle hint="近 30 天">每日收款趋势</SectionTitle>
      <Card>
        {dailyData.length > 0 ? (
          <DailyLines
            data={dailyData}
            series={[{ key: "收款", color: "#517bdf" }]}
          />
        ) : (
          <p className="py-8 text-center text-sm text-slate-400">近 30 天无数据</p>
        )}
      </Card>

      <SectionTitle>支付订单（按状态）</SectionTitle>
      <Card>
        <Table head={["状态", "类型", "订单数", "金额", "退款额"]}>
          {paidStatuses.map((r, i) => (
            <tr key={i} className="border-b border-slate-100 last:border-0">
              <td className="px-3 py-2 text-left">
                {STATUS_CN[r.status] ?? r.status}
              </td>
              <td className="px-3 py-2 text-right text-slate-500">
                {r.orderType === "balance" ? "余额充值" : "订阅套餐"}
              </td>
              <td className="px-3 py-2 text-right">{num(r.cnt)}</td>
              <td className="px-3 py-2 text-right">{rmb(r.amount)}</td>
              <td className="px-3 py-2 text-right text-red-600">
                {r.refund > 0 ? rmb(r.refund) : "—"}
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <SectionTitle hint="支付完成后生成兑换码并核销，是余额入账的真实机制">
        兑换码 / 充值入账
      </SectionTitle>
      <Card>
        <Table head={["类型", "状态", "数量", "金额"]}>
          {snap.redeem.map((r, i) => (
            <tr key={i} className="border-b border-slate-100 last:border-0">
              <td className="px-3 py-2 text-left">{r.type}</td>
              <td className="px-3 py-2 text-right">
                {r.status === "used" ? (
                  <Badge color="green">已使用</Badge>
                ) : (
                  <Badge color="slate">未使用</Badge>
                )}
              </td>
              <td className="px-3 py-2 text-right">{num(r.cnt)}</td>
              <td className="px-3 py-2 text-right">{rmb(r.value)}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
