# Per-zone arrangement rotation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-zone `arrangeRot` (0/90/180/270° CW) that rotates a zone's whole product/gap arrangement so items can face the aisle, set from the zone editor.

**Architecture:** Pure helpers in `boxPlan.js` (`normArrangeRot`, `arrangeRotY`, `arrangePoint`) define the rotation. `scene.js` lays items out in a local canvas (swapped dims for 90/270) then maps each to world + sets `pg.rotation.y`. `warehouse3d.js` passes `arrangeRot` through; `Warehouse3D.jsx` adds it (and `boxConfig`) to `rebuildKey`. `Zones.jsx` gets a cycle button.

**Tech Stack:** JS, Vitest + @testing-library/react, three.js (scene not unit-tested).

Spec: `docs/superpowers/specs/2026-06-27-warehouse-3d-zone-arrange-rotation-design.md`

---

## Task 1: Pure rotation helpers

**Files:**
- Modify: `src/lib/warehouse3d/boxPlan.js` (add 3 exports after `placeInBand`)
- Test: `src/lib/warehouse3d/boxPlan.test.ts` (extend import line 2; add a `describe`)

- [ ] **Step 1: Write the failing tests**

Add the 3 names to the import on line 2 of `src/lib/warehouse3d/boxPlan.test.ts`:

```ts
import { planBoxes, productColor, PRODUCT_PALETTE, REP_THRESHOLD, orientBoxDims, mergeEdgePositions, isGapId, gapWidthM, placeInBand, normArrangeRot, arrangeRotY, arrangePoint } from "./boxPlan.js";
```

Append this block to the file:

```ts
describe("normArrangeRot / arrangeRotY / arrangePoint", () => {
  it("normArrangeRot: snap ไป 0/90/180/270", () => {
    expect(normArrangeRot(0)).toBe(0);
    expect(normArrangeRot(90)).toBe(90);
    expect(normArrangeRot(180)).toBe(180);
    expect(normArrangeRot(270)).toBe(270);
    expect(normArrangeRot(360)).toBe(0);
    expect(normArrangeRot(450)).toBe(90);
    expect(normArrangeRot(-90)).toBe(270);
    expect(normArrangeRot(undefined)).toBe(0);
  });

  it("arrangeRotY: เรเดียนตาม R", () => {
    expect(arrangeRotY(0)).toBe(0);
    expect(arrangeRotY(90)).toBeCloseTo(-Math.PI / 2);
    expect(arrangeRotY(180)).toBeCloseTo(Math.PI);
    expect(arrangeRotY(270)).toBeCloseTo(Math.PI / 2);
  });

  it("arrangePoint: map canvas -> zone-inner ตามการหมุน (innerW 6, innerL 8)", () => {
    expect(arrangePoint(0, 2, 3, 6, 8)).toEqual({ x: 2, z: 3 });
    expect(arrangePoint(90, 2, 3, 6, 8)).toEqual({ x: 3, z: 2 });
    expect(arrangePoint(90, 0, 0, 6, 8)).toEqual({ x: 6, z: 0 });
    expect(arrangePoint(180, 2, 3, 6, 8)).toEqual({ x: 4, z: 5 });
    expect(arrangePoint(270, 2, 3, 6, 8)).toEqual({ x: 3, z: 6 });
    expect(arrangePoint(270, 0, 0, 6, 8)).toEqual({ x: 0, z: 8 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/warehouse3d/boxPlan.test.ts`
Expected: FAIL — `normArrangeRot is not a function` (and the others).

- [ ] **Step 3: Add the helpers**

In `src/lib/warehouse3d/boxPlan.js`, insert after the `placeInBand` function (before
the `// Distinct, readable swatch colours…` comment):

```js
// Normalize any value to one of 0/90/180/270 (degrees CW).
export function normArrangeRot(v) {
  return ((Math.round((Number(v) || 0) / 90) * 90) % 360 + 360) % 360;
}

// three.js Y-rotation (radians) turning a +X/+Z box grid to match an R° CW arrangement.
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/warehouse3d/boxPlan.test.ts`
Expected: PASS (all prior + 3 new cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/warehouse3d/boxPlan.js src/lib/warehouse3d/boxPlan.test.ts
git commit -m "feat(warehouse3d): arrangeRot pure helpers (normArrangeRot/arrangeRotY/arrangePoint)"
```

---

## Task 2: Pass `arrangeRot` through merge + rebuild

**Files:**
- Modify: `src/utils/warehouse3d.js:159`
- Modify: `src/components/Warehouse3D.jsx:19`
- Test: `src/utils/warehouse3d.test.ts` (add a `describe`)

- [ ] **Step 1: Write the failing test**

Append to `src/utils/warehouse3d.test.ts`:

```ts
describe("buildWarehouseData — arrangeRot passthrough", () => {
  test("carries arrangeRot from the app zone into the scene zone", () => {
    const z = [{ id: "z1", productIds: [1], arrangeRot: 90 }];
    const { ZONES } = build([product()], z, {});
    expect(ZONES[0].arrangeRot).toBe(90);
  });

  test("omits arrangeRot when the zone has none", () => {
    const { ZONES } = build([product()], [{ id: "z1", productIds: [1] }], {});
    expect(ZONES[0].arrangeRot).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/utils/warehouse3d.test.ts`
Expected: the first new test FAILS (`ZONES[0].arrangeRot` is `undefined`).

- [ ] **Step 3: Add the passthrough**

In `src/utils/warehouse3d.js`, find (line ~159):

```js
    if (z.boxConfig) out.boxConfig = z.boxConfig; // per-product แถว/ชั้น from the form
    return out;
```

Insert a line so it reads:

```js
    if (z.boxConfig) out.boxConfig = z.boxConfig; // per-product แถว/ชั้น from the form
    if (z.arrangeRot) out.arrangeRot = z.arrangeRot; // per-zone arrangement rotation
    return out;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/utils/warehouse3d.test.ts`
Expected: PASS.

- [ ] **Step 5: Add boxConfig + arrangeRot to rebuildKey**

In `src/components/Warehouse3D.jsx`, change line 19 from:

```js
    z: (zones || []).map((z) => [z.id, z.name, z.note, z.productIds]),
```

to:

```js
    z: (zones || []).map((z) => [z.id, z.name, z.note, z.productIds, z.boxConfig, z.arrangeRot]),
```

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/utils/warehouse3d.js src/utils/warehouse3d.test.ts src/components/Warehouse3D.jsx
git commit -m "feat(warehouse3d): pass arrangeRot through; rebuild on boxConfig/arrangeRot"
```

---

## Task 3: Rotate the arrangement in the scene

**Files:**
- Modify: `src/lib/warehouse3d/scene.js` — import line, cursor init (476-481), gap branch (487-501), product placement + tail (576-587)

No unit test (WebGL). Verification = full suite green + Task 1 coverage + manual 3D.

- [ ] **Step 1: Extend the boxPlan import**

In `src/lib/warehouse3d/scene.js`, add `normArrangeRot, arrangeRotY, arrangePoint`
to the existing `boxPlan.js` import (which already imports `placeInBand`):

```js
import { planBoxes, productColor, snapClampZoneRect, clampZoneHeight, orientBoxDims, mergeEdgePositions, isGapId, gapWidthM, placeInBand, normArrangeRot, arrangeRotY, arrangePoint } from "./boxPlan.js";
```

- [ ] **Step 2: Replace the cursor init with a local-canvas frame**

In `src/lib/warehouse3d/scene.js`, find (lines 476-481):

```js
    let curX = ox + MARGIN, curZ = oz + MARGIN, bandDepth = 0;
    const innerXMax = ox + w - MARGIN;
    const innerZMax = oz + l - MARGIN;
    const innerW = w - 2 * MARGIN, innerL = l - 2 * MARGIN;
    const flowZ = l > w; // flow products/gaps along the longer side of the zone
    const bounds = { ox, oz, innerXMax, innerZMax, margin: MARGIN, gap: GAP };
```

Replace with:

```js
    const innerW = w - 2 * MARGIN, innerL = l - 2 * MARGIN;
    const R = normArrangeRot(zone.arrangeRot);
    const swap = R === 90 || R === 270;
    const cw = swap ? innerL : innerW; // canvas layout width
    const cl = swap ? innerW : innerL; // canvas layout depth
    const flowZ = cl > cw;             // flow along the longer canvas side
    let curX = 0, curZ = 0, bandDepth = 0; // LOCAL canvas coords
    const bounds = { ox: 0, oz: 0, innerXMax: cw, innerZMax: cl, margin: 0, gap: GAP };
    const rotY = arrangeRotY(R);
    const toWorld = (px, pz) => { const q = arrangePoint(R, px, pz, innerW, innerL); return { x: ox + MARGIN + q.x, z: oz + MARGIN + q.z }; };
```

(The pile branch still uses `innerW`/`innerL`; they remain defined. `innerXMax`/
`innerZMax` world constants are gone — only the cursor used them.)

- [ ] **Step 3: Map the gap marker through `toWorld`**

In `src/lib/warehouse3d/scene.js`, find the gap branch from the `gd` line through its
`return` (lines 487-501):

```js
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

Replace with:

```js
        const gd = Math.min(flowZ ? cw : cl, 0.6); // marker thickness across the flow
        const fw = flowZ ? gd : gw; // canvas-X extent
        const fl = flowZ ? gw : gd; // canvas-Z extent
        const step = placeInBand({ curX, curZ, bandDepth }, { fw, fl, advance: 0 }, bounds, flowZ);
        curX = step.curX; curZ = step.curZ; bandDepth = step.bandDepth;
        const c = toWorld(step.bx + fw / 2, step.bz + fl / 2); // marker center in world
        const mw = swap ? fl : fw, ml = swap ? fw : fl;        // world plane dims
        const gm = new THREE.Mesh(new THREE.PlaneGeometry(mw, ml),
          new THREE.MeshBasicMaterial({ color: "#9aa3af", transparent: true, opacity: 0.14, depthWrite: false }));
        gm.rotation.x = -Math.PI / 2;
        gm.position.set(c.x, 0.03, c.z);
        gm.userData.zonePart = true; group.add(gm); st.meshes.push(gm);
        const go = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(mw, ml)),
          new THREE.LineBasicMaterial({ color: "#9aa3af", transparent: true, opacity: 0.5 }));
        go.rotation.x = -Math.PI / 2; go.position.copy(gm.position);
        go.userData.zonePart = true; group.add(go); st.meshes.push(go);
        return;
```

- [ ] **Step 4: Map product placement through `toWorld` + use radians**

In `src/lib/warehouse3d/scene.js`, find (lines 576-587):

```js
      let bx, bz, rotDeg = 0;
      if (manual) {
        bx = ox + (manual.x ?? 0);
        bz = oz + (manual.z ?? 0);
        rotDeg = manual.rot ?? 0;
      } else {
        const step = placeInBand({ curX, curZ, bandDepth }, { fw, fl, advance: GAP * 4 }, bounds, flowZ);
        bx = step.bx; bz = step.bz;
        curX = step.curX; curZ = step.curZ; bandDepth = step.bandDepth;
      }
      pg.position.set(bx, 0, bz);
      pg.rotation.y = -rotDeg * Math.PI / 180;
```

Replace with:

```js
      let bx, bz, rotRad = 0;
      if (manual) {
        bx = ox + (manual.x ?? 0);
        bz = oz + (manual.z ?? 0);
        rotRad = -(manual.rot ?? 0) * Math.PI / 180;
      } else {
        const step = placeInBand({ curX, curZ, bandDepth }, { fw, fl, advance: GAP * 4 }, bounds, flowZ);
        curX = step.curX; curZ = step.curZ; bandDepth = step.bandDepth;
        const wp = toWorld(step.bx, step.bz);
        bx = wp.x; bz = wp.z; rotRad = rotY;
      }
      pg.position.set(bx, 0, bz);
      pg.rotation.y = rotRad;
```

- [ ] **Step 5: Run the full suite to confirm no regression**

Run: `npm test`
Expected: PASS (default `arrangeRot` 0 → identity map, `rotY` 0 → byte-equivalent).

- [ ] **Step 6: Commit**

```bash
git add src/lib/warehouse3d/scene.js
git commit -m "feat(warehouse3d): rotate zone arrangement by arrangeRot (canvas + map)"
```

---

## Task 4: "หมุนเรียง" cycle button in the editor

**Files:**
- Modify: `src/components/Zones.jsx`
- Test: `src/components/Zones.test.tsx` (add one smoke case)

- [ ] **Step 1: Write the failing smoke test**

Append inside the existing `describe("ZonePage editor — ordered product rows", ...)`
block in `src/components/Zones.test.tsx`:

```tsx
  test("'หมุนเรียง' cycles 0 -> 90 -> 180", async () => {
    const user = userEvent.setup();
    render(<Harness initialZones={[{ id: "z1", name: "Z1", productIds: [1] }]} />);
    await openEditor(user);

    const btn = screen.getByTitle("หมุนการจัดเรียงทั้งโซน (ตามเข็ม)") as HTMLButtonElement;
    expect(btn.textContent).toBe("หมุนเรียง 0°");
    await user.click(btn);
    expect(btn.textContent).toBe("หมุนเรียง 90°");
    await user.click(btn);
    expect(btn.textContent).toBe("หมุนเรียง 180°");
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/Zones.test.tsx`
Expected: FAIL — no element with title "หมุนการจัดเรียงทั้งโซน (ตามเข็ม)".

- [ ] **Step 3: Import `normArrangeRot` and add the handler**

In `src/components/Zones.jsx`, change the boxPlan import:

```js
import { isGapId } from "../lib/warehouse3d/boxPlan.js";
```

to:

```js
import { isGapId, normArrangeRot } from "../lib/warehouse3d/boxPlan.js";
```

Add the handler next to `addGap` (after the `addGap` block):

```js
  const cycleArrangeRot = () => setEditing((z) => ({ ...z, arrangeRot: normArrangeRot((z.arrangeRot || 0) + 90) }));
```

- [ ] **Step 4: Render the button beside the products header**

In `src/components/Zones.jsx`, find the products header (line ~128):

```jsx
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>สินค้าที่ควรอยู่ในโซนนี้ ({editing.productIds.filter((id) => !isGapId(id)).length})</div>
```

Replace with:

```jsx
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>สินค้าที่ควรอยู่ในโซนนี้ ({editing.productIds.filter((id) => !isGapId(id)).length})</span>
            <button onClick={cycleArrangeRot} title="หมุนการจัดเรียงทั้งโซน (ตามเข็ม)" style={orientBtn}>หมุนเรียง {normArrangeRot(editing.arrangeRot || 0)}°</button>
          </div>
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/Zones.test.tsx`
Expected: PASS (all prior + the new cycle test).

- [ ] **Step 6: Run the full suite + build**

Run: `npm test`
Expected: PASS.

Run: `npm run build`
Expected: builds with no errors (only the pre-existing chunk-size warning).

- [ ] **Step 7: Commit**

```bash
git add src/components/Zones.jsx src/components/Zones.test.tsx
git commit -m "feat(zones): หมุนเรียง per-zone arrangement rotation button"
```

---

## Manual verification (after Task 4)

In the running app (localhost shares prod Supabase — read-only; do NOT click บันทึก
on real data without permission):

1. Zones tab → edit zone E → click "หมุนเรียง" to 90°.
2. โกดัง 3D tab → zone E's products rotate to face the aisle (z=8 edge); other zones
   (arrangeRot 0) unchanged. Cycle 180/270 to compare; pick what fits the aisle.

---

## Self-review notes

- **Spec coverage:** `arrangeRot` data + helpers → Task 1; merge passthrough + rebuild
  (incl. `boxConfig`) → Task 2; canvas layout + world mapping + box rotation (products
  & gaps) → Task 3; editor cycle button → Task 4. Default-0 byte-equivalence → Task 3
  Step 2/5 (identity map).
- **Names consistent:** `normArrangeRot`, `arrangeRotY`, `arrangePoint`, `arrangeRot`,
  `toWorld`, `rotY`/`rotRad`, `cw`/`cl`/`swap` used identically across helper, tests,
  scene, merge, and editor.
- **No placeholders:** every step has concrete code/commands/expected output.
