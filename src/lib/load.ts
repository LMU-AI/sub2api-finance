import { getLatestSnapshot } from "./aggregate";
import { listCosts } from "./costs";
import { listManualRevenue } from "./revenue";
import { listBankMonthlyCost } from "./bank";
import { computeMetrics } from "./metrics";

export async function loadData() {
  const [snap, costs, manualRevenue, bankMonthly] = await Promise.all([
    getLatestSnapshot(),
    listCosts(),
    listManualRevenue(),
    listBankMonthlyCost(),
  ]);
  const metrics = snap
    ? computeMetrics(snap, costs, manualRevenue, bankMonthly)
    : null;
  return { snap, costs, manualRevenue, bankMonthly, metrics };
}
