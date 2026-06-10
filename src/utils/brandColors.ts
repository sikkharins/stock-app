/**
 * Official brand color lookup. Falls back to a deterministic HSL hash from the
 * brand name for any brand not in this map.
 *
 * Add new entries here when the user confirms an official hex code.
 */
const BRAND_HEX: Record<string, string> = {
  LG: "#A50034",
  Samsung: "#1428A0",
  Hitachi: "#D11B1A",
  Toshiba: "#CC0000",
  Haier: "#0C5CA8",
  Daikin: "#54C3F1",
  Midea: "#0098D1",
};

export type BrandColor = {
  /** Base CSS color value (hex if mapped, hsl(...) otherwise). */
  base: string;
  /** Returns the same color with the given alpha (0..1) — rgba or hsla. */
  alpha: (a: number) => string;
  /** True if the brand has an official mapped hex (vs hash fallback). */
  isOfficial: boolean;
};

const hexToRgba = (hex: string, a: number): string => {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

const hashHue = (s: string): number => {
  let h = 0;
  for (let i = 0; i < (s || "").length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
};

export const brandColor = (brand: string): BrandColor => {
  // Case-insensitive lookup so "lg" / "LG" / "Lg" all match.
  const key = Object.keys(BRAND_HEX).find(
    (k) => k.toLowerCase() === (brand || "").toLowerCase()
  );
  if (key) {
    const hex = BRAND_HEX[key];
    return {
      base: hex,
      alpha: (a) => hexToRgba(hex, a),
      isOfficial: true,
    };
  }
  const hue = hashHue(brand || "");
  return {
    base: `hsl(${hue} 70% 50%)`,
    alpha: (a) => `hsl(${hue} 70% 50% / ${a})`,
    isOfficial: false,
  };
};
