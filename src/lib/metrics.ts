import type {
  BankMonthlyCost,
  ManualRevenue,
  MonthlyCost,
  PayrollAggregates,
  Platform,
  Snapshot,
} from "./types";

export type Bucket = "claude" | "gpt" | "domestic";

export interface PnL {
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
}
export interface PlatformMetric {
  bucket: Bucket;
  official: number; // 交付的官方美元价值
  charged: number; // 计费额（人民币）
  cost: number | null; // 录入的上游成本（人民币）
  costPerDollar: number | null; // 元/美元
}
export interface ModelMetric {
  model: string;
  billingType: number;
  cnt: number;
  charged: number;
  official: number;
  sellPerDollar: number;
  bucket: Bucket;
  estCost: number | null;
  estMargin: number | null;
  marginPct: number | null;
  loss: boolean;
}
export interface SubBreakeven {
  planId: number;
  name: string;
  price: number;
  monthlyLimit: number;
  validityDays: number;
  bucket: Bucket;
  costPerDollar: number | null;
  breakevenUsd: number | null;
  breakevenPctQuota: number | null;
  activeCnt: number;
  avgMoUsed: number;
  status: "safe" | "tight" | "danger" | "unknown";
}

export interface Metrics {
  hasCost: boolean;
  cost: {
    total: number; // 权威总成本：(银行流水 | 手工录入) + 已付工资
    byPlatform: Record<Platform, number>; // 手工录入分平台（参考/分平台单位成本用）
    server: number;
    bank: number; // 银行流水实付合计
    manual: number; // 手工录入合计
    byMonth: BankMonthlyCost[]; // 银行流水按月实付
    payroll: number; // 已付工资公司成本合计（含在 total 内）
    dividend: number; // 已付分红税后实付合计（只扣现金口径，不在 total 内）
    payrollByMonth: { month: string; cost: number }[]; // 已付工资按实付月
  };
  revenue: {
    balanceRecharged: number;
    balanceConsumed: number;
    subSold: number;
    subRecognized: number;
    subDeferred: number;
    manualTransfer: number;
  };
  consumption: {
    officialTotal: number;
    chargedTotal: number;
    balanceOfficial: number;
    balanceCharged: number;
    subOfficial: number;
    subCharged: number;
  };
  profit: { cash: PnL; contract: PnL; accrual: PnL };
  liabilities: {
    userBalance: number;
    referralPayable: number;
    subDeferred: number;
    payrollPayable: number; // 未付薪酬（税后净额）
    total: number;
  };
  unit: {
    blendedCostPerDollar: number | null;
    balanceSellPerDollar: number;
    subEffectivePerDollar: number;
  };
  platforms: PlatformMetric[];
  models: ModelMetric[];
  subscriptions: SubBreakeven[];
}

export function bucketOf(model: string): Bucket {
  const m = model.toLowerCase();
  if (m.includes("claude")) return "claude";
  if (
    m.startsWith("gpt") ||
    m.startsWith("o1") ||
    m.startsWith("o3") ||
    m.startsWith("o4") ||
    m.includes("codex") ||
    m.includes("sora") ||
    m.includes("dall")
  )
    return "gpt";
  return "domestic";
}

function planBucket(name: string): Bucket {
  const m = name.toLowerCase();
  if (m.includes("claude")) return "claude";
  if (m.includes("gpt")) return "gpt";
  return "domestic";
}

function pnl(revenue: number, cost: number): PnL {
  return {
    revenue,
    cost,
    profit: revenue - cost,
    margin: revenue > 0 ? (revenue - cost) / revenue : 0,
  };
}

export function computeMetrics(
  snap: Snapshot,
  costs: MonthlyCost[],
  manualRevenue: ManualRevenue[],
  bankMonthly: BankMonthlyCost[] = [],
  payroll?: PayrollAggregates,
): Metrics {
  // ---- 成本 ----
  // 手工录入（分平台，供分平台单位成本参考）
  const byPlatform: Record<Platform, number> = {
    claude: 0,
    gpt: 0,
    domestic: 0,
    server: 0,
    other: 0,
  };
  for (const c of costs) byPlatform[c.platform] += c.amountRmb;
  const manualTotal = Object.values(byPlatform).reduce((a, b) => a + b, 0);
  const hasManual = manualTotal > 0;
  // 银行流水实付（权威总成本，所有账面支出都走该卡）
  const bankTotal = bankMonthly.reduce((a, b) => a + b.cost, 0);
  // 薪酬：已付工资进总成本；已付分红只扣现金口径；未付进负债
  const payrollCostPaid = payroll?.payrollCostPaid ?? 0;
  const dividendCashPaid = payroll?.dividendCashPaid ?? 0;
  const payrollPayable = payroll?.payrollPayable ?? 0;
  // 权威总成本：(优先银行流水，回退手工) + 已付工资
  // 注意：若银行流水已含发薪支出会重复，由总览页提示人工判断（v0.4 口径）
  const totalCost = (bankTotal > 0 ? bankTotal : manualTotal) + payrollCostPaid;
  const hasCost = totalCost > 0;

  // ---- 收入 ----
  const monthly = snap.payments.monthly;
  const balanceRecharged = monthly
    .filter((m) => m.orderType === "balance")
    .reduce((a, b) => a + b.net, 0);
  const subSold = snap.subscriptions.revenue.netSold;
  const subRecognized = snap.subscriptions.revenue.recognized;
  const subDeferred = snap.subscriptions.revenue.deferred;
  // 对公转账：线下实收的现金，消耗已在 sub2api 内计入，故只反映到现金口径
  const manualTransfer = manualRevenue.reduce((a, b) => a + b.amountRmb, 0);

  const bt0 = snap.usage.byBillingType.find((b) => b.billingType === 0);
  const bt1 = snap.usage.byBillingType.find((b) => b.billingType === 1);
  const balanceConsumed = bt0?.actualCost ?? 0;
  const balanceOfficial = bt0?.totalCost ?? 0;
  const subCharged = bt1?.actualCost ?? 0;
  const subOfficial = bt1?.totalCost ?? 0;
  const officialTotal = snap.usage.byBillingType.reduce(
    (a, b) => a + b.totalCost,
    0,
  );
  const chargedTotal = snap.usage.byBillingType.reduce(
    (a, b) => a + b.actualCost,
    0,
  );

  // ---- 三口径利润 ----
  // 分红是税后利润分配：按税后实付作为现金流出，只扣现金口径，不进合同/权责（避免对同一笔利润扣两次）
  const profit = {
    cash: pnl(
      balanceRecharged + subSold + manualTransfer,
      totalCost + dividendCashPaid,
    ),
    contract: pnl(balanceConsumed + subSold, totalCost),
    accrual: pnl(balanceConsumed + subRecognized, totalCost),
  };

  // ---- 负债 ----
  const liabilities = {
    userBalance: snap.users.sumBalance,
    referralPayable: snap.users.sumReferralUsable,
    subDeferred,
    payrollPayable,
    total:
      snap.users.sumBalance +
      snap.users.sumReferralUsable +
      subDeferred +
      payrollPayable,
  };

  // ---- 单位经济 ----
  const blendedCostPerDollar =
    hasCost && officialTotal > 0 ? totalCost / officialTotal : null;
  const balanceSellPerDollar =
    balanceOfficial > 0 ? balanceConsumed / balanceOfficial : 0;
  const subEffectivePerDollar = subOfficial > 0 ? subSold / subOfficial : 0;

  // ---- 按平台 bucket 汇总消耗 ----
  const bk: Record<Bucket, { official: number; charged: number }> = {
    claude: { official: 0, charged: 0 },
    gpt: { official: 0, charged: 0 },
    domestic: { official: 0, charged: 0 },
  };
  for (const m of snap.usage.byModel) {
    const b = bucketOf(m.model);
    bk[b].official += m.totalCost;
    bk[b].charged += m.actualCost;
  }
  const bucketCost: Record<Bucket, number> = {
    claude: byPlatform.claude,
    gpt: byPlatform.gpt,
    domestic: byPlatform.domestic,
  };
  const costPerDollar: Record<Bucket, number | null> = {
    claude: null,
    gpt: null,
    domestic: null,
  };
  (["claude", "gpt", "domestic"] as Bucket[]).forEach((b) => {
    if (bucketCost[b] > 0 && bk[b].official > 0)
      costPerDollar[b] = bucketCost[b] / bk[b].official;
  });

  const platforms: PlatformMetric[] = (
    ["claude", "gpt", "domestic"] as Bucket[]
  ).map((b) => ({
    bucket: b,
    official: bk[b].official,
    charged: bk[b].charged,
    cost: hasManual ? bucketCost[b] : null,
    costPerDollar: costPerDollar[b],
  }));

  // ---- 按模型 ----
  const models: ModelMetric[] = snap.usage.byModel
    .filter((m) => m.actualCost > 0 || m.totalCost > 0)
    .map((m) => {
      const b = bucketOf(m.model);
      const cpd = costPerDollar[b];
      const sellPerDollar = m.totalCost > 0 ? m.actualCost / m.totalCost : 0;
      const estCost = cpd != null ? m.totalCost * cpd : null;
      const estMargin = estCost != null ? m.actualCost - estCost : null;
      const marginPct =
        estMargin != null && m.actualCost > 0
          ? estMargin / m.actualCost
          : null;
      return {
        model: m.model,
        billingType: m.billingType,
        cnt: m.cnt,
        charged: m.actualCost,
        official: m.totalCost,
        sellPerDollar,
        bucket: b,
        estCost,
        estMargin,
        marginPct,
        loss: estMargin != null && estMargin < 0,
      };
    });

  // ---- 订阅盈亏平衡 ----
  const subscriptions: SubBreakeven[] = snap.subscriptions.plans.map((p) => {
    const b = planBucket(p.name);
    const cpd = costPerDollar[b];
    const breakevenUsd = cpd != null && cpd > 0 ? p.price / cpd : null;
    const breakevenPctQuota =
      breakevenUsd != null && p.monthlyLimit > 0
        ? breakevenUsd / p.monthlyLimit
        : null;
    const grp = snap.subscriptions.activeByGroup.find(
      (g) => g.groupId === p.groupId,
    );
    const activeCnt = grp?.cnt ?? 0;
    const avgMoUsed = grp && grp.cnt > 0 ? grp.moUsed / grp.cnt : 0;
    let status: SubBreakeven["status"] = "unknown";
    if (breakevenUsd != null) {
      if (avgMoUsed >= breakevenUsd) status = "danger";
      else if (avgMoUsed >= breakevenUsd * 0.6) status = "tight";
      else status = "safe";
    }
    return {
      planId: p.planId,
      name: p.name,
      price: p.price,
      monthlyLimit: p.monthlyLimit,
      validityDays: p.validityDays,
      bucket: b,
      costPerDollar: cpd,
      breakevenUsd,
      breakevenPctQuota,
      activeCnt,
      avgMoUsed,
      status,
    };
  });

  return {
    hasCost,
    cost: {
      total: totalCost,
      byPlatform,
      server: byPlatform.server,
      bank: bankTotal,
      manual: manualTotal,
      byMonth: bankMonthly,
      payroll: payrollCostPaid,
      dividend: dividendCashPaid,
      payrollByMonth: payroll?.payrollCostByMonth ?? [],
    },
    revenue: {
      balanceRecharged,
      balanceConsumed,
      subSold,
      subRecognized,
      subDeferred,
      manualTransfer,
    },
    consumption: {
      officialTotal,
      chargedTotal,
      balanceOfficial,
      balanceCharged: balanceConsumed,
      subOfficial,
      subCharged,
    },
    profit,
    liabilities,
    unit: { blendedCostPerDollar, balanceSellPerDollar, subEffectivePerDollar },
    platforms,
    models,
    subscriptions,
  };
}
