import { describe, test, expect } from "vitest";
import {
  calcAccumulatedTotal,
  calcCurrentMatchTotal,
  findClaimableTiers,
  getSS,
  toBE,
  AddDue,
  splitLegacyNum,
  fmtDur,
  round2,
  type Promo,
  type Sale,
  type Product,
  type SaleItem,
} from "./helpers.js";

describe("round2", () => {
  test("rounds to 2 decimals", () => {
    expect(round2(1.234)).toBe(1.23);
    expect(round2(1.235)).toBe(1.24);
    expect(round2("1.005")).toBe(1.01); // EPSILON guard
  });
});

describe("toBE (Christian → Buddhist Era)", () => {
  test("converts YYYY-MM-DD → DD/MM/YYYY+543", () => {
    expect(toBE("2026-06-09")).toBe("09/06/2569");
    expect(toBE("2000-01-01")).toBe("01/01/2543");
  });

  test("returns '-' for empty input", () => {
    expect(toBE("")).toBe("-");
    expect(toBE(null)).toBe("-");
    expect(toBE(undefined)).toBe("-");
  });

  test("returns input unchanged when not 3-part date", () => {
    expect(toBE("2026")).toBe("2026"); // 1 part — split length !== 3
    expect(toBE("2026-06")).toBe("2026-06"); // 2 parts
  });
});

describe("AddDue", () => {
  test("adds N days to ISO date string", () => {
    expect(AddDue("2026-01-01", 30)).toBe("2026-01-31");
    expect(AddDue("2026-01-31", 1)).toBe("2026-02-01");
    expect(AddDue("2026-12-31", 1)).toBe("2027-01-01");
  });

  test("returns '' for empty input", () => {
    expect(AddDue("", 5)).toBe("");
    expect(AddDue(undefined, 5)).toBe("");
  });
});

describe("splitLegacyNum", () => {
  test("splits IV{YYYY}/{MM}{nnn} into prefix + suffix", () => {
    expect(splitLegacyNum("IV2026/05003")).toEqual({
      prefix: "IV2026/05",
      suffix: "003",
    });
    expect(splitLegacyNum("IV2025/12999")).toEqual({
      prefix: "IV2025/12",
      suffix: "999",
    });
  });

  test("returns input as prefix with empty suffix when format doesn't match", () => {
    expect(splitLegacyNum("not-legacy")).toEqual({
      prefix: "not-legacy",
      suffix: "",
    });
    expect(splitLegacyNum(undefined)).toEqual({ prefix: "", suffix: "" });
  });
});

describe("fmtDur", () => {
  test("formats seconds as Thai duration", () => {
    expect(fmtDur(45)).toBe("45วิ");
    expect(fmtDur(60)).toBe("1น.");
    expect(fmtDur(125)).toBe("2น."); // 2 minutes 5 sec → "2น." (floor)
    expect(fmtDur(3600)).toBe("1ชม. 0น.");
    expect(fmtDur(3725)).toBe("1ชม. 2น.");
  });

  test("returns '-' for invalid input", () => {
    expect(fmtDur(0)).toBe("-");
    expect(fmtDur(-5)).toBe("-");
    expect(fmtDur(null)).toBe("-");
    expect(fmtDur(undefined)).toBe("-");
  });
});

describe("getSS (stock status by recency)", () => {
  const baseSale = (date: string, productId: number | string = 1): Sale => ({
    soNum: "SO-x",
    status: "completed",
    date,
    items: [{ productId, qty: 1, price: 100 }],
  });

  test("returns 'fossil' when product has no sales", () => {
    const r = getSS(99, []);
    expect(r.key).toBe("fossil");
    expect(r.days).toBeNull();
  });

  test("ignores sales not 'completed'", () => {
    const r = getSS(1, [
      { ...baseSale(new Date().toISOString().slice(0, 10)), status: "draft" },
    ]);
    expect(r.key).toBe("fossil");
  });

  test("classifies by days since most-recent completed sale", () => {
    const today = new Date();
    const isoDaysAgo = (n: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - n);
      return d.toISOString().slice(0, 10);
    };
    expect(getSS(1, [baseSale(isoDaysAgo(3))]).key).toBe("active");
    expect(getSS(1, [baseSale(isoDaysAgo(20))]).key).toBe("slow");
    expect(getSS(1, [baseSale(isoDaysAgo(60))]).key).toBe("dead");
    expect(getSS(1, [baseSale(isoDaysAgo(200))]).key).toBe("fossil");
  });

  test("uses MOST RECENT date when multiple sales exist", () => {
    const today = new Date();
    const old = new Date(today);
    old.setDate(old.getDate() - 100);
    const recent = new Date(today);
    recent.setDate(recent.getDate() - 3);

    const r = getSS(1, [
      baseSale(old.toISOString().slice(0, 10)),
      baseSale(recent.toISOString().slice(0, 10)),
    ]);
    expect(r.key).toBe("active"); // recent wins
  });
});

describe("calcAccumulatedTotal (promo accumulate mode)", () => {
  const promo: Promo = {
    id: "p1",
    mode: "accumulate",
    measureBy: "amount",
    brands: ["LG"],
  };
  const products: Product[] = [
    { id: 1, brand: "LG" },
    { id: 2, brand: "Samsung" },
  ];

  test("returns 0 when promo is null or wrong mode", () => {
    expect(calcAccumulatedTotal(1, null, [], [])).toBe(0);
    expect(
      calcAccumulatedTotal(1, { ...promo, mode: "single" }, [], [])
    ).toBe(0);
  });

  test("returns 0 when customerId is falsy", () => {
    expect(calcAccumulatedTotal(null, promo, [], [])).toBe(0);
    expect(calcAccumulatedTotal(0, promo, [], [])).toBe(0);
  });

  test("sums amount across matching brand items in completed+pending_delivery SOs", () => {
    const sales: Sale[] = [
      {
        soNum: "S1",
        customerId: 1,
        status: "completed",
        items: [
          { productId: 1, qty: 2, price: 1000 }, // LG: 2000
          { productId: 2, qty: 1, price: 500 }, // Samsung: filtered out
        ],
      },
      {
        soNum: "S2",
        customerId: 1,
        status: "pending_delivery",
        items: [{ productId: 1, qty: 1, price: 1500 }], // LG: 1500
      },
      {
        soNum: "S3",
        customerId: 1,
        status: "draft", // wrong status — skip
        items: [{ productId: 1, qty: 10, price: 1000 }],
      },
      {
        soNum: "S4",
        customerId: 2, // different customer — skip
        status: "completed",
        items: [{ productId: 1, qty: 5, price: 1000 }],
      },
    ];
    expect(calcAccumulatedTotal(1, promo, sales, products)).toBe(3500);
  });

  test("measureBy='qty' counts units instead of amount", () => {
    const qtyPromo: Promo = { ...promo, measureBy: "qty" };
    const sales: Sale[] = [
      {
        soNum: "S1",
        customerId: 1,
        status: "completed",
        items: [{ productId: 1, qty: 3, price: 999 }],
      },
    ];
    expect(calcAccumulatedTotal(1, qtyPromo, sales, products)).toBe(3);
  });
});

describe("calcCurrentMatchTotal", () => {
  const products: Product[] = [{ id: 1, brand: "LG" }];

  test("returns 0 when promo is null", () => {
    expect(calcCurrentMatchTotal([], null, products)).toBe(0);
  });

  test("skips items with no productId or zero qty", () => {
    const items: SaleItem[] = [
      { productId: "", qty: 5, price: 100 } as unknown as SaleItem,
      { productId: 1, qty: 0, price: 100 },
    ];
    expect(
      calcCurrentMatchTotal(items, { id: "p", brands: ["LG"] }, products)
    ).toBe(0);
  });

  test("computes match total for current SO items", () => {
    const items: SaleItem[] = [{ productId: 1, qty: 2, price: 500 }];
    expect(
      calcCurrentMatchTotal(items, { id: "p", brands: ["LG"] }, products)
    ).toBe(1000);
  });
});

describe("findClaimableTiers", () => {
  const promo: Promo = {
    id: "p1",
    tiers: [
      { id: "t3", threshold: 30000 },
      { id: "t1", threshold: 10000 },
      { id: "t2", threshold: 20000 },
    ],
  };

  test("returns tiers user has reached but not yet claimed, sorted ascending", () => {
    const customer = { promoClaims: { p1: { claimedTierIds: ["t1"] } } };
    const result = findClaimableTiers(customer, promo, 25000);
    expect(result.map((t) => t.id)).toEqual(["t2"]);
  });

  test("returns ALL tiers ascending when none claimed", () => {
    const result = findClaimableTiers(null, promo, 100000);
    expect(result.map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
  });

  test("returns empty when accumulated < lowest tier threshold", () => {
    expect(findClaimableTiers(null, promo, 5000)).toEqual([]);
  });

  test("excludes already-claimed tiers", () => {
    const customer = {
      promoClaims: { p1: { claimedTierIds: ["t1", "t2"] } },
    };
    const result = findClaimableTiers(customer, promo, 50000);
    expect(result.map((t) => t.id)).toEqual(["t3"]);
  });
});
