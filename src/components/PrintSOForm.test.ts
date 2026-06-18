import { describe, test, expect } from "vitest";
import {
  toBEShort,
  fmtC,
  resolveBillTo,
  buildRows,
  computeTotals,
  paginate,
} from "./PrintSOForm.js";

describe("toBEShort", () => {
  test("YYYY-MM-DD -> dd/mm/yy (BE 2-digit)", () => {
    expect(toBEShort("2026-06-17")).toBe("17/06/69"); // 2026+543=2569 -> 69
  });
  test("empty -> empty string", () => {
    expect(toBEShort("")).toBe("");
    expect(toBEShort(undefined)).toBe("");
  });
});

describe("fmtC", () => {
  test("2-decimal grouped", () => {
    expect(fmtC(10280.38)).toBe("10,280.38");
    expect(fmtC(0)).toBe("0.00");
  });
});

describe("resolveBillTo", () => {
  const contact = { nameT: "ร้าน A", address: "123", taxId: "TAX1", custCode: "C001" };
  test("ปกติ -> ใช้ข้อมูลลูกค้า + custCode", () => {
    const so = { useVatRep: false };
    expect(resolveBillTo(so, contact)).toEqual({
      custCode: "C001", name: "ร้าน A", address: "123", taxId: "TAX1",
    });
  });
  test("ตัวแทน VAT -> override ชื่อ/ที่อยู่/เลขบัตร, custCode ว่าง", () => {
    const so = { useVatRep: true, vatRepName: "ตัวแทน X", vatRepAddress: "ADDR X", vatRepIdCard: "RID13" };
    expect(resolveBillTo(so, contact)).toEqual({
      custCode: "", name: "ตัวแทน X", address: "ADDR X", taxId: "RID13",
    });
  });
});

describe("buildRows", () => {
  const products = [{ id: 1, nameT: "ตู้เย็น", unit: "เครื่อง", price: 107 }];
  test("includeVat -> ราคาก่อน VAT (x100/107)", () => {
    const so = { includeVat: true, items: [{ productId: 1, qty: 2, price: 107 }] };
    expect(buildRows(so, products)).toEqual([
      { no: 1, name: "ตู้เย็น", qty: 2, unit: "เครื่อง", unitPrice: 100, amount: 200 },
    ]);
  });
  test("ไม่คิด VAT -> ราคาเต็ม", () => {
    const so = { includeVat: false, items: [{ productId: 1, qty: 2, price: 100 }] };
    expect(buildRows(so, products)).toEqual([
      { no: 1, name: "ตู้เย็น", qty: 2, unit: "เครื่อง", unitPrice: 100, amount: 200 },
    ]);
  });
  test("split parts -> แตกหลายบรรทัด นับ no ต่อบรรทัด", () => {
    const so = { includeVat: true, items: [{ productId: 1, qty: 1, price: 107, parts: [
      { name: "ร้อน", price: 53.5 }, { name: "เย็น", price: 53.5 },
    ] }] };
    const rows = buildRows(so, products);
    expect(rows.length).toBe(2);
    expect(rows[0]).toEqual({ no: 1, name: "ตู้เย็น — ร้อน", qty: 1, unit: "เครื่อง", unitPrice: 50, amount: 50 });
    expect(rows[1].no).toBe(2);
    expect(rows[1].name).toBe("ตู้เย็น — เย็น");
  });
});

describe("computeTotals", () => {
  test("includeVat: subEx/discEx/goods/vat/grand", () => {
    const so = { includeVat: true, discountAmt: 0, items: [{ qty: 2, price: 107 }] };
    expect(computeTotals(so)).toEqual({ subTotal: 200, discount: 0, goods: 200, vat: 14, grand: 214 });
  });
  test("includeVat + discount", () => {
    const so = { includeVat: true, discountAmt: 10.7, items: [{ qty: 1, price: 107 }] };
    expect(computeTotals(so)).toEqual({ subTotal: 100, discount: 10, goods: 90, vat: 6.3, grand: 96.3 });
  });
  test("ไม่คิด VAT -> vat=null, grand=goods", () => {
    const so = { includeVat: false, discountAmt: 0, items: [{ qty: 2, price: 100 }] };
    expect(computeTotals(so)).toEqual({ subTotal: 200, discount: 0, goods: 200, vat: null, grand: 200 });
  });
});

describe("paginate", () => {
  test("25 แถว / 12 -> 3 หน้า [12,12,1]", () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({ no: i + 1 }));
    const pages = paginate(rows, 12);
    expect(pages.map((p) => p.length)).toEqual([12, 12, 1]);
  });
  test("ว่าง -> [[]] (1 หน้าว่าง)", () => {
    expect(paginate([], 12)).toEqual([[]]);
  });
});
