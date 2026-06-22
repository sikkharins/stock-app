import { describe, it, expect } from "vitest";
import { planBoxes, productColor, PRODUCT_PALETTE, REP_THRESHOLD } from "./boxPlan.js";

const ZONE = { innerW: 10, innerL: 10, ceilingH: 10 };
const BOX = { w: 0.4, l: 0.4, h: 0.4 }; // 40cm cube

describe("planBoxes", () => {
  it("stock = 0 -> ทุกค่าเป็นศูนย์ ไม่ใช้ pile", () => {
    const p = planBoxes(BOX, ZONE, { stock: 0 });
    expect(p).toMatchObject({ usePile: false, cols: 0, rows: 0, layers: 0, perLayer: 0, overflow: false });
  });

  it("stock พอดี -> ไม่ overflow, footprint อยู่ในโซน", () => {
    const p = planBoxes(BOX, ZONE, { stock: 100, gap: 0.04 });
    expect(p.usePile).toBe(false);
    expect(p.cols).toBeGreaterThanOrEqual(1);
    expect(p.rows).toBeGreaterThanOrEqual(1);
    expect(p.layers).toBeLessThanOrEqual(p.layersMax); // ไม่ล้นแนวตั้ง
    expect(p.footW).toBeLessThanOrEqual(ZONE.innerW + 1e-9);
    expect(p.footL).toBeLessThanOrEqual(ZONE.innerL + 1e-9);
    expect(p.cols * p.rows * p.layers).toBeGreaterThanOrEqual(100); // จุครบ
  });

  it("กล่องใหญ่ในโซนเล็ก -> ล้นแนวตั้ง (overflow) แต่ footprint ไม่เกินโซน", () => {
    const bigBox = { w: 2, l: 2, h: 3 };
    const smallZone = { innerW: 4, innerL: 4, ceilingH: 9 }; // layersMax = 3
    const p = planBoxes(bigBox, smallZone, { stock: 200, gap: 0.04 });
    expect(p.usePile).toBe(false);
    expect(p.layers).toBeGreaterThan(p.layersMax); // ทะลุเพดาน
    expect(p.overflow).toBe(true);
    expect(p.footW).toBeLessThanOrEqual(smallZone.innerW + 1e-9);
    expect(p.footL).toBeLessThanOrEqual(smallZone.innerL + 1e-9);
    expect(p.cols * p.rows * p.layers).toBeGreaterThanOrEqual(200);
  });

  it("stock > REP_THRESHOLD -> usePile", () => {
    const p = planBoxes(BOX, ZONE, { stock: REP_THRESHOLD + 1 });
    expect(p.usePile).toBe(true);
  });

  it("manualCols override -> ใช้ cols ที่กำหนด (clamp กับความกว้างโซน)", () => {
    const p = planBoxes(BOX, ZONE, { stock: 100, manualCols: 3 });
    expect(p.cols).toBe(3);
  });

  it("REP_THRESHOLD ถูกดันขึ้นเป็น 5000", () => {
    expect(REP_THRESHOLD).toBe(5000);
  });
});

describe("productColor", () => {
  it("deterministic — id เดิมได้สีเดิมเสมอ", () => {
    expect(productColor("sku-123")).toBe(productColor("sku-123"));
  });
  it("คืนสีที่อยู่ใน palette", () => {
    expect(PRODUCT_PALETTE).toContain(productColor("anything"));
  });
  it("id ต่างกันกระจายได้หลายสี (ไม่ใช่สีเดียวทั้งหมด)", () => {
    const colors = new Set(Array.from({ length: 30 }, (_, i) => productColor("p" + i)));
    expect(colors.size).toBeGreaterThan(1);
  });
  it("รับ id ที่เป็นตัวเลขได้ (cast เป็น string)", () => {
    expect(productColor(42)).toBe(productColor("42"));
  });
});

import { snapClampZoneRect } from "./boxPlan.js";

const WH = { widthM: 54, lengthM: 30 };

describe("snapClampZoneRect", () => {
  it("snap origin + size เป็นทวีคูณ 0.5", () => {
    const r = snapClampZoneRect({ x: 1.2, z: 2.7 }, { w: 11.3, l: 7.8 }, WH);
    expect(r).toEqual({ origin: { x: 1, z: 2.5 }, size: { w: 11.5, l: 8 } });
  });
  it("clamp size ไม่เกินโกดัง และไม่ต่ำกว่า 0.5", () => {
    expect(snapClampZoneRect({ x: 0, z: 0 }, { w: 100, l: 0.1 }, WH))
      .toEqual({ origin: { x: 0, z: 0 }, size: { w: 54, l: 0.5 } });
  });
  it("clamp origin ไม่ให้ origin+size เลยขอบ", () => {
    const r = snapClampZoneRect({ x: 50, z: 28 }, { w: 12, l: 8 }, WH);
    expect(r.origin).toEqual({ x: 42, z: 22 });
  });
  it("ค่าพอดีขอบผ่านเหมือนเดิม", () => {
    const r = snapClampZoneRect({ x: 42, z: 22 }, { w: 12, l: 8 }, WH);
    expect(r).toEqual({ origin: { x: 42, z: 22 }, size: { w: 12, l: 8 } });
  });
});
