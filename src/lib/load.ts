import { getLatestSnapshot } from "./aggregate";
import { listCosts } from "./costs";
import { listManualRevenue } from "./revenue";
import { computeMetrics } from "./metrics";

export async function loadData() {
  const [snap, costs, manualRevenue] = await Promise.all([
    getLatestSnapshot(),
    listCosts(),
    listManualRevenue(),
  ]);
  const metrics = snap ? computeMetrics(snap, costs, manualRevenue) : null;
  return { snap, costs, manualRevenue, metrics };
}
