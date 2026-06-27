# 3D zone — per-zone arrangement rotation (0/90/180/270°)

Date: 2026-06-27
Status: approved (design)

## Goal

Let the user rotate a zone's whole product arrangement (sequence flow + box
orientation together) by 0/90/180/270° clockwise, per zone, so items can be
oriented to be picked from the aisle (way). Set once per zone, persisted, adjustable
from the zone editor. First use: zone E set to 90° so its products face the aisle at
its z=8 edge.

Builds on the flow-axis work ([[2026-06-27-warehouse-3d-zone-flow-axis-design]]):
`flowZ` still auto-picks the longer side **within the (possibly rotated) canvas**.

## Background

`scene.js` lays each zone's items along a cursor in world coordinates via
`placeInBand`, then positions each product group `pg` at `(bx,bz)` with the box grid
extending +X/+Z. To rotate the whole arrangement we lay out in a **local canvas
frame** and map every item's corner to world through a rotation, setting
`pg.rotation.y` so the boxes turn too. The zone footprint is rectangular, so for
90/270 the canvas dimensions are swapped (depth becomes the layout width) and the
result still fits.

Two wiring gaps must also be fixed for the control to take effect:
- `warehouse3d.js` merge must pass `zone.arrangeRot` through to the scene (like
  `boxConfig`).
- `Warehouse3D.jsx` `rebuildKey` currently omits `boxConfig`, so per-value edits
  (แถว/ชั้น/orient/gap width) don't rebuild the scene. Add both `boxConfig` and
  `arrangeRot` so saving a rotation (or any boxConfig value) refreshes the 3D.

## Data model

Per-zone, stored on the app zone (`sh.zones`, persisted with zones):

```js
zone.arrangeRot = 0 | 90 | 180 | 270   // degrees clockwise (top-down). absent = 0
```

## Pure helpers (new, in `src/lib/warehouse3d/boxPlan.js`)

Top-down coordinates: X right, Z "down/into". Clockwise viewed from above. The
layout canvas has inner dims `(cw, cl)`; for 90/270 they are the zone's swapped inner
dims so the rotated result fits `innerW × innerL`.

```js
// Normalize any value to one of 0/90/180/270.
export function normArrangeRot(v) {
  const r = ((Math.round((Number(v) || 0) / 90) * 90) % 360 + 360) % 360;
  return r; // 0, 90, 180, or 270
}

// three.js Y-rotation (radians) that turns a +X/+Z box grid to match an R° CW arrangement.
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
```

`arrangePoint` is affine with linear part `arrangeRotY`, so a product group placed at
`pg.position = origin + arrangePoint(R, lx, lz)` with `pg.rotation.y = arrangeRotY(R)`
fills exactly the rotated footprint rectangle (its +X/+Z box grid rotates into place).

## Scene integration (`src/lib/warehouse3d/scene.js`)

Import `normArrangeRot, arrangeRotY, arrangePoint`. At the per-zone cursor init,
replace the world-frame cursor/bounds with a **local canvas** frame:

```js
const R = normArrangeRot(zone.arrangeRot);
const swap = R === 90 || R === 270;
const cw = swap ? innerL : innerW;            // canvas layout width
const cl = swap ? innerW : innerL;            // canvas layout depth
const flowZ = cl > cw;                         // flow along the longer canvas side
let curX = 0, curZ = 0, bandDepth = 0;         // LOCAL canvas coords
const bounds = { ox: 0, oz: 0, innerXMax: cw, innerZMax: cl, margin: 0, gap: GAP };
const rotY = arrangeRotY(R);
const toWorld = (px, pz) => { const p = arrangePoint(R, px, pz, innerW, innerL); return { x: ox + MARGIN + p.x, z: oz + MARGIN + p.z }; };
```

(`innerW`/`innerL` keep their current definitions; `innerXMax`/`innerZMax` world
constants are removed — `bounds` now uses the local `cw`/`cl`.)

**Gap branch** — lay out in canvas, map the marker center to world, swap plane dims
for 90/270:

```js
const gw = gapWidthM(gcfg);
const gd = Math.min(flowZ ? cw : cl, 0.6);
const fw = flowZ ? gd : gw;          // canvas-X extent
const fl = flowZ ? gw : gd;          // canvas-Z extent
const step = placeInBand({ curX, curZ, bandDepth }, { fw, fl, advance: 0 }, bounds, flowZ);
curX = step.curX; curZ = step.curZ; bandDepth = step.bandDepth;
const c = toWorld(step.bx + fw / 2, step.bz + fl / 2); // marker center in world
const mw = swap ? fl : fw, ml = swap ? fw : fl;        // world plane dims
const gm = new THREE.Mesh(new THREE.PlaneGeometry(mw, ml),
  new THREE.MeshBasicMaterial({ color: "#9aa3af", transparent: true, opacity: 0.14, depthWrite: false }));
gm.rotation.x = -Math.PI / 2; gm.position.set(c.x, 0.03, c.z);
gm.userData.zonePart = true; group.add(gm); st.meshes.push(gm);
const go = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(mw, ml)),
  new THREE.LineBasicMaterial({ color: "#9aa3af", transparent: true, opacity: 0.5 }));
go.rotation.x = -Math.PI / 2; go.position.copy(gm.position);
go.userData.zonePart = true; group.add(go); st.meshes.push(go);
return;
```

**Product placement** — the `manual` branch is unchanged (absolute world + manual
rot). The auto `else` becomes:

```js
} else {
  const step = placeInBand({ curX, curZ, bandDepth }, { fw, fl, advance: GAP * 4 }, bounds, flowZ);
  curX = step.curX; curZ = step.curZ; bandDepth = step.bandDepth;
  const wp = toWorld(step.bx, step.bz);
  bx = wp.x; bz = wp.z; rotRad = rotY;
}
```

Refactor the shared tail so the group uses radians directly: declare `let bx, bz,
rotRad = 0;`, set `rotRad = -(manual.rot ?? 0) * Math.PI / 180` in the `manual`
branch, and replace `pg.rotation.y = -rotDeg * Math.PI / 180;` with
`pg.rotation.y = rotRad;`.

Because `pg` stays a direct child of the zone `group` with **world** position +
`pg.rotation.y`, the existing `localToWorld` UNITS/anchor math, OBSTACLES, and
`mpCopy` drag-save (which read `pg.position` relative to the zone origin) keep working
unchanged.

## Merge + rebuild wiring

`src/utils/warehouse3d.js` (after the `boxConfig` passthrough):

```js
if (z.arrangeRot) out.arrangeRot = z.arrangeRot;
```

`src/components/Warehouse3D.jsx` `rebuildKey` — include `boxConfig` and `arrangeRot`
so value edits refresh the scene:

```js
z: (zones || []).map((z) => [z.id, z.name, z.note, z.productIds, z.boxConfig, z.arrangeRot]),
```

## Editor (`src/components/Zones.jsx`)

A per-zone (not per-row) control beside the products header: a button
`หมุนเรียง: {R}°` that cycles 0 → 90 → 180 → 270 → 0.

```js
const cycleArrangeRot = () => setEditing((z) => ({ ...z, arrangeRot: normArrangeRot((z.arrangeRot || 0) + 90) }));
```

Rendered next to the "สินค้าที่ควรอยู่ในโซนนี้ (N)" header:

```jsx
<button onClick={cycleArrangeRot} title="หมุนการจัดเรียงทั้งโซน (ตามเข็ม)" style={orientBtn}>หมุนเรียง {normArrangeRot(editing.arrangeRot || 0)}°</button>
```

Import `normArrangeRot` from `boxPlan.js` (alongside the existing `isGapId` import).

## Backward compatibility

- `arrangeRot` absent / 0 → canvas dims = `(innerW, innerL)`, `arrangePoint` is the
  identity, `rotY = 0` → byte-equivalent to the current flow-axis behaviour.
- Manual (dragged) layouts are unchanged.
- Adding `boxConfig`/`arrangeRot` to `rebuildKey` only makes the scene rebuild when
  those change (previously it silently didn't for boxConfig values).

## Edge cases

- `normArrangeRot` coerces any stored/garbage value to 0/90/180/270.
- 90/270 swap the canvas so the arrangement always fits the zone footprint.
- A zone with a saved `manual` layout ignores `arrangeRot` for those items (manual
  positions win), same as today.

## Testing

- **Unit (`boxPlan`)**:
  - `normArrangeRot`: 0/90/180/270 pass through; 360→0; 450→90; -90→270;
    undefined→0.
  - `arrangeRotY`: 0→0, 90→−π/2, 180→π, 270→π/2.
  - `arrangePoint` (innerW 6, innerL 8): R0 (2,3)→(2,3); R90 (2,3)→(3,2) and
    corner (0,0)→(6,0); R180 (2,3)→(4,5); R270 (2,3)→(3,6) and (0,0)→(0,8).
- **Unit (`warehouse3d`)**: a zone with `arrangeRot: 90` carries it onto the scene
  zone; a zone without it leaves `arrangeRot` undefined.
- **Smoke (`Zones`)**: the "หมุนเรียง 0°" button cycles to 90° then 180° on clicks.
- **Manual (after build):** zone E → set หมุนเรียง to 90° → in 3D its products rotate
  to face the aisle; A/B/C/D (left at 0°) unchanged.

## Out of scope

- Free-angle rotation (only 0/90/180/270).
- Auto-deriving rotation from aisle geometry (aisles are not in the data model).
- Re-flowing zones that have a saved `manual` drag layout.
