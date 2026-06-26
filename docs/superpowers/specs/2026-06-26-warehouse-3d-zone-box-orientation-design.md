# Zone box orientation — long/wide side parallel to the wall

Date: 2026-06-26
Status: approved (design)

## Goal

Per product in a zone, let the user choose which side of the carton runs
**parallel to the wall** — its ยาว (length) side or its กว้าง (width) side — so the
3D warehouse orients boxes the way they are actually placed. Default is
**ยาวขนานกำแพง** (long side along the wall).

Extends [[2026-06-26-warehouse-3d-zone-box-arrangement-design]] (order / แถว / ชั้น).

## Background

`boxDims(p)` (`scene.js:398`) returns `{ w: widthCm/100, l: lengthCm/100, h:
heightCm/100 }` — `w` = กว้าง, `l` = ยาว. Today `planBoxes` and the scene always
place `box.w` along X (the wall) and `box.l` along Z (depth), i.e. **กว้างขนานกำแพง**.
The new default flips this to **ยาวขนานกำแพง**.

## Data model

Extend the per-product `boxConfig` entry with an optional `orient`:

```js
zone.boxConfig[pid] = { cols?, layers?, orient? }
// orient: "wide" (กว้างขนานกำแพง) | "long" (ยาวขนานกำแพง)
// absent  -> "long" (default)
```

- Store `orient` only when it is `"wide"` (the non-default). Toggling back to
  `"long"` removes the `orient` key; if the entry becomes empty it is removed
  entirely — same leanness rule as `cols`/`layers`.
- Persisted with `zones` and merged into the scene by the existing
  `if (z.boxConfig) out.boxConfig = z.boxConfig` (`warehouse3d.js`). No merge change.

## Changes

### 1. `src/lib/warehouse3d/boxPlan.js` — pure `orientBoxDims`

Add an exported, pure helper (so the swap is unit-testable; `scene.js` is not):

```js
// Orient a box footprint relative to the wall (X = along the wall, Z = depth).
//   "long"  (default): ยาว (l) runs along the wall  -> swap w/l
//   "wide"           : กว้าง (w) runs along the wall -> unchanged
export function orientBoxDims(d, orient) {
  if (orient === "wide") return { w: d.w, l: d.l, h: d.h };
  return { w: d.l, l: d.w, h: d.h };
}
```

`planBoxes` is unchanged: it keeps using `box.w` (along wall) / `box.l` (depth);
the caller feeds it already-oriented dims.

### 2. `src/lib/warehouse3d/scene.js` — apply orientation before planning

The `cfg` lookup currently sits at ~line 472 (added by the arrangement feature),
*after* `const d = boxDims(p);` at ~line 468. To orient `d` we must compute `cfg`
first. Replace `const d = boxDims(p);` (line 468) with:

```js
      const cfg = zone.boxConfig && zone.boxConfig[pid] ? zone.boxConfig[pid] : null;
      const d = orientBoxDims(boxDims(p), cfg && cfg.orient ? cfg.orient : "long");
```

…and **remove** the now-duplicate `const cfg = zone.boxConfig && zone.boxConfig[pid]
? zone.boxConfig[pid] : null;` line further down (it would otherwise be a `const`
redeclaration). The `manualCols`/`manualLayers` lines keep using `cfg` unchanged.

Add `orientBoxDims` to the existing `boxPlan.js` import. `d` is already used for
`planBoxes`, `BoxGeometry`, pitch, and placement, so orientation propagates with
no other change.

`volumeOf(p)` and the popup size text use raw product cm and are unaffected.
`noLayDown` is unaffected — only horizontal `w`/`l` swap, never the height axis.

### 3. `src/components/Zones.jsx` — per-row orientation toggle

In each product row (after the ชั้น input, before the `×` button) add a compact
toggle button showing the side currently parallel to the wall:

- Label: `"ยาว"` when orient is `"long"`/absent, `"กว้าง"` when `"wide"`.
- `title="ด้านที่ขนานกำแพง"`.
- Click toggles orient via a new `toggleOrient(id)` helper:

```js
  const toggleOrient = (id) => setEditing((z) => {
    const cur = { ...(z.boxConfig || {}) };
    const entry = { ...(cur[String(id)] || {}) };
    if (entry.orient === "wide") delete entry.orient; // back to default "long"
    else entry.orient = "wide";
    if (Object.keys(entry).length) cur[String(id)] = entry;
    else delete cur[String(id)];
    return { ...z, boxConfig: cur };
  });
```

Read for display: `const orient = cfg.orient === "wide" ? "wide" : "long";`

## Backward compatibility

- Products with no `boxConfig` / no `orient` render with the new default
  (ยาวขนานกำแพง). Dimensioned products in existing zones rotate footprint 90°;
  sizeClass-cube products (`w === l`) are visually unchanged. This default flip
  is intended.
- `cols`/`layers` behaviour from the prior spec is untouched; orientation only
  changes which box dimension is the along-wall pitch.

## Edge cases

- Cube footprint (`w === l`): swap is a no-op.
- `usePile` products (stock > REP_THRESHOLD): pile is a square footprint, so
  orientation has no visible effect; harmless.

## Testing

- **Unit (`boxPlan`)**: `orientBoxDims` — `"long"` swaps `w`/`l`, `"wide"` keeps,
  `undefined` defaults to `"long"`, `h` always preserved.
- **Smoke (`Zones`)**: each product row shows an orientation toggle defaulting to
  "ยาว"; clicking it shows "กว้าง" and writes `boxConfig[pid].orient === "wide"`;
  clicking again returns to "ยาว" and clears the key.

## Out of scope

- Choosing which side faces "up" (covered by `noLayDown`, unchanged).
- Free per-box rotation in 3D (existing drag `rot`, unchanged).
- A zone-wide or global orientation control (per-product only).
