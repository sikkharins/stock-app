# Stock-to-Sales Ratio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มแท็บ "สต็อก/ขาย" ในหน้า Reports แสดงอัตราส่วน สต็อกเฉลี่ย(฿) ÷ ยอดขาย(฿) เป็น KPI รวม + กราฟแท่ง 3 อัน (ยี่ห้อ / หมวด / หมวด×ยี่ห้อ) เลือกงวดได้ เดือน/ไตรมาส/ปี

**Architecture:** logic ทั้งหมดเป็น pure function ใน `src/utils/stockToSalesRatio.ts` (ทดสอบด้วย vitest) — สต็อกเฉลี่ยคำนวณจาก stock logs จริง (อ่าน `qtyAfter`/`qtyBefore` ณ วันต้น/ปลายงวด). component `StockToSales.jsx` แค่ render ด้วย recharts ตามสไตล์ `Overview.jsx`. แก้ `ReportsPage.jsx` เพิ่มแท็บ + ส่ง `logs` (มีใน `sh` แล้ว). อ่านอย่างเดียว ไม่บันทึกข้อมูล

**Tech Stack:** React 19, recharts 3, TypeScript, vitest

Spec: [docs/superpowers/specs/2026-06-25-stock-to-sales-ratio-design.md](../specs/2026-06-25-stock-to-sales-ratio-design.md)

## File Structure

- `src/utils/stockToSalesRatio.ts` (create) — pure: types, `dayKey`, `shiftISO`, `stockUnitsAt`, `periodBounds`, `listPeriods`, `computeStockToSales`
- `src/utils/stockToSalesRatio.test.ts` (create) — vitest สำหรับทุก export
- `src/components/Reports/StockToSales.jsx` (create) — UI recharts รับ `{ products, sales, logs, cats }`
- `src/components/Reports/ReportsPage.jsx` (modify) — เพิ่มแท็บ `stocksales` + destructure `logs` + render component

---

### Task 1: Util — types + `dayKey` + `shiftISO` + `stockUnitsAt`

**Files:**
- Create: `src/utils/stockToSalesRatio.ts`
- Test: `src/utils/stockToSalesRatio.test.ts`

- [ ] **Step 1: Write the failing test**

สร้าง `src/utils/stockToSalesRatio.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { shiftISO, stockUnitsAt } from "./stockToSalesRatio.ts";

describe("shiftISO", () => {
  it("ลบข้ามเดือน", () => expect(shiftISO("2026-06-01", -1)).toBe("2026-05-31"));
  it("ลบข้ามปี", () => expect(shiftISO("2026-01-01", -1)).toBe("2025-12-31"));
  it("บวกวัน", () => expect(shiftISO("2026-02-28", 1)).toBe("2026-03-01"));
});

describe("stockUnitsAt", () => {
  const logs = [
    { productId: 1, date: "2026-01-10", qtyBefore: 5, qtyAfter: 8 },
    { productId: 1, date: "2026-02-10", qtyBefore: 8, qtyAfter: 3 },
  ];
  it("คืน qtyAfter ของ log ล่าสุด <= วันนั้น", () =>
    expect(stockUnitsAt(logs, "2026-01-31", 99)).toBe(8));
  it("คืน qtyAfter ของ log เดือน ก.พ. เมื่อเลยไป", () =>
    expect(stockUnitsAt(logs, "2026-02-28", 99)).toBe(3));
  it("ไม่มี log ก่อนวันนั้น → คืน qtyBefore ของใบแรก", () =>
    expect(stockUnitsAt(logs, "2026-01-05", 99)).toBe(5));
  it("ไม่มี log เลย → คืน stock ปัจจุบัน", () =>
    expect(stockUnitsAt([], "2026-01-05", 7)).toBe(7));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/stockToSalesRatio.test.ts`
Expected: FAIL — "Failed to resolve import ./stockToSalesRatio.ts" / function not defined

- [ ] **Step 3: Write minimal implementation**

สร้าง `src/utils/stockToSalesRatio.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/stockToSalesRatio.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/utils/stockToSalesRatio.ts src/utils/stockToSalesRatio.test.ts
git commit -m "feat(reports): stockToSalesRatio util — shiftISO + stockUnitsAt

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Util — `periodBounds` + `listPeriods`

**Files:**
- Modify: `src/utils/stockToSalesRatio.ts`
- Test: `src/utils/stockToSalesRatio.test.ts`

- [ ] **Step 1: Write the failing test**

เพิ่มท้าย `stockToSalesRatio.test.ts`:

```ts
import { periodBounds, listPeriods } from "./stockToSalesRatio.ts";

describe("periodBounds", () => {
  it("เดือน", () =>
    expect(periodBounds("month", "2026-06")).toEqual({ startDate: "2026-06-01", endDate: "2026-06-30", label: "มิ.ย. 2026" }));
  it("เดือน ก.พ. ปีอธิกสุรทิน", () =>
    expect(periodBounds("month", "2024-02").endDate).toBe("2024-02-29"));
  it("เดือน ก.พ. ปีปกติ", () =>
    expect(periodBounds("month", "2026-02").endDate).toBe("2026-02-28"));
  it("ไตรมาส Q2", () =>
    expect(periodBounds("quarter", "2026-Q2")).toEqual({ startDate: "2026-04-01", endDate: "2026-06-30", label: "Q2 2026" }));
  it("ปี", () =>
    expect(periodBounds("year", "2026")).toEqual({ startDate: "2026-01-01", endDate: "2026-12-31", label: "2026" }));
});

describe("listPeriods", () => {
  const ref = new Date(2026, 5, 15); // 15 มิ.ย. 2026 (local)
  it("เดือน — 12 งวด ล่าสุดก่อน", () => {
    const ps = listPeriods("month", ref);
    expect(ps).toHaveLength(12);
    expect(ps[0]).toBe("2026-06");
    expect(ps[1]).toBe("2026-05");
    expect(ps[11]).toBe("2025-07");
  });
  it("ไตรมาส — 8 งวด", () => {
    const ps = listPeriods("quarter", ref);
    expect(ps).toHaveLength(8);
    expect(ps[0]).toBe("2026-Q2");
    expect(ps[1]).toBe("2026-Q1");
    expect(ps[2]).toBe("2025-Q4");
  });
  it("ปี — 5 งวด", () =>
    expect(listPeriods("year", ref)).toEqual(["2026", "2025", "2024", "2023", "2022"]));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/stockToSalesRatio.test.ts`
Expected: FAIL — periodBounds / listPeriods not exported

- [ ] **Step 3: Write minimal implementation**

เพิ่มใน `src/utils/stockToSalesRatio.ts` (ต่อจาก `stockUnitsAt`):

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/stockToSalesRatio.test.ts`
Expected: PASS (ทุกเทสรวม Task 1)

- [ ] **Step 5: Commit**

```bash
git add src/utils/stockToSalesRatio.ts src/utils/stockToSalesRatio.test.ts
git commit -m "feat(reports): periodBounds + listPeriods for stock-to-sales

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Util — `computeStockToSales` (aggregator)

**Files:**
- Modify: `src/utils/stockToSalesRatio.ts`
- Test: `src/utils/stockToSalesRatio.test.ts`

- [ ] **Step 1: Write the failing test**

เพิ่มท้าย `stockToSalesRatio.test.ts`:

```ts
import { computeStockToSales } from "./stockToSalesRatio.ts";

describe("computeStockToSales", () => {
  const products = [
    { id: 1, brand: "Sony", categoryId: 10, price: 100, stock: 10 },
    { id: 2, brand: "LG", categoryId: 10, price: 200, stock: 5 },
    { id: 3, brand: "Sony", categoryId: 20, price: 50, stock: 0 },
  ];
  const cats = [{ id: 10, name: "ทีวี" }, { id: 20, name: "สายไฟ" }];
  // p1: ต้นงวด(31 พ.ค.)=qtyBefore 14, ปลายงวด(30 มิ.ย.)=qtyAfter 10 → เฉลี่ย 12 → 12*100=1200
  const logs = [{ productId: 1, date: "2026-06-15", qtyBefore: 14, qtyAfter: 10 }];
  // p2 ไม่มี log → 5*200=1000 ; p3 → 0
  const sales = [
    { status: "confirmed", date: "2026-06-10", items: [{ productId: 1, qty: 2, price: 120 }, { productId: 2, qty: 1, price: 210 }] },
    { status: "cancelled", date: "2026-06-12", items: [{ productId: 1, qty: 99, price: 100 }] }, // ตัดทิ้ง
    { status: "confirmed", date: "2026-05-30", items: [{ productId: 1, qty: 5, price: 100 }] },   // นอกงวด
  ];
  const res = computeStockToSales(products, logs, sales, cats, { granularity: "month", periodKey: "2026-06" });

  it("รวม: avgStock 2200, sales 450, ratio ~4.889", () => {
    expect(res.total.avgStock).toBe(2200);
    expect(res.total.sales).toBe(450);
    expect(res.total.ratio).toBeCloseTo(2200 / 450, 4);
  });
  it("byBrand เรียงมาก→น้อย: Sony 5.0 แล้ว LG ~4.762", () => {
    expect(res.byBrand.map(b => b.label)).toEqual(["Sony", "LG"]);
    expect(res.byBrand[0].ratio).toBeCloseTo(5.0, 4);   // 1200/240
    expect(res.byBrand[1].ratio).toBeCloseTo(1000 / 210, 4);
  });
  it("byCat: ตัดสายไฟ (ยอดขาย 0) เหลือแต่ทีวี", () => {
    expect(res.byCat.map(c => c.label)).toEqual(["ทีวี"]);
    expect(res.byCat[0].ratio).toBeCloseTo(2200 / 450, 4);
  });
  it("byCatBrand: รูปสำหรับ grouped bar ถูก", () => {
    expect(res.byCatBrand.cats).toEqual(["ทีวี"]);
    expect(res.byCatBrand.brands).toEqual(["Sony", "LG"]); // เรียงตามยอดขาย desc (240>210)
    expect(res.byCatBrand.rows[0].category).toBe("ทีวี");
    expect(res.byCatBrand.rows[0].Sony).toBeCloseTo(5.0, 4);
    expect(res.byCatBrand.rows[0].LG).toBeCloseTo(1000 / 210, 4);
  });
  it("period.label = มิ.ย. 2026", () => expect(res.period.label).toBe("มิ.ย. 2026"));
});

describe("computeStockToSales — ไม่ระบุ", () => {
  const products = [{ id: 9, brand: "", categoryId: 999, price: 10, stock: 4 }];
  const sales = [{ status: "confirmed", date: "2026-06-05", items: [{ productId: 9, qty: 1, price: 100 }] }];
  const res = computeStockToSales(products, [], sales, [], { granularity: "month", periodKey: "2026-06" });
  it("brand/หมวด ว่าง → ไม่ระบุ", () => {
    expect(res.byBrand[0].label).toBe("ไม่ระบุ");
    expect(res.byCat[0].label).toBe("ไม่ระบุ");
    expect(res.byBrand[0].ratio).toBeCloseTo(40 / 100, 4); // avg 4*10=40, sales 100
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/stockToSalesRatio.test.ts`
Expected: FAIL — computeStockToSales not exported

- [ ] **Step 3: Write minimal implementation**

เพิ่มท้าย `src/utils/stockToSalesRatio.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/stockToSalesRatio.test.ts`
Expected: PASS (ทุกเทส)

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: ไม่มี error ที่ไฟล์ `stockToSalesRatio.ts`

- [ ] **Step 6: Commit**

```bash
git add src/utils/stockToSalesRatio.ts src/utils/stockToSalesRatio.test.ts
git commit -m "feat(reports): computeStockToSales aggregator (total/brand/cat/cat-brand)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Component `StockToSales.jsx`

**Files:**
- Create: `src/components/Reports/StockToSales.jsx`

ไม่มี unit test (recharts + jsdom เปราะ — logic ทดสอบครบใน util แล้ว); ยืนยันด้วย typecheck + preview ใน Task 6.

- [ ] **Step 1: Create the component**

สร้าง `src/components/Reports/StockToSales.jsx`:

```jsx
import { useState, useMemo } from "react";
import { fmt } from "../../utils/helpers.js";
import { computeStockToSales, listPeriods, periodBounds } from "../../utils/stockToSalesRatio.ts";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell } from "recharts";

const COLORS = ["#34c759", "#007aff", "#ff9500", "#af52de", "#ff3b30", "#5ac8fa", "#ffcc00", "#ff2d55", "#64d2ff", "#30d158", "#bf5af2", "#ff6482"];
const TIP_STYLE = { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12, padding: "8px 12px" };
const UNIT = { month: "เดือน", quarter: "ไตรมาส", year: "ปี" };
const GRAN = [["month", "เดือน"], ["quarter", "ไตรมาส"], ["year", "ปี"]];
const r2 = (v) => (v == null || isNaN(v) ? "—" : v.toFixed(2));

const cardStyle = { background: "var(--panel)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "1rem", marginBottom: 16 };
const emptyBox = <div style={{ textAlign: "center", color: "var(--faint)", padding: "2rem", fontSize: 12 }}>ยังไม่มีข้อมูล</div>;

function RatioTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const items = payload.filter((p) => p.value != null);
  if (!items.length) return null;
  const single = items.length === 1 ? items[0].payload : null;
  return (
    <div style={TIP_STYLE}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {items.map((p) => (
        <div key={p.dataKey} style={{ color: p.color }}>{p.name + ": " + r2(p.value) + "x"}</div>
      ))}
      {single && single.avgStock != null && (
        <div style={{ borderTop: "1px solid var(--line)", marginTop: 4, paddingTop: 4, color: "var(--dim)" }}>
          {"สต็อกเฉลี่ย ฿" + fmt(single.avgStock) + " · ยอดขาย ฿" + fmt(single.sales)}
        </div>
      )}
    </div>
  );
}

export default function StockToSales({ products, sales, logs, cats }) {
  const [gran, setGran] = useState("month");
  const periods = useMemo(() => listPeriods(gran), [gran]);
  const defaultKey = periods[1] || periods[0];
  const [periodKey, setPeriodKey] = useState(defaultKey);
  const activeKey = periods.includes(periodKey) ? periodKey : defaultKey;

  const res = useMemo(
    () => computeStockToSales(products || [], logs || [], sales || [], cats || [], { granularity: gran, periodKey: activeKey }),
    [products, logs, sales, cats, gran, activeKey]
  );

  const changeGran = (g) => {
    setGran(g);
    const ps = listPeriods(g);
    setPeriodKey(ps[1] || ps[0]);
  };

  const singleChart = (title, data) => (
    <div style={cardStyle}>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>{title}</div>
      {data.length === 0 ? emptyBox : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--dim)" }} interval={0} angle={-25} textAnchor="end" height={64} />
            <YAxis tick={{ fontSize: 11, fill: "var(--dim)" }} tickFormatter={(v) => v.toFixed(1)} />
            <Tooltip content={<RatioTip />} cursor={{ fill: "var(--line)", opacity: 0.3 }} />
            {res.total.ratio != null && (
              <ReferenceLine y={res.total.ratio} stroke="var(--dim)" strokeDasharray="4 4"
                label={{ value: "รวม " + r2(res.total.ratio), fontSize: 10, fill: "var(--dim)", position: "right" }} />
            )}
            <Bar dataKey="ratio" name="อัตราส่วน" radius={[4, 4, 0, 0]}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );

  const cb = res.byCatBrand;
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
          {GRAN.map(([g, lbl]) => (
            <button key={g} onClick={() => changeGran(g)}
              style={{ padding: "7px 16px", fontSize: 13, border: "none", cursor: "pointer", fontFamily: "inherit",
                background: gran === g ? "var(--text)" : "transparent", color: gran === g ? "var(--panel)" : "var(--dim)", fontWeight: gran === g ? 600 : 400 }}>
              {lbl}
            </button>
          ))}
        </div>
        <select value={activeKey} onChange={(e) => setPeriodKey(e.target.value)}
          style={{ padding: "7px 12px", fontSize: 13, borderRadius: 8, border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text)", fontFamily: "inherit" }}>
          {periods.map((pk, i) => (
            <option key={pk} value={pk}>{periodBounds(gran, pk).label + (i === 0 ? " (ยังไม่จบ)" : "")}</option>
          ))}
        </select>
      </div>

      <div style={{ ...cardStyle, display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--dim)" }}>{"สต็อกเฉลี่ย ÷ ยอดขาย — รวมทั้งร้าน (" + res.period.label + ")"}</div>
          <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.1 }}>{r2(res.total.ratio) + (res.total.ratio != null ? "x" : "")}</div>
          {res.total.ratio != null && (
            <div style={{ fontSize: 12, color: "var(--dim)" }}>{"≈ ถือสต็อกพอขาย " + r2(res.total.ratio) + " " + UNIT[gran]}</div>
          )}
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right", fontSize: 13 }}>
          <div>{"สต็อกเฉลี่ย: ฿" + fmt(res.total.avgStock)}</div>
          <div style={{ color: "var(--dim)" }}>{"ยอดขาย: ฿" + fmt(res.total.sales)}</div>
        </div>
      </div>

      {singleChart("ตามยี่ห้อ", res.byBrand)}
      {singleChart("ตามหมวดสินค้า", res.byCat)}

      <div style={cardStyle}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>ตามหมวดสินค้า × ยี่ห้อ</div>
        {cb.rows.length === 0 ? emptyBox : (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={cb.rows} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
              <XAxis dataKey="category" tick={{ fontSize: 11, fill: "var(--dim)" }} interval={0} angle={-25} textAnchor="end" height={64} />
              <YAxis tick={{ fontSize: 11, fill: "var(--dim)" }} tickFormatter={(v) => v.toFixed(1)} />
              <Tooltip content={<RatioTip />} cursor={{ fill: "var(--line)", opacity: 0.3 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {cb.brands.map((b, i) => <Bar key={b} dataKey={b} name={b} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />)}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Reports/StockToSales.jsx
git commit -m "feat(reports): StockToSales chart component

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Wire into `ReportsPage.jsx`

**Files:**
- Modify: `src/components/Reports/ReportsPage.jsx`

- [ ] **Step 1: Add import**

ใน `src/components/Reports/ReportsPage.jsx` เพิ่มบรรทัด import ใต้ `import RepOverview...`:

```jsx
import StockToSales from "./StockToSales.jsx";
```

- [ ] **Step 2: Add the tab to `TABS`**

แทน:

```jsx
const TABS=[["overview","ภาพรวม"],["compare","เปรียบเทียบ"],["targets","เป้า"],["vatreport","ตัวแทน VAT"],["audit","Audit"],["prices","ราคา"]];
```

ด้วย:

```jsx
const TABS=[["overview","ภาพรวม"],["stocksales","สต็อก/ขาย"],["compare","เปรียบเทียบ"],["targets","เป้า"],["vatreport","ตัวแทน VAT"],["audit","Audit"],["prices","ราคา"]];
```

- [ ] **Step 3: Destructure `logs` from `sh`**

แทน:

```jsx
  const{products,sales,pos,pN,cN,quotes,targets,setTargets,audit,priceHist,users,contacts,canE,cats}=sh;
```

ด้วย (เพิ่ม `logs`):

```jsx
  const{products,sales,pos,pN,cN,quotes,targets,setTargets,audit,priceHist,users,contacts,canE,cats,logs}=sh;
```

- [ ] **Step 4: Render the tab**

เพิ่มบรรทัดใต้ `{sub==="overview"&&<RepOverview .../>}`:

```jsx
    {sub==="stocksales"&&<StockToSales products={products} sales={sales} logs={logs} cats={cats}/>}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/Reports/ReportsPage.jsx
git commit -m "feat(reports): add สต็อก/ขาย tab wiring

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Verify end-to-end

**Files:** (none — verification only)

- [ ] **Step 1: Full typecheck**

Run: `npm run typecheck`
Expected: PASS (ไม่มี error ใหม่)

- [ ] **Step 2: Full test suite**

Run: `npx vitest run`
Expected: PASS รวมไฟล์ `stockToSalesRatio.test.ts`; ไม่มีไฟล์เดิมพัง

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: ไม่มี error ใหม่จากไฟล์ที่เพิ่ม/แก้

- [ ] **Step 4: Preview (read-only)**

เปิด dev server, ไปหน้า Reports → แท็บ "สต็อก/ขาย". ตรวจ:
- ตัวเลือกงวด (เดือน/ไตรมาส/ปี) สลับได้, dropdown งวด default = งวดที่จบล่าสุด, งวดบนสุดติด "(ยังไม่จบ)"
- KPI รวม แสดงอัตราส่วน + สต็อกเฉลี่ย ฿ + ยอดขาย ฿
- กราฟ 3 อัน (ยี่ห้อ / หมวด / หมวด×ยี่ห้อ กลุ่ม) render มีเส้นอ้างอิงรวม, tooltip โชว์อัตราส่วน
- ไม่มี error ใน console
- **อ่านอย่างเดียว — ห้ามกด save/confirm/delete ใดๆ ระหว่างตรวจ (dev ใช้ prod Supabase)**

---

## Self-Review Notes

- **Spec coverage:** หน่วยมูลค่า(฿) ✓(price), avg=(ต้น+ปลาย)/2 ✓(stockUnitsAt+beforeStart/endDate), งวดเดือน/ไตรมาส/ปี ✓, default งวดจบล่าสุด ✓(periods[1]), ราคา=price ✓, กราฟแท่งกลุ่มหมวด×ยี่ห้อ ✓, KPI รวม ✓, edge: sales=0 ตัดทิ้ง ✓, "ไม่ระบุ" ✓, แท็บใน Reports ✓, อ่านอย่างเดียว ✓, เทสต์ util ✓
- **Type consistency:** ฟังก์ชัน/ฟิลด์ตรงกันทุก task — `stockUnitsAt(logs,isoDate,currentStock)`, `periodBounds`/`listPeriods`/`computeStockToSales` ลายเซ็นเดียวกันทั้ง test กับ impl; ผลลัพธ์ใช้ `byCatBrand.{cats,brands,rows}` ตรงกับที่ component อ่าน
- **No placeholders:** ทุก step มีโค้ด/คำสั่งจริง
