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
