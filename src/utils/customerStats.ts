/**
 * Pure helpers for customer-side business signals: AR status, lifetime value,
 * revenue trend, last-purchase recency, outstanding/overdue, top product,
 * average ticket size. All functions accept an optional `today` parameter for
 * deterministic testing.
 */

type AnyObj = Record<string, any>;

const soNet = (so: AnyObj): number =>
  (so.items || []).reduce(
    (s: number, i: AnyObj) => s + (i.qty || 0) * (i.price || 0),
    0
  ) - (so.discountAmt || 0);

const paidFor = (soNum: string, payments: AnyObj[]): number =>
  (payments || [])
    .filter((p) => p.refId === soNum && p.type === "ar")
    .reduce((s, p) => s + (+p.amount || 0), 0);

const MS_PER_DAY = 86_400_000;

export const daysAgo = (dateISO: string, today: Date = new Date()): number | null => {
  if (!dateISO) return null;
  const d = new Date(dateISO + "T00:00:00Z");
  const t = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );
  return Math.floor((t.getTime() - d.getTime()) / MS_PER_DAY);
};

export function salesByCustomerId(sales: AnyObj[]): Record<string, AnyObj[]> {
  const map: Record<string, AnyObj[]> = {};
  for (const s of sales || []) {
    if (s == null || s.customerId == null) continue;
    (map[s.customerId] ||= []).push(s);
  }
  return map;
}

export function lifetimeValue(customer: AnyObj, sales: AnyObj[]): number {
  return (sales || [])
    .filter((s) => s.customerId === customer.id)
    .reduce((s, so) => s + soNet(so), 0);
}

export function revenueTrend(
  customer: AnyObj,
  sales: AnyObj[],
  today: Date = new Date()
): { last30: number; prev30: number; deltaPct: number } {
  let last30 = 0;
  let prev30 = 0;
  const cutoff30 = new Date(today.getTime() - 30 * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
  const cutoff60 = new Date(today.getTime() - 60 * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
  for (const so of sales || []) {
    if (so.customerId !== customer.id || !so.date) continue;
    if (so.date >= cutoff30) last30 += soNet(so);
    else if (so.date >= cutoff60) prev30 += soNet(so);
  }
  const deltaPct =
    prev30 > 0 ? Math.round(((last30 - prev30) / prev30) * 100) : 0;
  return { last30, prev30, deltaPct };
}

export function lastPurchaseDays(
  customer: AnyObj,
  sales: AnyObj[],
  today: Date = new Date()
): number | null {
  let latest: string | null = null;
  for (const so of sales || []) {
    if (so.customerId !== customer.id || !so.date) continue;
    if (!latest || so.date > latest) latest = so.date;
  }
  return latest ? daysAgo(latest, today) : null;
}

export function outstandingDetail(
  customer: AnyObj,
  sales: AnyObj[],
  payments: AnyObj[],
  today: Date = new Date()
): { total: number; count: number; overdueCount: number } {
  let total = 0;
  let count = 0;
  let overdueCount = 0;
  for (const so of sales || []) {
    if (so.customerId !== customer.id || so.status !== "completed") continue;
    const rem = soNet(so) - paidFor(so.soNum, payments);
    if (rem <= 0) continue;
    total += rem;
    count += 1;
    if (so.payType === "credit" && so.creditDays && so.date) {
      const due = new Date(so.date + "T00:00:00Z");
      due.setUTCDate(due.getUTCDate() + so.creditDays);
      if (today.getTime() > due.getTime()) overdueCount += 1;
    }
  }
  return { total, count, overdueCount };
}

export function arStatus(
  customer: AnyObj,
  sales: AnyObj[],
  payments: AnyObj[],
  today: Date = new Date()
): "overdue" | "ar" | "dormant" | "normal" {
  const od = outstandingDetail(customer, sales, payments, today);
  if (od.overdueCount > 0) return "overdue";
  if (od.total > 0) return "ar";
  const lpd = lastPurchaseDays(customer, sales, today);
  if (lpd !== null && lpd > 60) return "dormant";
  return "normal";
}

export function topProduct(
  customer: AnyObj,
  sales: AnyObj[],
  products: AnyObj[]
): { name: string; qty: number } | null {
  const qtyByProd: Record<string, number> = {};
  for (const so of sales || []) {
    if (so.customerId !== customer.id) continue;
    for (const i of so.items || []) {
      qtyByProd[i.productId] = (qtyByProd[i.productId] || 0) + (i.qty || 0);
    }
  }
  const entries = Object.entries(qtyByProd);
  if (entries.length === 0) return null;
  const [pid, qty] = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  const prod = (products || []).find((p) => p.id === +pid);
  return { name: prod ? prod.name : "—", qty };
}

export function avgPerSO(customer: AnyObj, sales: AnyObj[]): number {
  const mine = (sales || []).filter((s) => s.customerId === customer.id);
  if (mine.length === 0) return 0;
  return Math.round(mine.reduce((s, so) => s + soNet(so), 0) / mine.length);
}
