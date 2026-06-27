# 3D zone — auto-anchor products to the wall away from the aisle

Date: 2026-06-27
Status: approved (design)

## Goal

Auto-arrange each zone's products against the warehouse wall **opposite its aisle**
(way), so aisles stay clear and order reads naturally when approached from the way.
"Walls" include the warehouse perimeter **and internal back-to-back seams** (e.g. the
z=15 spine between the two middle bands). Detected automatically from zone geometry —
no per-zone setup, no hard-coded coordinates.

Builds on the arrangement-rotation work
([[2026-06-27-warehouse-3d-zone-arrange-rotation-design]]): the auto-anchor is
expressed as an automatic 0°/180° flip composed with the manual `arrangeRot`.

## Background

`scene.js` lays products from a zone's near corner (`origin`) outward. Today:
- Top band (z=0-8): near edge z=0 is the perimeter wall → products anchor at the wall
  (correct, unchanged).
- Bottom band (z=22-30): near edge z=22 faces the aisle, so products pile on the
  aisle side instead of the z=30 wall (wrong).
- Middle bands (z=11-15 and z=15-19) meet back-to-back at z=15; products should anchor
  to that shared spine, aisle on the outer side.

A 180° rotation of the arrangement flips both the depth anchor (near↔far) and the
left-right order — which is exactly what's wanted when a zone is approached from the
opposite (aisle) side. So the fix is: auto-apply 180° to zones whose **far** Z edge is
a wall and whose **near** edge is not.

## Pure helpers (new, in `src/lib/warehouse3d/boxPlan.js`)

```js
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

// Auto arrangement rotation (0 or 180°): flip 180 when the FAR Z edge sits on a wall
// line but the NEAR edge does not, so products anchor to the wall away from the aisle.
export function autoWallRot(zone, wallLinesZ) {
  const EPS = 0.01;
  const onLine = (z) => wallLinesZ.some((w) => Math.abs(w - z) < EPS);
  const near = zone.origin.z, far = zone.origin.z + zone.size.l;
  return (onLine(far) && !onLine(near)) ? 180 : 0;
}
```

## Scene change (`src/lib/warehouse3d/scene.js`)

1. Import `zoneWallLinesZ, autoWallRot` from `boxPlan.js`.
2. Compute the wall lines once, just before the main per-zone build loop
   (`ZONES.forEach((zone) => { … }`):

```js
const wallLinesZ = zoneWallLinesZ(ZONES, WAREHOUSE);
```

3. In the per-zone cursor init, change the effective rotation to compose the manual
   `arrangeRot` with the auto flip:

```js
const R = normArrangeRot((zone.arrangeRot || 0) + autoWallRot(zone, wallLinesZ));
```

Everything downstream (canvas swap, `arrangePoint`, `arrangeRotY`, `toWorld`) is
unchanged — it already consumes `R`.

## Resulting behaviour (seed layout)

| Band | zones | near/far | flip | anchor |
|------|-------|----------|------|--------|
| top | E D C B A (0-8) | near 0 = perimeter | 0 | z=0 wall (unchanged) |
| upper-mid | e d c b a (11-15) | far 15 = seam | 180 | z=15 spine, order ขวา→ซ้าย |
| lower-mid | i h g f (15-19) | near 15 = seam | 0 | z=15 spine, order ซ้าย→ขวา |
| bottom | F G H I (22-30) | far 30 = perimeter | 180 | z=30 wall, order ขวา→ซ้าย |

## Composition with manual `arrangeRot`

Effective rotation `R = (manual arrangeRot + autoWallRot) mod 360`. For a far-wall
zone (auto 180): manual 0 → 180 (anchored, the default); manual 180 → 0 (cancels the
auto flip). Zones with auto 0 behave exactly as the manual button says.

The editor "หมุนเรียง" button keeps showing the **manual** value only (Zones.jsx has
no warehouse geometry); the auto flip is applied in the scene. A far-wall zone can
therefore read "หมุนเรียง 0°" while rendering flipped — acceptable (auto is a smart
default).

## Backward compatibility

- Top-band and middle (non-seam) zones: `autoWallRot` returns 0 → identical to today.
- `arrangeRot`, flow-axis, gaps, orientation: unchanged; only the effective `R` gains
  the auto term.
- No data-model or persistence change (auto is derived from geometry each build); no
  `rebuildKey` change (geometry + `arrangeRot` are already in it).

## Edge cases

- A zone touching **both** a near and far wall line (e.g. full-depth) → not flipped
  (`near onLine` is true) → anchors near. Safe default.
- Back-to-back detection requires X overlap, so a coincidental far==near at unrelated
  X positions does not create a false wall line.
- `EPS = 0.01` m absorbs float noise in snapped coordinates.

## Testing

- **Unit (`boxPlan`)** with `warehouse = { lengthM: 30 }` and four stacked zones
  (z 0-8, 11-15, 15-19, 22-30, all x 0-6):
  - `zoneWallLinesZ` includes 0, 30, and 15 (the 11-15 / 15-19 seam); excludes 8, 11,
    19, 22.
  - X-overlap guard: zones with far==near at non-overlapping X do **not** add a line.
  - `autoWallRot` with lines `[0, 15, 30]`: top (0-8) → 0; upper-mid (11-15) → 180;
    lower-mid (15-19) → 0; bottom (22-30) → 180.
- **Manual (after build):** in 3D, F/G/H/I store against the z=30 wall (order ขวา→ซ้าย
  from the aisle); e/d/c/b/a and i/h/g/f store back-to-back against the z=15 spine;
  E/D/C/B/A unchanged.

## Out of scope

- Anchoring along the X axis (left/right walls) — handled by manual `arrangeRot`.
- Modelling aisles/ways as explicit data.
- Showing the effective (auto-composed) rotation in the editor button.
