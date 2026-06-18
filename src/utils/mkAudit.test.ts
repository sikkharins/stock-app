import { describe, test, expect } from "vitest";
import { mkAudit } from "./helpers";

describe("mkAudit changes", () => {
  test("omits changes when none given", () => {
    expect("changes" in mkAudit("แก้ไข SO", "SO-1", "u")).toBe(false);
  });
  test("omits changes when empty array", () => {
    expect("changes" in mkAudit("แก้ไข SO", "SO-1", "u", [])).toBe(false);
  });
  test("attaches non-empty changes", () => {
    const ch = [{ label: "ส่วนลด", from: "฿100", to: "฿200" }];
    expect(mkAudit("แก้ไข SO", "SO-1", "u", ch).changes).toEqual(ch);
  });
});
