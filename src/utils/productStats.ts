type Product = { id: number | string; stock: number; price: number; minStock?: number };
type Log = { productId: number | string; type: string; qty: number; date: string };
type Sale = { status: string; date: string; items?: Array<{ qty: number }> };

export const daysAgoISO = (n: number, ref: Date = new Date()): string => {
  const d = new Date(ref);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

const dayKey = (iso: string): string => (iso || "").slice(0, 10);

export const stockValueSeries = (
  products: Product[],
  logs: Log[],
  days: number,
  ref: Date = new Date()
): number[] => {
  const stockByPid = new Map<string, number>();
  for (const p of products) stockByPid.set(String(p.id), p.stock || 0);

  const series: number[] = [];
  for (let d = 0; d < days; d++) {
    let total = 0;
    for (const p of products) {
      const s = stockByPid.get(String(p.id)) ?? 0;
      total += s * (p.price || 0);
    }
    series.push(total);

    const targetDay = daysAgoISO(d, ref);
    for (const l of logs) {
      if (dayKey(l.date) !== targetDay) continue;
      const key = String(l.productId);
      const cur = stockByPid.get(key) ?? 0;
      if (l.type === "in" || l.type === "adjust_in") stockByPid.set(key, cur - l.qty);
      else if (l.type === "out" || l.type === "adjust_out") stockByPid.set(key, cur + l.qty);
    }
  }
  return series.reverse();
};

export const lowStockSeries = (
  products: Product[],
  _logs: Log[],
  days: number,
  _ref: Date = new Date()
): number[] => {
  const count = products.filter(
    (p) => (p.minStock || 0) > 0 && p.stock <= (p.minStock || 0)
  ).length;
  return Array.from({ length: days }, () => count);
};

export const reservedSeries = (
  sales: Sale[],
  days: number,
  ref: Date = new Date()
): number[] => {
  const series: number[] = [];
  for (let d = days - 1; d >= 0; d--) {
    const target = daysAgoISO(d, ref);
    let total = 0;
    for (const so of sales) {
      if (so.status !== "pending_delivery") continue;
      if (dayKey(so.date) > target) continue;
      for (const it of so.items || []) total += it.qty || 0;
    }
    series.push(total);
  }
  return series;
};

/**
 * Returns a map { productId → { d7: qtySold, d30: qtySold } } over the given
 * sales array. Only counts SOs whose status is not "cancelled". Sums item.qty
 * for each matching item.productId — split-parts are NOT double-counted because
 * the parent item carries the unit qty (parts live in `item.parts`).
 */
export const salesCountByProduct = (
  sales: Sale[],
  ref: Date = new Date()
): Record<string, { d7: number; d30: number }> => {
  const d7Cutoff = daysAgoISO(6, ref);   // include today + last 6 days = 7 days
  const d30Cutoff = daysAgoISO(29, ref); // include today + last 29 days = 30 days
  const out: Record<string, { d7: number; d30: number }> = {};
  for (const so of sales) {
    if ((so as any).status === "cancelled") continue;
    const d = dayKey(so.date);
    if (d < d30Cutoff) continue;
    for (const it of ((so as any).items || []) as Array<{ productId: number | string; qty: number }>) {
      const key = String(it.productId);
      if (!out[key]) out[key] = { d7: 0, d30: 0 };
      out[key].d30 += it.qty || 0;
      if (d >= d7Cutoff) out[key].d7 += it.qty || 0;
    }
  }
  return out;
};

/**
 * Estimate days of stock remaining based on recent velocity.
 * Returns null if no sales history (velocity is unknown).
 * Returns Infinity if stock > 0 but qty30d = 0 (caller decides how to render).
 */
export const daysOfStock = (stock: number, qty30d: number): number | null => {
  if (qty30d <= 0) return stock > 0 ? Infinity : 0;
  const dailyVelocity = qty30d / 30;
  return stock / dailyVelocity;
};

/**
 * Trend direction based on whether the 7-day rate is above/below the 30-day rate.
 * "up" when last week is selling faster than the trailing 30-day average.
 * "down" when it's slower. "flat" when within ±10% of the trend.
 */
export const salesTrend = (d7: number, d30: number): "up" | "down" | "flat" | "none" => {
  if (d30 <= 0 && d7 <= 0) return "none";
  const weekRate = d7 / 7;
  const monthRate = d30 / 30;
  if (monthRate <= 0) return weekRate > 0 ? "up" : "none";
  const ratio = weekRate / monthRate;
  if (ratio > 1.1) return "up";
  if (ratio < 0.9) return "down";
  return "flat";
};

/**
 * Returns true if a product needs operational attention.
 * Combines three risk signals (any one is enough):
 *  - minStock-low: stock <= minStock (when minStock > 0)
 *  - velocity-low: estimated days of stock < `velocityDaysThreshold` AND has sales history
 *  - oversold: reservations > current stock
 */
export const needsAttention = (
  p: { stock: number; minStock?: number },
  qty30d: number,
  reserved: number,
  velocityDaysThreshold: number = 14
): boolean => {
  const minLow = (p.minStock || 0) > 0 && p.stock <= (p.minStock || 0);
  if (minLow) return true;
  if (reserved > p.stock) return true;
  const days = daysOfStock(p.stock, qty30d);
  if (days !== null && days !== Infinity && days < velocityDaysThreshold) return true;
  return false;
};

export const newProductsSeries = (
  logs: Log[],
  days: number,
  ref: Date = new Date()
): number[] => {
  const firstSeen = new Map<string, string>();
  for (const l of logs) {
    if (l.type !== "in") continue;
    const k = String(l.productId);
    const day = dayKey(l.date);
    const prev = firstSeen.get(k);
    if (!prev || day < prev) firstSeen.set(k, day);
  }
  const series: number[] = [];
  for (let d = days - 1; d >= 0; d--) {
    const target = daysAgoISO(d, ref);
    let count = 0;
    for (const [, day] of firstSeen) if (day === target) count++;
    series.push(count);
  }
  return series;
};
