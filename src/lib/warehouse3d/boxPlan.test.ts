import { describe, it, expect } from "vitest";
import { planBoxes, REP_THRESHOLD } from "./boxPlan.js";

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
