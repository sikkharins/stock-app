export interface PresetRef { token: string; name: string; }
export type CaptureMode = "current" | "zone" | "manual";
interface ZoneLike { presets?: PresetRef[]; }
export interface CaptureTarget { token: string | null; name: string; }

// เลือกว่าจะดึงเฟรมจากมุมไหนบ้าง (pure). ใช้ชื่อจาก presets ปัจจุบันเสมอ (เผื่อ rename).
export function pickCaptureTargets(opts: {
  mode: CaptureMode;
  zone?: ZoneLike | null;
  selectedTokens?: string[];
  presets?: PresetRef[];
}): CaptureTarget[] {
  const { mode, zone, selectedTokens = [], presets = [] } = opts;
  if (mode === "current") return [{ token: null, name: "มุมปัจจุบัน" }];
  const byToken = new Map(presets.map((p) => [String(p.token), p]));
  const order = mode === "zone" ? (zone?.presets || []).map((p) => String(p.token)) : selectedTokens.map(String);
  return order
    .filter((t) => byToken.has(t))
    .map((t) => ({ token: t, name: byToken.get(t)!.name }));
}

export const RELAY_URL_KEY = "v3_relay_url";
export const DEFAULT_RELAY_URL = "http://localhost:8765";
export const getRelayUrl = (): string => {
  try { return localStorage.getItem(RELAY_URL_KEY) || DEFAULT_RELAY_URL; } catch { return DEFAULT_RELAY_URL; }
};
export const setRelayUrl = (u: string): void => {
  try { localStorage.setItem(RELAY_URL_KEY, u); } catch { /* ignore */ }
};
