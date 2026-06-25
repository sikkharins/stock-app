import { describe, it, expect } from "vitest";
import { shiftISO, stockUnitsAt, periodBounds, listPeriods, computeStockToSales, latestPeriodWithSales } from "./stockToSalesRatio";

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
    expect(res.byBrand.map((b) => b.label)).toEqual(["Sony", "LG"]);
    expect(res.byBrand[0].ratio).toBeCloseTo(5.0, 4); // 1200/240
    expect(res.byBrand[1].ratio).toBeCloseTo(1000 / 210, 4);
  });
  it("byCat: ตัดสายไฟ (ยอดขาย 0) เหลือแต่ทีวี", () => {
    expect(res.byCat.map((c) => c.label)).toEqual(["ทีวี"]);
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

describe("latestPeriodWithSales", () => {
  const sales = [
    { status: "completed", date: "2026-06-02", items: [{ productId: 1, qty: 1, price: 10 }] },
    { status: "cancelled", date: "2026-05-10", items: [{ productId: 1, qty: 1, price: 10 }] },
  ];
  it("คืนงวดล่าสุดที่มีขาย (ข้าม cancelled)", () =>
    expect(latestPeriodWithSales(["2026-06", "2026-05", "2026-04"], sales, "month")).toBe("2026-06"));
  it("ไม่มีงวดไหนมีขายใน list → null", () =>
    expect(latestPeriodWithSales(["2026-04", "2026-03"], sales, "month")).toBe(null));
  it("รองรับ quarter key", () =>
    expect(latestPeriodWithSales(["2026-Q2", "2026-Q1"], sales, "quarter")).toBe("2026-Q2"));
  it("รองรับ year key", () =>
    expect(latestPeriodWithSales(["2026", "2025"], sales, "year")).toBe("2026"));
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
