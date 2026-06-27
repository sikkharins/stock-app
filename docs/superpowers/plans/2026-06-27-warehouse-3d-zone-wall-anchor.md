# Auto wall-anchor (away from aisle) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-anchor each zone's products to the wall opposite its aisle (perimeter walls + internal back-to-back seams like z=15) by composing an automatic 0°/180° flip with the manual `arrangeRot`.

**Architecture:** Two pure helpers in `boxPlan.js` — `zoneWallLinesZ(zones, warehouse)` derives the Z "wall lines" from geometry, and `autoWallRot(zone, wallLinesZ)` returns 0 or 180. `scene.js` computes the lines once and folds the auto flip into the effective rotation `R` feeding the existing `arrangePoint`/`arrangeRotY`.

**Tech Stack:** JS, Vitest, three.js (scene not unit-tested).

Spec: `docs/superpowers/specs/2026-06-27-warehouse-3d-zone-wall-anchor-design.md`

---

## Task 1: Pure `zoneWallLinesZ` + `autoWallRot`

**Files:**
- Modify: `src/lib/warehouse3d/boxPlan.js` (add 2 exports after `pickDragKind`)
- Test: `src/lib/warehouse3d/boxPlan.test.ts` (extend import line 2; add a `describe`)

- [ ] **Step 1: Write the failing tests**

Add the two names to the import on line 2 of `src/lib/warehouse3d/boxPlan.test.ts`:

```ts
import { planBoxes, productColor, PRODUCT_PALETTE, REP_THRESHOLD, orientBoxDims, mergeEdgePositions, isGapId, gapWidthM, placeInBand, normArrangeRot, arrangeRotY, arrangePoint, pickDragKind, zoneWallLinesZ, autoWallRot } from "./boxPlan.js";
```

Append this block to the file:

```ts
describe("zoneWallLinesZ / autoWallRot", () => {
  const wh = { lengthM: 30 };
  const Z = [
    { origin: { x: 0, z: 0 }, size: { w: 6, l: 8 } },    // top 0-8
    { origin: { x: 0, z: 11 }, size: { w: 6, l: 4 } },   // upper-mid 11-15
    { origin: { x: 0, z: 15 }, size: { w: 6, l: 4 } },   // lower-mid 15-19
    { origin: { x: 0, z: 22 }, size: { w: 6, l: 8 } },   // bottom 22-30
  ];

  it("zoneWallLinesZ: ขอบโกดัง + รอยต่อหลังชนหลัง (z=15)", () => {
    const lines = zoneWallLinesZ(Z, wh);
    expect(lines).toContain(0);
    expect(lines).toContain(30);
    expect(lines).toContain(15);            // upper-mid far == lower-mid near, X overlap
    expect(lines).not.toContain(8);
    expect(lines).not.toContain(11);
    expect(lines).not.toContain(19);
    expect(lines).not.toContain(22);
  });

  it("zoneWallLinesZ: far==near แต่ไม่ซ้อนแนว X -> ไม่เป็น wall line", () => {
    const Z2 = [
      { origin: { x: 0, z: 0 }, size: { w: 6, l: 10 } },   // far=10 at x0-6
      { origin: { x: 40, z: 10 }, size: { w: 6, l: 5 } },  // near=10 at x40-46
    ];
    expect(zoneWallLinesZ(Z2, wh)).not.toContain(10);
  });

  it("autoWallRot: far บน wall line + near ไม่อยู่ -> 180; ไม่งั้น 0", () => {
    const lines = [0, 15, 30];
    expect(autoWallRot({ origin: { x: 0, z: 0 }, size: { w: 6, l: 8 } }, lines)).toBe(0);    // top
    expect(autoWallRot({ origin: { x: 0, z: 11 }, size: { w: 6, l: 4 } }, lines)).toBe(180); // upper-mid
    expect(autoWallRot({ origin: { x: 0, z: 15 }, size: { w: 6, l: 4 } }, lines)).toBe(0);   // lower-mid
    expect(autoWallRot({ origin: { x: 0, z: 22 }, size: { w: 6, l: 8 } }, lines)).toBe(180); // bottom
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/warehouse3d/boxPlan.test.ts`
Expected: FAIL — `zoneWallLinesZ is not a function` / `autoWallRot is not a function`.

- [ ] **Step 3: Add the helpers**

In `src/lib/warehouse3d/boxPlan.js`, insert after the `pickDragKind` function (before
the `// Distinct, readable swatch colours…` comment):

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

// Auto arrangement rotation (0 or 180 degrees): flip 180 when the FAR Z edge sits on a
// wall line but the NEAR edge does not, so products anchor to the wall away from the aisle.
export function autoWallRot(zone, wallLinesZ) {
  const EPS = 0.01;
  const onLine = (z) => wallLinesZ.some((w) => Math.abs(w - z) < EPS);
  const near = zone.origin.z, far = zone.origin.z + zone.size.l;
  return (onLine(far) && !onLine(near)) ? 180 : 0;
}

```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/warehouse3d/boxPlan.test.ts`
Expected: PASS (all prior + 3 new cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/warehouse3d/boxPlan.js src/lib/warehouse3d/boxPlan.test.ts
git commit -m "feat(warehouse3d): zoneWallLinesZ + autoWallRot (anchor away from aisle)"
```

---

## Task 2: Apply the auto flip in the scene

**Files:**
- Modify: `src/lib/warehouse3d/scene.js` — import (13), before build loop (~447), R line (478)

No unit test (WebGL). Verification = full suite green + Task 1 coverage + manual 3D.

- [ ] **Step 1: Import the helpers**

In `src/lib/warehouse3d/scene.js`, add `zoneWallLinesZ, autoWallRot` to the existing
`boxPlan.js` import:

```js
import { planBoxes, productColor, snapClampZoneRect, clampZoneHeight, orientBoxDims, mergeEdgePositions, isGapId, gapWidthM, placeInBand, normArrangeRot, arrangeRotY, arrangePoint, pickDragKind, zoneWallLinesZ, autoWallRot } from "./boxPlan.js";
```

- [ ] **Step 2: Compute wall lines once before the build loop**

In `src/lib/warehouse3d/scene.js`, find (lines 446-448):

```js
  const OBSTACLES = [];

  ZONES.forEach((zone) => {
```

Replace with:

```js
  const OBSTACLES = [];
  const wallLinesZ = zoneWallLinesZ(ZONES, WAREHOUSE);

  ZONES.forEach((zone) => {
```

- [ ] **Step 3: Fold the auto flip into the effective rotation**

In `src/lib/warehouse3d/scene.js`, change line 478:

```js
    const R = normArrangeRot(zone.arrangeRot);
```

to:

```js
    const R = normArrangeRot((zone.arrangeRot || 0) + autoWallRot(zone, wallLinesZ));
```

- [ ] **Step 4: Run the full suite to confirm no regression**

Run: `npm test`
Expected: PASS (top-band/middle non-seam zones get `autoWallRot` 0 → unchanged).

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: builds with no errors (only the pre-existing chunk-size warning).

- [ ] **Step 6: Commit**

```bash
git add src/lib/warehouse3d/scene.js
git commit -m "feat(warehouse3d): auto-anchor zone products to wall away from aisle"
```

---

## Manual verification (after Task 2)

In the running app (localhost shares prod Supabase — read-only; do NOT save):

1. โกดัง 3D → bottom band F/G/H/I now store against the z=30 wall, order reading
   ขวา→ซ้าย when viewed from the aisle.
2. Middle bands e/d/c/b/a (z11-15) and i/h/g/f (z15-19) store back-to-back against the
   z=15 spine.
3. Top band E/D/C/B/A unchanged (already against z=0).

---

## Self-review notes

- **Spec coverage:** wall-line detection (perimeter + back-to-back + X overlap) →
  Task 1 `zoneWallLinesZ`; 0/180 decision → `autoWallRot`; compose with manual
  `arrangeRot` in the scene → Task 2 Step 3; compute-once → Step 2. Backward compat
  (auto 0 for top/middle) covered by the `autoWallRot` tests + suite staying green.
- **Names consistent:** `zoneWallLinesZ`, `autoWallRot`, `wallLinesZ` used identically
  across helper, tests, and scene; composes via the existing `normArrangeRot`.
- **No placeholders:** every step has concrete code/commands/expected output.
