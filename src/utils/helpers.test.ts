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
  haversineKm,
  productCubicM,
  soVolumeM3,
  soRevenue,
  consolidatePickList,
  scoreSO,
  parseGmapsUrl,
  soItemsByCategory,
  snapshotItemParts,
  expandItemParts,
  DEFAULT_SPLIT_PARTS,
  CLASS_M3,
  type Promo,
  type Sale,
  type Product,
  type SaleItem,
  type Contact,
  type Category,
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

describe("haversineKm", () => {
  test("identical points = 0", () => {
    expect(haversineKm(13.75, 100.5, 13.75, 100.5)).toBe(0);
  });

  test("Bangkok ↔ Chiang Mai ≈ 580 km", () => {
    const d = haversineKm(13.7563, 100.5018, 18.7883, 98.9853);
    expect(d).toBeGreaterThan(560);
    expect(d).toBeLessThan(600);
  });

  test("antipodal points ≈ 20015 km (half Earth's circumference)", () => {
    const d = haversineKm(0, 0, 0, 180);
    expect(d).toBeGreaterThan(20000);
    expect(d).toBeLessThan(20020);
  });
});

describe("productCubicM", () => {
  test("explicit cubicM wins", () => {
    expect(productCubicM({ id: 1, cubicM: 1.5 })).toBe(1.5);
  });

  test("falls back to size class when cubicM missing", () => {
    expect(productCubicM({ id: 1, sizeClass: "S" })).toBe(CLASS_M3.S);
    expect(productCubicM({ id: 1, sizeClass: "XL" })).toBe(CLASS_M3.XL);
  });

  test("defaults to M when both missing", () => {
    expect(productCubicM({ id: 1 })).toBe(CLASS_M3.M);
  });

  test("null/undefined product → M default", () => {
    expect(productCubicM(null)).toBe(CLASS_M3.M);
    expect(productCubicM(undefined)).toBe(CLASS_M3.M);
  });

  test("zero or negative cubicM falls through to class", () => {
    expect(productCubicM({ id: 1, cubicM: 0, sizeClass: "L" })).toBe(CLASS_M3.L);
  });

  test("derives from W×L×H (cm) when cubicM missing", () => {
    // 60 × 80 × 175 cm = 840,000 cm³ = 0.84 m³
    expect(
      productCubicM({ id: 1, widthCm: 60, lengthCm: 80, heightCm: 175 })
    ).toBeCloseTo(0.84);
  });

  test("explicit cubicM overrides dimensions", () => {
    expect(
      productCubicM({
        id: 1,
        cubicM: 0.5,
        widthCm: 60,
        lengthCm: 80,
        heightCm: 175,
      })
    ).toBe(0.5);
  });

  test("dimensions only used if ALL three are positive", () => {
    expect(
      productCubicM({ id: 1, widthCm: 60, lengthCm: 80, sizeClass: "S" })
    ).toBe(CLASS_M3.S); // missing height → fall through
    expect(
      productCubicM({ id: 1, widthCm: 0, lengthCm: 80, heightCm: 175, sizeClass: "S" })
    ).toBe(CLASS_M3.S); // zero width → fall through
  });
});

describe("soVolumeM3", () => {
  const products: Product[] = [
    { id: 1, cubicM: 1.0 },
    { id: 2, sizeClass: "S" }, // 0.05
  ];

  test("sums qty * cubicM across items", () => {
    const so: Sale = { items: [{ productId: 1, qty: 3, price: 0 }] };
    expect(soVolumeM3(so, products)).toBeCloseTo(3.0);
  });

  test("mixes explicit cubicM + class fallback", () => {
    const so: Sale = {
      items: [
        { productId: 1, qty: 2, price: 0 }, // 2 * 1.0 = 2.0
        { productId: 2, qty: 4, price: 0 }, // 4 * 0.05 = 0.2
      ],
    };
    expect(soVolumeM3(so, products)).toBeCloseTo(2.2);
  });

  test("unknown productId uses M default", () => {
    const so: Sale = { items: [{ productId: 99, qty: 1, price: 0 }] };
    expect(soVolumeM3(so, products)).toBeCloseTo(CLASS_M3.M);
  });

  test("null SO → 0", () => {
    expect(soVolumeM3(null, products)).toBe(0);
  });
});

describe("soRevenue", () => {
  test("sums qty * price minus discount", () => {
    const so: Sale = {
      items: [
        { productId: 1, qty: 2, price: 1000 },
        { productId: 2, qty: 1, price: 500 },
      ],
      discountAmt: 100,
    };
    expect(soRevenue(so)).toBe(2400); // 2500 - 100
  });

  test("no discount → just items total", () => {
    const so: Sale = {
      items: [{ productId: 1, qty: 3, price: 999 }],
    };
    expect(soRevenue(so)).toBe(2997);
  });

  test("null SO → 0", () => {
    expect(soRevenue(null)).toBe(0);
  });
});

describe("consolidatePickList", () => {
  const products: Product[] = [
    { id: 1, name: "Fridge", nameT: "ตู้เย็น 14 คิว" },
    { id: 2, name: "TV", nameT: "ทีวี 55 นิ้ว" },
  ];

  test("groups same product across SOs, sums qty, tracks sources", () => {
    const sos: Sale[] = [
      {
        soNum: "S1",
        items: [
          { productId: 1, qty: 2, price: 0 },
          { productId: 2, qty: 1, price: 0 },
        ],
      },
      { soNum: "S2", items: [{ productId: 1, qty: 3, price: 0 }] },
      { soNum: "S3", items: [{ productId: 2, qty: 4, price: 0 }] },
    ];
    const list = consolidatePickList(sos, products);
    expect(list).toHaveLength(2);
    const fridge = list.find((e) => e.productId === 1)!;
    const tv = list.find((e) => e.productId === 2)!;
    expect(fridge.totalQty).toBe(5);
    expect(fridge.sources).toEqual(["S1", "S2"]);
    expect(tv.totalQty).toBe(5);
    expect(tv.sources).toEqual(["S1", "S3"]);
  });

  test("uses Thai name (nameT) when available", () => {
    const sos: Sale[] = [{ soNum: "S1", items: [{ productId: 1, qty: 1, price: 0 }] }];
    expect(consolidatePickList(sos, products)[0].name).toBe("ตู้เย็น 14 คิว");
  });

  test("handles same SO listing same product twice (dedupes sources)", () => {
    const sos: Sale[] = [
      {
        soNum: "S1",
        items: [
          { productId: 1, qty: 2, price: 0 },
          { productId: 1, qty: 3, price: 0 },
        ],
      },
    ];
    const list = consolidatePickList(sos, products);
    expect(list[0].totalQty).toBe(5);
    expect(list[0].sources).toEqual(["S1"]);
  });

  test("empty input → empty list", () => {
    expect(consolidatePickList([], products)).toEqual([]);
    expect(consolidatePickList(null, products)).toEqual([]);
  });
});

describe("scoreSO", () => {
  const products: Product[] = [{ id: 1, sizeClass: "M" }]; // 0.3 m³
  const truckCapM3 = 8;

  // Build customer geo: 3 clustered around Bangkok + 1 in Chiang Mai
  const contacts: Contact[] = [
    { id: 1, name: "C1-BKK", lat: 13.75, lng: 100.5 },
    { id: 2, name: "C2-BKK", lat: 13.78, lng: 100.55 }, // ~5 km from C1
    { id: 3, name: "C3-BKK", lat: 13.72, lng: 100.48 }, // ~5 km from C1
    { id: 4, name: "C4-CM", lat: 18.78, lng: 98.99 },   // ~580 km away
  ];

  const mkSo = (
    soNum: string,
    customerId: number,
    revenue: number,
    qty: number = 5
  ): Sale => ({
    soNum,
    customerId,
    status: "pending_delivery",
    items: [{ productId: 1, qty, price: revenue / qty }],
  });

  test("clustered + high revenue → high score (>70)", () => {
    const pool: Sale[] = [
      mkSo("A1", 1, 50000), // anchor: BKK, high revenue
      mkSo("A2", 2, 40000),
      mkSo("A3", 3, 30000),
      mkSo("A4", 4, 40000), // far Chiang Mai
    ];
    const s = scoreSO(pool[0], pool, contacts, products, truckCapM3);
    // All 3 OTHER BKK SOs are within 50km of A1; A4 is far.
    // 2/3 = 0.67 proximity, revenue=50000 → capped 1, capacity ~0.19 → ideal
    // Score = 100 * (0.4*0.67 + 0.2*1 + 0.4*1) ≈ 87
    expect(s).toBeGreaterThan(70);
  });

  test("isolated + low revenue → low score (<40)", () => {
    const pool: Sale[] = [
      mkSo("A1", 1, 5000), // BKK alone, cheap
      mkSo("A4", 4, 50000), // far away
    ];
    const s = scoreSO(pool[0], pool, contacts, products, truckCapM3);
    // 0/1 within 50km of A1 (A4 is far), revenue 5000/30000=0.17, capacity ok
    expect(s).toBeLessThan(40);
  });

  test("missing lat/lng on customer → neutral proximity 0.3", () => {
    const noGeoContacts: Contact[] = [{ id: 1, name: "X" }];
    const pool: Sale[] = [mkSo("A1", 1, 30000)];
    const s = scoreSO(pool[0], pool, noGeoContacts, products, truckCapM3);
    // proximity=0.3, revenue=1, capacity ok ≈ 100*(0.12+0.2+0.4) = 72
    expect(s).toBeGreaterThan(50);
    expect(s).toBeLessThan(85);
  });

  test("over-capacity SO (volume > truck) → low capacity score", () => {
    // 1 truck = 8 m³, sizeClass M = 0.3 → need qty 30+ to exceed
    const pool: Sale[] = [mkSo("A1", 1, 50000, 100)]; // 100*0.3 = 30 m³ > 8
    const s = scoreSO(pool[0], pool, contacts, products, truckCapM3);
    // Revenue = 1, capacity ≈ 0 (over), proximity neutral fallback = 0.3
    // Score = 100*(0.4*0.3 + 0.2*0 + 0.4*1) ≈ 52 — still moderate from revenue
    expect(s).toBeLessThan(60);
  });
});

describe("parseGmapsUrl", () => {
  test("/maps/@LAT,LNG,ZOOM format", () => {
    expect(
      parseGmapsUrl("https://www.google.com/maps/@13.7563,100.5018,17z")
    ).toEqual({ lat: 13.7563, lng: 100.5018 });
  });

  test("?q=LAT,LNG format", () => {
    expect(parseGmapsUrl("https://maps.google.com/?q=13.7563,100.5018")).toEqual({
      lat: 13.7563,
      lng: 100.5018,
    });
  });

  test("embed !3d/!4d format", () => {
    expect(
      parseGmapsUrl(
        "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3870!3d13.7563!4d100.5018"
      )
    ).toEqual({ lat: 13.7563, lng: 100.5018 });
  });

  test("plain 'lat,lng' paste", () => {
    expect(parseGmapsUrl("13.7563, 100.5018")).toEqual({
      lat: 13.7563,
      lng: 100.5018,
    });
    expect(parseGmapsUrl("13.7563,100.5018")).toEqual({
      lat: 13.7563,
      lng: 100.5018,
    });
  });

  test("handles negative coordinates", () => {
    expect(parseGmapsUrl("https://www.google.com/maps/@-33.86,151.20,17z")).toEqual({
      lat: -33.86,
      lng: 151.2,
    });
  });

  test("returns null for unparseable input", () => {
    expect(parseGmapsUrl("not a url")).toBeNull();
    expect(parseGmapsUrl("https://maps.app.goo.gl/abc123")).toBeNull(); // short link
    expect(parseGmapsUrl("")).toBeNull();
    expect(parseGmapsUrl(null)).toBeNull();
  });

  test("prefers !3d/!4d place pin over @viewport center", () => {
    // Real-world: @ is the camera center (offset), !3d!4d is the actual shop pin
    const url =
      "https://www.google.com/maps/place/Shop/@13.7563,100.5018,17z/data=!4m6!3m5!1s0x0!8m2!3d13.7521!4d100.5034!16s";
    expect(parseGmapsUrl(url)).toEqual({ lat: 13.7521, lng: 100.5034 });
  });

  test("prefers ?q= shared pin over @viewport center", () => {
    const url = "https://www.google.com/maps/@13.7563,100.5018,17z/?q=13.7521,100.5034";
    expect(parseGmapsUrl(url)).toEqual({ lat: 13.7521, lng: 100.5034 });
  });
});

describe("soItemsByCategory", () => {
  const categories: Category[] = [
    {
      id: 1,
      name: "ตู้เย็น",
      subs: [
        { id: 11, name: "ประตูเดียว" },
        { id: 12, name: "2 ประตู" },
      ],
    },
    {
      id: 2,
      name: "เครื่องซักผ้า",
      subs: [
        { id: 21, name: "ฝาบน" },
        { id: 22, name: "ฝาหน้า" },
      ],
    },
  ];

  const products: Product[] = [
    { id: 1, categoryId: 1, subcategoryId: 12, sizeClass: "XL", noLayDown: true },
    { id: 2, categoryId: 1, subcategoryId: 11, sizeClass: "L" },
    { id: 3, categoryId: 2, subcategoryId: 21, sizeClass: "L" },
    { id: 4, categoryId: 2, subcategoryId: 22, sizeClass: "M" },
  ];

  test("groups items by (catId, subId), sums qty and volume", () => {
    const so: Sale = {
      items: [
        { productId: 1, qty: 3, price: 0 }, // ตู้เย็น 2 ประตู: XL=2.5 * 3 = 7.5
        { productId: 3, qty: 2, price: 0 }, // ซักผ้า ฝาบน: L=1.0 * 2 = 2.0
        { productId: 4, qty: 1, price: 0 }, // ซักผ้า ฝาหน้า: M=0.3 * 1 = 0.3
      ],
    };
    const groups = soItemsByCategory(so, products, categories);
    expect(groups).toHaveLength(3);
    // Sorted by totalVolM3 descending
    expect(groups[0].catName).toBe("ตู้เย็น");
    expect(groups[0].subName).toBe("2 ประตู");
    expect(groups[0].qty).toBe(3);
    expect(groups[0].hasNoLayDown).toBe(true);
    expect(groups[1].catName).toBe("เครื่องซักผ้า");
    expect(groups[1].subName).toBe("ฝาบน");
    expect(groups[1].qty).toBe(2);
    expect(groups[2].subName).toBe("ฝาหน้า");
    expect(groups[2].qty).toBe(1);
  });

  test("combines items with same (cat,sub) across multiple item rows", () => {
    const so: Sale = {
      items: [
        { productId: 3, qty: 2, price: 0 }, // ซักผ้า ฝาบน
        { productId: 3, qty: 5, price: 0 }, // same again
      ],
    };
    const groups = soItemsByCategory(so, products, categories);
    expect(groups).toHaveLength(1);
    expect(groups[0].qty).toBe(7);
  });

  test("hasNoLayDown true if ANY product in the group is noLayDown", () => {
    const mixed: Product[] = [
      { id: 1, categoryId: 1, subcategoryId: 12, noLayDown: false },
      { id: 2, categoryId: 1, subcategoryId: 12, noLayDown: true },
    ];
    const so: Sale = {
      items: [
        { productId: 1, qty: 1, price: 0 },
        { productId: 2, qty: 1, price: 0 },
      ],
    };
    expect(soItemsByCategory(so, mixed, categories)[0].hasNoLayDown).toBe(true);
  });

  test("unknown product → skipped silently", () => {
    const so: Sale = { items: [{ productId: 999, qty: 1, price: 0 }] };
    expect(soItemsByCategory(so, products, categories)).toEqual([]);
  });

  test("missing categories arg → group with '?' catName", () => {
    const so: Sale = { items: [{ productId: 1, qty: 1, price: 0 }] };
    const groups = soItemsByCategory(so, products, null);
    expect(groups).toHaveLength(1);
    expect(groups[0].catName).toBe("?");
    expect(groups[0].subName).toBe("");
  });
});

describe("snapshotItemParts", () => {
  const acProduct: Product = {
    id: 1,
    name: "AC LG 12000 BTU",
    splitEnabled: true,
    splitParts: DEFAULT_SPLIT_PARTS,
  };

  test("returns undefined when product has no split", () => {
    expect(snapshotItemParts({ id: 2, name: "Fridge" }, 10000)).toBeUndefined();
  });

  test("returns undefined when splitEnabled is true but splitParts missing", () => {
    expect(
      snapshotItemParts({ id: 3, name: "X", splitEnabled: true }, 10000)
    ).toBeUndefined();
  });

  test("returns undefined when ratios don't sum to 1 (misconfigured)", () => {
    expect(
      snapshotItemParts(
        {
          id: 4,
          name: "X",
          splitEnabled: true,
          splitParts: [
            { key: "a", name: "A", priceRatio: 0.5 },
            { key: "b", name: "B", priceRatio: 0.3 },
          ],
        },
        10000
      )
    ).toBeUndefined();
  });

  test("splits AC ฿10,000 into 60/40 parts with rounded prices", () => {
    const parts = snapshotItemParts(acProduct, 10000)!;
    expect(parts).toHaveLength(2);
    expect(parts[0]).toEqual({ key: "hot", name: "คอยล์ร้อน", price: 6000 });
    expect(parts[1]).toEqual({ key: "cold", name: "คอยล์เย็น", price: 4000 });
  });

  test("honors a non-default 65/35 ratio override", () => {
    const customAc: Product = {
      id: 5,
      name: "Y",
      splitEnabled: true,
      splitParts: [
        { key: "hot", name: "ร้อน", priceRatio: 0.65 },
        { key: "cold", name: "เย็น", priceRatio: 0.35 },
      ],
    };
    const parts = snapshotItemParts(customAc, 10000)!;
    expect(parts[0].price).toBeCloseTo(6500);
    expect(parts[1].price).toBeCloseTo(3500);
  });

  test("null / undefined product → undefined", () => {
    expect(snapshotItemParts(null, 10000)).toBeUndefined();
    expect(snapshotItemParts(undefined, 10000)).toBeUndefined();
  });
});

describe("expandItemParts", () => {
  const acProduct: Product = {
    id: 1,
    name: "AC LG 12000",
    splitEnabled: true,
    splitParts: DEFAULT_SPLIT_PARTS,
  };
  const fridge: Product = { id: 2, name: "Fridge" };

  test("non-split item → one entry, partKey empty", () => {
    const item: SaleItem = { productId: 2, qty: 3, price: 12900 };
    const out = expandItemParts(item, fridge);
    expect(out).toHaveLength(1);
    expect(out[0].partKey).toBe("");
    expect(out[0].displayName).toBe("Fridge");
    expect(out[0].qty).toBe(3);
    expect(out[0].unitPrice).toBe(12900);
  });

  test("split item → N rows with composite display names + per-part prices", () => {
    const item: SaleItem = {
      productId: 1,
      qty: 2,
      price: 10000,
      parts: [
        { key: "hot", name: "คอยล์ร้อน", price: 6000 },
        { key: "cold", name: "คอยล์เย็น", price: 4000 },
      ],
    };
    const out = expandItemParts(item, acProduct);
    expect(out).toHaveLength(2);
    expect(out[0].displayName).toBe("AC LG 12000 — คอยล์ร้อน");
    expect(out[0].partKey).toBe("hot");
    expect(out[0].qty).toBe(2);
    expect(out[0].unitPrice).toBe(6000);
    expect(out[1].displayName).toBe("AC LG 12000 — คอยล์เย็น");
    expect(out[1].unitPrice).toBe(4000);
  });

  test("uses Thai name (nameT) when present", () => {
    const item: SaleItem = { productId: 2, qty: 1, price: 100 };
    expect(
      expandItemParts(item, { id: 2, name: "EN", nameT: "ไทย" })[0].displayName
    ).toBe("ไทย");
  });
});

describe("consolidatePickList — split items", () => {
  const ac: Product = {
    id: 1,
    name: "AC 12000",
    splitEnabled: true,
    splitParts: DEFAULT_SPLIT_PARTS,
  };
  const fridge: Product = { id: 2, name: "Fridge" };

  const acItem = (qty: number): SaleItem => ({
    productId: 1,
    qty,
    price: 10000,
    parts: [
      { key: "hot", name: "คอยล์ร้อน", price: 6000 },
      { key: "cold", name: "คอยล์เย็น", price: 4000 },
    ],
  });

  test("AC qty=2 + fridge qty=1 → 3 pick rows", () => {
    const sos: Sale[] = [
      {
        soNum: "S1",
        items: [acItem(2), { productId: 2, qty: 1, price: 12900 }],
      },
    ];
    const list = consolidatePickList(sos, [ac, fridge]);
    expect(list).toHaveLength(3);
    const hotRow = list.find((e) => e.partKey === "hot")!;
    const coldRow = list.find((e) => e.partKey === "cold")!;
    const fridgeRow = list.find((e) => e.partKey === "")!;
    expect(hotRow.totalQty).toBe(2);
    expect(hotRow.partName).toBe("คอยล์ร้อน");
    expect(coldRow.totalQty).toBe(2);
    expect(fridgeRow.totalQty).toBe(1);
  });

  test("ACs from two SOs aggregate per-part with merged sources", () => {
    const sos: Sale[] = [
      { soNum: "S1", items: [acItem(2)] },
      { soNum: "S2", items: [acItem(3)] },
    ];
    const list = consolidatePickList(sos, [ac]);
    expect(list).toHaveLength(2);
    expect(list.find((e) => e.partKey === "hot")!.totalQty).toBe(5);
    expect(list.find((e) => e.partKey === "cold")!.sources).toEqual([
      "S1",
      "S2",
    ]);
  });

  test("non-split AC in older SO (no parts) → single pick row alongside split ACs", () => {
    const sos: Sale[] = [
      // newer SO with parts
      { soNum: "S1", items: [acItem(1)] },
      // older SO from before split was enabled — no parts on item
      {
        soNum: "S2",
        items: [{ productId: 1, qty: 2, price: 10000 }],
      },
    ];
    const list = consolidatePickList(sos, [ac]);
    // Expect: hot×1, cold×1, AC (unsplit)×2 → 3 rows
    expect(list).toHaveLength(3);
    expect(list.find((e) => e.partKey === "")?.totalQty).toBe(2);
    expect(list.find((e) => e.partKey === "hot")?.totalQty).toBe(1);
  });
});
