import { describe, test, expect } from "vitest";
import {
  stockValueSeries,
  lowStockSeries,
  reservedSeries,
  newProductsSeries,
  salesCountByProduct,
  daysAgoISO,
} from "./productStats";

const today = new Date("2026-06-10T00:00:00Z");

describe("daysAgoISO", () => {
  test("returns YYYY-MM-DD format n days back", () => {
    expect(daysAgoISO(0, today)).toBe("2026-06-10");
    expect(daysAgoISO(1, today)).toBe("2026-06-09");
    expect(daysAgoISO(30, today)).toBe("2026-05-11");
  });
});

describe("stockValueSeries", () => {
  test("flat series at current value when no logs", () => {
    const products = [{ id: 1, stock: 10, price: 100 }];
    const series = stockValueSeries(products, [], 7, today);
    expect(series).toHaveLength(7);
    expect(series.every((v) => v === 1000)).toBe(true);
  });

  test("rewinds stock changes day by day", () => {
    const products = [{ id: 1, stock: 10, price: 100 }];
    const logs = [
      { productId: 1, type: "in", qty: 4, date: "2026-06-09" },
    ];
    const series = stockValueSeries(products, logs, 3, today);
    expect(series).toEqual([600, 1000, 1000]);
  });

  test("ignores logs outside window", () => {
    const products = [{ id: 1, stock: 10, price: 100 }];
    const logs = [{ productId: 1, type: "in", qty: 4, date: "2026-01-01" }];
    const series = stockValueSeries(products, logs, 5, today);
    expect(series.every((v) => v === 1000)).toBe(true);
  });
});

describe("lowStockSeries", () => {
  test("flat zero when no products have minStock", () => {
    const products = [{ id: 1, stock: 10, minStock: 0, price: 1 }];
    expect(lowStockSeries(products, [], 5, today)).toEqual([0, 0, 0, 0, 0]);
  });

  test("counts low-stock products at end of each day", () => {
    const products = [{ id: 1, stock: 2, minStock: 5, price: 1 }];
    const series = lowStockSeries(products, [], 3, today);
    expect(series).toEqual([1, 1, 1]);
  });
});

describe("reservedSeries", () => {
  test("counts pending_delivery item qty per day", () => {
    const sales = [
      {
        status: "pending_delivery",
        date: "2026-06-10",
        items: [{ qty: 3 }, { qty: 2 }],
      },
    ];
    const series = reservedSeries(sales, 3, today);
    expect(series).toEqual([0, 0, 5]);
  });
});

describe("newProductsSeries", () => {
  test("counts first-in log per product per day (earliest date wins)", () => {
    const logs = [
      { productId: 1, type: "in", qty: 1, date: "2026-06-10" },
      { productId: 1, type: "in", qty: 1, date: "2026-06-09" },
      { productId: 2, type: "in", qty: 1, date: "2026-06-08" },
    ];
    const series = newProductsSeries(logs, 3, today);
    // -2 (06-08): product 2 earliest → 1
    // -1 (06-09): product 1 earliest (06-09 < 06-10) → 1
    //  0 (06-10): nothing → 0
    expect(series).toEqual([1, 1, 0]);
  });

  test("ignores non-'in' log types", () => {
    const logs = [
      { productId: 1, type: "adjust_in", qty: 5, date: "2026-06-10" },
      { productId: 2, type: "out", qty: 1, date: "2026-06-09" },
    ];
    expect(newProductsSeries(logs, 3, today)).toEqual([0, 0, 0]);
  });
});

describe("salesCountByProduct", () => {
  test("sums qty for last 7 and 30 days, excludes cancelled", () => {
    const sales = [
      { status: "completed", date: "2026-06-10", items: [{ productId: 1, qty: 2 }] },
      { status: "completed", date: "2026-06-05", items: [{ productId: 1, qty: 3 }] },
      { status: "completed", date: "2026-05-20", items: [{ productId: 1, qty: 4 }] },
      { status: "cancelled", date: "2026-06-09", items: [{ productId: 1, qty: 99 }] },
    ];
    const r = salesCountByProduct(sales as any, today);
    expect(r["1"]).toEqual({ d7: 5, d30: 9 });
  });

  test("ignores SOs older than 30 days", () => {
    const sales = [
      { status: "completed", date: "2026-01-01", items: [{ productId: 1, qty: 50 }] },
    ];
    const r = salesCountByProduct(sales as any, today);
    expect(r["1"]).toBeUndefined();
  });

  test("counts pending_delivery as sold", () => {
    const sales = [
      { status: "pending_delivery", date: "2026-06-10", items: [{ productId: 2, qty: 7 }] },
    ];
    const r = salesCountByProduct(sales as any, today);
    expect(r["2"]).toEqual({ d7: 7, d30: 7 });
  });
});
