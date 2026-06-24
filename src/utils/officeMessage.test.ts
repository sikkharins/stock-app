import { describe, test, expect } from "vitest";
import { buildOfficeMessage } from "./officeMessage";

const products = [
  { id: 1, nameT: "ตู้เย็น Samsung", unit: "เครื่อง" },
  { id: 2, nameT: "แอร์ Daikin 12000", unit: "เครื่อง" },
];
const contacts = [{ id: 10, nameT: "ร้านสมชาย" }];

describe("buildOfficeMessage", () => {
  test("เงินสด พื้นฐาน", () => {
    const so = { customerId: 10, items: [{ productId: 1, qty: 2 }], payType: "cash" };
    const msg = buildOfficeMessage("ใบขาย", "SO-1", so, products, contacts);
    expect(msg).toContain("ใบขาย SO-1");
    expect(msg).toContain("ร้าน: ร้านสมชาย");
    expect(msg).toContain("- ตู้เย็น Samsung x2 เครื่อง");
    expect(msg).toContain("การชำระ: เงินสด");
    expect(msg).not.toContain("ออก VAT");
  });

  test("เครดิต + ตัวแทนออก VAT", () => {
    const so = { customerId: 10, items: [{ productId: 2, qty: 1 }], payType: "credit", creditDays: 45, useVatRep: true, vatRepName: "บจก เอบีซี" };
    const msg = buildOfficeMessage("ใบขาย", "SO-2", so, products, contacts);
    expect(msg).toContain("ออก VAT ในนาม: บจก เอบีซี");
    expect(msg).toContain("การชำระ: เครดิต 45 วัน");
  });

  test("ไม่เจอสินค้า/ลูกค้า → ใช้ -", () => {
    const so = { customerId: 999, items: [{ productId: 999, qty: 3 }], payType: "cash" };
    const msg = buildOfficeMessage("ใบขาย", "SO-3", so, products, contacts);
    expect(msg).toContain("ร้าน: -");
    expect(msg).toContain("- - x3");
  });

  test("ตัดความยาวที่ maxLen", () => {
    const items = Array.from({ length: 500 }, () => ({ productId: 1, qty: 1 }));
    const so = { customerId: 10, items, payType: "cash" };
    const msg = buildOfficeMessage("ใบขาย", "SO-4", so, products, contacts, 200);
    expect(msg.length).toBeLessThanOrEqual(200);
  });
});
