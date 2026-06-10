import { describe, test, expect } from "vitest";
import { brandColor } from "./brandColors";

describe("brandColor", () => {
  test("returns mapped hex for known brand", () => {
    const c = brandColor("LG");
    expect(c.base).toBe("#A50034");
    expect(c.isOfficial).toBe(true);
  });

  test("hex.alpha returns rgba with correct channels", () => {
    // #A50034 → r=165, g=0, b=52
    expect(brandColor("LG").alpha(0.5)).toBe("rgba(165, 0, 52, 0.5)");
  });

  test("Samsung maps to #1428A0", () => {
    expect(brandColor("Samsung").base).toBe("#1428A0");
  });

  test("case-insensitive lookup", () => {
    expect(brandColor("lg").base).toBe("#A50034");
    expect(brandColor("SAMSUNG").base).toBe("#1428A0");
    expect(brandColor("hAiEr").base).toBe("#0C5CA8");
  });

  test("falls back to hsl for unmapped brand", () => {
    const c = brandColor("UnknownBrand");
    expect(c.isOfficial).toBe(false);
    expect(c.base).toMatch(/^hsl\(\d+ 70% 50%\)$/);
  });

  test("fallback alpha uses hsla format", () => {
    const c = brandColor("UnknownBrand");
    expect(c.alpha(0.3)).toMatch(/^hsl\(\d+ 70% 50% \/ 0\.3\)$/);
  });

  test("empty string is handled (falls back to hash of empty)", () => {
    const c = brandColor("");
    expect(c.isOfficial).toBe(false);
    expect(c.base).toMatch(/^hsl\(/);
  });

  test("two known brands produce different colors", () => {
    expect(brandColor("LG").base).not.toBe(brandColor("Samsung").base);
  });
});
