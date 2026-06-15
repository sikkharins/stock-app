import { describe, test, expect } from "vitest";
import { buildComparison } from "./stockCompare";

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
