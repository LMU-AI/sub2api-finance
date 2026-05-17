export const env = {
  // sub2api 生产库（只读数据源）
  rdsHost: process.env.RDS_HOST || "127.0.0.1",
  rdsPort: Number(process.env.RDS_PORT || 5432),
  rdsUser: process.env.RDS_USER || "postgres",
  rdsPassword: process.env.RDS_PASSWORD || "",
  rdsDb: process.env.RDS_DB || "sub2api",

  // 财务系统自有库（PostgreSQL，读写：快照 / 成本 / 设置）
  financeDbHost: process.env.FINANCE_DB_HOST || "127.0.0.1",
  financeDbPort: Number(process.env.FINANCE_DB_PORT || 5544),
  financeDbUser: process.env.FINANCE_DB_USER || "finance",
  financeDbPassword: process.env.FINANCE_DB_PASSWORD || "finance",
  financeDbName: process.env.FINANCE_DB_NAME || "finance",

  appPassword: process.env.APP_PASSWORD || "admin",
  sessionSecret: process.env.SESSION_SECRET || "dev-secret-change-me",
  aggCron: process.env.AGG_CRON || "*/30 * * * *",
};
