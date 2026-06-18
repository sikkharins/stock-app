import { describe, test, expect } from "vitest";
import { diffFields, diffLineItems } from "./auditDiff";

describe("diffFields", () => {
  test("emits changed fields only, formatted", () => {
    const defs = [
      { key: "customerId", label: "ลูกค้า", fmt: (v: unknown) => (v === 1 ? "A" : v === 2 ? "B" : String(v ?? "")) },
      { key: "discountAmt", label: "ส่วนลด", fmt: (v: unknown) => "฿" + v },
      { key: "note", label: "หมายเหตุ" },
    ];
    const out = diffFields({ customerId: 1, discountAmt: 100, note: "x" }, { customerId: 2, discountAmt: 100, note: "y" }, defs);
    expect(out).toEqual([
      { label: "ลูกค้า", from: "A", to: "B" },
      { label: "หมายเหตุ", from: "x", to: "y" },
    ]);
  });

  test("treats numeric and string-equal as unchanged", () => {
    expect(diffFields({ qty: 5 }, { qty: "5" }, [{ key: "qty", label: "จำนวน" }])).toEqual([]);
  });

  test("handles missing keys", () => {
    expect(diffFields({}, { note: "hi" }, [{ key: "note", label: "หมายเหตุ" }])).toEqual([{ label: "หมายเหตุ", from: "", to: "hi" }]);
  });
});

describe("diffLineItems", () => {
  const opts = { priceKey: "price" as const, nameOf: (id: number) => "P" + id, fmtMoney: (n: number) => "฿" + n };

  test("detects added line", () => {
    expect(diffLineItems([], [{ productId: 1, qty: 2, price: 50 }], opts)).toEqual([{ label: "+ P1", from: "—", to: "2 × ฿50" }]);
  });
  test("detects removed line", () => {
    expect(diffLineItems([{ productId: 1, qty: 2, price: 50 }], [], opts)).toEqual([{ label: "− P1", from: "2 × ฿50", to: "—" }]);
  });
  test("detects qty change", () => {
    expect(diffLineItems([{ productId: 1, qty: 2, price: 50 }], [{ productId: 1, qty: 3, price: 50 }], opts)).toEqual([{ label: "P1", from: "2 × ฿50", to: "3 × ฿50" }]);
  });
  test("detects price change", () => {
    expect(diffLineItems([{ productId: 1, qty: 2, price: 50 }], [{ productId: 1, qty: 2, price: 60 }], opts)).toEqual([{ label: "P1", from: "2 × ฿50", to: "2 × ฿60" }]);
  });
  test("skips unchanged", () => {
    expect(diffLineItems([{ productId: 1, qty: 2, price: 50 }], [{ productId: 1, qty: 2, price: 50 }], opts)).toEqual([]);
  });
  test("uses cost when priceKey is cost", () => {
    const o = { priceKey: "cost" as const, nameOf: (id: number) => "P" + id, fmtMoney: (n: number) => "฿" + n };
    expect(diffLineItems([], [{ productId: 1, qty: 1, cost: 30 }], o)).toEqual([{ label: "+ P1", from: "—", to: "1 × ฿30" }]);
  });
});
