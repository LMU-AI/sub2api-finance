import { Pool, types } from "pg";
import { env } from "./env";

// pg 默认把 numeric / bigint 当字符串返回，这里统一转成数字
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v))); // numeric
types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10))); // int8

declare global {
  // eslint-disable-next-line no-var
  var __rdsPool: Pool | undefined;
}

function pool(): Pool {
  if (!global.__rdsPool) {
    global.__rdsPool = new Pool({
      host: env.rdsHost,
      port: env.rdsPort,
      user: env.rdsUser,
      password: env.rdsPassword,
      database: env.rdsDb,
      max: 4,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 15_000,
      ssl: false,
    });
  }
  return global.__rdsPool;
}

/** 只读查询 sub2api 生产库 */
export async function q<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const res = await pool().query(sql, params);
  return res.rows as T[];
}
