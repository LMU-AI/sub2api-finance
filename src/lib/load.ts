import { getLatestSnapshot } from "./aggregate";
import { listCosts } from "./costs";
import { computeMetrics } from "./metrics";

export async function loadData() {
  const [snap, costs] = await Promise.all([getLatestSnapshot(), listCosts()]);
  const metrics = snap ? computeMetrics(snap, costs) : null;
  return { snap, costs, metrics };
}
