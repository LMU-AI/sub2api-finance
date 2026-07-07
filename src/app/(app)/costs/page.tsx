import { loadData } from "@/lib/load";
import { Kpi, SectionTitle } from "@/components/ui";
import { CostManager } from "@/components/CostManager";
import { rmb } from "@/lib/format";
import { PLATFORM_LABEL, PLATFORMS } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CostsPage() {
  const { costs, metrics } = await loadData();
  const bankIsSource = (metrics?.cost.bank ?? 0) > 0;

  const byPlatform: Record<string, number> = {};
  const countByPlatform: Record<string, number> = {};
  for (const p of PLATFORMS) {
    byPlatform[p] = 0;
    countByPlatform[p] = 0;
  }
  for (const c of costs) {
    byPlatform[c.platform] += c.amountRmb;
    countByPlatform[c.platform] += 1;
  }
  const total = Object.values(byPlatform).reduce((a, b) => a + b, 0);

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800">成本录入</h1>
      <p className="mt-1 text-xs text-slate-400">
        {bankIsSource
          ? "已启用「银行流水成本」作为权威总成本，本页录入不再计入总览/利润总额，仅用于分平台单位成本的参考拆分。"
          : "数据库没有上游采购成本，需在此手工录入。录入后总览、消耗、订阅各页的毛利会自动按平台重算。"}
      </p>

      <SectionTitle>成本汇总</SectionTitle>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi
          label={bankIsSource ? "手工录入合计(参考)" : "上游总成本"}
          value={rmb(total)}
          accent={bankIsSource ? "slate" : "red"}
          sub={
            bankIsSource
              ? `银行流水实付 ${rmb(metrics?.cost.bank ?? 0)}`
              : `共 ${costs.length} 条明细`
          }
        />
        {PLATFORMS.map((p) => (
          <Kpi
            key={p}
            label={PLATFORM_LABEL[p]}
            value={rmb(byPlatform[p])}
            accent="slate"
            sub={
              countByPlatform[p] > 0 ? `${countByPlatform[p]} 条明细累加` : "未录入"
            }
          />
        ))}
      </div>

      {metrics && metrics.hasCost && (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {metrics.platforms.map((pl) => (
            <div
              key={pl.bucket}
              className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm"
            >
              <div className="font-semibold text-slate-700">
                {PLATFORM_LABEL[pl.bucket]} · 单位成本
              </div>
              <div className="mt-1 text-2xl font-bold text-slate-900">
                {pl.costPerDollar != null
                  ? `${pl.costPerDollar.toFixed(2)} 元/$`
                  : "—"}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                成本 {rmb(pl.cost ?? 0)} ÷ 官方价值 $
                {pl.official.toLocaleString("en-US", {
                  maximumFractionDigits: 0,
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <SectionTitle>录入</SectionTitle>
      <CostManager costs={costs} />
    </div>
  );
}
