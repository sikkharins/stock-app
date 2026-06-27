# Zone editor — gap / spacer items in the arrangement

Date: 2026-06-26
Status: approved (design)

## Goal

In the zone arrangement, let the user insert a **gap / spacer** item (empty space,
not a product) anywhere in the left→right order. Each gap has a width in แถว units
where **1 แถว = 10 cm** (default 1 = 10 cm). In the 3D warehouse the gap reserves
that width — pushing the following products to the right — and shows as a faint
floor patch.

Extends the arrangement features: [[2026-06-26-warehouse-3d-zone-box-arrangement-design]],
[[2026-06-26-warehouse-3d-zone-box-orientation-design]],
[[2026-06-26-warehouse-3d-zone-replace-product-design]].

## Background

A zone's order lives in `zone.productIds` (array order = left→right). The 3D scene
(`scene.js`) lays each product along an X cursor (`curX`), advancing
`curX += footprintW + GAP*4`, wrapping to a new depth band when it passes the zone
edge. Per-product arrangement is in `boxConfig[pid] = { cols?, layers?, orient? }`.

ตรวจนับ AI (`StockCount.jsx`) reads only `zone.id`/`zone.name` (a dropdown), not
`productIds`, so gap entries do not affect screening. `warehouse3d.js` passes
`productIds` and `boxConfig` through unchanged. `mpCopy` drag-save already guards
`if (!m || !m.pg) return`, so unregistered gaps are skipped.

## Data model

A gap is an entry in `zone.productIds` whose id is a sentinel string:

```
"gap-" + Date.now() + "-" + Math.floor(Math.random() * 1e6)
```

(unique per [[id-collisions-and-setstate-in-updater]] — `Date.now()` alone collides).

Its width is stored in the existing per-item map:

```js
boxConfig[gapId] = { cols: N }   // N = จำนวนแถว, each แถว = 10 cm; width = N * 0.10 m
```

Absent/empty `boxConfig[gapId]` → treated as 1 แถว (10 cm).

### Pure helpers (new, in `src/lib/warehouse3d/boxPlan.js`)

```js
// A gap/spacer entry in zone.productIds (reserved empty space, not a product).
export function isGapId(id) {
  return typeof id === "string" && id.startsWith("gap-");
}

// Gap width in metres from its boxConfig entry. Each แถว (cols) = 10 cm; min 1.
export function gapWidthM(cfg) {
  const cols = Math.max(1, Math.floor((cfg && cfg.cols) || 1));
  return cols * 0.10;
}
```

Single source of truth for the prefix + width; imported by both `scene.js` and
`Zones.jsx`.

## Editor changes (`src/components/Zones.jsx`)

- **Add control:** a "+ ช่องว่าง" button beside the add ProductPicker. Handler
  `addGap()` appends a gap:

```js
  const addGap = () => setEditing((z) => {
    const gid = "gap-" + Date.now() + "-" + Math.floor(Math.random() * 1e6);
    return { ...z, productIds: [...z.productIds, gid], boxConfig: { ...(z.boxConfig || {}), [gid]: { cols: 1 } } };
  });
```

- **Row rendering branches on `isGapId(id)`:**
  - **Gap row:** `‹ ›` · `#n` · label "ช่องว่าง" · a แถว number input bound to
    `setBoxCfg(id, "cols", …)` · a width readout "= {(cfg.cols||1) * 10} ซม." · the
    `×` remove button. No ชั้น / orient / replace controls.
  - **Product row:** unchanged (name button, แถว, ชั้น, orient, ×).
- **Header count:** "สินค้าที่ควรอยู่ในโซนนี้ (N)" counts only real products:
  `editing.productIds.filter((id) => !isGapId(id)).length`.
- `moveProduct`, `removeProduct` (deletes `boxConfig[gapId]` too), and `setBoxCfg`
  work on gaps unchanged. `replaceProduct` is never reachable for gaps (no name
  button rendered).

## 3D rendering (`src/lib/warehouse3d/scene.js`)

Import `isGapId`, `gapWidthM` from `boxPlan.js`. At the top of the
`zone.productIds.forEach((pid) => { … })` loop, before `const p = productById[pid]`:

```js
      if (isGapId(pid)) {
        const gcfg = zone.boxConfig && zone.boxConfig[pid] ? zone.boxConfig[pid] : null;
        const gw = gapWidthM(gcfg);
        if (curX + gw > innerXMax) { curX = ox + MARGIN; curZ += bandDepth + GAP; bandDepth = 0; }
        const gd = Math.min(innerL, 0.6);                 // nominal depth of the floor marker
        const gx = curX, gz = curZ;
        // faint translucent floor patch + outline marking reserved space
        const gm = new THREE.Mesh(new THREE.PlaneGeometry(gw, gd),
          new THREE.MeshBasicMaterial({ color: "#9aa3af", transparent: true, opacity: 0.14, depthWrite: false }));
        gm.rotation.x = -Math.PI / 2;
        gm.position.set(gx + gw / 2, 0.03, gz + gd / 2);
        gm.userData.zonePart = true; group.add(gm); st.meshes.push(gm);
        const go = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(gw, gd)),
          new THREE.LineBasicMaterial({ color: "#9aa3af", transparent: true, opacity: 0.5 }));
        go.rotation.x = -Math.PI / 2; go.position.copy(gm.position);
        go.userData.zonePart = true; group.add(go); st.meshes.push(go);
        curX += gw;                                        // gap reserves exactly its width
        bandDepth = Math.max(bandDepth, gd);
        return;
      }
```

- The gap advances `curX` by exactly `gw` (no extra `GAP*4`), so its reserved width
  is the 10 cm × N the user set.
- It is **not** added to `pickables`, `st.productMeta`, `UNITS`, or `OBSTACLES`, so
  it cannot be dragged/selected and is skipped by `mpCopy` drag-save.
- `userData.zonePart = true` makes the marker dim/hide with the rest of the zone.
- It adds no volume (`st.volProducts` untouched), so fill% is unaffected; if a gap
  pushes products past the zone edge the existing overflow check still fires.

### Popup (`scene.js` zone list)

- The product list map already does `if (!p) return ""`, so gaps render nothing.
- Change the header count to exclude gaps:

```js
    const realCount = zone.productIds.filter((pid) => !isGapId(pid)).length;
```

and use `realCount` in `<div class="zp-head">สินค้า ${realCount} รายการ · …`.
`totalUnits` already contributes 0 for gaps (`productById[gapId]` is undefined).

## Backward compatibility

- Existing zones have no gap entries; behaviour is unchanged.
- A gap id never matches a real product, so `productById[gapId]` is always
  undefined and every product code path keeps working.

## Edge cases

- Empty/cleared `boxConfig[gapId]` → width defaults to 10 cm (1 แถว).
- Consecutive gaps, or a gap first/last in the order → each just advances the
  cursor by its width.
- Manual (dragged) layout: products with a `layout[pid]` entry use absolute
  positions and ignore `curX`; gaps still draw their marker at the cursor. Gaps are
  intended for auto-arranged zones; this corner is acceptable, not special-cased.

## Testing

- **Unit (`boxPlan`)**: `isGapId` — true for `"gap-…"`, false for numbers/other
  strings; `gapWidthM` — `{cols:3}` → 0.30, missing/`{}` → 0.10, `{cols:0}` → 0.10.
- **Smoke (`Zones`)**: clicking "+ ช่องว่าง" adds a row labelled "ช่องว่าง" with a
  แถว input and a "ซม." readout and no ชั้น/orient/replace controls; setting แถว to 3
  shows "30 ซม."; the "สินค้าที่ควรอยู่ในโซนนี้ (N)" count excludes the gap; removing
  the gap row restores the count.

## Out of scope

- Dragging gaps in 3D (they are auto-positioned spacers).
- Vertical/height gaps or depth gaps (this is a width-along-the-wall spacer only).
- Per-slice width other than 10 cm (fixed unit).
