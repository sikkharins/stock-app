import { describe, test, expect } from "vitest";
import { buildWarehouseData, autoPlaceZones, DEFAULT_WAREHOUSE } from "./warehouse3d.js";

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
