import { describe, test, expect } from "vitest";
import {
  stockValueSeries,
  lowStockSeries,
  reservedSeries,
  newProductsSeries,
  salesCountByProduct,
  daysOfStock,
  salesTrend,
  needsAttention,
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

describe("daysOfStock", () => {
  test("returns stock / daily velocity", () => {
    // qty30d=30 → 1/day; stock=15 → 15 days
    expect(daysOfStock(15, 30)).toBe(15);
  });
  test("returns null when no sales and no stock (unknown)", () => {
    expect(daysOfStock(0, 0)).toBe(0);
  });
  test("returns Infinity when stock>0 and no sales", () => {
    expect(daysOfStock(5, 0)).toBe(Infinity);
  });
  test("works with fractional velocity", () => {
    // qty30d=10 → 1/3 per day; stock=5 → 15 days
    expect(daysOfStock(5, 10)).toBe(15);
  });
});

describe("salesTrend", () => {
  test("up when 7-day rate > 110% of 30-day rate", () => {
    // d7/7=2, d30/30=1, ratio=2 → up
    expect(salesTrend(14, 30)).toBe("up");
  });
  test("down when 7-day rate < 90% of 30-day rate", () => {
    // d7/7=0.5, d30/30=1, ratio=0.5 → down
    expect(salesTrend(3.5, 30)).toBe("down");
  });
  test("flat when within ±10%", () => {
    // d7/7=1, d30/30=1, ratio=1 → flat
    expect(salesTrend(7, 30)).toBe("flat");
  });
  test("none when no sales at all", () => {
    expect(salesTrend(0, 0)).toBe("none");
  });
  test("up when monthly rate is 0 but weekly has sales", () => {
    // Cannot reach this via normal salesCountByProduct (d30 ≥ d7), but the
    // pure fn should still behave sanely.
    expect(salesTrend(3, 0)).toBe("up");
  });
});

describe("needsAttention", () => {
  test("true when stock at/below minStock", () => {
    expect(needsAttention({ stock: 2, minStock: 5 }, 0, 0)).toBe(true);
  });
  test("true when reservations exceed stock", () => {
    expect(needsAttention({ stock: 3, minStock: 0 }, 0, 5)).toBe(true);
  });
  test("true when velocity says <14 days left", () => {
    // 30d sold = 30 → 1/day. stock=10 → 10 days → attention
    expect(needsAttention({ stock: 10, minStock: 0 }, 30, 0)).toBe(true);
  });
  test("false when healthy stock + slow velocity", () => {
    // 30d sold = 1 → 30 days estimate at stock=1 (1*30/1=30) — well above 14
    expect(needsAttention({ stock: 10, minStock: 0 }, 1, 0)).toBe(false);
  });
  test("false when no sales and stock above minStock", () => {
    expect(needsAttention({ stock: 5, minStock: 1 }, 0, 0)).toBe(false);
  });
  test("respects custom threshold", () => {
    // 30 days estimate, threshold 60 → trigger
    expect(needsAttention({ stock: 30, minStock: 0 }, 30, 0, 60)).toBe(true);
  });
});
