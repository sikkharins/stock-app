import { describe, test, expect } from "vitest";
import {
  toBEShort,
  fmtC,
  bahtText,
  resolveBillTo,
  buildRows,
  computeTotals,
  paginate,
  buildSOFormHtml,
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

describe("bahtText", () => {
  test("จำนวนมีสตางค์", () => {
    expect(bahtText(94129.46)).toBe("เก้าหมื่นสี่พันหนึ่งร้อยยี่สิบเก้าบาทสี่สิบหกสตางค์");
  });
  test("ลงท้ายบาทถ้วน / ศูนย์", () => {
    expect(bahtText(100)).toBe("หนึ่งร้อยบาทถ้วน");
    expect(bahtText(214)).toBe("สองร้อยสิบสี่บาทถ้วน");
    expect(bahtText(0)).toBe("ศูนย์บาทถ้วน");
  });
  test("เอ็ด / ยี่สิบ / ล้าน", () => {
    expect(bahtText(21)).toBe("ยี่สิบเอ็ดบาทถ้วน");
    expect(bahtText(11)).toBe("สิบเอ็ดบาทถ้วน");
    expect(bahtText(1000000)).toBe("หนึ่งล้านบาทถ้วน");
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
  const cats = [{ id: 5, name: "ตู้เย็น" }];
  const products = [{ id: 1, nameT: "รุ่น A", unit: "เครื่อง", brand: "LG", categoryId: 5 }];
  test("includeVat -> ราคาก่อน VAT + หมวด+ยี่ห้อ นำหน้า", () => {
    const so = { includeVat: true, items: [{ productId: 1, qty: 2, price: 107 }] };
    expect(buildRows(so, products, cats)).toEqual([
      { no: 1, name: "ตู้เย็น LG รุ่น A", qty: 2, unit: "เครื่อง", unitPrice: 100, amount: 200 },
    ]);
  });
  test("ไม่มีหมวด/ยี่ห้อ -> ใช้ nameT อย่างเดียว", () => {
    const so = { includeVat: false, items: [{ productId: 2, qty: 1, price: 100 }] };
    const prods = [{ id: 2, nameT: "X", unit: "ชิ้น" }];
    expect(buildRows(so, prods, [])).toEqual([
      { no: 1, name: "X", qty: 1, unit: "ชิ้น", unitPrice: 100, amount: 100 },
    ]);
  });
  test("split parts -> แตกหลายบรรทัด นับ no ต่อบรรทัด", () => {
    const so = { includeVat: true, items: [{ productId: 1, qty: 1, price: 107, parts: [
      { name: "ร้อน", price: 53.5 }, { name: "เย็น", price: 53.5 },
    ] }] };
    const rows = buildRows(so, products, cats);
    expect(rows.length).toBe(2);
    expect(rows[0]).toEqual({ no: 1, name: "ตู้เย็น LG รุ่น A — ร้อน", qty: 1, unit: "เครื่อง", unitPrice: 50, amount: 50 });
    expect(rows[1].no).toBe(2);
    expect(rows[1].name).toBe("ตู้เย็น LG รุ่น A — เย็น");
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

describe("buildSOFormHtml", () => {
  const cats = [{ id: 3, name: "ตู้เย็น" }];
  const products = [{ id: 1, nameT: "ตู้เย็น", unit: "เครื่อง", price: 107, brand: "LG", categoryId: 3 }];
  const contacts = [{ id: 9, nameT: "ร้าน A", address: "123 ถนน", taxId: "TAX1", custCode: "C001", salesPerson: "เซลส์1" }];
  const baseSO = {
    legacyNum: "IV2026/06115", date: "2026-06-17", customerId: 9,
    payType: "credit", creditDays: 60, includeVat: true, discountAmt: 0,
    items: [{ productId: 1, qty: 2, price: 107 }],
  };

  test("มีเลขที่ ชื่อลูกค้า รหัสลูกค้า เซลส์ ยอดรวม และยอดตัวอักษร", () => {
    const html = buildSOFormHtml(baseSO, products, contacts, cats);
    expect(html).toContain("IV2026/06115");
    expect(html).toContain("ร้าน A");
    expect(html).toContain("C001");
    expect(html).toContain("เซลส์1");
    expect(html).toContain("214.00"); // grand
    expect(html).toContain("สองร้อยสิบสี่บาทถ้วน"); // bahtText(grand)
    expect(html).toContain("@page");
    expect(html).toContain("205mm 279mm");
  });

  test("ตัวแทน VAT -> โชว์ชื่อ/เลขบัตรตัวแทน", () => {
    const so = { ...baseSO, useVatRep: true, vatRepName: "ตัวแทน X", vatRepAddress: "ADDR X", vatRepIdCard: "RID13" };
    const html = buildSOFormHtml(so, products, contacts, cats);
    expect(html).toContain("ตัวแทน X");
    expect(html).toContain("RID13");
  });

  test("สินค้าเกิน 12 บรรทัด -> 2 หน้า", () => {
    const items = Array.from({ length: 13 }, () => ({ productId: 1, qty: 1, price: 107 }));
    const html = buildSOFormHtml({ ...baseSO, items }, products, contacts, cats);
    expect((html.match(/class="so-page"/g) || []).length).toBe(2);
  });
});
