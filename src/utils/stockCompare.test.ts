import { describe, test, expect } from "vitest";
import { buildComparison, buildZoneComparison } from "./stockCompare";

const products = [
  { id: 1, brand: "LG", name: "แอร์ 12000", stock: 50 },
  { id: 2, brand: "Toshiba", name: "ตู้เย็น", stock: 8 },
];

describe("buildComparison", () => {
  test("จับคู่ได้: คิด diff = aiCount - systemStock", () => {
    const { matched, unmatched } = buildComparison(
      [{ productId: 2, guess: "ตู้เย็น", count: 6, confidence: "high", note: "" }],
      products,
    );
    expect(unmatched).toEqual([]);
    expect(matched).toHaveLength(1);
    expect(matched[0].product.id).toBe(2);
    expect(matched[0].aiCount).toBe(6);
    expect(matched[0].systemStock).toBe(8);
    expect(matched[0].diff).toBe(-2);
    expect(matched[0].confidence).toBe("high");
  });

  test("รวมหลาย pile ของสินค้าเดียวกัน (sum count, confidence แย่สุด)", () => {
    const { matched } = buildComparison(
      [
        { productId: 1, guess: "LG", count: 30, confidence: "high", note: "ซ้าย" },
        { productId: 1, guess: "LG", count: 25, confidence: "low", note: "ขวา" },
      ],
      products,
    );
    expect(matched).toHaveLength(1);
    expect(matched[0].aiCount).toBe(55);
    expect(matched[0].confidence).toBe("low");
    expect(matched[0].note).toContain("ซ้าย");
    expect(matched[0].note).toContain("ขวา");
  });

  test("productId null หรือหาไม่เจอ → unmatched (พร้อม idx)", () => {
    const { matched, unmatched } = buildComparison(
      [
        { productId: null, guess: "พัดลม?", count: 5, confidence: "med", note: "n" },
        { productId: 999, guess: "ไม่รู้", count: 3, confidence: "low", note: "" },
      ],
      products,
    );
    expect(matched).toEqual([]);
    expect(unmatched).toHaveLength(2);
    expect(unmatched[0]).toEqual({ idx: 0, guess: "พัดลม?", count: 5, confidence: "med", note: "n" });
    expect(unmatched[1].idx).toBe(1);
  });

  test("เรียง matched ตาม abs(diff) มาก→น้อย", () => {
    const { matched } = buildComparison(
      [
        { productId: 2, guess: "", count: 9, confidence: "high", note: "" },
        { productId: 1, guess: "", count: 10, confidence: "high", note: "" },
      ],
      products,
    );
    expect(matched.map((m) => m.product.id)).toEqual([1, 2]);
  });

  test("จับคู่ด้วย id แบบ string/number ก็ตรง", () => {
    const { matched } = buildComparison(
      [{ productId: "2", guess: "", count: 8, confidence: "high", note: "" }],
      products,
    );
    expect(matched).toHaveLength(1);
    expect(matched[0].diff).toBe(0);
  });
});

describe("buildZoneComparison", () => {
  const zproducts = [
    { id: 1, brand: "LG", name: "แอร์ 12000", stock: 50 },
    { id: 2, brand: "Toshiba", name: "ตู้เย็น", stock: 8 },
    { id: 3, brand: "Sharp", name: "พัดลม", stock: 0 },
    { id: 4, brand: "Haier", name: "เครื่องซักผ้า", stock: 5 },
  ];
  const zone = { id: "A1", name: "A1", productIds: [1, 2, 3] };

  test("expectedSeen: อยู่โซน + AI เจอ → diff เทียบ stock รวม, เรียง abs(diff)", () => {
    const { expectedSeen } = buildZoneComparison(
      zone,
      [
        { productId: 1, guess: "LG", count: 40, confidence: "high", note: "" },
        { productId: 2, guess: "", count: 9, confidence: "med", note: "" },
      ],
      zproducts,
    );
    expect(expectedSeen.map((r) => r.product.id)).toEqual([1, 2]);
    expect(expectedSeen[0].diff).toBe(-10);
    expect(expectedSeen[1].diff).toBe(1);
  });

  test("expectedMissing: อยู่โซน + stock>0 + AI ไม่เจอ → ธงแดง", () => {
    const { expectedMissing } = buildZoneComparison(
      zone,
      [{ productId: 1, guess: "LG", count: 40, confidence: "high", note: "" }],
      zproducts,
    );
    expect(expectedMissing.map((r) => r.product.id)).toEqual([2]);
    expect(expectedMissing[0].systemStock).toBe(8);
  });

  test("expectedMissing: ข้ามตัว stock=0 (id 3 ไม่ฟ้อง)", () => {
    const { expectedMissing } = buildZoneComparison(zone, [], zproducts);
    expect(expectedMissing.map((r) => r.product.id)).toEqual([1, 2]);
  });

  test("AI คืน count 0 ของตัวที่อยู่โซน → นับเป็นไม่เห็น (expectedMissing)", () => {
    const { expectedSeen, expectedMissing } = buildZoneComparison(
      zone,
      [{ productId: 2, guess: "", count: 0, confidence: "low", note: "" }],
      zproducts,
    );
    expect(expectedSeen).toEqual([]);
    expect(expectedMissing.map((r) => r.product.id)).toContain(2);
  });

  test("foreignSeen: AI เจอตัวที่ไม่อยู่โซน (id 4)", () => {
    const { foreignSeen } = buildZoneComparison(
      zone,
      [{ productId: 4, guess: "", count: 5, confidence: "high", note: "n" }],
      zproducts,
    );
    expect(foreignSeen.map((r) => r.product.id)).toEqual([4]);
    expect(foreignSeen[0].aiCount).toBe(5);
  });

  test("unmatched: productId null/หาไม่เจอ", () => {
    const { unmatched } = buildZoneComparison(
      zone,
      [
        { productId: null, guess: "?", count: 2, confidence: "low", note: "" },
        { productId: 999, guess: "x", count: 1, confidence: "low", note: "" },
      ],
      zproducts,
    );
    expect(unmatched).toHaveLength(2);
    expect(unmatched[0].idx).toBe(0);
  });

  test("multi-zone: สินค้าตัวเดียวอยู่ได้หลายโซน (id 1 อยู่ทั้ง A1 และ B1)", () => {
    const zoneB = { id: "B1", name: "B1", productIds: [1, 4] };
    const piles = [{ productId: 1, guess: "", count: 48, confidence: "high", note: "" }];
    expect(buildZoneComparison(zone, piles, zproducts).expectedSeen.map((r) => r.product.id)).toEqual([1]);
    expect(buildZoneComparison(zoneB, piles, zproducts).expectedSeen.map((r) => r.product.id)).toEqual([1]);
  });

  test("zone.productIds มี id ที่สินค้าถูกลบ → ข้าม ไม่ crash", () => {
    const z = { id: "Z", name: "Z", productIds: [1, 12345] };
    const { expectedMissing } = buildZoneComparison(z, [], zproducts);
    expect(expectedMissing.map((r) => r.product.id)).toEqual([1]);
  });

  test("โซนว่าง: ทุก pile ที่เจอไป foreignSeen, missing ว่าง", () => {
    const empty = { id: "E", name: "E", productIds: [] };
    const { expectedSeen, expectedMissing, foreignSeen } = buildZoneComparison(
      empty,
      [{ productId: 1, guess: "", count: 3, confidence: "high", note: "" }],
      zproducts,
    );
    expect(expectedSeen).toEqual([]);
    expect(expectedMissing).toEqual([]);
    expect(foreignSeen.map((r) => r.product.id)).toEqual([1]);
  });
});
