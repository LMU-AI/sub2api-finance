import { createHash } from "node:crypto";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { fdb } from "./store";
import type {
  BankBatch,
  BankImportResult,
  BankMonthlyCost,
  BankTransaction,
} from "./types";

// 交易首行锚点：记账日期 记账时间 币别 金额 余额（金额负=支出）
const TXN_RE =
  /(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+人民币\s+(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})(.*)$/;

interface ParsedTxn {
  date: string;
  time: string;
  amount: number; // 有符号
  balance: number;
  txnName: string | null;
  counterparty: string | null;
}
interface ParsedPdf {
  cardNo: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  txns: ParsedTxn[];
}

function num(s: string): number {
  return Number(s.replace(/,/g, ""));
}

/** 解析中国银行交易流水明细清单 PDF（纯文本层，无 OCR） */
export async function parseBankPdf(buf: Buffer): Promise<ParsedPdf> {
  const doc = await getDocument({
    data: new Uint8Array(buf),
    useSystemFonts: true,
  }).promise;

  let cardNo: string | null = null;
  let periodStart: string | null = null;
  let periodEnd: string | null = null;
  const txns: ParsedTxn[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    // 按 y 坐标聚成行（四舍五入到 1px），行内按 x 排序拼接
    const rows = new Map<number, Array<[number, string]>>();
    for (const it of tc.items) {
      const str = "str" in it ? it.str : "";
      if (!str) continue;
      const tr = (it as { transform: number[] }).transform;
      const y = Math.round(tr[5]);
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y)!.push([tr[4], str]);
    }
    const ys = [...rows.keys()].sort((a, b) => b - a);
    for (const y of ys) {
      const line = rows
        .get(y)!
        .sort((a, b) => a[0] - b[0])
        .map((v) => v[1])
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      if (!cardNo) {
        const m = line.match(/借记卡号[：:]\s*(\d+)/);
        if (m) cardNo = m[1];
      }
      if (!periodStart) {
        const m = line.match(
          /交易区间[：:]\s*(\d{4}-\d{2}-\d{2})\s*至\s*(\d{4}-\d{2}-\d{2})/,
        );
        if (m) {
          periodStart = m[1];
          periodEnd = m[2];
        }
      }

      const m = line.match(TXN_RE);
      if (!m) continue;
      const rest = (m[5] || "").trim();
      // rest 大致为：交易名称 渠道 网点 附言 对方账户名 …取前两段做展示
      const parts = rest.split(" ").filter(Boolean);
      const txnName = parts[0] ?? null;
      const cp =
        rest.match(/(支付宝-[^\s]+|财付通-[^\s]+|[一-龥]{2,})/)?.[0] ??
        null;
      txns.push({
        date: m[1],
        time: m[2],
        amount: num(m[3]),
        balance: num(m[4]),
        txnName,
        counterparty: cp,
      });
    }
  }

  return { cardNo, periodStart, periodEnd, txns };
}

/** 逐笔内容哈希：卡号+日期+时间+金额+余额（余额逐笔唯一，几乎不可能碰撞） */
function dedupHash(
  cardNo: string,
  t: Pick<ParsedTxn, "date" | "time" | "amount" | "balance">,
): string {
  return createHash("sha256")
    .update(
      `${cardNo}|${t.date}|${t.time}|${t.amount.toFixed(2)}|${t.balance.toFixed(2)}`,
    )
    .digest("hex");
}

/** 解析并入库；ON CONFLICT DO NOTHING 保证幂等（无交叉无污染） */
export async function importBankPdf(
  filename: string,
  buf: Buffer,
): Promise<BankImportResult> {
  const parsed = await parseBankPdf(buf);
  if (parsed.txns.length === 0) {
    throw new Error(
      "未从 PDF 中解析到任何交易记录，请确认是中国银行交易流水明细清单原件（非扫描件）",
    );
  }
  const cardNo = parsed.cardNo ?? "unknown";
  const fileHash = createHash("sha256").update(buf).digest("hex");
  const d = await fdb();

  const batch = await d.query(
    `INSERT INTO bank_import_batches
       (filename, file_hash, card_no, period_start, period_end, parsed_count)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [
      filename,
      fileHash,
      parsed.cardNo,
      parsed.periodStart,
      parsed.periodEnd,
      parsed.txns.length,
    ],
  );
  const batchId = Number(batch.rows[0].id);

  let inserted = 0;
  for (const t of parsed.txns) {
    const r = await d.query(
      `INSERT INTO bank_transactions
         (card_no, booked_date, booked_time, amount_rmb, balance_rmb,
          txn_name, counterparty, direction, dedup_hash, batch_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (dedup_hash) DO NOTHING`,
      [
        cardNo,
        t.date,
        t.time,
        t.amount,
        t.balance,
        t.txnName,
        t.counterparty,
        t.amount < 0 ? "out" : "in",
        dedupHash(cardNo, t),
        batchId,
      ],
    );
    inserted += r.rowCount ?? 0;
  }
  const skipped = parsed.txns.length - inserted;

  await d.query(
    `UPDATE bank_import_batches SET inserted_count=$1, skipped_count=$2 WHERE id=$3`,
    [inserted, skipped, batchId],
  );

  return {
    parsed: parsed.txns.length,
    inserted,
    skipped,
    cardNo: parsed.cardNo,
    periodStart: parsed.periodStart,
    periodEnd: parsed.periodEnd,
    byMonth: await listBankMonthlyCost(),
  };
}

/** 每月成本 = 当月所有支出(负金额)绝对值之和；进账仅参考 */
export async function listBankMonthlyCost(): Promise<BankMonthlyCost[]> {
  const d = await fdb();
  const r = await d.query(
    `SELECT to_char(booked_date,'YYYY-MM') AS month,
       COALESCE(sum(-amount_rmb) FILTER (WHERE amount_rmb<0),0) AS cost,
       count(*) FILTER (WHERE amount_rmb<0)::int AS out_count,
       COALESCE(sum(amount_rmb) FILTER (WHERE amount_rmb>0),0) AS inflow,
       count(*) FILTER (WHERE amount_rmb>0)::int AS in_count
     FROM bank_transactions
     GROUP BY 1 ORDER BY 1 DESC`,
  );
  return r.rows.map((row) => ({
    month: String(row.month),
    cost: Number(row.cost),
    outCount: Number(row.out_count),
    inflow: Number(row.inflow),
    inCount: Number(row.in_count),
  }));
}

export async function listBankBatches(): Promise<BankBatch[]> {
  const d = await fdb();
  const r = await d.query(
    `SELECT id, filename, card_no, period_start, period_end,
       parsed_count, inserted_count, skipped_count, created_at
     FROM bank_import_batches ORDER BY id DESC`,
  );
  return r.rows.map((row) => ({
    id: Number(row.id),
    filename: row.filename ?? null,
    cardNo: row.card_no ?? null,
    periodStart: row.period_start ?? null,
    periodEnd: row.period_end ?? null,
    parsedCount: Number(row.parsed_count),
    insertedCount: Number(row.inserted_count),
    skippedCount: Number(row.skipped_count),
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  }));
}

/** 删除一次导入：连带删除该批次「首次录入」的交易；再次上传可恢复 */
export async function deleteBankBatch(id: number): Promise<void> {
  const d = await fdb();
  await d.query("DELETE FROM bank_transactions WHERE batch_id=$1", [id]);
  await d.query("DELETE FROM bank_import_batches WHERE id=$1", [id]);
}

export async function listBankTransactions(
  month?: string,
): Promise<BankTransaction[]> {
  const d = await fdb();
  const r = month
    ? await d.query(
        `SELECT * FROM bank_transactions
         WHERE to_char(booked_date,'YYYY-MM')=$1
         ORDER BY booked_date DESC, booked_time DESC`,
        [month],
      )
    : await d.query(
        `SELECT * FROM bank_transactions
         ORDER BY booked_date DESC, booked_time DESC LIMIT 500`,
      );
  return r.rows.map((row) => ({
    id: Number(row.id),
    cardNo: String(row.card_no),
    bookedDate: String(row.booked_date),
    bookedTime: String(row.booked_time),
    amountRmb: Number(row.amount_rmb),
    balanceRmb: row.balance_rmb == null ? null : Number(row.balance_rmb),
    txnName: row.txn_name ?? null,
    counterparty: row.counterparty ?? null,
    direction: row.direction === "out" ? "out" : "in",
  }));
}
