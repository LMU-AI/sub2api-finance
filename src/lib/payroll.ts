import { fdb } from "./store";
import type {
  Employee,
  PayoutMode,
  PayrollAggregates,
  PayrollAnnual,
  PayrollDividend,
  PayrollEntry,
} from "./types";

function iso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return v == null ? "" : String(v);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const YM_RE = /^\d{4}-\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertYm(ym: string): void {
  if (!YM_RE.test(ym)) throw new Error("月份格式应为 YYYY-MM");
}
function assertMode(mode: string): asserts mode is PayoutMode {
  if (mode !== "gross" && mode !== "net")
    throw new Error("发放模式应为 gross 或 net");
}
function assertTaxRate(rate: number): void {
  if (!Number.isFinite(rate) || rate < 0 || rate >= 1)
    throw new Error("税率应在 0 ~ 1 之间");
}

/** 折算基数：满月 = base；否则按 考勤/计薪 天数折算 */
function prorated(
  base: number,
  attendanceDays: number | null,
  payrollDays: number,
): number {
  if (attendanceDays == null) return base;
  if (payrollDays <= 0) throw new Error("计薪天数无效");
  return (base * attendanceDays) / payrollDays;
}

/** 工资条派生：公司成本（gross=税前；net=税后÷(1−税率)，公司承担税差） */
export function entryCost(e: {
  baseSalary: number;
  attendanceDays: number | null;
  payrollDays: number;
  taxRate: number;
  payoutMode: PayoutMode;
}): number {
  const base = prorated(e.baseSalary, e.attendanceDays, e.payrollDays);
  return round2(e.payoutMode === "net" ? base / (1 - e.taxRate) : base);
}

/** 工资条派生：员工到手 */
export function entryNet(e: {
  baseSalary: number;
  attendanceDays: number | null;
  payrollDays: number;
  taxRate: number;
  payoutMode: PayoutMode;
}): number {
  const base = prorated(e.baseSalary, e.attendanceDays, e.payrollDays);
  return round2(e.payoutMode === "net" ? base : base * (1 - e.taxRate));
}

/** 分红派生：员工到手 = 税前 × (1−税率)；公司成本即税前本身 */
export function dividendNet(d: {
  amountPreTax: number;
  taxRate: number;
}): number {
  return round2(d.amountPreTax * (1 - d.taxRate));
}

// ---------------- 员工主档 ----------------

export async function listEmployees(): Promise<Employee[]> {
  const d = await fdb();
  const r = await d.query(
    `SELECT id, name, role, default_base_salary, default_tax_rate,
       default_payout_mode, status, joined_at, left_at, note, updated_at
     FROM employees ORDER BY status ASC, id ASC`,
  );
  return r.rows.map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    role: row.role ?? null,
    defaultBaseSalary:
      row.default_base_salary == null ? null : Number(row.default_base_salary),
    defaultTaxRate: Number(row.default_tax_rate),
    defaultPayoutMode: row.default_payout_mode === "net" ? "net" : "gross",
    status: row.status === "left" ? "left" : "active",
    joinedAt: row.joined_at ?? null,
    leftAt: row.left_at ?? null,
    note: row.note ?? null,
    updatedAt: iso(row.updated_at),
  }));
}

export async function addEmployee(input: {
  name: string;
  role?: string;
  defaultBaseSalary?: number | null;
  defaultTaxRate?: number;
  defaultPayoutMode?: string;
  joinedAt?: string;
  note?: string;
}): Promise<void> {
  const name = input.name?.trim();
  if (!name) throw new Error("姓名不能为空");
  const rate = input.defaultTaxRate ?? 0.08;
  assertTaxRate(rate);
  const mode = input.defaultPayoutMode ?? "gross";
  assertMode(mode);
  if (input.joinedAt && !DATE_RE.test(input.joinedAt))
    throw new Error("入职日期格式应为 YYYY-MM-DD");
  const d = await fdb();
  try {
    await d.query(
      `INSERT INTO employees
         (name, role, default_base_salary, default_tax_rate, default_payout_mode, joined_at, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        name,
        input.role?.trim() || null,
        input.defaultBaseSalary ?? null,
        rate,
        mode,
        input.joinedAt || null,
        input.note?.trim() || null,
      ],
    );
  } catch (e) {
    if ((e as { code?: string }).code === "23505")
      throw new Error(`员工「${name}」已存在`);
    throw e;
  }
}

export async function updateEmployee(input: {
  id: number;
  name?: string;
  role?: string | null;
  defaultBaseSalary?: number | null;
  defaultTaxRate?: number;
  defaultPayoutMode?: string;
  status?: string;
  joinedAt?: string | null;
  leftAt?: string | null;
  note?: string | null;
}): Promise<void> {
  if (!Number.isFinite(input.id)) throw new Error("无效 id");
  if (input.defaultTaxRate != null) assertTaxRate(input.defaultTaxRate);
  if (input.defaultPayoutMode != null) assertMode(input.defaultPayoutMode);
  if (input.status != null && input.status !== "active" && input.status !== "left")
    throw new Error("状态应为 active 或 left");
  const d = await fdb();
  await d.query(
    `UPDATE employees SET
       name                = COALESCE($2, name),
       role                = COALESCE($3, role),
       default_base_salary = COALESCE($4, default_base_salary),
       default_tax_rate    = COALESCE($5, default_tax_rate),
       default_payout_mode = COALESCE($6, default_payout_mode),
       status              = COALESCE($7, status),
       joined_at           = COALESCE($8, joined_at),
       left_at             = COALESCE($9, left_at),
       note                = COALESCE($10, note),
       updated_at          = now()
     WHERE id = $1`,
    [
      input.id,
      input.name?.trim() || null,
      input.role === undefined ? null : input.role,
      input.defaultBaseSalary === undefined ? null : input.defaultBaseSalary,
      input.defaultTaxRate ?? null,
      input.defaultPayoutMode ?? null,
      input.status ?? null,
      input.joinedAt === undefined ? null : input.joinedAt,
      input.leftAt === undefined ? null : input.leftAt,
      input.note === undefined ? null : input.note,
    ],
  );
}

export async function deleteEmployee(id: number): Promise<void> {
  const d = await fdb();
  try {
    await d.query("DELETE FROM employees WHERE id = $1", [id]);
  } catch (e) {
    if ((e as { code?: string }).code === "23503")
      throw new Error("该员工已有工资条或分红记录，请改为「标记离职」");
    throw e;
  }
}

// ---------------- 工资条 ----------------

const ENTRY_SELECT = `
  SELECT p.id, p.year_month, p.employee_id, e.name AS employee_name, e.role AS employee_role,
    p.base_salary, p.attendance_days, p.payroll_days, p.tax_rate, p.payout_mode,
    p.paid_at, p.note, p.updated_at
  FROM payroll_entries p JOIN employees e ON e.id = p.employee_id`;

function mapEntry(row: Record<string, unknown>): PayrollEntry {
  const base = {
    baseSalary: Number(row.base_salary),
    attendanceDays:
      row.attendance_days == null ? null : Number(row.attendance_days),
    payrollDays: Number(row.payroll_days),
    taxRate: Number(row.tax_rate),
    payoutMode: (row.payout_mode === "net" ? "net" : "gross") as PayoutMode,
  };
  return {
    id: Number(row.id),
    yearMonth: String(row.year_month),
    employeeId: Number(row.employee_id),
    employeeName: String(row.employee_name),
    employeeRole: (row.employee_role as string | null) ?? null,
    ...base,
    paidAt: (row.paid_at as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    updatedAt: iso(row.updated_at),
    costRmb: entryCost(base),
    netRmb: entryNet(base),
  };
}

export async function listPayrollEntries(): Promise<PayrollEntry[]> {
  const d = await fdb();
  const r = await d.query(
    `${ENTRY_SELECT} ORDER BY p.year_month DESC, p.employee_id ASC`,
  );
  return r.rows.map(mapEntry);
}

export async function addPayrollEntry(input: {
  yearMonth: string;
  employeeId: number;
  baseSalary: number;
  attendanceDays?: number | null;
  payrollDays?: number;
  taxRate?: number;
  payoutMode?: string;
  note?: string;
}): Promise<void> {
  assertYm(input.yearMonth);
  if (!Number.isFinite(input.employeeId)) throw new Error("请选择员工");
  if (!Number.isFinite(input.baseSalary) || input.baseSalary < 0)
    throw new Error("月薪基数无效");
  const rate = input.taxRate ?? 0.08;
  assertTaxRate(rate);
  const mode = input.payoutMode ?? "gross";
  assertMode(mode);
  const days = input.payrollDays ?? 21.75;
  if (days <= 0) throw new Error("计薪天数无效");
  const d = await fdb();
  try {
    await d.query(
      `INSERT INTO payroll_entries
         (year_month, employee_id, base_salary, attendance_days, payroll_days, tax_rate, payout_mode, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        input.yearMonth,
        input.employeeId,
        input.baseSalary,
        input.attendanceDays ?? null,
        days,
        rate,
        mode,
        input.note?.trim() || null,
      ],
    );
  } catch (e) {
    if ((e as { code?: string }).code === "23505")
      throw new Error("该员工当月已有工资条，请直接编辑");
    throw e;
  }
}

export async function updatePayrollEntry(input: {
  id: number;
  baseSalary?: number;
  attendanceDays?: number | null;
  payrollDays?: number;
  taxRate?: number;
  payoutMode?: string;
  paidAt?: string | null;
  note?: string | null;
}): Promise<void> {
  if (!Number.isFinite(input.id)) throw new Error("无效 id");
  if (input.taxRate != null) assertTaxRate(input.taxRate);
  if (input.payoutMode != null) assertMode(input.payoutMode);
  if (input.paidAt && !DATE_RE.test(input.paidAt))
    throw new Error("实付日期格式应为 YYYY-MM-DD");
  const d = await fdb();
  // attendanceDays / paidAt / note 允许显式置空，用哨兵区分「未传」与「传 null」
  await d.query(
    `UPDATE payroll_entries SET
       base_salary     = COALESCE($2, base_salary),
       attendance_days = CASE WHEN $3 THEN $4::numeric ELSE attendance_days END,
       payroll_days    = COALESCE($5, payroll_days),
       tax_rate        = COALESCE($6, tax_rate),
       payout_mode     = COALESCE($7, payout_mode),
       paid_at         = CASE WHEN $8 THEN $9::date ELSE paid_at END,
       note            = CASE WHEN $10 THEN $11 ELSE note END,
       updated_at      = now()
     WHERE id = $1`,
    [
      input.id,
      input.baseSalary ?? null,
      input.attendanceDays !== undefined,
      input.attendanceDays ?? null,
      input.payrollDays ?? null,
      input.taxRate ?? null,
      input.payoutMode ?? null,
      input.paidAt !== undefined,
      input.paidAt ?? null,
      input.note !== undefined,
      input.note ?? null,
    ],
  );
}

export async function deletePayrollEntry(id: number): Promise<void> {
  const d = await fdb();
  await d.query("DELETE FROM payroll_entries WHERE id = $1", [id]);
}

/** 一键生成当月工资条草稿（幂等：唯一约束冲突自动跳过）。返回新增条数 */
export async function generateMonthlyDraft(yearMonth: string): Promise<number> {
  assertYm(yearMonth);
  const d = await fdb();
  const r = await d.query(
    `INSERT INTO payroll_entries
       (year_month, employee_id, base_salary, payroll_days, tax_rate, payout_mode, note)
     SELECT $1, id, default_base_salary, 21.75, default_tax_rate, default_payout_mode, '一键生成'
     FROM employees
     WHERE status = 'active' AND COALESCE(default_base_salary, 0) > 0
     ON CONFLICT (year_month, employee_id) DO NOTHING`,
    [yearMonth],
  );
  return r.rowCount ?? 0;
}

// ---------------- 分红 ----------------

const DIV_SELECT = `
  SELECT p.id, p.year_month, p.employee_id, e.name AS employee_name, e.role AS employee_role,
    p.project_name, p.amount_pre_tax, p.tax_rate, p.formula, p.paid_at, p.note, p.updated_at
  FROM payroll_dividends p JOIN employees e ON e.id = p.employee_id`;

function mapDividend(row: Record<string, unknown>): PayrollDividend {
  const amountPreTax = Number(row.amount_pre_tax);
  const taxRate = Number(row.tax_rate);
  return {
    id: Number(row.id),
    yearMonth: String(row.year_month),
    employeeId: Number(row.employee_id),
    employeeName: String(row.employee_name),
    employeeRole: (row.employee_role as string | null) ?? null,
    projectName: (row.project_name as string | null) ?? null,
    amountPreTax,
    taxRate,
    formula: (row.formula as string | null) ?? null,
    paidAt: (row.paid_at as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    updatedAt: iso(row.updated_at),
    netRmb: dividendNet({ amountPreTax, taxRate }),
  };
}

export async function listPayrollDividends(): Promise<PayrollDividend[]> {
  const d = await fdb();
  const r = await d.query(
    `${DIV_SELECT} ORDER BY p.year_month DESC, p.id ASC`,
  );
  return r.rows.map(mapDividend);
}

export async function addPayrollDividend(input: {
  yearMonth: string;
  employeeId: number;
  projectName?: string;
  amountPreTax: number;
  taxRate?: number;
  formula?: string;
  note?: string;
}): Promise<void> {
  assertYm(input.yearMonth);
  if (!Number.isFinite(input.employeeId)) throw new Error("请选择员工");
  if (!Number.isFinite(input.amountPreTax) || input.amountPreTax < 0)
    throw new Error("税前金额无效");
  const rate = input.taxRate ?? 0.08;
  assertTaxRate(rate);
  const d = await fdb();
  await d.query(
    `INSERT INTO payroll_dividends
       (year_month, employee_id, project_name, amount_pre_tax, tax_rate, formula, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      input.yearMonth,
      input.employeeId,
      input.projectName?.trim() || null,
      round2(input.amountPreTax),
      rate,
      input.formula?.trim() || null,
      input.note?.trim() || null,
    ],
  );
}

export async function updatePayrollDividend(input: {
  id: number;
  projectName?: string | null;
  amountPreTax?: number;
  taxRate?: number;
  formula?: string | null;
  paidAt?: string | null;
  note?: string | null;
}): Promise<void> {
  if (!Number.isFinite(input.id)) throw new Error("无效 id");
  if (input.taxRate != null) assertTaxRate(input.taxRate);
  if (input.paidAt && !DATE_RE.test(input.paidAt))
    throw new Error("实付日期格式应为 YYYY-MM-DD");
  const d = await fdb();
  await d.query(
    `UPDATE payroll_dividends SET
       project_name   = CASE WHEN $2 THEN $3 ELSE project_name END,
       amount_pre_tax = COALESCE($4, amount_pre_tax),
       tax_rate       = COALESCE($5, tax_rate),
       formula        = CASE WHEN $6 THEN $7 ELSE formula END,
       paid_at        = CASE WHEN $8 THEN $9::date ELSE paid_at END,
       note           = CASE WHEN $10 THEN $11 ELSE note END,
       updated_at     = now()
     WHERE id = $1`,
    [
      input.id,
      input.projectName !== undefined,
      input.projectName ?? null,
      input.amountPreTax ?? null,
      input.taxRate ?? null,
      input.formula !== undefined,
      input.formula ?? null,
      input.paidAt !== undefined,
      input.paidAt ?? null,
      input.note !== undefined,
      input.note ?? null,
    ],
  );
}

export async function deletePayrollDividend(id: number): Promise<void> {
  const d = await fdb();
  await d.query("DELETE FROM payroll_dividends WHERE id = $1", [id]);
}

/** 分红计算器：项目额 × 提成池 × 每人分成 + 基础分 → 批量生成明细。
 *  税点只按每行明示的值计一次：未传 = 0（不扣税）；总额层不设税率 */
export async function generateDividendsFromProject(input: {
  yearMonth: string;
  projectName: string;
  projectAmount: number;
  poolRatio: number;
  participants: {
    employeeId: number;
    shareRatio?: number;
    baseShare?: number;
    taxRate?: number;
  }[];
}): Promise<number> {
  assertYm(input.yearMonth);
  if (!Number.isFinite(input.projectAmount) || input.projectAmount < 0)
    throw new Error("项目额无效");
  if (
    !Number.isFinite(input.poolRatio) ||
    input.poolRatio < 0 ||
    input.poolRatio > 1
  )
    throw new Error("提成池比例应在 0 ~ 1 之间");
  if (!input.participants?.length) throw new Error("请至少添加一名参与人");

  const pool = input.projectAmount * input.poolRatio;
  const d = await fdb();
  let inserted = 0;
  for (const p of input.participants) {
    if (!Number.isFinite(p.employeeId)) throw new Error("参与人无效");
    // 税点只按行内明示的值计一次；未传 = 0（不扣税），不隐式回落主档默认
    const rate = p.taxRate ?? 0;
    assertTaxRate(rate);
    const share = p.shareRatio ?? 0;
    const base = p.baseShare ?? 0;
    const preTax = round2(pool * share + base);
    if (preTax <= 0) continue;
    const parts: string[] = [];
    if (share > 0) parts.push(`${pool}×${share}`);
    if (base > 0) parts.push(String(base));
    await d.query(
      `INSERT INTO payroll_dividends
         (year_month, employee_id, project_name, amount_pre_tax, tax_rate, formula)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        input.yearMonth,
        p.employeeId,
        input.projectName.trim() || null,
        preTax,
        rate,
        parts.join("+") || null,
      ],
    );
    inserted++;
  }
  return inserted;
}

// ---------------- 批量标已发 / 聚合 ----------------

/** 把某月所有未付的工资条+分红标记为已发。返回更新条数 */
export async function markMonthPaid(
  yearMonth: string,
  paidAt: string,
): Promise<number> {
  assertYm(yearMonth);
  if (!DATE_RE.test(paidAt)) throw new Error("实付日期格式应为 YYYY-MM-DD");
  const d = await fdb();
  const r1 = await d.query(
    "UPDATE payroll_entries SET paid_at=$2, updated_at=now() WHERE year_month=$1 AND paid_at IS NULL",
    [yearMonth, paidAt],
  );
  const r2 = await d.query(
    "UPDATE payroll_dividends SET paid_at=$2, updated_at=now() WHERE year_month=$1 AND paid_at IS NULL",
    [yearMonth, paidAt],
  );
  return (r1.rowCount ?? 0) + (r2.rowCount ?? 0);
}

/** 年度视图：每人每月税后到手（工资+分红）。与列表同源同批派生，前置数据一变必然同步 */
export function buildPayrollAnnual(
  entries: PayrollEntry[],
  dividends: PayrollDividend[],
): PayrollAnnual {
  const matrix: Record<string, Record<string, number[]>> = {};
  const add = (ym: string, name: string, net: number) => {
    const year = ym.slice(0, 4);
    const mi = Number(ym.slice(5, 7)) - 1;
    if (mi < 0 || mi > 11) return;
    const yearMap = (matrix[year] ??= {});
    const arr = (yearMap[name] ??= Array(12).fill(0));
    arr[mi] = round2(arr[mi] + net);
  };
  for (const e of entries) add(e.yearMonth, e.employeeName, e.netRmb);
  for (const d of dividends) add(d.yearMonth, d.employeeName, d.netRmb);
  const years = Object.keys(matrix).sort().reverse();
  const totals: Record<string, Record<string, number>> = {};
  for (const y of years) {
    totals[y] = {};
    for (const [name, arr] of Object.entries(matrix[y])) {
      totals[y][name] = round2(arr.reduce((a, b) => a + b, 0));
    }
  }
  return { years, matrix, totals };
}

/** 口径聚合：已付进 P&L（工资→总成本、分红→现金流出），未付进负债 */
export async function getPayrollAggregates(): Promise<PayrollAggregates> {
  const d = await fdb();
  const [entries, dividends] = await Promise.all([
    d.query(`${ENTRY_SELECT}`),
    d.query(`${DIV_SELECT}`),
  ]);

  let payrollCostPaid = 0;
  let dividendCashPaid = 0;
  let payrollPayable = 0;
  const byMonth = new Map<string, number>();

  for (const row of entries.rows) {
    const e = mapEntry(row);
    if (e.paidAt) {
      payrollCostPaid += e.costRmb;
      const mo = e.paidAt.slice(0, 7);
      byMonth.set(mo, (byMonth.get(mo) ?? 0) + e.costRmb);
    } else {
      payrollPayable += e.netRmb;
    }
  }
  for (const row of dividends.rows) {
    const dv = mapDividend(row);
    // 现金流出按税后实付：税点已在每人份额中扣除，总额不再重复计税
    if (dv.paidAt) dividendCashPaid += dv.netRmb;
    else payrollPayable += dv.netRmb;
  }

  return {
    payrollCostPaid: round2(payrollCostPaid),
    dividendCashPaid: round2(dividendCashPaid),
    payrollPayable: round2(payrollPayable),
    payrollCostByMonth: [...byMonth.entries()]
      .map(([month, cost]) => ({ month, cost: round2(cost) }))
      .sort((a, b) => a.month.localeCompare(b.month)),
  };
}
