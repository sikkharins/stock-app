# Zone box arrangement — order, rows, layers per product

Date: 2026-06-26
Status: approved (design)

## Goal

In the zone editor (`src/components/Zones.jsx`), let the user control how each
product's boxes are arranged inside its zone, so the 3D warehouse
(`Warehouse3D`) places real boxes per SKU the way the warehouse is actually
stacked. Three controls per product:

1. **Order** — products line up left to right along the wall. Product #1 is
   leftmost, then #2, #3, … Reordered with left/right arrow buttons.
2. **แถว (rows)** — number of boxes laid side by side **along the wall**
   (left-right) within that product's block. User input.
3. **ชั้น (layers)** — how many boxes are stacked **vertically**. User input.

The third spatial dimension — **depth** (running away from the wall) — is
**derived automatically** from stock so every unit fits:
`depth = ceil(stock / (แถว × ชั้น))`.

### Terminology (confirmed with diagram)

Looking at the wall head-on, each product reads as a "box face" of
`แถว × ชั้น` units, and these faces sit next to each other left to right in
order. Depth grows back into the zone on its own.

| Term (Thai) | Axis | Source |
|---|---|---|
| ลำดับ (order) | along wall, left→right | `zone.productIds` array order |
| แถว (rows) | along wall, left↔right (= scene "cols") | user input |
| ชั้น (layers) | vertical (= scene "layers") | user input |
| depth / แนวลึก | away from wall (= scene "rows") | auto = `ceil(stock/(แถว×ชั้น))` |

Note the deliberate vocabulary mismatch: the user's **แถว** maps to the scene's
internal **cols** (X axis, `pitchX`), and the scene's internal **rows** (Z axis,
`pitchZ`) is the auto-derived depth. The UI uses the Thai terms; the engine
keeps its existing variable names.

## Approach

**Approach B — separate `boxConfig` map (chosen).**

Store per-product shape as `zone.boxConfig[pid] = { cols, layers }` on the app
zone object, edited in the form. This is intentionally separate from
`zone.layout` (which holds dragged x/z/rot position and lives in the
`warehouse_layout` store, rebuilt wholesale by the 3D "save arrangement"
button at `scene.js:1117`). Keeping shape (`boxConfig`, in app zones) and
position (`layout`, in warehouse_layout) in different maps means neither
clobbers the other.

`cols` = แถว, `layers` = ชั้น. Either field may be omitted → that axis falls
back to the current automatic behavior. An absent `boxConfig` (all existing
zones) behaves exactly as today.

Approach A (extend `zone.layout`) was rejected: the 3D drag-save at
`scene.js:1117` rebuilds the whole layout map from position only, dropping any
`cols`/`layers`; and `layout` is sourced from `warehouse_layout`, not from the
form's `sh.zones`.

## Data model

App zone object gains an optional field:

```js
zone.boxConfig = {
  [productId]: { cols?: number, layers?: number }, // cols=แถว, layers=ชั้น
  ...
}
```

- Lives in `sh.zones`, edited by the form, persisted as-is — `zones` is
  JSON-serialized whole with no field whitelist (`App.jsx:339`,
  `storage.ts` `v3_zones`). No storage change needed.
- Order continues to live in `zone.productIds` (array order). No new field.

## Changes

### 1. `src/lib/warehouse3d/boxPlan.js` — `planBoxes`

Add `manualLayers` to `opts` (alongside existing `manualCols`). Each axis is
honored independently; a missing manual value keeps the current auto math.

New flow (replaces the cols/rows/layers block, keeping the empty-stock and
`usePile` early returns and the pile threshold unchanged):

```js
const pitchX = box.w + gap, pitchZ = box.l + gap;
const maxCols = Math.max(1, Math.floor(zone.innerW / pitchX));
const maxRows = Math.max(1, Math.floor(zone.innerL / pitchZ));

// cols (= แถว): honor manual exactly, else auto-square as today
let cols;
if (manualCols) cols = Math.max(1, Math.floor(manualCols));
else {
  const itemsPerLayer = Math.ceil(stock / layersMax);
  cols = Math.min(Math.max(1, Math.round(Math.sqrt(itemsPerLayer))), maxCols);
}

// depth (= rows): manualLayers fixes the layer count, so depth fills to fit;
// else keep the existing auto-rows behavior.
let rows;
if (manualLayers) {
  const L = Math.max(1, Math.floor(manualLayers));
  rows = Math.max(1, Math.ceil(stock / (cols * L)));
} else {
  const itemsPerLayer = Math.ceil(stock / layersMax);
  rows = Math.min(Math.ceil(itemsPerLayer / cols), maxRows);
}

const perLayer = cols * rows;
const layers = Math.ceil(stock / perLayer); // actual layers placed
const footW = cols * pitchX, footL = rows * pitchZ;
const overflow = layers > layersMax || cols > maxCols || rows > maxRows;
```

Key points:
- Manual `cols`/`layers` are **not clamped** to the zone footprint — the user's
  numbers are honored exactly, and `overflow` is raised when the block exceeds
  the zone width / depth / ceiling (the scene already tints overflow zones).
  All units are still placed (depth grows to fit).
- Returned `layers` is the **actual** stacking (≤ requested ชั้น when stock is
  too small to fill them), matching today's semantics consumed by the scene.
- Return shape is unchanged: `{ usePile, cols, rows, layers, perLayer,
  layersMax, footW, footL, overflow }`.

### 2. `src/lib/warehouse3d/scene.js` — placement loop (~line 471–475)

Read the per-product config and pass both manual values:

```js
const cfg = (zone.boxConfig && zone.boxConfig[pid]) || null;
const plan = planBoxes(d, { innerW, innerL, ceilingH: zone.heightM }, {
  stock: p.stock, gap: GAP,
  manualCols: cfg && cfg.cols ? cfg.cols : null,
  manualLayers: cfg && cfg.layers ? cfg.layers : null,
});
```

No change to the positioning branch (`if (manual) { … }` at ~527): `layout`
entries always carry an explicit `x`, so auto left→right flow still applies to
products that were never dragged, and order follows `productIds`. `boxConfig`
never enters `layout`, so the earlier positioning concern does not arise.

### 3. `src/utils/warehouse3d.js` — zone merge (~line 158)

Carry `boxConfig` from the app zone into the merged scene zone:

```js
if (z.boxConfig) out.boxConfig = z.boxConfig;
```

(`boxConfig` is shape config from the app zone, not geometry — it is not part
of the `warehouse_layout` `saved` object, so it reads straight off `z`.)

### 4. `src/components/Zones.jsx` — editor

Replace the flat wrap of product chips with an ordered vertical list. Each row:

```
[‹] [›]  #<n>  <product name> ……  แถว [__]  ชั้น [__]  [×]
```

- `‹` / `›` swap the product with its neighbor in `productIds`
  (`‹` = move toward index 0 / leftmost; `›` = toward the end / rightmost).
  `‹` disabled on the first row, `›` on the last.
- `#<n>` shows the 1-based order.
- `แถว` and `ชั้น` are small number inputs (`min=1`, placeholder `"auto"`).
  Empty = that axis stays auto. `onChange` writes
  `editing.boxConfig[pid] = { ...prev, cols|layers: value || undefined }`;
  clearing an input removes that key.
- `×` removes the product from `productIds` **and** deletes
  `editing.boxConfig[pid]`.
- Adding a product via `ProductPicker` is unchanged (no `boxConfig` entry → auto).

Helper functions (`moveProduct`, `setBoxCfg`, etc.) declared at the top of the
component body. No component defined inside another's render (per project
pitfalls: inline-component remount, useMemo TDZ).

`save()` already spreads `...editing`, so `boxConfig` persists with the zone.
The zone list summary line may optionally note products with custom arrangement
(not required).

## Backward compatibility

- Zones without `boxConfig` (every existing zone) → `planBoxes` takes the auto
  path → identical rendering to today.
- Reordering still works through `productIds`; only the editing UI changes.
- 3D drag-to-position and "save arrangement" are untouched and independent.

## Edge cases

- Stock too small to fill ชั้น (e.g. 4 units, แถว 3, ชั้น 3) → depth = 1,
  actual layers = 2; the extra requested layer is simply empty. Acceptable.
- แถว or ชั้น larger than the zone fits → honored exactly, `overflow` raised
  (zone tints as overflow), all boxes still placed.
- `stock > REP_THRESHOLD` (5000) → pile path as today; `boxConfig` ignored for
  piles.
- `stock <= 0` → empty plan as today.

## Testing

- **Unit (`boxPlan`)**: add cases for the `manualLayers` / `manualCols` branch —
  verify `cols === แถว`, `rows === ceil(stock/(cols*layers))`, `layers` actual,
  `footW/footL`, and `overflow` when exceeding zone/ceiling. Verify omitting a
  manual value keeps the auto result.
- **Smoke (`Zones`)**: editor renders one ordered row per product with แถว/ชั้น
  inputs and ‹/› buttons; reordering swaps `productIds`; typing แถว/ชั้น writes
  `boxConfig`; `×` clears both `productIds` and `boxConfig`.

## Out of scope

- Editing depth manually (always auto-derived).
- Per-product manual x/z/rotation from the form (stays a 3D-drag feature).
- Migrating or auto-populating `boxConfig` for existing zones.
