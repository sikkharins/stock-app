// gaugeData — ตัวช่วยคำนวณข้อมูลให้ NeonGauge: cumsum รายวัน, % เดือนก่อน, ETA, % เมื่อวาน
import type { Sale } from "./helpers";

const THAI_MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

export function daysInMonth(monthKey: string): number {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function prevMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

type Pred = (so: Sale) => boolean;

// คืนค่ายอดขายรายวัน [d1, d2, ..., dN] ของเดือน (ไม่สะสม — ดูสปาร์คเข้าใจง่ายกว่า)
export function dailyTotals(sales: Sale[] | undefined | null, pred: Pred, monthKey: string): number[] {
  const days = daysInMonth(monthKey);
  const daily = new Array(days).fill(0);
  (sales || []).forEach(so => {
    if (!(so.date || "").startsWith(monthKey)) return;
    if (!pred(so)) return;
    const day = parseInt((so.date || "").slice(8, 10), 10);
    if (!day || day > days) return;
    const sub = (so.items || []).reduce((a, i) => a + i.qty * i.price, 0) - (so.discountAmt || 0);
    daily[day - 1] += sub;
  });
  return daily;
}

// ยอดรวมของเดือนใด เดือนหนึ่ง (filter ด้วย predicate)
export function actualForMonth(sales: Sale[] | undefined | null, pred: Pred, monthKey: string): number {
  return (sales || [])
    .filter(so => (so.date || "").startsWith(monthKey) && pred(so))
    .reduce((s, so) => s + (so.items || []).reduce((a, i) => a + i.qty * i.price, 0) - (so.discountAmt || 0), 0);
}

// % ของเป้าที่ "เมื่อวาน" เพิ่มเข้ามา (= ยอดเมื่อวาน / target × 100)
export function yesterdayPct(sales: Sale[] | undefined | null, pred: Pred, target: number, today: string): number | null {
  if (target <= 0) return null;
  const d = new Date(today + "T00:00:00");
  d.setDate(d.getDate() - 1);
  const yest = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const sum = (sales || [])
    .filter(so => so.date === yest && pred(so))
    .reduce((s, so) => s + (so.items || []).reduce((a, i) => a + i.qty * i.price, 0) - (so.discountAmt || 0), 0);
  return sum / target * 100;
}

export type ETAResult =
  | { kind: "hit"; text: string }
  | { kind: "ontrack"; text: string; etaDay: number }
  | { kind: "miss"; text: string }
  | { kind: "noData"; text: string };

// linear regression ง่าย ๆ: rate = actual/วันที่ผ่านมา, projected day = ที่ถึงเป้า
export function projectETA(actual: number, target: number, monthKey: string, today: string): ETAResult | null {
  if (target <= 0) return null;
  if (actual >= target) return { kind: "hit", text: "บรรลุแล้ว 🎉" };
  const d = new Date(today + "T00:00:00");
  const dayOfMonth = d.getDate();
  const daysInMo = daysInMonth(monthKey);
  if (dayOfMonth === 0 || actual <= 0) return { kind: "noData", text: "—" };
  const dailyRate = actual / dayOfMonth;
  if (dailyRate <= 0) return { kind: "noData", text: "—" };
  const remaining = target - actual;
  const daysNeeded = Math.ceil(remaining / dailyRate);
  const etaDay = dayOfMonth + daysNeeded;
  const [, m] = monthKey.split("-").map(Number);
  if (etaDay > daysInMo) {
    // ทำไม่ทันเดือนนี้ — บอกตรง ๆ ว่าตามอัตรานี้สิ้นเดือนจะได้กี่ %
    const projectedActual = dailyRate * daysInMo;
    const projectedPct = (projectedActual / target) * 100;
    return { kind: "miss", text: "คาดสิ้นเดือน ~" + Math.round(projectedPct) + "%" };
  }
  return { kind: "ontrack", text: "ถึงเป้าวันที่ " + etaDay + " " + THAI_MONTHS[m - 1], etaDay };
}
