import Link from "next/link";
import { loadData } from "@/lib/load";
import { Card, Empty, Kpi, SectionTitle, Table } from "@/components/ui";
import { MonthlyTrend, Donut } from "@/components/charts";
import { rmb, usd, pct, num, fmtTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const { snap, metrics, manualRevenue } = await loadData();

  if (!snap || !metrics) {
    return (
      <Empty>
        尚无数据。请点击右上角「刷新数据」从生产库拉取并生成第一份快照。
      </Empty>
    );
  }

  const { revenue, cost, profit, liabilities, consumption, unit } = metrics;
  const netIncome =
    revenue.balanceRecharged + revenue.subSold + revenue.manualTransfer;

  // 月度趋势:收款（实收）/ 成本（按官方价值占比分摊）/ 利润
  const months = Array.from(
    new Set([
      ...snap.payments.monthly.map((m) => m.month),
      ...snap.usage.monthly.map((m) => m.month),
      ...manualRevenue.map((m) => m.date.slice(0, 7)),
      ...cost.payrollByMonth.map((m) => m.month),
    ]),
  )
    .filter(Boolean)
    .sort();
  const officialByMonth: Record<string, number> = {};
  for (const m of snap.usage.monthly)
    officialByMonth[m.month] = (officialByMonth[m.month] ?? 0) + m.totalCost;
  const totalOfficial = Object.values(officialByMonth).reduce(
    (a, b) => a + b,
    0,
  );
  const revByMonth: Record<string, number> = {};
  for (const m of snap.payments.monthly)
    revByMonth[m.month] = (revByMonth[m.month] ?? 0) + m.net;
  for (const m of manualRevenue) {
    const mo = m.date.slice(0, 7);
    revByMonth[mo] = (revByMonth[mo] ?? 0) + m.amountRmb;
  }
  // 成本按月对齐：优先银行流水当月实付；无银行数据时回退官方价值占比分摊（只摊上游手工成本）
  // 已付薪资按「实付月」精确叠加，不参与占比分摊
  const bankCostByMonth: Record<string, number> = {};
  for (const m of cost.byMonth) bankCostByMonth[m.month] = m.cost;
  const payrollCostByMonth: Record<string, number> = {};
  for (const m of cost.payrollByMonth) payrollCostByMonth[m.month] = m.cost;
  const hasBank = cost.bank > 0;
  const trend = months.map((mo) => {
    const 收款 = revByMonth[mo] ?? 0;
    const upstream = hasBank
      ? (bankCostByMonth[mo] ?? 0)
      : totalOfficial > 0
        ? (cost.manual * (officialByMonth[mo] ?? 0)) / totalOfficial
        : 0;
    const 成本 = upstream + (payrollCostByMonth[mo] ?? 0);
    return {
      month: mo,
      收款: Math.round(收款),
      成本: Math.round(成本),
      利润: Math.round(收款 - 成本),
    };
  });

  const pnlRows = [
    { k: "现金口径", d: "收到的全部现金 vs 付出的成本，含未消耗预收", v: profit.cash },
    { k: "合同口径", d: "余额按已消耗 + 订阅按整卡确认，最贴近经营实质", v: profit.contract },
    { k: "权责口径", d: "余额已消耗 + 订阅按时间分摊，最保守", v: profit.accrual },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800">经营总览</h1>
      <p className="mt-1 text-xs text-slate-400">
        数据周期 {fmtTime(snap.usagePeriod.first)} ～{" "}
        {fmtTime(snap.usagePeriod.last)} · 快照生成 {fmtTime(snap.generatedAt)}
      </p>

      {!metrics.hasCost && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          尚未录入上游成本，利润与毛利率无法计算。请到{" "}
          <Link href="/costs" className="font-semibold underline">
            成本录入
          </Link>{" "}
          按月填写 Claude / GPT / 国产 / 服务器 支出。
        </div>
      )}

      {cost.bank > 0 && (cost.payroll > 0 || cost.dividend > 0) && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
          ⚠️ 当前总成本 = 银行流水实付 + 已付薪资（
          {rmb(cost.payroll)}
          {cost.dividend > 0 ? `，另有已付分红 ${rmb(cost.dividend)} 扣现金口径` : ""}
          ）。若发薪/分红也走该银行卡，会与流水中的支出重复计入，请自行判断——发薪不走该卡则无需处理。
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi
          label="累计净收款"
          value={rmb(netIncome)}
          accent="indigo"
          sub={`充值 ${rmb(revenue.balanceRecharged)} + 订阅 ${rmb(revenue.subSold)} + 对公 ${rmb(revenue.manualTransfer)}`}
        />
        <Kpi
          label="总成本"
          value={metrics.hasCost ? rmb(cost.total) : "未录入"}
          accent="red"
          sub={
            cost.bank > 0
              ? cost.payroll > 0
                ? `银行流水 + 已付薪资 ${rmb(cost.payroll)}`
                : "银行流水实付"
              : metrics.hasCost
                ? cost.payroll > 0
                  ? `上游成本 + 已付薪资 ${rmb(cost.payroll)}`
                  : "账号采购 + 服务器"
                : "前往成本录入"
          }
        />
        <Kpi
          label="现金口径净利"
          value={metrics.hasCost ? rmb(profit.cash.profit) : "—"}
          tone={
            metrics.hasCost
              ? profit.cash.profit >= 0
                ? "pos"
                : "neg"
              : undefined
          }
          accent="emerald"
          sub={metrics.hasCost ? `净利率 ${pct(profit.cash.margin)}` : "需录入成本"}
        />
        <Kpi
          label="用户余额(负债)"
          value={rmb(liabilities.userBalance)}
          accent="amber"
          sub="平台欠用户、随时可消耗"
        />
        <Kpi
          label="订阅递延收入"
          value={rmb(liabilities.subDeferred)}
          accent="amber"
          sub="按剩余配额计、未交付部分"
        />
        <Kpi
          label="注册用户"
          value={num(snap.users.total)}
          accent="sky"
          sub={`付费 ${num(snap.users.paidUsers)} 人`}
        />
      </div>

      <SectionTitle hint="同一盘生意，因有预收，三种口径差异较大">
        利润测算 · 三种口径
      </SectionTitle>
      <Card>
        <Table head={["口径", "收入", "成本", "利润", "利润率", "说明"]}>
          {pnlRows.map((r) => (
            <tr key={r.k} className="border-b border-slate-100 last:border-0">
              <td className="px-3 py-2.5 font-semibold text-slate-700">
                {r.k}
              </td>
              <td className="px-3 py-2.5 text-right">{rmb(r.v.revenue)}</td>
              <td className="px-3 py-2.5 text-right">
                {metrics.hasCost ? rmb(r.v.cost) : "—"}
              </td>
              <td
                className={`px-3 py-2.5 text-right font-bold ${
                  metrics.hasCost && r.v.profit < 0
                    ? "text-red-600"
                    : "text-emerald-600"
                }`}
              >
                {metrics.hasCost ? rmb(r.v.profit) : "—"}
              </td>
              <td className="px-3 py-2.5 text-right">
                {metrics.hasCost ? pct(r.v.margin) : "—"}
              </td>
              <td className="px-3 py-2.5 text-left text-xs text-slate-400">
                {r.d}
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <SectionTitle
        hint={
          cost.bank > 0
            ? "成本＝银行流水当月实付，按月对齐"
            : "成本按各月官方价值占比分摊估算"
        }
      >
        月度趋势
      </SectionTitle>
      <Card>
        <MonthlyTrend data={trend} />
      </Card>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Card>
          <div className="mb-1 text-sm font-semibold text-slate-700">
            收入构成（人民币）
          </div>
          <Donut
            data={[
              { name: "余额充值", value: Math.round(revenue.balanceRecharged) },
              { name: "订阅卡销售", value: Math.round(revenue.subSold) },
              { name: "对公转账", value: Math.round(revenue.manualTransfer) },
            ].filter((d) => d.value > 0)}
          />
        </Card>
        <Card>
          <div className="mb-1 text-sm font-semibold text-slate-700">
            消耗的官方价值（美元）
          </div>
          <Donut
            unit="$"
            data={[
              { name: "余额用户消耗", value: Math.round(consumption.balanceOfficial) },
              { name: "订阅用户消耗", value: Math.round(consumption.subOfficial) },
            ]}
          />
        </Card>
      </div>

      <SectionTitle>负债与预收（不能当利润花）</SectionTitle>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <Kpi
          label="用户余额结余"
          value={rmb(liabilities.userBalance)}
          accent="amber"
        />
        <Kpi
          label="订阅递延收入"
          value={rmb(liabilities.subDeferred)}
          accent="amber"
        />
        <Kpi
          label="推广佣金应付"
          value={rmb(liabilities.referralPayable)}
          accent="amber"
        />
        <Kpi
          label="员工薪酬应付"
          value={rmb(liabilities.payrollPayable)}
          accent="amber"
          sub="已录未付的工资/分红（税后）"
        />
        <Kpi
          label="负债合计"
          value={rmb(liabilities.total)}
          accent="slate"
          sub="对应服务仍需成本交付"
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="交付官方价值"
          value={usd(consumption.officialTotal)}
          accent="sky"
        />
        <Kpi
          label="计费消耗额"
          value={rmb(consumption.chargedTotal)}
          accent="sky"
        />
        <Kpi
          label="综合成本"
          value={
            unit.blendedCostPerDollar != null
              ? `${unit.blendedCostPerDollar.toFixed(2)} 元/$`
              : "—"
          }
          accent="red"
        />
        <Kpi
          label="累计退款"
          value={rmb(snap.payments.totalRefund)}
          accent="slate"
        />
      </div>
    </div>
  );
}
