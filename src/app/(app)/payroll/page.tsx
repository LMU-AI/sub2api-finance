import {
  buildPayrollAnnual,
  listEmployees,
  listPayrollDividends,
  listPayrollEntries,
} from "@/lib/payroll";
import { Kpi, SectionTitle } from "@/components/ui";
import { PayrollManager } from "@/components/PayrollManager";
import { rmb } from "@/lib/format";

export const dynamic = "force-dynamic";

function currentYm(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function PayrollPage() {
  const [employees, entries, dividends] = await Promise.all([
    listEmployees(),
    listPayrollEntries(),
    listPayrollDividends(),
  ]);

  const ym = currentYm();
  const moEntries = entries.filter((e) => e.yearMonth === ym);
  const moDividends = dividends.filter((d) => d.yearMonth === ym);
  const moSalaryCost = moEntries.reduce((a, b) => a + b.costRmb, 0);
  const moDividendPreTax = moDividends.reduce((a, b) => a + b.amountPreTax, 0);
  const moNet =
    moEntries.reduce((a, b) => a + b.netRmb, 0) +
    moDividends.reduce((a, b) => a + b.netRmb, 0);
  const unpaid =
    entries.filter((e) => !e.paidAt).reduce((a, b) => a + b.netRmb, 0) +
    dividends.filter((d) => !d.paidAt).reduce((a, b) => a + b.netRmb, 0);

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800">薪资 / 工资条</h1>
      <p className="mt-1 text-xs text-slate-400">
        员工主档统一维护，每月一键生成工资条草稿；项目分红用计算器批量生成。已付工资计入总成本参与三口径利润；分红为税后利润分配，只影响现金口径。税率为内部核算口径，非法定累进个税。
      </p>

      <SectionTitle hint={`统计月份 ${ym}`}>本月汇总</SectionTitle>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="本月工资（公司成本）"
          value={rmb(moSalaryCost, 2)}
          accent="sky"
          sub={`${moEntries.length} 条 · 进总成本`}
        />
        <Kpi
          label="本月分红（税前）"
          value={rmb(moDividendPreTax, 2)}
          accent="amber"
          sub={`${moDividends.length} 条 · 按税后实付扣现金口径`}
        />
        <Kpi
          label="本月税后合计"
          value={rmb(moNet, 2)}
          accent="indigo"
          sub="工资到手 + 分红到手"
        />
        <Kpi
          label="未付薪酬（应付）"
          value={rmb(unpaid, 2)}
          accent={unpaid > 0 ? "red" : "emerald"}
          sub={unpaid > 0 ? "计入负债，未进利润" : "全部已发放"}
        />
      </div>

      <PayrollManager
        employees={employees}
        entries={entries}
        dividends={dividends}
        annual={buildPayrollAnnual(entries, dividends)}
      />
    </div>
  );
}
