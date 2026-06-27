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

// A gap/spacer entry in zone.productIds (reserved empty space, not a product).
export function isGapId(id) {
  return typeof id === "string" && id.startsWith("gap-");
}

// Gap width in metres from its boxConfig entry. Each แถว (cols) = 10 cm; min 1.
export function gapWidthM(cfg) {
  const cols = Math.max(1, Math.floor((cfg && cfg.cols) || 1));
  return cols * 0.10;
}

// Place one item along the flow axis inside a zone, wrapping into bands. Pure.
//   cur:    { curX, curZ, bandDepth }   current cursor (metres, world coords)
//   item:   { fw, fl, advance }         footprint X/Z extents + extra spacing after it
//   bounds: { ox, oz, innerXMax, innerZMax, margin, gap }
//   flowZ:  false = flow along X (wrap into Z bands); true = flow along Z (wrap into X)
// Returns the item's base corner {bx,bz} and the advanced cursor {curX,curZ,bandDepth}.
export function placeInBand(cur, item, bounds, flowZ) {
  let { curX, curZ, bandDepth } = cur;
  const { ox, oz, innerXMax, innerZMax, margin, gap } = bounds;
  if (!flowZ) {
    if (curX + item.fw > innerXMax) { curX = ox + margin; curZ += bandDepth + gap; bandDepth = 0; }
    return { bx: curX, bz: curZ, curX: curX + item.fw + item.advance, curZ, bandDepth: Math.max(bandDepth, item.fl) };
  }
  if (curZ + item.fl > innerZMax) { curZ = oz + margin; curX += bandDepth + gap; bandDepth = 0; }
  return { bx: curX, bz: curZ, curX, curZ: curZ + item.fl + item.advance, bandDepth: Math.max(bandDepth, item.fw) };
}

// Normalize any value to one of 0/90/180/270 (degrees CW).
export function normArrangeRot(v) {
  return ((Math.round((Number(v) || 0) / 90) * 90) % 360 + 360) % 360;
}

// three.js Y-rotation (radians) turning a +X/+Z box grid to match an R° CW arrangement.
export function arrangeRotY(R) {
  return { 0: 0, 90: -Math.PI / 2, 180: Math.PI, 270: Math.PI / 2 }[normArrangeRot(R)];
}

// Map a canvas-frame point (px,pz) into zone-inner coords [0..innerW] x [0..innerL]
// for an R° CW arrangement. (Caller adds the ox+MARGIN / oz+MARGIN origin offset.)
export function arrangePoint(R, px, pz, innerW, innerL) {
  switch (normArrangeRot(R)) {
    case 90:  return { x: innerW - pz, z: px };
    case 180: return { x: innerW - px, z: innerL - pz };
    case 270: return { x: pz, z: innerL - px };
    default:  return { x: px, z: pz };
  }
}

// Decide whether a move-mode click grabs one box ("unit") or the whole group ("block").
// Only an instanced product with a real instanceId + per-unit data can be a unit, and
// only when the user is NOT in whole-stack mode.
export function pickDragKind(isInstanced, instanceId, hasUnits, selectWhole) {
  if (isInstanced && instanceId != null && hasUnits && !selectWhole) return "unit";
  return "block";
}

// Z lines that act as walls for auto-anchoring: warehouse perimeter (0 and lengthM)
// plus internal back-to-back seams — where one zone's far Z edge meets another zone's
// near Z edge at the same z, overlapping in X. Returns an array of z values.
export function zoneWallLinesZ(zones, warehouse) {
  const EPS = 0.01;
  const lines = [0, warehouse.lengthM];
  const add = (z) => { if (!lines.some((w) => Math.abs(w - z) < EPS)) lines.push(z); };
  for (const a of zones) {
    const aFar = a.origin.z + a.size.l;
    const ax0 = a.origin.x, ax1 = a.origin.x + a.size.w;
    for (const b of zones) {
      if (b === a) continue;
      if (Math.abs(aFar - b.origin.z) >= EPS) continue;            // far(a) meets near(b)
      const bx0 = b.origin.x, bx1 = b.origin.x + b.size.w;
      if (Math.min(ax1, bx1) - Math.max(ax0, bx0) > EPS) add(aFar); // truly back-to-back (X overlap)
    }
  }
  return lines;
}

// Auto arrangement rotation (0 or 180 degrees): flip 180 when the FAR Z edge sits on a
// wall line but the NEAR edge does not, so products anchor to the wall away from the aisle.
export function autoWallRot(zone, wallLinesZ) {
  const EPS = 0.01;
  const onLine = (z) => wallLinesZ.some((w) => Math.abs(w - z) < EPS);
  const near = zone.origin.z, far = zone.origin.z + zone.size.l;
  return (onLine(far) && !onLine(near)) ? 180 : 0;
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
