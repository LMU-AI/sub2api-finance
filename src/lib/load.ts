import { getLatestSnapshot } from "./aggregate";
import { listCosts } from "./costs";
import { listManualRevenue } from "./revenue";
import { listBankMonthlyCost } from "./bank";
import { getPayrollAggregates } from "./payroll";
import { computeMetrics } from "./metrics";

export async function loadData() {
  const [snap, costs, manualRevenue, bankMonthly, payroll] = await Promise.all([
    getLatestSnapshot(),
    listCosts(),
    listManualRevenue(),
    listBankMonthlyCost(),
    getPayrollAggregates(),
  ]);
  const metrics = snap
    ? computeMetrics(snap, costs, manualRevenue, bankMonthly, payroll)
    : null;
  return { snap, costs, manualRevenue, bankMonthly, payroll, metrics };
}
