// Pure box-placement + colour helpers for the 3D warehouse scene.
// No three.js / DOM here so this stays unit-testable (WebGL screenshots time out).

// Per-SKU safety valve: stock above this renders as one aggregated "pile" instead of
// per-unit boxes. Raised from 200 -> 5000 so the real 300-3,000/zone range draws real boxes.
export const REP_THRESHOLD = 5000;

// Plan how one product's `stock` units pack inside a zone. Lengths in metres.
//   box:  { w, l, h }            one unit's dimensions
//   zone: { innerW, innerL, ceilingH }
//   opts: { stock, gap=0.04, repThreshold=REP_THRESHOLD, manualCols=null }
// Footprint is always clamped to the zone, so any excess stacks UPWARD (overflow=true
// when the stack rises past the ceiling) rather than spilling sideways.
export function planBoxes(box, zone, opts = {}) {
  const { stock = 0, gap = 0.04, repThreshold = REP_THRESHOLD, manualCols = null, manualLayers = null } = opts;
  const layersMax = Math.max(1, Math.floor(zone.ceilingH / box.h));

  if (stock <= 0) {
    return { usePile: false, cols: 0, rows: 0, layers: 0, perLayer: 0, layersMax, footW: 0, footL: 0, overflow: false };
  }
  if (stock > repThreshold) {
    return { usePile: true, cols: 0, rows: 0, layers: 0, perLayer: 0, layersMax, footW: 0, footL: 0, overflow: false };
  }

  const pitchX = box.w + gap, pitchZ = box.l + gap;
  const maxCols = Math.max(1, Math.floor(zone.innerW / pitchX));
  const maxRows = Math.max(1, Math.floor(zone.innerL / pitchZ));
  const itemsPerLayer = Math.ceil(stock / layersMax);

  // cols (= แถว, boxes along the wall). Manual value honored exactly so the user's
  // count is never silently changed; overflow below flags it if it exceeds the zone.
  let cols;
  if (manualCols) cols = Math.max(1, Math.floor(manualCols));
  else cols = Math.min(Math.max(1, Math.round(Math.sqrt(itemsPerLayer))), maxCols);

  // rows (= depth, away from the wall). manualLayers fixes ชั้น, so depth fills to fit
  // stock; otherwise keep the original auto-rows behaviour.
  let rows;
  if (manualLayers) {
    const L = Math.max(1, Math.floor(manualLayers));
    rows = Math.max(1, Math.ceil(stock / (cols * L)));
  } else {
    rows = Math.min(Math.ceil(itemsPerLayer / cols), maxRows);
  }

  const perLayer = cols * rows;
  const layers = Math.ceil(stock / perLayer); // actual layers placed (<= requested ชั้น)
  const footW = cols * pitchX, footL = rows * pitchZ;
  const overflow = layers > layersMax || cols > maxCols || rows > maxRows;

  return { usePile: false, cols, rows, layers, perLayer, layersMax, footW, footL, overflow };
}

// Orient a box footprint relative to the wall (X = along the wall, Z = depth).
//   "long"  (default): ยาว (l) runs along the wall  -> swap w/l
//   "wide"           : กว้าง (w) runs along the wall -> unchanged
export function orientBoxDims(d, orient) {
  if (orient === "wide") return { w: d.w, l: d.l, h: d.h };
  return { w: d.l, l: d.w, h: d.h };
}

// Distinct, readable swatch colours for per-SKU box tinting (blended with cardboard in the scene).
export const PRODUCT_PALETTE = [
  "#d98b4a", "#e0c14a", "#7bbf5a", "#4aab9b", "#4a86d9",
  "#8a6ad9", "#d05a9b", "#c0573a", "#5a9bd0", "#9bbf3a",
];

// Stable colour per product id (same id -> same colour across zones/renders). FNV-1a hash.
export function productColor(id) {
  const s = String(id);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return PRODUCT_PALETTE[Math.abs(h) % PRODUCT_PALETTE.length];
}

// Snap a zone footprint to a 0.5 m grid and clamp it inside the warehouse. Pure.
export function snapClampZoneRect(origin, size, warehouse, step = 0.5) {
  const snap = (v) => Math.round(v / step) * step;
  const W = warehouse.widthM, L = warehouse.lengthM;
  const w = Math.min(Math.max(snap(size.w), step), W);
  const l = Math.min(Math.max(snap(size.l), step), L);
  const x = Math.min(Math.max(snap(origin.x), 0), W - w);
  const z = Math.min(Math.max(snap(origin.z), 0), L - l);
  return { origin: { x, z }, size: { w, l } };
}

// Snap a zone ceiling height to 0.5 m and clamp to (0.5 .. warehouse height]. Pure.
export function clampZoneHeight(h, warehouse, step = 0.5) {
  const max = warehouse.heightM;
  const v = Math.round((Number(h) || max) / step) * step;
  return Math.min(Math.max(v, step), max);
}

// Merge one box's edge-line template across many box centres (local space).
//   tpl:     flat [x,y,z, x,y,z, ...] of the box-edge LineSegments (length = n*3)
//   centers: [{ x, y, z }] one entry per box; each box = tpl translated by its centre
// Returns a Float32Array suitable for a LineSegments "position" attribute.
export function mergeEdgePositions(tpl, centers) {
  const n = tpl.length;
  const out = new Float32Array(n * centers.length);
  let o = 0;
  for (const c of centers) {
    for (let i = 0; i < n; i += 3) {
      out[o++] = tpl[i] + c.x;
      out[o++] = tpl[i + 1] + c.y;
      out[o++] = tpl[i + 2] + c.z;
    }
  }
  return out;
}
