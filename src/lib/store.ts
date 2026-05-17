import { Pool, types } from "pg";
import { env } from "./env";

// numeric / bigint 统一转数字
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));

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
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );
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
