import { describe, test, expect } from "vitest";
import { categorizeAudit, CATEGORIES } from "./auditCategory";

describe("categorizeAudit", () => {
  test("classifies destructive actions as risk", () => {
    expect(categorizeAudit("ลบสินค้า").key).toBe("delete");
    expect(categorizeAudit("ลบสินค้า").risk).toBe(true);
    expect(categorizeAudit("ยกเลิก PO").key).toBe("cancel");
    expect(categorizeAudit("ยกเลิก PO").risk).toBe(true);
    expect(categorizeAudit("ปฏิเสธ PO").key).toBe("reject");
    expect(categorizeAudit("ปฏิเสธ PO").risk).toBe(true);
  });

  test("destructive keyword wins over later keywords", () => {
    expect(categorizeAudit("ลบ SO อัตโนมัติ (ยกเลิก PO)").key).toBe("delete");
  });

  test("submit is detected before approve", () => {
    expect(categorizeAudit("ส่งขออนุมัติ PO").key).toBe("submit");
    expect(categorizeAudit("อนุมัติ PO").key).toBe("approve");
    expect(categorizeAudit("อนุมัติพิเศษ SO").key).toBe("approve");
  });

  test("non-destructive categories", () => {
    expect(categorizeAudit("สร้าง SO").key).toBe("create");
    expect(categorizeAudit("แปลง QT เป็น SO").key).toBe("create");
    expect(categorizeAudit("แก้ไข PO").key).toBe("edit");
    expect(categorizeAudit("เปลี่ยนหมวด (กลุ่ม)").key).toBe("edit");
    expect(categorizeAudit("ปรับสต็อก").key).toBe("stock");
    expect(categorizeAudit("จัดส่ง SO").key).toBe("logistics");
    expect(categorizeAudit("นำเข้า Excel").key).toBe("import");
    expect(categorizeAudit("ส่ง QT").key).toBe("send");
  });

  test("create (AI Bot) still classifies by the verb", () => {
    expect(categorizeAudit("สร้าง SO (AI Bot)").key).toBe("create");
  });

  test("unknown action falls back to other, never risk", () => {
    expect(categorizeAudit("อะไรสักอย่าง").key).toBe("other");
    expect(categorizeAudit("").key).toBe("other");
    expect(categorizeAudit("อะไรสักอย่าง").risk).toBe(false);
  });

  test("exactly delete/cancel/reject are risky", () => {
    const risky = CATEGORIES.filter(c => c.risk).map(c => c.key).sort();
    expect(risky).toEqual(["cancel", "delete", "reject"]);
  });
});
