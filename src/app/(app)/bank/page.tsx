import { listBankBatches, listBankMonthlyCost } from "@/lib/bank";
import { BankImporter } from "@/components/BankImporter";
import { Empty, Kpi, SectionTitle, Table } from "@/components/ui";
import { num, rmb } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function BankPage() {
  const [byMonth, batches] = await Promise.all([
    listBankMonthlyCost(),
    listBankBatches(),
  ]);
  const totalCost = byMonth.reduce((a, b) => a + b.cost, 0);
  const totalTxn = byMonth.reduce((a, b) => a + b.outCount + b.inCount, 0);

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800">银行流水成本</h1>
      <p className="mt-1 text-xs text-slate-400">
        上传银行流水 PDF，自动按月归集成本（所有支出＝成本）。此为独立口径，
        不并入「成本录入」与三口径利润，供人工对照。逐笔按内容去重，重复上传或区间重叠不会重复计入。
      </p>

      <SectionTitle>汇总</SectionTitle>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="累计成本（支出）"
          value={rmb(totalCost)}
          accent="red"
          sub={`覆盖 ${byMonth.length} 个月`}
        />
        <Kpi
          label="交易笔数"
          value={num(totalTxn)}
          accent="slate"
          sub={`已导入 ${batches.length} 次`}
        />
      </div>

      <SectionTitle hint="成本＝当月支出(流出)绝对值之和；进账仅参考">
        每月成本
      </SectionTitle>
      {byMonth.length === 0 ? (
        <Empty>尚未导入任何银行流水，请在下方上传 PDF。</Empty>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <Table
            head={["月份", "支出笔数", "支出合计(成本)", "进账笔数", "进账合计(参考)"]}
          >
            {byMonth.map((m) => (
              <tr
                key={m.month}
                className="border-b border-slate-100 last:border-0"
              >
                <td className="px-3 py-2.5 text-left font-semibold text-slate-700">
                  {m.month}
                </td>
                <td className="px-3 py-2.5 text-right">{m.outCount}</td>
                <td className="px-3 py-2.5 text-right font-bold text-red-600">
                  {rmb(m.cost)}
                </td>
                <td className="px-3 py-2.5 text-right text-slate-400">
                  {m.inCount}
                </td>
                <td className="px-3 py-2.5 text-right text-slate-400">
                  {rmb(m.inflow)}
                </td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      <SectionTitle>上传与导入记录</SectionTitle>
      <BankImporter batches={batches} />
    </div>
  );
}
