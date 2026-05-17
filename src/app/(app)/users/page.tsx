import { loadData } from "@/lib/load";
import { Card, Empty, Kpi, SectionTitle, Table } from "@/components/ui";
import { rmb, num, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

const REF_STATUS: Record<string, string> = {
  accruing: "累计中",
  fully_released: "已释放",
  partial_reversed: "部分回滚",
  reversed: "已回滚",
};

export default async function UsersPage() {
  const { snap } = await loadData();
  if (!snap) {
    return <Empty>尚无数据，请先在右上角刷新。</Empty>;
  }

  const u = snap.users;
  const conv = u.total > 0 ? u.paidUsers / u.total : 0;

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800">用户分析</h1>
      <p className="mt-1 text-xs text-slate-400">
        余额分布、付费转化与推广佣金
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="注册用户" value={num(u.total)} accent="indigo" />
        <Kpi
          label="付费用户"
          value={num(u.paidUsers)}
          accent="emerald"
          sub={`转化率 ${pct(conv)}`}
        />
        <Kpi
          label="用户余额结余"
          value={rmb(u.sumBalance)}
          accent="amber"
          sub="平台负债"
        />
        <Kpi
          label="累计充值"
          value={rmb(u.sumTotalRecharged)}
          accent="sky"
        />
        <Kpi
          label="可提现推广佣金"
          value={rmb(u.sumReferralUsable)}
          accent="amber"
        />
      </div>

      <SectionTitle>余额分布</SectionTitle>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="有余额用户" value={num(u.balancePos)} accent="emerald" />
        <Kpi label="零余额用户" value={num(u.balanceZero)} accent="slate" />
        <Kpi
          label="负余额用户"
          value={num(u.balanceNeg)}
          accent="red"
          sub={`合计 ${rmb(u.sumNeg)}（并发超支）`}
        />
        <Kpi
          label="活跃用户(未删除)"
          value={num(u.active)}
          accent="sky"
        />
      </div>

      <SectionTitle hint="按累计充值排序">Top 25 充值用户</SectionTitle>
      <Card>
        <Table
          head={["用户", "累计充值", "当前余额", "余额已消耗"]}
        >
          {snap.topUsers.map((t) => (
            <tr key={t.id} className="border-b border-slate-100 last:border-0">
              <td className="px-3 py-2 text-left text-slate-700">{t.email}</td>
              <td className="px-3 py-2 text-right">{rmb(t.recharged)}</td>
              <td className="px-3 py-2 text-right">{rmb(t.balance)}</td>
              <td className="px-3 py-2 text-right text-slate-500">
                {rmb(t.spent)}
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <SectionTitle>推广佣金</SectionTitle>
      <Card>
        <Table head={["状态", "笔数", "计提佣金", "已释放"]}>
          {snap.referral.map((r, i) => (
            <tr key={i} className="border-b border-slate-100 last:border-0">
              <td className="px-3 py-2 text-left">
                {REF_STATUS[r.status] ?? r.status}
              </td>
              <td className="px-3 py-2 text-right">{num(r.cnt)}</td>
              <td className="px-3 py-2 text-right">{rmb(r.gross)}</td>
              <td className="px-3 py-2 text-right">{rmb(r.released)}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
