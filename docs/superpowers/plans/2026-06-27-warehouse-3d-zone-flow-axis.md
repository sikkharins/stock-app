# 3D zone flow-axis (longer side) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-arrange a zone's products/gaps along its longer horizontal side (flow along Z when depth `l` > width `w`), so tall narrow zones (E, I, office) form long rows down their long wall like A/B/C/D do.

**Architecture:** Extract the cursor-stepping math into a pure `placeInBand(cur, item, bounds, flowZ)` in `boxPlan.js` (unit-tested). `scene.js` computes `flowZ = l > w` per zone and routes both the gap branch and the product auto-placement through it. Non-flow (wide/square) zones are byte-for-byte equivalent to today.

**Tech Stack:** JS, Vitest, three.js (scene not unit-tested).

Spec: `docs/superpowers/specs/2026-06-27-warehouse-3d-zone-flow-axis-design.md`

---

## Task 1: Pure `placeInBand` cursor helper

**Files:**
- Modify: `src/lib/warehouse3d/boxPlan.js` (add export after `gapWidthM`)
- Test: `src/lib/warehouse3d/boxPlan.test.ts` (extend import on line 2; add a `describe`)

- [ ] **Step 1: Write the failing tests**

Add `placeInBand` to the import on line 2 of `src/lib/warehouse3d/boxPlan.test.ts`:

```ts
import { planBoxes, productColor, PRODUCT_PALETTE, REP_THRESHOLD, orientBoxDims, mergeEdgePositions, isGapId, gapWidthM, placeInBand } from "./boxPlan.js";
```

Append this block to the file:

```ts
describe("placeInBand", () => {
  // zone origin (0,0), inner extents 10 (X) x 6 (Z), margin 0.3, gap 0.1
  const bounds = { ox: 0, oz: 0, innerXMax: 10, innerZMax: 6, margin: 0.3, gap: 0.1 };
  const start = { curX: 0.3, curZ: 0.3, bandDepth: 0 };

  it("flow X: ไม่ wrap -> ไล่ตาม X, แชร์แถว Z เดิม", () => {
    const a = placeInBand(start, { fw: 2, fl: 1, advance: 0.2 }, bounds, false);
    expect([a.bx, a.bz]).toEqual([0.3, 0.3]);
    expect(a.curX).toBeCloseTo(2.5);          // 0.3 + 2 + 0.2
    expect(a.curZ).toBe(0.3);                  // unchanged
    expect(a.bandDepth).toBe(1);              // max(0, fl)
    const b = placeInBand({ curX: a.curX, curZ: a.curZ, bandDepth: a.bandDepth }, { fw: 2, fl: 1, advance: 0.2 }, bounds, false);
    expect(b.bx).toBeCloseTo(2.5);             // next to the first
    expect(b.bz).toBe(0.3);
  });

  it("flow X: เกิน innerXMax -> wrap ขึ้นแถว Z ใหม่", () => {
    const cur = { curX: 9.5, curZ: 0.3, bandDepth: 1 };
    const a = placeInBand(cur, { fw: 2, fl: 1.5, advance: 0 }, bounds, false);
    expect(a.bx).toBe(0.3);                    // reset to ox + margin
    expect(a.bz).toBeCloseTo(1.4);             // 0.3 + bandDepth(1) + gap(0.1)
    expect(a.bandDepth).toBe(1.5);
  });

  it("flow Z: ไม่ wrap -> ไล่ตาม Z, แชร์ band X เดิม", () => {
    const a = placeInBand(start, { fw: 2, fl: 1, advance: 0.2 }, bounds, true);
    expect([a.bx, a.bz]).toEqual([0.3, 0.3]);
    expect(a.curZ).toBeCloseTo(1.5);           // 0.3 + fl(1) + 0.2
    expect(a.curX).toBe(0.3);                  // unchanged
    expect(a.bandDepth).toBe(2);              // max(0, fw)
  });

  it("flow Z: เกิน innerZMax -> wrap ไป band X ใหม่", () => {
    const cur = { curX: 0.3, curZ: 5.5, bandDepth: 2 };
    const a = placeInBand(cur, { fw: 1.5, fl: 1, advance: 0 }, bounds, true);
    expect(a.bz).toBe(0.3);                    // reset to oz + margin
    expect(a.bx).toBeCloseTo(2.4);             // 0.3 + bandDepth(2) + gap(0.1)
    expect(a.bandDepth).toBe(1.5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/warehouse3d/boxPlan.test.ts`
Expected: FAIL — `placeInBand is not a function`.

- [ ] **Step 3: Add the helper**

In `src/lib/warehouse3d/boxPlan.js`, insert after the `gapWidthM` function (before
the `// Distinct, readable swatch colours…` comment):

```js
// Place one item along the flow axis inside a zone, wrapping into bands. Pure.
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/warehouse3d/boxPlan.test.ts`
Expected: PASS (all prior + 4 new cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/warehouse3d/boxPlan.js src/lib/warehouse3d/boxPlan.test.ts
git commit -m "feat(warehouse3d): placeInBand pure cursor helper (flow X or Z)"
```

---

## Task 2: Route scene placement through `placeInBand`

**Files:**
- Modify: `src/lib/warehouse3d/scene.js` — import line, cursor init (~476-478), gap branch (~481-498), product auto-placement (~578-583)

No unit test (WebGL). Verification = full suite green + Task 1 helper coverage +
manual 3D check.

- [ ] **Step 1: Extend the boxPlan import**

In `src/lib/warehouse3d/scene.js`, add `placeInBand` to the existing `boxPlan.js`
import (the line that already imports `isGapId, gapWidthM`):

```js
import { planBoxes, productColor, snapClampZoneRect, clampZoneHeight, orientBoxDims, mergeEdgePositions, isGapId, gapWidthM, placeInBand } from "./boxPlan.js";
```

- [ ] **Step 2: Add `flowZ`, `innerZMax`, `bounds` at cursor init**

In `src/lib/warehouse3d/scene.js`, find (lines 476-478):

```js
    let curX = ox + MARGIN, curZ = oz + MARGIN, bandDepth = 0;
    const innerXMax = ox + w - MARGIN;
    const innerW = w - 2 * MARGIN, innerL = l - 2 * MARGIN;
```

Replace with:

```js
    let curX = ox + MARGIN, curZ = oz + MARGIN, bandDepth = 0;
    const innerXMax = ox + w - MARGIN;
    const innerZMax = oz + l - MARGIN;
    const innerW = w - 2 * MARGIN, innerL = l - 2 * MARGIN;
    const flowZ = l > w; // flow products/gaps along the longer side of the zone
    const bounds = { ox, oz, innerXMax, innerZMax, margin: MARGIN, gap: GAP };
```

- [ ] **Step 3: Route the gap branch through `placeInBand`**

In `src/lib/warehouse3d/scene.js`, find the gap branch body (lines 482-498):

```js
        const gcfg = zone.boxConfig && zone.boxConfig[pid] ? zone.boxConfig[pid] : null;
        const gw = gapWidthM(gcfg);
        if (curX + gw > innerXMax) { curX = ox + MARGIN; curZ += bandDepth + GAP; bandDepth = 0; }
        const gd = Math.min(innerL, 0.6); // nominal depth of the floor marker
        const gx = curX, gz = curZ;
        const gm = new THREE.Mesh(new THREE.PlaneGeometry(gw, gd),
          new THREE.MeshBasicMaterial({ color: "#9aa3af", transparent: true, opacity: 0.14, depthWrite: false }));
        gm.rotation.x = -Math.PI / 2;
        gm.position.set(gx + gw / 2, 0.03, gz + gd / 2);
        gm.userData.zonePart = true; group.add(gm); st.meshes.push(gm);
        const go = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(gw, gd)),
          new THREE.LineBasicMaterial({ color: "#9aa3af", transparent: true, opacity: 0.5 }));
        go.rotation.x = -Math.PI / 2; go.position.copy(gm.position);
        go.userData.zonePart = true; group.add(go); st.meshes.push(go);
        curX += gw; // gap reserves exactly its width (no extra inter-item GAP)
        bandDepth = Math.max(bandDepth, gd);
        return;
```

Replace with:

```js
        const gcfg = zone.boxConfig && zone.boxConfig[pid] ? zone.boxConfig[pid] : null;
        const gw = gapWidthM(gcfg);
        const gd = Math.min(flowZ ? innerW : innerL, 0.6); // marker thickness across the flow
        const fw = flowZ ? gd : gw; // X extent
        const fl = flowZ ? gw : gd; // Z extent
        const step = placeInBand({ curX, curZ, bandDepth }, { fw, fl, advance: 0 }, bounds, flowZ);
        curX = step.curX; curZ = step.curZ; bandDepth = step.bandDepth;
        const gm = new THREE.Mesh(new THREE.PlaneGeometry(fw, fl),
          new THREE.MeshBasicMaterial({ color: "#9aa3af", transparent: true, opacity: 0.14, depthWrite: false }));
        gm.rotation.x = -Math.PI / 2;
        gm.position.set(step.bx + fw / 2, 0.03, step.bz + fl / 2);
        gm.userData.zonePart = true; group.add(gm); st.meshes.push(gm);
        const go = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(fw, fl)),
          new THREE.LineBasicMaterial({ color: "#9aa3af", transparent: true, opacity: 0.5 }));
        go.rotation.x = -Math.PI / 2; go.position.copy(gm.position);
        go.userData.zonePart = true; group.add(go); st.meshes.push(go);
        return;
```

- [ ] **Step 4: Route product auto-placement through `placeInBand`**

In `src/lib/warehouse3d/scene.js`, find the auto-placement `else` (lines 578-583):

```js
      } else {
        if (curX + fw > innerXMax) { curX = ox + MARGIN; curZ += bandDepth + GAP; bandDepth = 0; }
        bx = curX; bz = curZ;
        curX += fw + GAP * 4;
        bandDepth = Math.max(bandDepth, fl);
      }
```

Replace with:

```js
      } else {
        const step = placeInBand({ curX, curZ, bandDepth }, { fw, fl, advance: GAP * 4 }, bounds, flowZ);
        bx = step.bx; bz = step.bz;
        curX = step.curX; curZ = step.curZ; bandDepth = step.bandDepth;
      }
```

(`fw`/`fl` here are the product footprint extents already assigned above — `footW`/
`footL` for box products, `side`/`side` for piles.)

- [ ] **Step 5: Run the full suite to confirm no regression**

Run: `npm test`
Expected: PASS (no test drives the WebGL path; non-flow zones are unchanged).

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: builds with no errors (only the pre-existing chunk-size warning).

- [ ] **Step 7: Commit**

```bash
git add src/lib/warehouse3d/scene.js
git commit -m "feat(warehouse3d): flow products/gaps along zone's longer side"
```

---

## Manual verification (after Task 2)

In the running app (localhost shares prod Supabase — read-only; do NOT click บันทึก):

1. โกดัง 3D tab → zone E (6×8, has 6 products) now shows products as a long row
   running down the X=0 side wall, not piled toward the back.
2. Zones A/B/C/D look unchanged (they were already wide → `flowZ` false).

---

## Self-review notes

- **Spec coverage:** `flowZ = l > w` + flow along Z → Task 2 Step 2; pure
  `placeInBand` shared by gaps + products → Task 1 + Task 2 Steps 3-4; non-flow
  unchanged → `placeInBand` `!flowZ` path mirrors the old inline math (verified by
  the "flow X" unit tests matching prior behaviour); gap marker sized to flow → Task 2
  Step 3.
- **Names consistent:** `placeInBand`, `flowZ`, `bounds` (keys `margin`/`gap`), `fw`/
  `fl`/`advance` used identically in helper, tests, and both scene call sites.
- **No placeholders:** every step has concrete code/commands/expected output.
