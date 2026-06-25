import { describe, it, expect } from "vitest";
import { shiftISO, stockUnitsAt, periodBounds, listPeriods } from "./stockToSalesRatio.ts";

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
