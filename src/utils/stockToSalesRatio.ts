export type Granularity = "month" | "quarter" | "year";

type Product = { id: number | string; brand?: string; categoryId: number | string; price?: number; stock?: number };
type Log = { productId: number | string; date: string; qtyBefore: number; qtyAfter: number };
type SaleItem = { productId: number | string; qty: number; price: number };
type Sale = { status?: string; date: string; items?: SaleItem[] };
type Cat = { id: number | string; name: string };

export type GroupStat = { key: string; label: string; ratio: number; avgStock: number; sales: number };
export type CatBrandData = { cats: string[]; brands: string[]; rows: Array<Record<string, number | string>> };
export type StockToSalesResult = {
  period: { granularity: Granularity; periodKey: string; startDate: string; endDate: string; label: string };
  total: { ratio: number | null; avgStock: number; sales: number };
  byBrand: GroupStat[];
  byCat: GroupStat[];
  byCatBrand: CatBrandData;
};

const dayKey = (iso: string): string => (iso || "").slice(0, 10);

export const shiftISO = (iso: string, deltaDays: number): string => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
};

/** logs = ของสินค้าตัวเดียว เรียง date จากน้อยไปมาก. isoDate = ขอบสิ้นวัน "YYYY-MM-DD" (รวมวันนั้น). */
export const stockUnitsAt = (logs: Log[], isoDate: string, currentStock: number): number => {
  if (!logs.length) return currentStock;
  let last: Log | null = null;
  for (const l of logs) {
    if (dayKey(l.date) <= isoDate) last = l;
    else break;
  }
  return last ? last.qtyAfter : logs[0].qtyBefore;
};

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const pad2 = (n: number): string => String(n).padStart(2, "0");
const lastDay = (year: number, month1to12: number): number => new Date(Date.UTC(year, month1to12, 0)).getUTCDate();

export const periodBounds = (
  granularity: Granularity,
  periodKey: string
): { startDate: string; endDate: string; label: string } => {
  if (granularity === "year") {
    const y = Number(periodKey);
    return { startDate: `${y}-01-01`, endDate: `${y}-12-31`, label: String(y) };
  }
  if (granularity === "quarter") {
    const [ys, qs] = periodKey.split("-Q");
    const y = Number(ys), q = Number(qs);
    const startM = (q - 1) * 3 + 1;
    const endM = q * 3;
    return {
      startDate: `${y}-${pad2(startM)}-01`,
      endDate: `${y}-${pad2(endM)}-${pad2(lastDay(y, endM))}`,
      label: `Q${q} ${y}`,
    };
  }
  const [ys, ms] = periodKey.split("-");
  const y = Number(ys), m = Number(ms);
  return {
    startDate: `${y}-${pad2(m)}-01`,
    endDate: `${y}-${pad2(m)}-${pad2(lastDay(y, m))}`,
    label: `${TH_MONTHS[m - 1]} ${y}`,
  };
};

/** คืน periodKey เรียงล่าสุดก่อน; index 0 = งวดปัจจุบัน (ยังไม่จบ). ใช้เวลา local ให้ตรงนาฬิกาผู้ใช้. */
export const listPeriods = (granularity: Granularity, ref: Date = new Date()): string[] => {
  const y = ref.getFullYear();
  const m = ref.getMonth() + 1; // 1-12
  const out: string[] = [];
  if (granularity === "year") {
    for (let i = 0; i < 5; i++) out.push(String(y - i));
    return out;
  }
  if (granularity === "quarter") {
    let cy = y, cq = Math.floor((m - 1) / 3) + 1;
    for (let i = 0; i < 8; i++) {
      out.push(`${cy}-Q${cq}`);
      cq--; if (cq < 1) { cq = 4; cy--; }
    }
    return out;
  }
  let cy = y, cm = m;
  for (let i = 0; i < 12; i++) {
    out.push(`${cy}-${pad2(cm)}`);
    cm--; if (cm < 1) { cm = 12; cy--; }
  }
  return out;
};

const SEP = String.fromCharCode(0); // ตัวคั่น key หมวด/ยี่ห้อ — null char ไม่มีทางชนชื่อจริง

const ratioOf = (avg: number, sales: number): number | null => (sales > 0 ? avg / sales : null);

export const computeStockToSales = (
  products: Product[],
  logs: Log[],
  sales: Sale[],
  cats: Cat[],
  opts: { granularity: Granularity; periodKey: string }
): StockToSalesResult => {
  const { granularity, periodKey } = opts;
  const { startDate, endDate, label } = periodBounds(granularity, periodKey);
  const beforeStart = shiftISO(startDate, -1);

  const logsByPid = new Map<string, Log[]>();
  for (const l of logs) {
    const k = String(l.productId);
    const arr = logsByPid.get(k);
    if (arr) arr.push(l);
    else logsByPid.set(k, [l]);
  }
  for (const arr of logsByPid.values())
    arr.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const catName = new Map(cats.map((c) => [String(c.id), c.name]));
  const brandOf = (p: Product): string => (p.brand && String(p.brand).trim()) || "ไม่ระบุ";
  const catOf = (p: Product): string => catName.get(String(p.categoryId)) || "ไม่ระบุ";

  const avgStockByPid = new Map<string, number>();
  for (const p of products) {
    const lg = logsByPid.get(String(p.id)) || [];
    const startUnits = stockUnitsAt(lg, beforeStart, p.stock || 0);
    const endUnits = stockUnitsAt(lg, endDate, p.stock || 0);
    avgStockByPid.set(String(p.id), ((startUnits + endUnits) / 2) * (p.price || 0));
  }

  const prodIds = new Set(products.map((p) => String(p.id)));
  const salesByPid = new Map<string, number>();
  for (const so of sales) {
    if (so.status === "cancelled") continue;
    const d = dayKey(so.date);
    if (d < startDate || d > endDate) continue;
    for (const it of so.items || []) {
      const k = String(it.productId);
      if (!prodIds.has(k)) continue;
      salesByPid.set(k, (salesByPid.get(k) || 0) + (it.qty || 0) * (it.price || 0));
    }
  }

  type Acc = { avg: number; sales: number };
  const add = (m: Map<string, Acc>, key: string, avg: number, sales: number): void => {
    const a = m.get(key);
    if (a) { a.avg += avg; a.sales += sales; }
    else m.set(key, { avg, sales });
  };
  const brandAcc = new Map<string, Acc>();
  const catAcc = new Map<string, Acc>();
  const cbAcc = new Map<string, Acc>(); // key = cat + SEP + brand
  let totAvg = 0, totSales = 0;
  for (const p of products) {
    const k = String(p.id);
    const avg = avgStockByPid.get(k) || 0;
    const s = salesByPid.get(k) || 0;
    const b = brandOf(p), c = catOf(p);
    totAvg += avg; totSales += s;
    add(brandAcc, b, avg, s);
    add(catAcc, c, avg, s);
    add(cbAcc, c + SEP + b, avg, s);
  }

  const toStats = (m: Map<string, Acc>): GroupStat[] =>
    [...m.entries()]
      .filter(([, a]) => a.sales > 0)
      .map(([name, a]) => ({ key: name, label: name, ratio: a.avg / a.sales, avgStock: a.avg, sales: a.sales }))
      .sort((x, y) => y.ratio - x.ratio);

  const catSales = new Map<string, number>();
  const brandSales = new Map<string, number>();
  for (const [key, a] of cbAcc) {
    if (a.sales <= 0) continue;
    const [c, b] = key.split(SEP);
    catSales.set(c, (catSales.get(c) || 0) + a.sales);
    brandSales.set(b, (brandSales.get(b) || 0) + a.sales);
  }
  const orderBySalesDesc = (m: Map<string, number>): string[] =>
    [...m.entries()].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1)).map(([k]) => k);
  const catsOrder = orderBySalesDesc(catSales);
  const brandsOrder = orderBySalesDesc(brandSales);
  const rows = catsOrder.map((c) => {
    const row: Record<string, number | string> = { category: c };
    for (const b of brandsOrder) {
      const a = cbAcc.get(c + SEP + b);
      if (a && a.sales > 0) row[b] = a.avg / a.sales;
    }
    return row;
  });

  return {
    period: { granularity, periodKey, startDate, endDate, label },
    total: { ratio: ratioOf(totAvg, totSales), avgStock: totAvg, sales: totSales },
    byBrand: toStats(brandAcc),
    byCat: toStats(catAcc),
    byCatBrand: { cats: catsOrder, brands: brandsOrder, rows },
  };
};
