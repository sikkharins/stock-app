# Select whole stack (กอง) in arrange mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In 3D arrange mode add a "เลือก: ทั้งกอง / ทีละกล่อง" toggle (default ทั้งกอง) so a click grabs the whole product group (move/rotate/reset/save) instead of a single box.

**Architecture:** A pure `pickDragKind(...)` decides unit vs block. `scene.js` adds a `selectWhole` state + a move-panel toggle and routes `pointerdown` through the helper; the whole-group case reuses the existing "block" drag path (already used for piles), so save/merge are untouched.

**Tech Stack:** JS, Vitest, three.js (scene not unit-tested).

Spec: `docs/superpowers/specs/2026-06-27-warehouse-3d-select-whole-stack-design.md`

---

## Task 1: Pure `pickDragKind` helper

**Files:**
- Modify: `src/lib/warehouse3d/boxPlan.js` (add export after `arrangePoint`)
- Test: `src/lib/warehouse3d/boxPlan.test.ts` (extend import line 2; add a `describe`)

- [ ] **Step 1: Write the failing tests**

Add `pickDragKind` to the import on line 2 of `src/lib/warehouse3d/boxPlan.test.ts`:

```ts
import { planBoxes, productColor, PRODUCT_PALETTE, REP_THRESHOLD, orientBoxDims, mergeEdgePositions, isGapId, gapWidthM, placeInBand, normArrangeRot, arrangeRotY, arrangePoint, pickDragKind } from "./boxPlan.js";
```

Append this block to the file:

```ts
describe("pickDragKind", () => {
  it("instanced + instanceId + units + ทีละกล่อง -> unit", () => {
    expect(pickDragKind(true, 3, true, false)).toBe("unit");
    expect(pickDragKind(true, 0, true, false)).toBe("unit"); // instanceId 0 ใช้ได้
  });
  it("instanced + ทั้งกอง -> block", () => {
    expect(pickDragKind(true, 3, true, true)).toBe("block");
  });
  it("pile (ไม่ instanced) -> block เสมอ", () => {
    expect(pickDragKind(false, null, false, false)).toBe("block");
    expect(pickDragKind(false, null, false, true)).toBe("block");
  });
  it("instanced แต่ไม่มี instanceId/units -> block", () => {
    expect(pickDragKind(true, null, true, false)).toBe("block");
    expect(pickDragKind(true, 0, false, false)).toBe("block");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/warehouse3d/boxPlan.test.ts`
Expected: FAIL — `pickDragKind is not a function`.

- [ ] **Step 3: Add the helper**

In `src/lib/warehouse3d/boxPlan.js`, insert after the `arrangePoint` function (before
the `// Distinct, readable swatch colours…` comment):

```js
// Decide whether a move-mode click grabs one box ("unit") or the whole group ("block").
// Only an instanced product with a real instanceId + per-unit data can be a unit, and
// only when the user is NOT in whole-stack mode.
export function pickDragKind(isInstanced, instanceId, hasUnits, selectWhole) {
  if (isInstanced && instanceId != null && hasUnits && !selectWhole) return "unit";
  return "block";
}

```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/warehouse3d/boxPlan.test.ts`
Expected: PASS (all prior + 4 new cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/warehouse3d/boxPlan.js src/lib/warehouse3d/boxPlan.test.ts
git commit -m "feat(warehouse3d): pickDragKind helper (whole stack vs single box)"
```

---

## Task 2: Whole-stack toggle + drag in the scene

**Files:**
- Modify: `src/lib/warehouse3d/scene.js` — import (13), move-panel HTML (155-156), move state (918), pointerdown (1029-1039), canEdit handlers (~1181)

No unit test (WebGL). Verification = full suite green + Task 1 coverage + manual 3D.

- [ ] **Step 1: Import `pickDragKind`**

In `src/lib/warehouse3d/scene.js`, add `pickDragKind` to the existing `boxPlan.js`
import:

```js
import { planBoxes, productColor, snapClampZoneRect, clampZoneHeight, orientBoxDims, mergeEdgePositions, isGapId, gapWidthM, placeInBand, normArrangeRot, arrangeRotY, arrangePoint, pickDragKind } from "./boxPlan.js";
```

- [ ] **Step 2: Add `selectWhole` to the move state**

In `src/lib/warehouse3d/scene.js`, change (line 918):

```js
  let moveMode = false, dragging = null, selectedUD = null, dragUnit = null, selUnit = null, selKind = null;
```

to:

```js
  let moveMode = false, dragging = null, selectedUD = null, dragUnit = null, selUnit = null, selKind = null, selectWhole = true;
```

- [ ] **Step 3: Add the toggle button + update the hint in the panel HTML**

In `src/lib/warehouse3d/scene.js`, replace the hint line (155):

```js
      <div class="mp-hint">ลากกล่อง <b>ทีละชิ้น</b> ด้วยคลิกซ้าย — ชิ้นชนิดเดียวกันจะดูดเข้ากริด และวางทับสินค้าคนละชนิดไม่ได้ · คลิกขวาค้าง = หมุนกล้อง · ล้อ = ซูม</div>
```

with:

```js
      <div class="mp-hint">เลือก <b>ทั้งกอง</b> เพื่อลาก/หมุนสินค้าทั้งชนิด หรือ <b>ทีละกล่อง</b> เพื่อขยับกล่องเดี่ยว · คลิกขวาค้าง = หมุนกล้อง · ล้อ = ซูม</div>
```

Then insert a toggle row right after the `mpSel` line (156):

```js
      <div id="mpSel" class="mp-sel">— ยังไม่ได้เลือกสินค้า —</div>
      <div class="mp-rot"><button class="tbtn" id="mpSelMode">เลือก: ทั้งกอง</button></div>
```

- [ ] **Step 4: Route `pointerdown` through `pickDragKind`**

In `src/lib/warehouse3d/scene.js`, replace the unit/block branch (lines 1029-1039):

```js
    const h0 = hits[0], obj = h0.object;
    if (obj.isInstancedMesh && h0.instanceId != null && obj.userData.units) {
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

with:

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

- [ ] **Step 5: Wire the toggle handler**

In `src/lib/warehouse3d/scene.js`, find the rotate-button wiring inside the
`if (canEdit) {` block:

```js
    gid("mpRotL").addEventListener("click", () => rotateSel(-15));
    gid("mpRotR").addEventListener("click", () => rotateSel(15));
```

Insert the toggle handler right after those two lines:

```js
    gid("mpRotL").addEventListener("click", () => rotateSel(-15));
    gid("mpRotR").addEventListener("click", () => rotateSel(15));
    const mpSelMode = gid("mpSelMode");
    mpSelMode.addEventListener("click", () => {
      selectWhole = !selectWhole;
      mpSelMode.textContent = selectWhole ? "เลือก: ทั้งกอง" : "เลือก: ทีละกล่อง";
    });
```

- [ ] **Step 6: Run the full suite + build**

Run: `npm test`
Expected: PASS.

Run: `npm run build`
Expected: builds with no errors (only the pre-existing chunk-size warning).

- [ ] **Step 7: Commit**

```bash
git add src/lib/warehouse3d/scene.js
git commit -m "feat(warehouse3d): toggle to select/drag the whole stack in arrange mode"
```

---

## Manual verification (after Task 2)

In the running app (localhost shares prod Supabase — read-only; do NOT click
บันทึกการจัดเรียง on real data without permission):

1. โกดัง 3D → กด ✋ จัดเรียง. The panel shows "เลือก: ทั้งกอง".
2. Click a product in a zone with boxes → the whole SKU group highlights in the info
   panel and drags as one; rotate ±15° turns the whole group.
3. Toggle to "เลือก: ทีละกล่อง" → clicking a box drags a single box again.

---

## Self-review notes

- **Spec coverage:** `pickDragKind` → Task 1; `selectWhole` state → Task 2 Step 2;
  toggle button + hint → Step 3; pointerdown routing → Step 4; toggle handler →
  Step 5. Whole-group reuse of the block path (drag/rotate/reset/save) needs no
  further code — verified in spec against existing `rotateSel`/`mpResetPos`/`mpCopy`.
- **Names consistent:** `pickDragKind`, `selectWhole`, `mpSelMode`, `kind`/`selKind`
  used identically across helper, test, and scene.
- **No placeholders:** every step has concrete code/commands/expected output.
