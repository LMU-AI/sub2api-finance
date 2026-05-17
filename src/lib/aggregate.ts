import { q } from "./rds";
import { fdb } from "./store";
import type {
  Snapshot,
  UsersSummary,
  PaymentByStatus,
  PaymentMonthly,
  PaymentDaily,
  UsageByBillingType,
  UsageByModel,
  UsageByPlatform,
  UsageMonthly,
  UsageDaily,
  MultiplierBucket,
  RedeemRow,
  ReferralRow,
  SubPlan,
  ActiveSubGroup,
  SubStatus,
  SubRevenue,
  HeavySubUser,
  TopUser,
} from "./types";

const SQL = {
  period: `SELECT min(created_at) AS first, max(created_at) AS last FROM usage_logs`,

  users: `
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE deleted_at IS NULL)::int AS active,
      COALESCE(sum(balance),0) AS sum_balance,
      COALESCE(sum(referral_usable),0) AS sum_referral_usable,
      COALESCE(sum(total_recharged),0) AS sum_total_recharged,
      count(*) FILTER (WHERE balance>0)::int AS bal_pos,
      count(*) FILTER (WHERE balance=0)::int AS bal_zero,
      count(*) FILTER (WHERE balance<0)::int AS bal_neg,
      COALESCE(sum(balance) FILTER (WHERE balance<0),0) AS sum_neg,
      count(*) FILTER (WHERE total_recharged>0)::int AS paid_users
    FROM users`,

  payByStatus: `
    SELECT status, order_type, count(*)::int AS cnt,
      COALESCE(sum(amount),0) AS amount, COALESCE(sum(refund_amount),0) AS refund
    FROM payment_orders GROUP BY status, order_type ORDER BY status, order_type`,

  payMonthly: `
    SELECT to_char(date_trunc('month', paid_at), 'YYYY-MM') AS month, order_type,
      count(*)::int AS cnt, COALESCE(sum(amount - refund_amount),0) AS net
    FROM payment_orders
    WHERE status IN ('COMPLETED','PARTIALLY_REFUNDED') AND paid_at IS NOT NULL
    GROUP BY 1, order_type ORDER BY 1, order_type`,

  payDaily: `
    SELECT to_char(paid_at, 'YYYY-MM-DD') AS day, COALESCE(sum(amount - refund_amount),0) AS net
    FROM payment_orders
    WHERE status IN ('COMPLETED','PARTIALLY_REFUNDED') AND paid_at >= now() - interval '30 days'
    GROUP BY 1 ORDER BY 1`,

  refund: `SELECT COALESCE(sum(refund_amount),0) AS total FROM payment_orders WHERE refund_amount > 0`,

  usageBT: `
    SELECT billing_type, count(*)::int AS cnt,
      COALESCE(sum(total_cost),0) AS total_cost, COALESCE(sum(actual_cost),0) AS actual_cost
    FROM usage_logs GROUP BY billing_type ORDER BY billing_type`,

  usageModel: `
    SELECT model, billing_type, count(*)::int AS cnt,
      COALESCE(sum(total_cost),0) AS total_cost, COALESCE(sum(actual_cost),0) AS actual_cost
    FROM usage_logs GROUP BY model, billing_type ORDER BY sum(actual_cost) DESC`,

  usagePlatform: `
    SELECT a.platform, ul.billing_type, count(*)::int AS cnt,
      COALESCE(sum(ul.total_cost),0) AS total_cost, COALESCE(sum(ul.actual_cost),0) AS actual_cost
    FROM usage_logs ul JOIN accounts a ON a.id = ul.account_id
    GROUP BY a.platform, ul.billing_type ORDER BY a.platform, ul.billing_type`,

  usageMonthly: `
    SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month, billing_type,
      COALESCE(sum(total_cost),0) AS total_cost, COALESCE(sum(actual_cost),0) AS actual_cost
    FROM usage_logs GROUP BY 1, billing_type ORDER BY 1, billing_type`,

  usageDaily: `
    SELECT to_char(created_at, 'YYYY-MM-DD') AS day, billing_type,
      COALESCE(sum(actual_cost),0) AS actual_cost
    FROM usage_logs WHERE created_at >= now() - interval '30 days'
    GROUP BY 1, billing_type ORDER BY 1, billing_type`,

  multiplier: `
    SELECT rate_multiplier AS multiplier, count(*)::int AS cnt
    FROM usage_logs GROUP BY rate_multiplier ORDER BY rate_multiplier`,

  redeem: `
    SELECT type, status, count(*)::int AS cnt, COALESCE(sum(value),0) AS value
    FROM redeem_codes GROUP BY type, status ORDER BY type, status`,

  referral: `
    SELECT status, count(*)::int AS cnt,
      COALESCE(sum(gross_commission),0) AS gross, COALESCE(sum(released_commission),0) AS released
    FROM referral_commissions GROUP BY status ORDER BY status`,

  subPlans: `
    SELECT sp.id AS plan_id, sp.group_id, sp.name, sp.price, sp.validity_days,
      COALESCE(g.daily_limit_usd,0) AS daily_limit,
      COALESCE(g.weekly_limit_usd,0) AS weekly_limit,
      COALESCE(g.monthly_limit_usd,0) AS monthly_limit
    FROM subscription_plans sp JOIN groups g ON g.id = sp.group_id
    WHERE sp.for_sale = true ORDER BY sp.price`,

  activeSubs: `
    SELECT us.group_id, g.name, count(*)::int AS cnt,
      COALESCE(sum(us.weekly_usage_usd),0) AS wk_used,
      COALESCE(sum(us.monthly_usage_usd),0) AS mo_used
    FROM user_subscriptions us JOIN groups g ON g.id = us.group_id
    WHERE us.deleted_at IS NULL AND us.status = 'active'
    GROUP BY us.group_id, g.name ORDER BY count(*) DESC`,

  subStatus: `
    SELECT status, count(*)::int AS cnt FROM user_subscriptions
    WHERE deleted_at IS NULL GROUP BY status ORDER BY status`,

  subRevenue: `
    SELECT count(*)::int AS cnt,
      COALESCE(sum(amount-refund_amount),0) AS net_sold,
      COALESCE(sum((amount-refund_amount) * LEAST(1.0, GREATEST(0.0,
        EXTRACT(EPOCH FROM (now()-paid_at))/86400.0 / NULLIF(subscription_days,0)))),0) AS recognized,
      COALESCE(sum((amount-refund_amount) * (1.0 - LEAST(1.0, GREATEST(0.0,
        EXTRACT(EPOCH FROM (now()-paid_at))/86400.0 / NULLIF(subscription_days,0))))),0) AS deferred
    FROM payment_orders
    WHERE order_type='subscription' AND status IN ('COMPLETED','PARTIALLY_REFUNDED') AND paid_at IS NOT NULL`,

  heavySubs: `
    SELECT u.email, g.name AS group_name,
      us.monthly_usage_usd AS mo_used, us.weekly_usage_usd AS wk_used,
      COALESCE(g.monthly_limit_usd,0) AS mo_limit
    FROM user_subscriptions us
    JOIN groups g ON g.id = us.group_id
    JOIN users u ON u.id = us.user_id
    WHERE us.deleted_at IS NULL AND us.status='active' AND us.monthly_usage_usd > 0
    ORDER BY us.monthly_usage_usd DESC LIMIT 25`,

  topUsers: `
    SELECT u.id, u.email, u.balance, u.total_recharged AS recharged,
      COALESCE((SELECT sum(actual_cost) FROM usage_logs ul
                WHERE ul.user_id=u.id AND ul.billing_type=0),0) AS spent
    FROM users u WHERE u.deleted_at IS NULL
    ORDER BY u.total_recharged DESC LIMIT 25`,
};

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}
function s(v: unknown): string {
  return v == null ? "" : String(v);
}
function iso(v: unknown): string | null {
  if (!v) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

export async function runAggregation(): Promise<Snapshot> {
  const [
    period,
    users,
    payByStatus,
    payMonthly,
    payDaily,
    refund,
    usageBT,
    usageModel,
    usagePlatform,
    usageMonthly,
    usageDaily,
    multiplier,
    redeem,
    referral,
    subPlans,
    activeSubs,
    subStatus,
    subRevenue,
    heavySubs,
    topUsers,
  ] = await Promise.all([
    q(SQL.period),
    q(SQL.users),
    q(SQL.payByStatus),
    q(SQL.payMonthly),
    q(SQL.payDaily),
    q(SQL.refund),
    q(SQL.usageBT),
    q(SQL.usageModel),
    q(SQL.usagePlatform),
    q(SQL.usageMonthly),
    q(SQL.usageDaily),
    q(SQL.multiplier),
    q(SQL.redeem),
    q(SQL.referral),
    q(SQL.subPlans),
    q(SQL.activeSubs),
    q(SQL.subStatus),
    q(SQL.subRevenue),
    q(SQL.heavySubs),
    q(SQL.topUsers),
  ]);

  const u = users[0] ?? {};
  const usersSummary: UsersSummary = {
    total: n(u.total),
    active: n(u.active),
    sumBalance: n(u.sum_balance),
    sumReferralUsable: n(u.sum_referral_usable),
    sumTotalRecharged: n(u.sum_total_recharged),
    balancePos: n(u.bal_pos),
    balanceZero: n(u.bal_zero),
    balanceNeg: n(u.bal_neg),
    sumNeg: n(u.sum_neg),
    paidUsers: n(u.paid_users),
  };

  const rev = subRevenue[0] ?? {};
  const subRev: SubRevenue = {
    cnt: n(rev.cnt),
    netSold: n(rev.net_sold),
    recognized: n(rev.recognized),
    deferred: n(rev.deferred),
  };

  const snap: Snapshot = {
    generatedAt: new Date().toISOString(),
    usagePeriod: {
      first: iso(period[0]?.first),
      last: iso(period[0]?.last),
    },
    users: usersSummary,
    payments: {
      byStatus: payByStatus.map(
        (r): PaymentByStatus => ({
          status: s(r.status),
          orderType: s(r.order_type),
          cnt: n(r.cnt),
          amount: n(r.amount),
          refund: n(r.refund),
        }),
      ),
      monthly: payMonthly.map(
        (r): PaymentMonthly => ({
          month: s(r.month),
          orderType: s(r.order_type),
          cnt: n(r.cnt),
          net: n(r.net),
        }),
      ),
      daily: payDaily.map(
        (r): PaymentDaily => ({ day: s(r.day), net: n(r.net) }),
      ),
      totalRefund: n(refund[0]?.total),
    },
    usage: {
      byBillingType: usageBT.map(
        (r): UsageByBillingType => ({
          billingType: n(r.billing_type),
          cnt: n(r.cnt),
          totalCost: n(r.total_cost),
          actualCost: n(r.actual_cost),
        }),
      ),
      byModel: usageModel.map(
        (r): UsageByModel => ({
          model: s(r.model),
          billingType: n(r.billing_type),
          cnt: n(r.cnt),
          totalCost: n(r.total_cost),
          actualCost: n(r.actual_cost),
        }),
      ),
      byPlatform: usagePlatform.map(
        (r): UsageByPlatform => ({
          platform: s(r.platform),
          billingType: n(r.billing_type),
          cnt: n(r.cnt),
          totalCost: n(r.total_cost),
          actualCost: n(r.actual_cost),
        }),
      ),
      monthly: usageMonthly.map(
        (r): UsageMonthly => ({
          month: s(r.month),
          billingType: n(r.billing_type),
          totalCost: n(r.total_cost),
          actualCost: n(r.actual_cost),
        }),
      ),
      daily: usageDaily.map(
        (r): UsageDaily => ({
          day: s(r.day),
          billingType: n(r.billing_type),
          actualCost: n(r.actual_cost),
        }),
      ),
      multiplierDist: multiplier.map(
        (r): MultiplierBucket => ({
          multiplier: n(r.multiplier),
          cnt: n(r.cnt),
        }),
      ),
    },
    redeem: redeem.map(
      (r): RedeemRow => ({
        type: s(r.type),
        status: s(r.status),
        cnt: n(r.cnt),
        value: n(r.value),
      }),
    ),
    referral: referral.map(
      (r): ReferralRow => ({
        status: s(r.status),
        cnt: n(r.cnt),
        gross: n(r.gross),
        released: n(r.released),
      }),
    ),
    subscriptions: {
      plans: subPlans.map(
        (r): SubPlan => ({
          planId: n(r.plan_id),
          groupId: n(r.group_id),
          name: s(r.name),
          price: n(r.price),
          validityDays: n(r.validity_days),
          dailyLimit: n(r.daily_limit),
          weeklyLimit: n(r.weekly_limit),
          monthlyLimit: n(r.monthly_limit),
        }),
      ),
      activeByGroup: activeSubs.map(
        (r): ActiveSubGroup => ({
          groupId: n(r.group_id),
          name: s(r.name),
          cnt: n(r.cnt),
          wkUsed: n(r.wk_used),
          moUsed: n(r.mo_used),
        }),
      ),
      statusCounts: subStatus.map(
        (r): SubStatus => ({ status: s(r.status), cnt: n(r.cnt) }),
      ),
      revenue: subRev,
      heavyUsers: heavySubs.map(
        (r): HeavySubUser => ({
          email: s(r.email),
          groupName: s(r.group_name),
          moUsed: n(r.mo_used),
          wkUsed: n(r.wk_used),
          moLimit: n(r.mo_limit),
        }),
      ),
    },
    topUsers: topUsers.map(
      (r): TopUser => ({
        id: n(r.id),
        email: s(r.email),
        balance: n(r.balance),
        recharged: n(r.recharged),
        spent: n(r.spent),
      }),
    ),
  };

  const d = await fdb();
  await d.query("INSERT INTO snapshots (created_at, payload) VALUES ($1, $2)", [
    snap.generatedAt,
    JSON.stringify(snap),
  ]);
  await d.query(
    "DELETE FROM snapshots WHERE id NOT IN (SELECT id FROM snapshots ORDER BY id DESC LIMIT 200)",
  );
  return snap;
}

export async function getLatestSnapshot(): Promise<Snapshot | null> {
  const d = await fdb();
  const r = await d.query(
    "SELECT payload FROM snapshots ORDER BY id DESC LIMIT 1",
  );
  return r.rows[0] ? (r.rows[0].payload as Snapshot) : null;
}

export async function snapshotCount(): Promise<number> {
  const d = await fdb();
  const r = await d.query("SELECT count(*)::int AS c FROM snapshots");
  return r.rows[0].c as number;
}
