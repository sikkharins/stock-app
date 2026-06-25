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
