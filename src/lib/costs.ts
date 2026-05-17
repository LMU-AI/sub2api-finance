import { fdb } from "./store";
import type { MonthlyCost, Platform } from "./types";
import { PLATFORMS } from "./types";

function iso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return v == null ? "" : String(v);
}

export async function listCosts(): Promise<MonthlyCost[]> {
  const d = await fdb();
  const r = await d.query(
    "SELECT id, year_month, platform, amount_rmb, note, updated_at FROM monthly_costs ORDER BY year_month DESC, platform, id",
  );
  return r.rows.map((row) => ({
    id: Number(row.id),
    yearMonth: String(row.year_month),
    platform: row.platform as Platform,
    amountRmb: Number(row.amount_rmb),
    note: row.note ?? null,
    updatedAt: iso(row.updated_at),
  }));
}

/** 追加一条成本明细（不覆盖；同月份/平台可多条，系统按平台累加） */
export async function addCost(
  yearMonth: string,
  platform: Platform,
  amountRmb: number,
  note: string,
): Promise<void> {
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) throw new Error("月份格式应为 YYYY-MM");
  if (!PLATFORMS.includes(platform)) throw new Error("无效的平台");
  if (!Number.isFinite(amountRmb) || amountRmb < 0) throw new Error("金额无效");
  const d = await fdb();
  await d.query(
    `INSERT INTO monthly_costs (year_month, platform, amount_rmb, note, updated_at)
     VALUES ($1, $2, $3, $4, now())`,
    [yearMonth, platform, amountRmb, note || null],
  );
}

export async function deleteCost(id: number): Promise<void> {
  const d = await fdb();
  await d.query("DELETE FROM monthly_costs WHERE id = $1", [id]);
}
