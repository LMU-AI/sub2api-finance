import { Pool, types } from "pg";
import { env } from "./env";

// numeric / bigint 统一转数字
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
// date 原样返回字符串 YYYY-MM-DD，避免 Date 对象按时区回退一天
types.setTypeParser(1082, (v) => v);

declare global {
  // eslint-disable-next-line no-var
  var __financePool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __financeReady: Promise<void> | undefined;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS snapshots (
    id          BIGSERIAL PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    payload     JSONB NOT NULL
  );
  CREATE TABLE IF NOT EXISTS monthly_costs (
    id          BIGSERIAL PRIMARY KEY,
    year_month  TEXT NOT NULL,
    platform    TEXT NOT NULL,
    amount_rmb  NUMERIC(20,2) NOT NULL DEFAULT 0,
    note        TEXT,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  -- 成本改为追加式明细账：移除旧的「月份+平台」唯一约束
  ALTER TABLE monthly_costs
    DROP CONSTRAINT IF EXISTS monthly_costs_year_month_platform_key;
  -- 对公转账等线下收款明细账（不进 sub2api 支付流水）
  CREATE TABLE IF NOT EXISTS manual_revenue (
    id          BIGSERIAL PRIMARY KEY,
    entry_date  DATE NOT NULL,
    amount_rmb  NUMERIC(20,2) NOT NULL DEFAULT 0,
    client      TEXT,
    note        TEXT,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );
  -- 银行流水成本：独立口径，不并入 monthly_costs / 三口径利润
  CREATE TABLE IF NOT EXISTS bank_import_batches (
    id             BIGSERIAL PRIMARY KEY,
    filename       TEXT,
    file_hash      TEXT,
    card_no        TEXT,
    period_start   DATE,
    period_end     DATE,
    parsed_count   INT NOT NULL DEFAULT 0,
    inserted_count INT NOT NULL DEFAULT 0,
    skipped_count  INT NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  -- 逐笔明细账；dedup_hash 唯一 → 重复上传 / 区间重叠自动去重（无交叉无污染）
  CREATE TABLE IF NOT EXISTS bank_transactions (
    id           BIGSERIAL PRIMARY KEY,
    card_no      TEXT NOT NULL,
    booked_date  DATE NOT NULL,
    booked_time  TEXT NOT NULL,
    amount_rmb   NUMERIC(20,2) NOT NULL,   -- 有符号：负=支出(成本)
    balance_rmb  NUMERIC(20,2),
    txn_name     TEXT,
    counterparty TEXT,
    direction    TEXT NOT NULL,            -- 'out' | 'in'
    dedup_hash   TEXT NOT NULL UNIQUE,
    batch_id     BIGINT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_bank_txn_date ON bank_transactions (booked_date);
  -- 员工主档：调薪只改这里，工资条存快照互不影响
  CREATE TABLE IF NOT EXISTS employees (
    id                  BIGSERIAL PRIMARY KEY,
    name                TEXT NOT NULL UNIQUE,
    role                TEXT,
    default_base_salary NUMERIC(20,2),                   -- NULL/0 = 无固定工资（仅分红）
    default_tax_rate    NUMERIC(6,4) NOT NULL DEFAULT 0.08,
    default_payout_mode TEXT NOT NULL DEFAULT 'gross',   -- 'gross' | 'net'(包税)
    status              TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'left'
    joined_at           DATE,
    left_at             DATE,
    note                TEXT,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  -- 月度工资条：一人一月一条（UNIQUE 保证一键生成幂等）
  CREATE TABLE IF NOT EXISTS payroll_entries (
    id              BIGSERIAL PRIMARY KEY,
    year_month      TEXT NOT NULL,                       -- 'YYYY-MM'
    employee_id     BIGINT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    base_salary     NUMERIC(20,2) NOT NULL,
    attendance_days NUMERIC(6,2),                        -- NULL = 满月
    payroll_days    NUMERIC(6,2) NOT NULL DEFAULT 21.75,
    tax_rate        NUMERIC(6,4) NOT NULL DEFAULT 0.08,
    payout_mode     TEXT NOT NULL DEFAULT 'gross',       -- gross: 基数=税前; net: 基数=约定税后(包税)
    paid_at         DATE,                                -- NULL = 未实付
    note            TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (year_month, employee_id)
  );
  -- 项目分红：一人一月可多条（多项目）；只进现金口径
  CREATE TABLE IF NOT EXISTS payroll_dividends (
    id              BIGSERIAL PRIMARY KEY,
    year_month      TEXT NOT NULL,
    employee_id     BIGINT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    project_name    TEXT,
    amount_pre_tax  NUMERIC(20,2) NOT NULL,
    tax_rate        NUMERIC(6,4) NOT NULL DEFAULT 0.08,
    formula         TEXT,                                -- 追溯："210000×0.55+32300"
    paid_at         DATE,
    note            TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_payroll_entries_ym ON payroll_entries (year_month);
  CREATE INDEX IF NOT EXISTS idx_payroll_div_ym     ON payroll_dividends (year_month);
`;

function pool(): Pool {
  if (!global.__financePool) {
    global.__financePool = new Pool({
      host: env.financeDbHost,
      port: env.financeDbPort,
      user: env.financeDbUser,
      password: env.financeDbPassword,
      database: env.financeDbName,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 15_000,
    });
  }
  return global.__financePool;
}

/** 取财务库连接池，首次调用时确保建表完成 */
export async function fdb(): Promise<Pool> {
  const p = pool();
  if (!global.__financeReady) {
    global.__financeReady = p
      .query(SCHEMA)
      .then(() => undefined)
      .catch((e) => {
        global.__financeReady = undefined;
        throw e;
      });
  }
  await global.__financeReady;
  return p;
}
