export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const cron = (await import("node-cron")).default;
  const { runAggregation, snapshotCount } = await import("@/lib/aggregate");
  const { env } = await import("@/lib/env");

  const run = (tag: string) =>
    runAggregation()
      .then((s) => console.log(`[finance] ${tag} 聚合完成 @ ${s.generatedAt}`))
      .catch((e) => console.error(`[finance] ${tag} 聚合失败:`, e?.message || e));

  // 启动后若还没有任何快照，跑一次首聚合
  setTimeout(async () => {
    try {
      if ((await snapshotCount()) === 0) run("首次");
    } catch (e) {
      console.error("[finance] 首聚合检查失败:", e);
    }
  }, 4000);

  cron.schedule(env.aggCron, () => run("定时"));
  console.log(`[finance] 聚合任务已注册:${env.aggCron}`);
}
