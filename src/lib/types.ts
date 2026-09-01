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

export type PayoutMode = "gross" | "net";

/** 员工主档：调薪只改默认值，历史工资条快照不受影响 */
export interface Employee {
  id: number;
  name: string;
  role: string | null;
  defaultBaseSalary: number | null; // NULL/0 = 无固定工资（仅分红）
  defaultTaxRate: number;
  defaultPayoutMode: PayoutMode;
  status: "active" | "left";
  joinedAt: string | null;
  leftAt: string | null;
  note: string | null;
  updatedAt: string;
}

/** 月度工资条（costRmb/netRmb 为 lib 层派生，不落库） */
export interface PayrollEntry {
  id: number;
  yearMonth: string;
  employeeId: number;
  employeeName: string;
  employeeRole: string | null;
  baseSalary: number;
  attendanceDays: number | null; // NULL = 满月
  payrollDays: number;
  taxRate: number;
  payoutMode: PayoutMode;
  paidAt: string | null; // NULL = 未实付
  note: string | null;
  updatedAt: string;
  costRmb: number; // 公司成本：gross=折算税前；net=折算税后÷(1−税率)
  netRmb: number; // 员工到手
}

/** 项目分红明细（只进现金口径；netRmb 派生） */
export interface PayrollDividend {
  id: number;
  yearMonth: string;
  employeeId: number;
  employeeName: string;
  employeeRole: string | null;
  projectName: string | null;
  amountPreTax: number;
  taxRate: number;
  formula: string | null;
  paidAt: string | null;
  note: string | null;
  updatedAt: string;
  netRmb: number; // 到手 = 税前 × (1−税率)
}

/** 年度视图数据（服务端从工资条+分红派生，客户端纯展示，保证与前置数据同步） */
export interface PayrollAnnual {
  years: string[]; // 倒序
  /** year → 员工名 → 12 个月税后到手（工资+分红），无数据月为 0 */
  matrix: Record<string, Record<string, number[]>>;
  /** year → 员工名 → 全年合计 */
  totals: Record<string, Record<string, number>>;
}

/** 薪酬聚合（口径接线用）：已付进 P&L，未付进负债 */
export interface PayrollAggregates {
  payrollCostPaid: number; // 已付工资公司成本合计 → 计入总成本
  dividendCashPaid: number; // 已付分红税后实付合计 → 只扣现金口径（税点每人已扣，不重复计税）
  payrollPayable: number; // 未付税后合计 → 员工薪酬应付（负债）
  payrollCostByMonth: { month: string; cost: number }[]; // 已付工资按实付月聚合（趋势图）
}
