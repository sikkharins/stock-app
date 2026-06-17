import { describe, test, expect } from "vitest";
import { parseAuditRef, parseAuditDate, auditInRange } from "./auditRefs";

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

describe("parseAuditDate", () => {
  test("parses nowStr Thai-BE format to a CE Date", () => {
    const d = parseAuditDate("18/06/2569 14:32")!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // June = 5
    expect(d.getDate()).toBe(18);
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(32);
  });

  test("returns null on malformed input", () => {
    expect(parseAuditDate("")).toBeNull();
    expect(parseAuditDate("nonsense")).toBeNull();
  });
});

describe("auditInRange", () => {
  const now = new Date(2026, 5, 18, 12, 0); // 18 Jun 2026

  test("all always passes", () => {
    expect(auditInRange("01/01/2500 00:00", "all", now)).toBe(true);
  });
  test("today matches same calendar day only", () => {
    expect(auditInRange("18/06/2569 09:00", "today", now)).toBe(true);
    expect(auditInRange("17/06/2569 23:59", "today", now)).toBe(false);
  });
  test("7d includes the last 7 calendar days", () => {
    expect(auditInRange("12/06/2569 00:00", "7d", now)).toBe(true);  // 6 days back
    expect(auditInRange("11/06/2569 23:59", "7d", now)).toBe(false); // 7 days back
  });
  test("month matches same calendar month", () => {
    expect(auditInRange("01/06/2569 00:00", "month", now)).toBe(true);
    expect(auditInRange("31/05/2569 00:00", "month", now)).toBe(false);
  });
  test("unparseable date fails any non-all range", () => {
    expect(auditInRange("bad", "today", now)).toBe(false);
  });
});
