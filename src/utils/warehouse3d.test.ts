import { describe, test, expect } from "vitest";
import { buildWarehouseData, autoPlaceZones, DEFAULT_WAREHOUSE, clearZoneLayout, applyZoneLayout, mergeZoneEntry, expandProductsForWarehouse } from "./warehouse3d.js";

// The util is plain JS producing dynamic shapes; treat results loosely in tests.
type WD = { WAREHOUSE: any; ZONES: any[]; PRODUCTS: any[] };
const build = (p?: any[], z?: any[], wl?: any): WD => buildWarehouseData(p, z, wl) as WD;

const product = (over: Record<string, unknown> = {}) => ({
  id: 1, code: "P-1", name: "Box", nameT: "กล่อง", brand: "Acme",
  stock: 10, widthCm: 40, lengthCm: 40, heightCm: 40, sizeClass: "M",
  noLayDown: false, unit: "ลัง", ...over,
});

// a dummy real zone forces the real-data path (empty zones triggers Claude Design seed)
const Z = [{ id: "z1", productIds: [] }];

const splitProduct = (over: Record<string, unknown> = {}) => ({
  id: 7, code: "AC-7", name: "AC", nameT: "แอร์ LG", brand: "LG", stock: 350,
  sizeClass: "M", unit: "ชุด", splitEnabled: true,
  splitParts: [
    { key: "hot", name: "คอยล์ร้อน", priceRatio: 0.6, widthCm: 60, lengthCm: 80, heightCm: 90 },
    { key: "cold", name: "คอยล์เย็น", priceRatio: 0.4, widthCm: 90, lengthCm: 30, heightCm: 30, noLayDown: true },
  ],
  ...over,
});

describe("expandProductsForWarehouse", () => {
  test("non-split ผ่านเหมือนเดิม", () => {
    const out = expandProductsForWarehouse([product()]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(1);
  });

  test("split แตกเป็น pseudo-product ต่อส่วน", () => {
    const out = expandProductsForWarehouse([splitProduct()]);
    expect(out.map((u: any) => u.id)).toEqual(["7:hot", "7:cold"]);
    expect(out[0].nameT).toBe("แอร์ LG — คอยล์ร้อน");
    expect(out[0].stock).toBe(350);
    expect(out[0].widthCm).toBe(60);
    expect(out[0].splitEnabled).toBeFalsy();
    expect(out[1].noLayDown).toBe(true);
  });
});

describe("buildWarehouseData — split products", () => {
  test("PRODUCTS มี composite id ต่อส่วน", () => {
    const { PRODUCTS } = build([splitProduct()], [{ id: "z1", productIds: [] }], {});
    expect(PRODUCTS.map((p) => p.id)).toEqual(["7:hot", "7:cold"]);
  });

  test("zone ที่อ้าง id เปล่า (ของ split เดิม) → แตกเป็นส่วนอัตโนมัติ", () => {
    const { ZONES } = build([splitProduct()], [{ id: "z1", productIds: [7] }], {});
    expect(ZONES[0].productIds).toEqual(["7:hot", "7:cold"]);
  });

  test("zone ที่อ้าง composite id อยู่แล้ว → คงเดิม", () => {
    const { ZONES } = build([splitProduct()], [{ id: "z1", productIds: ["7:cold"] }], {});
    expect(ZONES[0].productIds).toEqual(["7:cold"]);
  });
});

describe("buildWarehouseData — PRODUCTS mapping", () => {
  test("maps products 1:1 preserving fields", () => {
    const { PRODUCTS } = build([product(), product({ id: 2, code: "P-2" })], Z, {});
    expect(PRODUCTS).toHaveLength(2);
    expect(PRODUCTS[0]).toMatchObject({ id: 1, code: "P-1", nameT: "กล่อง", stock: 10, widthCm: 40, unit: "ลัง" });
    expect(PRODUCTS[1].code).toBe("P-2");
  });

  test("fills safe defaults for missing optional fields", () => {
    const { PRODUCTS } = build([{ id: 9, name: "Solo" }], Z, {});
    const p = PRODUCTS[0];
    expect(p.code).toBe("");
    expect(p.nameT).toBe("Solo"); // falls back to name
    expect(p.brand).toBe("-");
    expect(p.stock).toBe(0);
    expect(p.widthCm).toBe(0);
    expect(p.sizeClass).toBe("M");
    expect(p.noLayDown).toBe(false);
    expect(p.unit).toBe("ชิ้น");
    expect("cubicM" in p).toBe(false); // omitted when not a number
  });

  test("keeps cubicM only when numeric", () => {
    const { PRODUCTS } = build([product({ cubicM: 0.05 }), product({ id: 2, cubicM: "x" })], Z, {});
    expect(PRODUCTS[0].cubicM).toBe(0.05);
    expect("cubicM" in PRODUCTS[1]).toBe(false);
  });
});

describe("buildWarehouseData — WAREHOUSE", () => {
  test("uses default when layout has none", () => {
    expect(build([], [], {}).WAREHOUSE).toEqual(DEFAULT_WAREHOUSE);
  });

  test("reads dims from layout.warehouse", () => {
    const { WAREHOUSE } = build([], [], { warehouse: { widthM: 55, lengthM: 30, heightM: 8 } });
    expect(WAREHOUSE).toEqual({ widthM: 55, lengthM: 30, heightM: 8 });
  });
});

describe("buildWarehouseData — ZONES", () => {
  const zones = [
    { id: "a", name: "Zone A", productIds: [1, 2] },
    { id: "b", name: "Zone B", productIds: [] },
  ];

  test("uses saved geometry/camera/color when present", () => {
    const layout = {
      zones: {
        a: { origin: { x: 5, z: 6 }, size: { w: 10, l: 8 }, color: "#abcdef", camera: { position: [1, 2, 3], target: [0, 0, 0], fov: 50 } },
      },
    };
    const a: any = build([], zones, layout).ZONES.find((z: any) => z.id === "a");
    expect(a.origin).toEqual({ x: 5, z: 6 });
    expect(a.size).toEqual({ w: 10, l: 8 });
    expect(a.color).toBe("#abcdef");
    expect(a.camera.fov).toBe(50);
    expect(a.productIds).toEqual([1, 2]);
  });

  test("auto-places zones lacking geometry, inside warehouse bounds", () => {
    const { WAREHOUSE, ZONES } = build([], zones, {});
    for (const z of ZONES) {
      expect(z.origin.x).toBeGreaterThanOrEqual(0);
      expect(z.origin.z).toBeGreaterThanOrEqual(0);
      expect(z.origin.x + z.size.w).toBeLessThanOrEqual(WAREHOUSE.widthM + 1e-6);
      expect(z.origin.z + z.size.l).toBeLessThanOrEqual(WAREHOUSE.lengthM + 1e-6);
      expect(z.color).toMatch(/^#/);
    }
  });

  test("preserves zone order and drops zones into the sketch slot template", () => {
    const { ZONES } = build([], zones, {});
    expect(ZONES.map((z: any) => z.id)).toEqual(["a", "b"]);
    // first design slot = zone E (top band, x0, w6)
    expect(ZONES[0].origin).toEqual({ x: 0, z: 0 });
    expect(ZONES[0].size).toEqual({ w: 6, l: 8 });
    expect(ZONES[0].color).toMatch(/^#/);
  });
});

describe("autoPlaceZones", () => {
  test("returns one entry per zone, all within bounds", () => {
    const wh = { widthM: 40, lengthM: 24, heightM: 6 };
    const zs = Array.from({ length: 7 }, (_, i) => ({ id: i }));
    const placed: Record<string, any> = autoPlaceZones(zs, wh);
    expect(Object.keys(placed)).toHaveLength(7);
    for (const k of Object.keys(placed)) {
      const { origin, size } = placed[k];
      expect(origin.x + size.w).toBeLessThanOrEqual(wh.widthM + 1e-6);
      expect(origin.z + size.l).toBeLessThanOrEqual(wh.lengthM + 1e-6);
      expect(size.w).toBeGreaterThan(0);
      expect(size.l).toBeGreaterThan(0);
    }
  });

  test("empty input → empty map", () => {
    expect(autoPlaceZones([], { widthM: 10, lengthM: 10, heightM: 4 })).toEqual({});
  });
});

describe("buildWarehouseData — Claude Design seed (no app zones)", () => {
  test("seeds the sketch zone layout (no sample products) when zones are empty", () => {
    const d = build([], [], {});
    expect(d.WAREHOUSE).toEqual(DEFAULT_WAREHOUSE);
    expect(d.ZONES.length).toBe(19); // E/D/C/B/A · e/d/c/b/a · i/h/g/f · I/H/G/F · office
    expect(d.ZONES.some((z: any) => z.id === "office")).toBe(true);
    expect(d.PRODUCTS).toEqual([]); // no sample products
    // a seeded zone carries its intrinsic geometry, with empty product list
    const A: any = d.ZONES.find((z: any) => z.id === "A");
    expect(A.size).toEqual({ w: 12, l: 8 });
    expect(A.origin).toEqual({ x: 42, z: 0 }); // right column, top band
    expect(A.productIds).toEqual([]);
    // every zone stays inside the 54×30 footprint
    for (const z of d.ZONES) {
      expect(z.origin.x + z.size.w).toBeLessThanOrEqual(54 + 1e-6);
      expect(z.origin.z + z.size.l).toBeLessThanOrEqual(30 + 1e-6);
    }
  });

  test("real zones override the seed (uses real products)", () => {
    const d = build([product()], [{ id: "z1", name: "จริง", productIds: [1] }], {});
    expect(d.ZONES.map((z: any) => z.id)).toEqual(["z1"]);
    expect(d.PRODUCTS).toHaveLength(1);
    expect(d.PRODUCTS[0].id).toBe(1);
  });

  test("real zones carrying their own geometry use it directly", () => {
    const d = build([], [{ id: "z1", name: "z", productIds: [], origin: { x: 2, z: 3 }, size: { w: 5, l: 6 }, color: "#123456" }], {});
    const z: any = d.ZONES[0];
    expect(z.origin).toEqual({ x: 2, z: 3 });
    expect(z.size).toEqual({ w: 5, l: 6 });
    expect(z.color).toBe("#123456");
  });

  test("undefined inputs also seed (no crash)", () => {
    const d = build();
    expect(d.ZONES.length).toBe(19);
    expect(d.PRODUCTS).toEqual([]);
  });
});

describe("buildWarehouseData — zone.presets", () => {
  test("พา zone.presets เข้า ZONES (default [])", () => {
    const d = build([], [
      { id: "z1", name: "z1", productIds: [], presets: [{ token: "1", name: "มุม A" }] },
      { id: "z2", name: "z2", productIds: [] },
    ], {});
    const z1: any = d.ZONES.find((z: any) => z.id === "z1");
    const z2: any = d.ZONES.find((z: any) => z.id === "z2");
    expect(z1.presets).toEqual([{ token: "1", name: "มุม A" }]);
    expect(z2.presets).toEqual([]);
  });
});

describe("buildWarehouseData — zone.heightM", () => {
  test("heightM: saved > intrinsic > fallback(warehouse)", () => {
    const zones = [{ id: "z1", productIds: [] }, { id: "z2", productIds: [], heightM: 6 }];
    const { ZONES } = build([], zones, { zones: { z1: { heightM: 4 } } });
    expect(ZONES.find((z) => z.id === "z1").heightM).toBe(4);   // saved
    expect(ZONES.find((z) => z.id === "z2").heightM).toBe(6);   // intrinsic
    const { ZONES: Z2, WAREHOUSE: W2 } = build([], [{ id: "z3", productIds: [] }], {});
    expect(Z2.find((z) => z.id === "z3").heightM).toBe(W2.heightM); // fallback
  });
});

describe("buildWarehouseData — boxConfig passthrough", () => {
  test("carries boxConfig from the app zone into the scene zone", () => {
    const z = [{ id: "z1", productIds: [1], boxConfig: { 1: { cols: 3, layers: 2 } } }];
    const { ZONES } = build([product()], z, {});
    expect(ZONES[0].boxConfig).toEqual({ 1: { cols: 3, layers: 2 } });
  });

  test("omits boxConfig when the zone has none", () => {
    const { ZONES } = build([product()], [{ id: "z1", productIds: [1] }], {});
    expect(ZONES[0].boxConfig).toBeUndefined();
  });
});

describe("buildWarehouseData — arrangeRot passthrough", () => {
  test("carries arrangeRot from the app zone into the scene zone", () => {
    const z = [{ id: "z1", productIds: [1], arrangeRot: 90 }];
    const { ZONES } = build([product()], z, {});
    expect(ZONES[0].arrangeRot).toBe(90);
  });

  test("omits arrangeRot when the zone has none", () => {
    const { ZONES } = build([product()], [{ id: "z1", productIds: [1] }], {});
    expect(ZONES[0].arrangeRot).toBeUndefined();
  });
});

describe("clearZoneLayout", () => {
  test("ลบ layout ของโซน เก็บ key อื่น (camera) ไว้", () => {
    const wl = { zones: { z1: { layout: { 1: { x: 1, z: 2 } }, camera: { fov: 55 } }, z2: { layout: {} } } };
    const out = clearZoneLayout(wl, "z1");
    expect(out.zones.z1).toEqual({ camera: { fov: 55 } });
    expect(out.zones.z2).toEqual({ layout: {} }); // z2 ไม่ถูกแตะ
  });
  test("entry ที่มีแค่ layout -> ลบทั้ง entry", () => {
    const wl = { zones: { z1: { layout: { 1: { x: 1 } } } } };
    expect(clearZoneLayout(wl, "z1").zones.z1).toBeUndefined();
  });
  test("ไม่มี layout -> คืน reference เดิม", () => {
    const wl = { zones: { z1: { camera: { fov: 55 } } } };
    expect(clearZoneLayout(wl, "z1")).toBe(wl);
  });
  test("ไม่มี entry โซน -> คืน reference เดิม", () => {
    const wl = { zones: {} };
    expect(clearZoneLayout(wl, "zX")).toBe(wl);
  });
});

describe("applyZoneLayout", () => {
  test("merge layout เข้าโซน เก็บ key อื่น + โซนอื่น", () => {
    const wl = { zones: { z1: { camera: { fov: 55 } } }, warehouse: { widthM: 54 } };
    const out = applyZoneLayout(wl, { z1: { 1: { x: 1, z: 2 } }, z2: { 3: { x: 0, z: 0 } } });
    expect(out.zones.z1).toEqual({ camera: { fov: 55 }, layout: { 1: { x: 1, z: 2 } } });
    expect(out.zones.z2).toEqual({ layout: { 3: { x: 0, z: 0 } } });
    expect(out.warehouse).toEqual({ widthM: 54 });
  });
  test("warehouseLayout ว่าง -> สร้าง zones", () => {
    expect(applyZoneLayout(undefined, { z1: { 1: { x: 1 } } }))
      .toEqual({ zones: { z1: { layout: { 1: { x: 1 } } } } });
  });
});

describe("mergeZoneEntry", () => {
  test("patch เข้าโซน เก็บ key อื่น + โซนอื่นไม่ถูกแตะ", () => {
    const wl = { zones: { z1: { layout: { 1: {} } }, z2: { camera: {} } } };
    const out = mergeZoneEntry(wl, "z1", { camera: { fov: 60 } });
    expect(out.zones.z1).toEqual({ layout: { 1: {} }, camera: { fov: 60 } });
    expect(out.zones.z2).toEqual({ camera: {} });
  });
  test("warehouseLayout ว่าง -> สร้าง entry", () => {
    expect(mergeZoneEntry(undefined, "z1", { origin: { x: 1, z: 2 } }))
      .toEqual({ zones: { z1: { origin: { x: 1, z: 2 } } } });
  });
});
