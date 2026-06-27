# 3D zone layout — flow products along the zone's longer side

Date: 2026-06-27
Status: approved (design)

## Goal

Auto-arrange products (and gap spacers) along the **longer horizontal side** of each
zone, instead of always along the X (width) axis. Tall-but-narrow zones (e.g. E, I,
office where depth `l` > width `w`) then form long rows down their long wall — the
same way wide zones A/B/C/D already do — rather than piling toward the back.

Extends the arrangement features ([[2026-06-26-warehouse-3d-zone-box-arrangement-design]]
and the gap-spacer design).

## Background

In `scene.js`, each zone's auto-placement walks a cursor that **always advances along
X** (`curX`), wrapping into a new Z band when it passes `innerXMax`:

```js
let curX = ox + MARGIN, curZ = oz + MARGIN, bandDepth = 0;
const innerXMax = ox + w - MARGIN;
// products: if (curX + fw > innerXMax) { wrap }; curX += fw + GAP*4; bandDepth = max(bandDepth, fl)
// gaps:     if (curX + gw > innerXMax) { wrap }; curX += gw;        bandDepth = max(bandDepth, gd)
```

For a wide zone (A/B/C/D, w 12 > l 8) the long axis is X, so rows look good. For E
(w 6 < l 8) the cursor exhausts the 6 m width fast and wraps deep into Z, so products
appear to "lean on the back wall". The fix: flow along whichever side is longer.

## Approach

Introduce `flowZ = l > w` per zone. When `flowZ` is true, the cursor advances along Z
(wrapping into X bands) instead of along X. The product's internal box grid
(cols/rows/orient) is **unchanged** — only the sequence direction (which wall the
items line up along) changes. The dragged-`manual` layout path is unchanged.

### Pure helper (new, in `src/lib/warehouse3d/boxPlan.js`)

The cursor-stepping math becomes a pure, unit-testable function. Both products and
gaps use it.

```js
// Place one item along the flow axis inside a zone, wrapping into bands.
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
```

### Scene integration (`src/lib/warehouse3d/scene.js`)

1. Import `placeInBand` from `boxPlan.js`.
2. At cursor init add:

```js
const flowZ = l > w;
const innerZMax = oz + l - MARGIN;
const bounds = { ox, oz, innerXMax, innerZMax, margin: MARGIN, gap: GAP };
```

3. **Gap branch** — compute the marker's X/Z extents from `flowZ`, step via
   `placeInBand`, and size the floor plane to match:

```js
const gd = Math.min(flowZ ? innerW : innerL, 0.6); // marker thickness across the flow
const fw = flowZ ? gd : gw;                          // X extent
const fl = flowZ ? gw : gd;                          // Z extent
const step = placeInBand({ curX, curZ, bandDepth }, { fw, fl, advance: 0 }, bounds, flowZ);
curX = step.curX; curZ = step.curZ; bandDepth = step.bandDepth;
// PlaneGeometry(fw, fl) at (step.bx + fw/2, 0.03, step.bz + fl/2); outline likewise
```

4. **Product auto-placement** (the `else` of `if (manual)`) — replace the inline X
   math with:

```js
const step = placeInBand({ curX, curZ, bandDepth }, { fw, fl, advance: GAP * 4 }, bounds, flowZ);
bx = step.bx; bz = step.bz;
curX = step.curX; curZ = step.curZ; bandDepth = step.bandDepth;
```

`fw`/`fl` are the already-computed footprint extents (`footW`/`footL`, or the pile
`side`). No other scene logic changes.

## Affected zones

With the current seed geometry, `l > w` holds for **E (6×8), I (6×8), office
(12×15)**. A/B/C/D and all `w ≥ l` zones keep flowing along X (unchanged). Square
zones (`w === l`) keep X-flow (`flowZ` false). This matches "เรียงตามโซน A B C D":
every zone now flows along its long side, exactly as A/B/C/D already did.

## Backward compatibility

- Wide and square zones are unchanged (`flowZ` false → identical to current code path).
- `manual` (dragged) layouts are untouched — they use absolute saved positions.
- `boxConfig` (แถว/ชั้น/orient) and gap widths are unchanged; only the sequence
  direction differs for tall zones.

## Edge cases

- A single product/gap: placed at the origin corner regardless of `flowZ`.
- Items wider/deeper than the zone still overflow (existing overflow check at the end
  of the loop is unchanged and still fires).
- `flowZ` only affects auto-placement; a zone fully dragged into a `manual` layout
  ignores it.

## Testing

- **Unit (`placeInBand`)** in `boxPlan.test.ts`:
  - non-flow, no wrap: 2 items advance along X, share the Z row.
  - non-flow, wrap: an item past `innerXMax` resets X and advances Z by the band.
  - flow (Z), no wrap: 2 items advance along Z, share the X band.
  - flow (Z), wrap: an item past `innerZMax` resets Z and advances X by the band.
  - `advance` (inter-item spacing) is added after the item on the flow axis only.
- **Manual (after build):** in the 3D tab, zone E's products form a long row down the
  X=0 side wall; A/B/C/D look unchanged. (Scene wiring itself is not unit-tested —
  WebGL.)

## Out of scope

- A per-zone manual override of the flow axis (automatic by `l > w` only).
- Rotating each product's internal box grid (orientation is the existing
  `boxConfig.orient`, unchanged).
- Re-flowing zones that have a saved `manual` drag layout.
