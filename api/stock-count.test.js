import { describe, test, expect } from "vitest";
import { resolveModel, formatCatalog } from "./stock-count.js";

describe("resolveModel", () => {
  test("maps known keys", () => {
    expect(resolveModel("opus")).toBe("claude-opus-4-8");
    expect(resolveModel("sonnet")).toBe("claude-sonnet-4-6");
    expect(resolveModel("haiku")).toBe("claude-haiku-4-5");
  });
  test("unknown/missing → opus default", () => {
    expect(resolveModel("nope")).toBe("claude-opus-4-8");
    expect(resolveModel(undefined)).toBe("claude-opus-4-8");
  });
});

describe("formatCatalog", () => {
  test("formats id/brand/name/unit/desc, never stock or price", () => {
    const out = formatCatalog([
      { id: 7, brand: "Toshiba", name: "ตู้เย็น", unit: "เครื่อง", desc: "กล่องน้ำตาล", stock: 99, price: 8000 },
    ]);
    expect(out).toContain("[7]");
    expect(out).toContain("Toshiba");
    expect(out).toContain("ตู้เย็น");
    expect(out).toContain("หน่วย:เครื่อง");
    expect(out).toContain("ลักษณะ:กล่องน้ำตาล");
    expect(out).not.toContain("99");
    expect(out).not.toContain("8000");
  });
  test("empty catalog", () => {
    expect(formatCatalog([])).toBe("(catalog ว่าง)");
  });
});
