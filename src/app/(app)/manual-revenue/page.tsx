import { listManualRevenue } from "@/lib/revenue";
import { Kpi, SectionTitle } from "@/components/ui";
import { RevenueManager } from "@/components/RevenueManager";
import { rmb } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ManualRevenuePage() {
  const manualRevenue = await listManualRevenue();
  const total = manualRevenue.reduce((a, b) => a + b.amountRmb, 0);

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800">对公转账</h1>
      <p className="mt-1 text-xs text-slate-400">
        线下对公打款不进 sub2api 支付流水，需在此手工录入。录入后计入「现金口径」收入与利润，总览、收入分析页自动重算；客户的
        API 消耗已走 sub2api，合同 / 权责口径不重复计入。
      </p>

      <SectionTitle>对公转账汇总</SectionTitle>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="累计对公转账"
          value={rmb(total)}
          accent="emerald"
          sub={`共 ${manualRevenue.length} 笔`}
        />
      </div>

      <SectionTitle>录入</SectionTitle>
      <RevenueManager entries={manualRevenue} />
    </div>
  );
}
