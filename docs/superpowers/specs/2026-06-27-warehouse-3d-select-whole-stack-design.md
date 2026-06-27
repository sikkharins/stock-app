# 3D arrange mode — select the whole stack (กอง)

Date: 2026-06-27
Status: approved (design)

## Goal

In the 3D arrange mode (✋ โหมดจัดเรียง), let the user grab a product's **whole stack**
(all its boxes / the product group) with one click — to move, rotate, and reset the
entire SKU at once — instead of only dragging a single box. A toggle keeps the
existing per-box drag available. Default = whole stack.

## Background

`scene.js` move mode (`moveMode`) handles `pointerdown` over `pickables`
(per-product `InstancedMesh`es + pile meshes):

- Hit an `InstancedMesh` box → `dragUnit = obj.userData.units[instanceId]`,
  `selKind = "unit"` → drags one box.
- Hit a pile (non-instanced) → `dragging = ud.pg`, `selKind = "block"` → drags the
  whole group.

So a "block" (whole-group) path already exists (for piles) and supports drag +
rotate (`rotateSel` requires `selKind === "block"`) + reset (`pg.userData.home`, set
by `captureHome()` on entering move mode). Whole-group selection for normal
(instanced) products just needs to route into that block path. `inst.userData`
already carries `pg`, `product`, `zoneId`, `pid`, so `selInfo(ud)` works for it.

## Behaviour

- New state `selectWhole` (default `true`), toggled by a button in the move panel:
  `เลือก: ทั้งกอง` ⇄ `เลือก: ทีละกล่อง`.
- `pointerdown` decides unit vs block via a pure helper:
  - **ทั้งกอง** (`selectWhole` true): any product (instanced or pile) → `block`
    (drag the whole `pg`).
  - **ทีละกล่อง** (`selectWhole` false): instanced box → `unit` (current behaviour);
    pile → `block` (piles have no units).
- In block mode the existing rotate ±15° / คืนตำแหน่งเดิม / บันทึกการจัดเรียง all
  operate on the whole group (so instanced products become rotatable too).

## Pure helper (new, in `src/lib/warehouse3d/boxPlan.js`)

```js
// Decide whether a move-mode click grabs one box ("unit") or the whole group ("block").
// Only an instanced product with a real instanceId + per-unit data can be a unit, and
// only when the user is NOT in whole-stack mode.
export function pickDragKind(isInstanced, instanceId, hasUnits, selectWhole) {
  if (isInstanced && instanceId != null && hasUnits && !selectWhole) return "unit";
  return "block";
}
```

## Scene changes (`src/lib/warehouse3d/scene.js`)

1. Import `pickDragKind` from `boxPlan.js`.
2. Add `selectWhole` to the move-mode state (default `true`):

```js
let moveMode = false, dragging = null, selectedUD = null, dragUnit = null, selUnit = null, selKind = null, selectWhole = true;
```

3. Move panel HTML — add a toggle button above the rotate row (after `mpSel`):

```html
      <div class="mp-rot"><button class="tbtn" id="mpSelMode">เลือก: ทั้งกอง</button></div>
```

4. Update the panel hint to mention the modes (replace the `mp-hint` text):

```html
      <div class="mp-hint">เลือก <b>ทั้งกอง</b> เพื่อลาก/หมุนสินค้าทั้งชนิด หรือ <b>ทีละกล่อง</b> เพื่อขยับกล่องเดี่ยว · คลิกขวาค้าง = หมุนกล้อง · ล้อ = ซูม</div>
```

5. Replace the `pointerdown` unit/block branch (current `if (obj.isInstancedMesh && h0.instanceId != null && obj.userData.units) { … } else { … }`) with a `pickDragKind`-driven version:

```js
    const h0 = hits[0], obj = h0.object;
    const kind = pickDragKind(obj.isInstancedMesh, h0.instanceId, !!obj.userData.units, selectWhole);
    if (kind === "unit") {
      dragUnit = obj.userData.units[h0.instanceId];
      dragging = null; selUnit = dragUnit; selKind = "unit"; selectedUD = obj.userData;
      const fp = floorAt(e); if (fp) dragOff.set(fp.x - dragUnit.x, 0, fp.z - dragUnit.z);
      showMarker(dragUnit, true); unitInfo(dragUnit, true);
    } else {
      const ud = obj.userData; dragging = ud.pg; dragUnit = null; selUnit = null; selKind = "block"; selectedUD = ud;
      const fp = floorAt(e); if (fp) dragOff.set(fp.x - ud.pg.position.x, 0, fp.z - ud.pg.position.z);
      selMarker.visible = false; selInfo(ud);
    }
```

6. Wire the toggle (inside the existing `if (canEdit) { … }` block, next to the
   `mpRotL`/`mpRotR` handlers):

```js
    const mpSelMode = gid("mpSelMode");
    mpSelMode.addEventListener("click", () => {
      selectWhole = !selectWhole;
      mpSelMode.textContent = selectWhole ? "เลือก: ทั้งกอง" : "เลือก: ทีละกล่อง";
    });
```

## Backward compatibility

- Toggling to **ทีละกล่อง** reproduces today's per-box behaviour exactly
  (`pickDragKind` returns `"unit"` for instanced boxes when `selectWhole` is false).
- Piles are unchanged (always `block`).
- Whole-group drags persist through the existing `mpCopy` save (reads `pg.position`
  relative to the zone) and reload (manual layout branch) — no save/merge changes.

## Edge cases

- `instanceId === 0` is a valid box (`instanceId != null` is true), so the first box
  is draggable in ทีละกล่อง mode.
- An instanced mesh without `userData.units` falls back to `block`.
- Dragging a whole group moves its child boxes/edges/shadow together (they are
  children of `pg`); UNITS/OBSTACLES world positions used only by unit-drag may be
  stale after a group move but are recomputed on the next rebuild — acceptable.

## Testing

- **Unit (`boxPlan`)** `pickDragKind`: instanced+unitId+hasUnits+!selectWhole →
  `"unit"`; same but selectWhole → `"block"`; non-instanced (pile) → `"block"` for
  both selectWhole values; instanced with `instanceId == null` or no units → `"block"`.
- **Manual (after build):** arrange mode default shows "เลือก: ทั้งกอง"; clicking a
  product grabs and drags the whole SKU; toggling to "ทีละกล่อง" restores single-box
  drag; rotate ±15° works on a whole instanced group.

## Out of scope

- A glow/outline highlight for the selected whole group (info panel + drag suffices).
- Multi-select across SKUs.
- Per-box behaviour changes (snap-to-grid etc. unchanged).
