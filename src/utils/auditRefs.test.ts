import { describe, test, expect } from "vitest";
import { parseAuditRef } from "./auditRefs";

describe("parseAuditRef", () => {
  const codes = ["TS-AMP-200", "TS-SPK-15"];

  test("extracts SO/PO/QT document numbers (legacy + monthly)", () => {
    expect(parseAuditRef("SO-2026-203", codes)).toEqual({ type: "so", num: "SO-2026-203" });
    expect(parseAuditRef("อนุมัติ PO PO-2026-06-014", codes)).toEqual({ type: "po", num: "PO-2026-06-014" });
    expect(parseAuditRef("QT-2026-001", codes)).toEqual({ type: "qt", num: "QT-2026-001" });
  });

  test("takes the first id when detail has two", () => {
    expect(parseAuditRef("SO-2026-201 ← PO-2026-014", codes)).toEqual({ type: "so", num: "SO-2026-201" });
  });

  test("matches a product by exact code token", () => {
    expect(parseAuditRef("TS-AMP-200", codes)).toEqual({ type: "product", code: "TS-AMP-200" });
    expect(parseAuditRef("5 รายการ: TS-AMP-200, TS-SPK-15", codes)).toEqual({ type: "product", code: "TS-AMP-200" });
  });

  test("does not match a partial/substring code", () => {
    expect(parseAuditRef("TS-AMP-2000", codes)).toBeNull();
  });

  test("returns null when there is nothing to reference", () => {
    expect(parseAuditRef("5 รายการ", codes)).toBeNull();
    expect(parseAuditRef("", codes)).toBeNull();
  });
});
