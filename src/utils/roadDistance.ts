// Road-distance via OSRM public server with localStorage cache + haversine
// fallback. Returns kilometers along driveable routes (≈ what Google Maps shows),
// not great-circle distance.

import { haversineKm } from "./helpers";

const CACHE_KEY = "v3_road_dist_cache";
const OSRM_BASE = "https://router.project-osrm.org/table/v1/driving";
const FALLBACK_FACTOR = 1.4; // haversine × this ≈ typical road ratio

type Cache = Record<string, number>;
type Pt = { lat: number; lng: number };

const round = (n: number) => n.toFixed(5);
const ptKey = (lat: number, lng: number) => round(lat) + "," + round(lng);
const pairKey = (a: Pt, b: Pt) => {
  const ka = ptKey(a.lat, a.lng);
  const kb = ptKey(b.lat, b.lng);
  return ka < kb ? ka + "|" + kb : kb + "|" + ka;
};

let cache: Cache | null = null;
const loadCache = (): Cache => {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") as Cache;
  } catch {
    cache = {};
  }
  return cache;
};
const persist = () => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore quota
  }
};

// Sync read: returns cached road km, or haversine × FALLBACK_FACTOR as estimate.
export const roadKmSync = (a: Pt, b: Pt): number => {
  const c = loadCache();
  const v = c[pairKey(a, b)];
  if (typeof v === "number") return v;
  return haversineKm(a.lat, a.lng, b.lat, b.lng) * FALLBACK_FACTOR;
};

// Whether a precise (non-fallback) value is available for this pair.
export const hasCached = (a: Pt, b: Pt): boolean =>
  typeof loadCache()[pairKey(a, b)] === "number";

// Track in-flight requests to avoid duplicate fetches.
const inflight = new Map<string, Promise<void>>();

// Fetch OSRM table for one anchor → many targets. Persists to cache.
// Public OSRM allows up to 100 coordinates per request.
const MAX_COORDS = 100;

const fetchAnchor = async (anchor: Pt, targets: Pt[]): Promise<void> => {
  if (targets.length === 0) return;
  const coords = [anchor, ...targets]
    .map((p) => p.lng + "," + p.lat)
    .join(";");
  const url = OSRM_BASE + "/" + coords + "?sources=0&annotations=distance";
  const res = await fetch(url);
  if (!res.ok) throw new Error("OSRM " + res.status);
  const data = (await res.json()) as { distances?: number[][] };
  const row = data.distances?.[0];
  if (!Array.isArray(row)) throw new Error("OSRM bad shape");
  const c = loadCache();
  for (let i = 0; i < targets.length; i++) {
    const meters = row[i + 1];
    if (typeof meters === "number") {
      c[pairKey(anchor, targets[i])] = meters / 1000;
    }
  }
  persist();
};

// Prefetch missing distances for every (anchor × target) pair. Resolves once
// network calls finish; on failure, leaves fallback estimate in place.
// Returns true if at least one new value was cached (caller can re-render).
export const prefetchRoadDistances = async (
  anchors: Pt[],
  targets: Pt[]
): Promise<boolean> => {
  if (anchors.length === 0 || targets.length === 0) return false;
  let updated = false;
  for (const anchor of anchors) {
    const missing = targets.filter((t) => !hasCached(anchor, t));
    if (missing.length === 0) continue;
    for (let i = 0; i < missing.length; i += MAX_COORDS - 1) {
      const batch = missing.slice(i, i + (MAX_COORDS - 1));
      const key = ptKey(anchor.lat, anchor.lng) + "::" + batch.map((p) => ptKey(p.lat, p.lng)).join(",");
      let p = inflight.get(key);
      if (!p) {
        p = fetchAnchor(anchor, batch).catch(() => undefined as void) as Promise<void>;
        inflight.set(key, p);
        p.finally(() => inflight.delete(key));
      }
      await p;
      updated = true;
    }
  }
  return updated;
};
