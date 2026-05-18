import { fdb } from "./store";
import type { ManualRevenue } from "./types";

function iso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return v == null ? "" : String(v);
}

export async function listManualRevenue(): Promise<ManualRevenue[]> {
  const d = await fdb();
  const r = await d.query(
    "SELECT id, entry_date, amount_rmb, client, note, updated_at FROM manual_revenue ORDER BY entry_date DESC, id DESC",
  );
  return r.rows.map((row) => ({
    id: Number(row.id),
    date: String(row.entry_date),
    amountRmb: Number(row.amount_rmb),
    client: row.client ?? null,
    note: row.note ?? null,
    updatedAt: iso(row.updated_at),
  }));
}

/** 追加一条对公转账收款明细（不覆盖；线下打款，不进 sub2api 支付流水） */
export async function addManualRevenue(
  date: string,
  amountRmb: number,
  client: string,
  note: string,
): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error("日期格式应为 YYYY-MM-DD");
  if (!Number.isFinite(amountRmb) || amountRmb < 0) throw new Error("金额无效");
  const d = await fdb();
  await d.query(
    `INSERT INTO manual_revenue (entry_date, amount_rmb, client, note, updated_at)
     VALUES ($1, $2, $3, $4, now())`,
    [date, amountRmb, client || null, note || null],
  );
}

export async function deleteManualRevenue(id: number): Promise<void> {
  const d = await fdb();
  await d.query("DELETE FROM manual_revenue WHERE id = $1", [id]);
}
