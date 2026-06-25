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
