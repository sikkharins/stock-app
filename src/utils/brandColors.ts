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
  /**
   * Luminance-lifted variant safe for text on dark or light backgrounds.
   * Brand hue/saturation preserved; lightness clamped to 62% so dark brand
   * hexes (Samsung #1428A0, Haier #0C5CA8, Toshiba #CC0000) remain readable
   * when used as text color on a dark-theme background.
   */
  text: string;
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

const hexToHsl = (hex: string): [number, number, number] => {
  const s2 = hex.replace("#", "");
  const r = parseInt(s2.slice(0, 2), 16) / 255;
  const g = parseInt(s2.slice(2, 4), 16) / 255;
  const b = parseInt(s2.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
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
    const [h, s] = hexToHsl(hex);
    return {
      base: hex,
      alpha: (a) => hexToRgba(hex, a),
      text: `hsl(${h} ${Math.max(s, 60)}% 62%)`,
      isOfficial: true,
    };
  }
  const hue = hashHue(brand || "");
  return {
    base: `hsl(${hue} 70% 50%)`,
    alpha: (a) => `hsl(${hue} 70% 50% / ${a})`,
    text: `hsl(${hue} 70% 62%)`,
    isOfficial: false,
  };
};
