// Bridges app data (products, zones) + persisted warehouse_layout config into the
// { WAREHOUSE, ZONES, PRODUCTS } shape consumed by the 3D scene (src/lib/warehouse3d/scene.js).
// Field names match the stock-app data model:
//   Product: id, code, name, nameT, brand, stock, widthCm, lengthCm, heightCm, cubicM, sizeClass, noLayDown, unit
//   Zone (app): id, name, note, productIds   (no geometry/camera — those live in warehouse_layout)

// Default warehouse box (metres) — taken from the Claude Design layout (5-column plan).
export const DEFAULT_WAREHOUSE = { widthM: 54, lengthM: 30, heightM: 10 };

// Per-zone colour fallback when warehouse_layout has no saved colour for a zone.
const ZONE_PALETTE = ["#4a90d9", "#39b56a", "#e0823a", "#b06ad9", "#d94a6a", "#3aa0b0", "#c0a02a", "#8a909a"];

const C1 = "#4a90d9", C2 = "#39b56a", C3 = "#e0823a", C4 = "#b06ad9", C5 = "#d94a6a", CG = "#8a909a";

// Real warehouse layout from the user's full sketch (metres). Warehouse 54 (X) × 30 (Z) × 8 (H).
// Columns (x): E/e/i/I = 0 (w6) · D/d/h/H = 6 (w12) · C/c/g/G = 18 (w12) · B/b/f/F = 30 (w12) · A/a/office = 42 (w12)
// Bands (z): top 0–8 · WAY 8–11 · upper-mid 11–15 · lower-mid 15–19 · WAY 19–22 · bottom 22–30
// b/f are a 9×4 box (3m WAY to their right, inside column B). Column 5: A(8)/way(3)/a(4)/office(15).
const DESIGN_ZONES = [
  // top band (depth 8)
  { id: "E", origin: { x: 0, z: 0 }, size: { w: 6, l: 8 }, color: C1 },
  { id: "D", origin: { x: 6, z: 0 }, size: { w: 12, l: 8 }, color: C2 },
  { id: "C", origin: { x: 18, z: 0 }, size: { w: 12, l: 8 }, color: C3 },
  { id: "B", origin: { x: 30, z: 0 }, size: { w: 12, l: 8 }, color: C4 },
  { id: "A", origin: { x: 42, z: 0 }, size: { w: 12, l: 8 }, color: C5 },
  // upper-middle row (depth 4)
  { id: "e", origin: { x: 0, z: 11 }, size: { w: 6, l: 4 }, color: C1 },
  { id: "d", origin: { x: 6, z: 11 }, size: { w: 12, l: 4 }, color: C2 },
  { id: "c", origin: { x: 18, z: 11 }, size: { w: 12, l: 4 }, color: C3 },
  { id: "b", origin: { x: 30, z: 11 }, size: { w: 9, l: 4 }, color: C4 },
  { id: "a", origin: { x: 42, z: 11 }, size: { w: 12, l: 4 }, color: C5 }, // upper-middle only
  // lower-middle row (depth 4)
  { id: "i", origin: { x: 0, z: 15 }, size: { w: 6, l: 4 }, color: C1 },
  { id: "h", origin: { x: 6, z: 15 }, size: { w: 12, l: 4 }, color: C2 },
  { id: "g", origin: { x: 18, z: 15 }, size: { w: 12, l: 4 }, color: C3 },
  { id: "f", origin: { x: 30, z: 15 }, size: { w: 9, l: 4 }, color: C4 },
  // bottom band (depth 8)
  { id: "I", origin: { x: 0, z: 22 }, size: { w: 6, l: 8 }, color: C1 },
  { id: "H", origin: { x: 6, z: 22 }, size: { w: 12, l: 8 }, color: C2 },
  { id: "G", origin: { x: 18, z: 22 }, size: { w: 12, l: 8 }, color: C3 },
  { id: "F", origin: { x: 30, z: 22 }, size: { w: 12, l: 8 }, color: C4 },
  { id: "office", origin: { x: 42, z: 15 }, size: { w: 12, l: 15 }, color: CG }, // fills the rest of column 5 below a
];

// Ordered slot geometries (used to place real app zones that lack saved geometry).
export function designSlots() {
  return DESIGN_ZONES.map((z) => ({ origin: { ...z.origin }, size: { ...z.size }, color: z.color }));
}

// Full sketch zone set with empty productIds (layout only — no sample products).
export function claudeDesignZones() {
  return DESIGN_ZONES.map((z) => ({
    id: z.id,
    name: z.id === "office" ? "สำนักงาน (Office)" : "โซน " + z.id,
    note: "",
    origin: { ...z.origin },
    size: { ...z.size },
    color: z.color,
    productIds: [],
  }));
}

// Remove a zone's manual drag layout from warehouse_layout, returning a new object.
// Returns the SAME reference when there is nothing to clear (so React can skip updates).
export function clearZoneLayout(warehouseLayout, zoneId) {
  const wl = warehouseLayout || {};
  const zones = wl.zones || {};
  const entry = zones[zoneId];
  if (!entry || !entry.layout) return warehouseLayout;
  const newEntry = { ...entry };
  delete newEntry.layout;
  const newZones = { ...zones };
  if (Object.keys(newEntry).length) newZones[zoneId] = newEntry;
  else delete newZones[zoneId];
  return { ...wl, zones: newZones };
}

// Merge per-zone drag layouts into warehouse_layout (used by the arrange-save). Pure.
export function applyZoneLayout(warehouseLayout, layoutByZone) {
  const next = { ...(warehouseLayout || {}) };
  const zones = { ...(next.zones || {}) };
  for (const zid of Object.keys(layoutByZone || {})) {
    zones[zid] = { ...(zones[zid] || {}), layout: layoutByZone[zid] };
  }
  next.zones = zones;
  return next;
}

// Merge a patch (e.g. {camera} or {origin,size,heightM}) into one zone's entry. Pure.
export function mergeZoneEntry(warehouseLayout, zoneId, patch) {
  const next = { ...(warehouseLayout || {}) };
  const zones = { ...(next.zones || {}) };
  zones[zoneId] = { ...(zones[zoneId] || {}), ...patch };
  next.zones = zones;
  return next;
}

// Lay out the given zones in a grid that fits inside the warehouse footprint.
// Returns a map zoneId -> { origin:{x,z}, size:{w,l} } (metres).
export function autoPlaceZones(zones, warehouse) {
  const n = zones.length;
  if (n === 0) return {};
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const gap = 1; // metres: outer margin + spacing between zones
  const cellW = (warehouse.widthM - gap * (cols + 1)) / cols;
  const cellL = (warehouse.lengthM - gap * (rows + 1)) / rows;
  const out = {};
  zones.forEach((z, i) => {
    const r = Math.floor(i / cols), c = i % cols;
    out[z.id] = {
      origin: { x: gap + c * (cellW + gap), z: gap + r * (cellL + gap) },
      size: { w: Math.max(1, cellW), l: Math.max(1, cellL) },
    };
  });
  return out;
}

// Expand split products into per-part pseudo-products for warehouse/zone use.
// Non-split products pass through unchanged. Each split part becomes a pseudo-
// product with id "<productId>:<partKey>", carrying that part's own box + name.
export function expandProductsForWarehouse(products = []) {
  const list = Array.isArray(products) ? products : [];
  const out = [];
  for (const p of list) {
    if (p && p.splitEnabled && Array.isArray(p.splitParts) && p.splitParts.length) {
      const base = p.nameT || p.name || "";
      for (const part of p.splitParts) {
        out.push({
          ...p,
          id: `${p.id}:${part.key}`,
          code: p.code || "",
          name: p.name ? `${p.name} — ${part.name}` : part.name,
          nameT: base ? `${base} — ${part.name}` : part.name,
          widthCm: part.widthCm,
          lengthCm: part.lengthCm,
          heightCm: part.heightCm,
          noLayDown: !!part.noLayDown,
          cubicM: undefined,     // ปล่อยให้ปริมาตรมาจาก W×L×H ของส่วน
          splitEnabled: false,   // pseudo-product เป็นชิ้นเดียว
          splitParts: undefined,
        });
      }
    } else {
      out.push(p);
    }
  }
  return out;
}

// Map one app Product onto the scene's PRODUCTS item shape (fill safe defaults for
// optional fields so the renderer never receives undefined dimensions).
function mapProduct(p) {
  const out = {
    id: p.id,
    code: p.code || "",
    name: p.name || "",
    nameT: p.nameT || p.name || "",
    brand: p.brand || "-",
    stock: Number(p.stock) || 0,
    widthCm: Number(p.widthCm) || 0,
    lengthCm: Number(p.lengthCm) || 0,
    heightCm: Number(p.heightCm) || 0,
    sizeClass: p.sizeClass || "M",
    noLayDown: !!p.noLayDown,
    unit: p.unit || "ชิ้น",
  };
  if (typeof p.cubicM === "number") out.cubicM = p.cubicM;
  return out;
}

// Combine real products + app zones + persisted warehouse_layout into the full data
// object the 3D scene / standalone HTML consume. Zones without saved geometry are
// auto-placed; saved camera/layout (per-zone) are carried through when present.
export function buildWarehouseData(products = [], zones = [], warehouseLayout = {}) {
  const wl = warehouseLayout && typeof warehouseLayout === "object" ? warehouseLayout : {};

  const WAREHOUSE = wl.warehouse && typeof wl.warehouse === "object"
    ? {
        widthM: Number(wl.warehouse.widthM) || DEFAULT_WAREHOUSE.widthM,
        lengthM: Number(wl.warehouse.lengthM) || DEFAULT_WAREHOUSE.lengthM,
        heightM: Number(wl.warehouse.heightM) || DEFAULT_WAREHOUSE.heightM,
      }
    : { ...DEFAULT_WAREHOUSE };

  const zlay = wl.zones && typeof wl.zones === "object" ? wl.zones : {};

  // When the app has no zones yet, seed the full Claude Design layout (zones + sample products);
  // once real zones exist they take over automatically.
  const hasRealZones = Array.isArray(zones) && zones.length > 0;
  const baseZones = hasRealZones ? zones : claudeDesignZones();
  // Seed shows the layout only — no sample products. Real products appear once real zones exist.
  const productList = hasRealZones ? (Array.isArray(products) ? products : []) : [];

  // Place zones that have neither a saved nor an intrinsic origin+size (i.e. real app zones)
  // into the Claude Design slot template (in order); fall back to an adaptive grid if too many.
  const needPlacement = baseZones.filter((z) => {
    const saved = zlay[z.id] || {};
    return !(saved.origin && saved.size) && !(z.origin && z.size);
  });
  const slots = designSlots();
  const placement = {};
  if (needPlacement.length <= slots.length) {
    needPlacement.forEach((z, i) => { placement[z.id] = slots[i]; });
  } else {
    const grid = autoPlaceZones(needPlacement, WAREHOUSE);
    needPlacement.forEach((z) => { placement[z.id] = grid[z.id]; });
  }

  // Split products เดิมอาจถูกอ้างด้วย id เปล่าใน zone.productIds — แตกเป็นส่วนตอน render
  const splitPartIds = new Map();
  for (const p of productList) {
    if (p && p.splitEnabled && Array.isArray(p.splitParts) && p.splitParts.length) {
      splitPartIds.set(String(p.id), p.splitParts.map((part) => `${p.id}:${part.key}`));
    }
  }
  const expandZoneIds = (ids) =>
    (Array.isArray(ids) ? ids : []).flatMap((id) =>
      splitPartIds.has(String(id)) ? splitPartIds.get(String(id)) : [id]
    );

  const ZONES = baseZones.map((z, i) => {
    const saved = zlay[z.id] || {};
    const geom = saved.origin && saved.size ? saved : (z.origin && z.size ? z : placement[z.id]);
    const out = {
      id: z.id,
      name: z.name || String(z.id),
      note: z.note || "",
      origin: (geom && geom.origin) || { x: 0, z: 0 },
      size: (geom && geom.size) || { w: 4, l: 4 },
      color: saved.color || z.color || (geom && geom.color) || ZONE_PALETTE[i % ZONE_PALETTE.length],
      productIds: expandZoneIds(z.productIds),
      presets: Array.isArray(z.presets) ? z.presets : [],
      heightM: Number(saved.heightM) || Number(z.heightM) || WAREHOUSE.heightM,
    };
    if (saved.camera || z.camera) out.camera = saved.camera || z.camera;
    if (saved.layout || z.layout) out.layout = saved.layout || z.layout;
    if (z.boxConfig) out.boxConfig = z.boxConfig; // per-product แถว/ชั้น from the form
    if (z.arrangeRot) out.arrangeRot = z.arrangeRot; // per-zone arrangement rotation
    return out;
  });

  const PRODUCTS = expandProductsForWarehouse(productList).map(mapProduct);

  return { WAREHOUSE, ZONES, PRODUCTS };
}
