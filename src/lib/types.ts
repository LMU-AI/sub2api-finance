export interface UsersSummary {
  total: number;
  active: number;
  sumBalance: number;
  sumReferralUsable: number;
  sumTotalRecharged: number;
  balancePos: number;
  balanceZero: number;
  balanceNeg: number;
  sumNeg: number;
  paidUsers: number;
}

export interface PaymentByStatus {
  status: string;
  orderType: string;
  cnt: number;
  amount: number;
  refund: number;
}
export interface PaymentMonthly {
  month: string;
  orderType: string;
  cnt: number;
  net: number;
}
export interface PaymentDaily {
  day: string;
  net: number;
}

export interface UsageByBillingType {
  billingType: number;
  cnt: number;
  totalCost: number;
  actualCost: number;
}
export interface UsageByModel {
  model: string;
  billingType: number;
  cnt: number;
  totalCost: number;
  actualCost: number;
}
export interface UsageByPlatform {
  platform: string;
  billingType: number;
  cnt: number;
  totalCost: number;
  actualCost: number;
}
export interface UsageMonthly {
  month: string;
  billingType: number;
  totalCost: number;
  actualCost: number;
}
export interface UsageDaily {
  day: string;
  billingType: number;
  actualCost: number;
}
export interface MultiplierBucket {
  multiplier: number;
  cnt: number;
}

export interface RedeemRow {
  type: string;
  status: string;
  cnt: number;
  value: number;
}
export interface ReferralRow {
  status: string;
  cnt: number;
  gross: number;
  released: number;
}

export interface SubPlan {
  planId: number;
  groupId: number;
  name: string;
  price: number;
  validityDays: number;
  dailyLimit: number;
  weeklyLimit: number;
  monthlyLimit: number;
}
export interface ActiveSubGroup {
  groupId: number;
  name: string;
  cnt: number;
  wkUsed: number;
  moUsed: number;
}
export interface SubStatus {
  status: string;
  cnt: number;
}
export interface SubRevenue {
  cnt: number;
  netSold: number;
  recognized: number;
  deferred: number;
}
export interface HeavySubUser {
  email: string;
  groupName: string;
  moUsed: number;
  wkUsed: number;
  moLimit: number;
}
export interface TopUser {
  id: number;
  email: string;
  balance: number;
  recharged: number;
  spent: number;
}

export interface Snapshot {
  generatedAt: string;
  usagePeriod: { first: string | null; last: string | null };
  users: UsersSummary;
  payments: {
    byStatus: PaymentByStatus[];
    monthly: PaymentMonthly[];
    daily: PaymentDaily[];
    totalRefund: number;
  };
  usage: {
    byBillingType: UsageByBillingType[];
    byModel: UsageByModel[];
    byPlatform: UsageByPlatform[];
    monthly: UsageMonthly[];
    daily: UsageDaily[];
    multiplierDist: MultiplierBucket[];
  };
  redeem: RedeemRow[];
  referral: ReferralRow[];
  subscriptions: {
    plans: SubPlan[];
    activeByGroup: ActiveSubGroup[];
    statusCounts: SubStatus[];
    revenue: SubRevenue;
    heavyUsers: HeavySubUser[];
  };
  topUsers: TopUser[];
}

export type Platform = "claude" | "gpt" | "domestic" | "server" | "other";
export const PLATFORMS: Platform[] = [
  "claude",
  "gpt",
  "domestic",
  "server",
  "other",
];
export const PLATFORM_LABEL: Record<Platform, string> = {
  claude: "Claude（Anthropic）",
  gpt: "GPT（OpenAI）",
  domestic: "国产模型",
  server: "服务器 / RDS",
  other: "其他",
};

export interface MonthlyCost {
  id: number;
  yearMonth: string;
  platform: Platform;
  amountRmb: number;
  note: string | null;
  updatedAt: string;
}

/** 对公转账等线下收款明细（不进 sub2api 支付流水，仅计入现金口径） */
export interface ManualRevenue {
  id: number;
  date: string;
  amountRmb: number;
  client: string | null;
  note: string | null;
  updatedAt: string;
}

/** 银行流水解析出的每月成本（独立口径，不并入 monthly_costs） */
export interface BankMonthlyCost {
  month: string; // YYYY-MM
  cost: number; // 当月支出合计（成本）= |负金额| 之和
  outCount: number; // 支出笔数
  inflow: number; // 进账合计（仅参考，不冲减成本）
  inCount: number; // 进账笔数
}

/** 一次银行流水 PDF 导入的记录 */
export interface BankBatch {
  id: number;
  filename: string | null;
  cardNo: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  parsedCount: number;
  insertedCount: number;
  skippedCount: number;
  createdAt: string;
}

/** 单笔银行流水明细 */
export interface BankTransaction {
  id: number;
  cardNo: string;
  bookedDate: string;
  bookedTime: string;
  amountRmb: number; // 有符号：负=支出
  balanceRmb: number | null;
  txnName: string | null;
  counterparty: string | null;
  direction: "out" | "in";
}

/** 上传解析后的返回统计 */
export interface BankImportResult {
  parsed: number;
  inserted: number;
  skipped: number;
  cardNo: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  byMonth: BankMonthlyCost[];
}
