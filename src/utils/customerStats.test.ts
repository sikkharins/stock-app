import { describe, test, expect } from "vitest";
import {
  salesByCustomerId,
  lifetimeValue,
  revenueTrend,
  lastPurchaseDays,
  outstandingDetail,
  arStatus,
  topProduct,
  avgPerSO,
  daysAgo,
} from "./customerStats";

const TODAY = new Date("2026-06-10T00:00:00Z");
const iso = (n: number) => {
  const d = new Date(TODAY);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

// soNet matches CustomerProfile.jsx logic: items.qty*price - discountAmt
const so = (overrides: any = {}) => ({
  id: 1,
  customerId: 1,
  soNum: "SO-001",
  date: iso(5),
  status: "completed",
  items: [{ productId: 10, qty: 1, price: 1000 }],
  discountAmt: 0,
  payType: "cash",
  creditDays: 0,
  ...overrides,
});

describe("salesByCustomerId", () => {
  test("groups SOs by customerId", () => {
    const sales = [so({ customerId: 1 }), so({ customerId: 2 }), so({ customerId: 1 })];
    const map = salesByCustomerId(sales);
    expect(map[1]).toHaveLength(2);
    expect(map[2]).toHaveLength(1);
  });
  test("empty input returns empty object", () => {
    expect(salesByCustomerId([])).toEqual({});
  });
});

describe("lifetimeValue", () => {
  test("sums soNet across all SOs regardless of status", () => {
    const sales = [
      so({ items: [{ qty: 2, price: 100 }] }),
      so({ items: [{ qty: 1, price: 50 }], status: "cancelled" }),
      so({ items: [{ qty: 3, price: 100 }], discountAmt: 50 }),
    ];
    expect(lifetimeValue({ id: 1 }, sales)).toBe(200 + 50 + 250);
  });
  test("no sales returns 0", () => {
    expect(lifetimeValue({ id: 1 }, [])).toBe(0);
  });
});

describe("revenueTrend", () => {
  test("computes last30 and prev30 deltaPct", () => {
    const sales = [
      so({ date: iso(5), items: [{ qty: 1, price: 1000 }] }),
      so({ date: iso(25), items: [{ qty: 1, price: 500 }] }),
      so({ date: iso(40), items: [{ qty: 1, price: 500 }] }),
    ];
    const t = revenueTrend({ id: 1 }, sales, TODAY);
    expect(t.last30).toBe(1500);
    expect(t.prev30).toBe(500);
    expect(t.deltaPct).toBe(200);
  });
  test("prev30 = 0 → deltaPct = 0 (avoid /0)", () => {
    const sales = [so({ date: iso(5), items: [{ qty: 1, price: 1000 }] })];
    expect(revenueTrend({ id: 1 }, sales, TODAY).deltaPct).toBe(0);
  });
  test("no sales returns zeroes", () => {
    expect(revenueTrend({ id: 1 }, [], TODAY)).toEqual({ last30: 0, prev30: 0, deltaPct: 0 });
  });
});

describe("lastPurchaseDays", () => {
  test("days between today and most recent sale date", () => {
    const sales = [so({ date: iso(12) }), so({ date: iso(30) })];
    expect(lastPurchaseDays({ id: 1 }, sales, TODAY)).toBe(12);
  });
  test("no sales returns null", () => {
    expect(lastPurchaseDays({ id: 1 }, [], TODAY)).toBeNull();
  });
});

describe("outstandingDetail", () => {
  test("sums remaining and counts overdue", () => {
    const sales = [
      so({ soNum: "S1", date: iso(60), status: "completed", payType: "credit", creditDays: 45, items: [{ qty: 1, price: 1000 }] }),
      so({ soNum: "S2", date: iso(10), status: "completed", payType: "credit", creditDays: 45, items: [{ qty: 1, price: 500 }] }),
    ];
    const payments = [{ refId: "S1", type: "ar", amount: 200 }];
    const r = outstandingDetail({ id: 1 }, sales, payments, TODAY);
    expect(r.total).toBe(800 + 500);
    expect(r.count).toBe(2);
    expect(r.overdueCount).toBe(1); // S1 is 60d old, 45d credit → 15d overdue
  });
  test("ignores non-completed SOs", () => {
    const sales = [so({ status: "pending_delivery", items: [{ qty: 1, price: 100 }] })];
    expect(outstandingDetail({ id: 1 }, sales, [], TODAY)).toEqual({ total: 0, count: 0, overdueCount: 0 });
  });
});

describe("arStatus", () => {
  test("overdue when any overdue SO", () => {
    const sales = [so({ soNum: "S1", date: iso(60), status: "completed", payType: "credit", creditDays: 45, items: [{ qty: 1, price: 1000 }] })];
    expect(arStatus({ id: 1 }, sales, [], TODAY)).toBe("overdue");
  });
  test("ar when outstanding > 0 but no overdue", () => {
    const sales = [so({ soNum: "S1", date: iso(10), status: "completed", payType: "credit", creditDays: 45, items: [{ qty: 1, price: 1000 }] })];
    expect(arStatus({ id: 1 }, sales, [], TODAY)).toBe("ar");
  });
  test("dormant when last purchase > 60d ago and outstanding = 0", () => {
    const sales = [so({ date: iso(90), status: "completed", items: [{ qty: 1, price: 100 }] })];
    const payments = [{ refId: "SO-001", type: "ar", amount: 100 }];
    expect(arStatus({ id: 1 }, sales, payments, TODAY)).toBe("dormant");
  });
  test("normal when recent + no outstanding", () => {
    const sales = [so({ date: iso(5), status: "completed", items: [{ qty: 1, price: 100 }] })];
    const payments = [{ refId: "SO-001", type: "ar", amount: 100 }];
    expect(arStatus({ id: 1 }, sales, payments, TODAY)).toBe("normal");
  });
  test("normal when no sales ever (do not flag empty as dormant)", () => {
    expect(arStatus({ id: 1 }, [], [], TODAY)).toBe("normal");
  });
});

describe("topProduct", () => {
  test("returns highest-qty product across history", () => {
    const sales = [
      so({ items: [{ productId: 10, qty: 5, price: 100 }, { productId: 20, qty: 1, price: 100 }] }),
      so({ items: [{ productId: 20, qty: 3, price: 100 }] }),
    ];
    const products = [{ id: 10, name: "A" }, { id: 20, name: "B" }];
    expect(topProduct({ id: 1 }, sales, products)).toEqual({ name: "A", qty: 5 });
  });
  test("returns null when no sales", () => {
    expect(topProduct({ id: 1 }, [], [])).toBeNull();
  });
});

describe("avgPerSO", () => {
  test("lifetime / count", () => {
    const sales = [
      so({ items: [{ qty: 1, price: 100 }] }),
      so({ items: [{ qty: 1, price: 300 }] }),
    ];
    expect(avgPerSO({ id: 1 }, sales)).toBe(200);
  });
  test("no sales returns 0", () => {
    expect(avgPerSO({ id: 1 }, [])).toBe(0);
  });
});

describe("daysAgo", () => {
  test("returns whole days between today and dateISO", () => {
    expect(daysAgo(iso(5), TODAY)).toBe(5);
    expect(daysAgo(iso(0), TODAY)).toBe(0);
  });
});
