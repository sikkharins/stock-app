# Clear manual zone layout ("จัดอัตโนมัติ") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-zone "↺ จัดอัตโนมัติ" button that clears a zone's saved manual drag layout so it reverts to automatic placement (flow-axis + arrangeRot + auto wall-anchor).

**Architecture:** Pure `clearZoneLayout(warehouseLayout, zoneId)` removes `zones[id].layout`. `Warehouse3D.jsx` exposes `onClearLayout` (clears + bumps a `rebuildNonce` so the scene rebuilds, since `layout` is intentionally absent from `rebuildKey`). `scene.js` renders the button in each zone row that has a manual layout.

**Tech Stack:** React, Vitest, three.js (scene not unit-tested).

Spec: `docs/superpowers/specs/2026-06-27-warehouse-3d-clear-zone-layout-design.md`

---

## Task 1: Pure `clearZoneLayout`

**Files:**
- Modify: `src/utils/warehouse3d.js` (add export before `autoPlaceZones`)
- Test: `src/utils/warehouse3d.test.ts` (extend import line 2; add a `describe`)

- [ ] **Step 1: Write the failing tests**

Add `clearZoneLayout` to the import on line 2 of `src/utils/warehouse3d.test.ts`:

```ts
import { buildWarehouseData, autoPlaceZones, DEFAULT_WAREHOUSE, clearZoneLayout } from "./warehouse3d.js";
```

Append this block to the file:

```ts
describe("clearZoneLayout", () => {
  test("ลบ layout ของโซน เก็บ key อื่น (camera) ไว้", () => {
    const wl = { zones: { z1: { layout: { 1: { x: 1, z: 2 } }, camera: { fov: 55 } }, z2: { layout: {} } } };
    const out = clearZoneLayout(wl, "z1");
    expect(out.zones.z1).toEqual({ camera: { fov: 55 } });
    expect(out.zones.z2).toEqual({ layout: {} }); // z2 ไม่ถูกแตะ
  });
  test("entry ที่มีแค่ layout -> ลบทั้ง entry", () => {
    const wl = { zones: { z1: { layout: { 1: { x: 1 } } } } };
    expect(clearZoneLayout(wl, "z1").zones.z1).toBeUndefined();
  });
  test("ไม่มี layout -> คืน reference เดิม", () => {
    const wl = { zones: { z1: { camera: { fov: 55 } } } };
    expect(clearZoneLayout(wl, "z1")).toBe(wl);
  });
  test("ไม่มี entry โซน -> คืน reference เดิม", () => {
    const wl = { zones: {} };
    expect(clearZoneLayout(wl, "zX")).toBe(wl);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/warehouse3d.test.ts`
Expected: FAIL — `clearZoneLayout is not a function`.

- [ ] **Step 3: Add the helper**

In `src/utils/warehouse3d.js`, insert immediately before the line
`// Lay out the given zones in a grid that fits inside the warehouse footprint.`
(just above `export function autoPlaceZones`):

```js
// Remove a zone's manual drag layout from warehouse_layout, returning a new object.
// Returns the SAME reference when there is nothing to clear (so React can skip updates).
export function clearZoneLayout(warehouseLayout, zoneId) {
  const wl = warehouseLayout || {};
  const zones = wl.zones || {};
  const entry = zones[zoneId];
  if (!entry || !entry.layout) return warehouseLayout;
  const newEntry = { ...entry };
  delete newEntry.layout;
  const newZones = { ...zones };
  if (Object.keys(newEntry).length) newZones[zoneId] = newEntry;
  else delete newZones[zoneId];
  return { ...wl, zones: newZones };
}

```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/warehouse3d.test.ts`
Expected: PASS (all prior + 4 new cases).

- [ ] **Step 5: Commit**

```bash
git add src/utils/warehouse3d.js src/utils/warehouse3d.test.ts
git commit -m "feat(warehouse3d): clearZoneLayout helper (drop manual drag layout)"
```

---

## Task 2: Wire `onClearLayout` + rebuild in Warehouse3D

**Files:**
- Modify: `src/components/Warehouse3D.jsx`

No unit test (renders the WebGL scene). Verified via Task 3 build + manual.

- [ ] **Step 1: Imports + rebuildNonce state**

In `src/components/Warehouse3D.jsx`, change line 1:

```js
import { useEffect, useMemo, useRef, useCallback } from "react";
```

to:

```js
import { useEffect, useMemo, useRef, useCallback, useState } from "react";
```

Change line 2:

```js
import { buildWarehouseData, claudeDesignZones } from "../utils/warehouse3d.js";
```

to:

```js
import { buildWarehouseData, claudeDesignZones, clearZoneLayout } from "../utils/warehouse3d.js";
```

Add the nonce state right after `const containerRef = useRef(null);`:

```js
  const [rebuildNonce, setRebuildNonce] = useState(0);
```

- [ ] **Step 2: Add the nonce to rebuildKey**

In `src/components/Warehouse3D.jsx`, change the `g:` line + closing of the `rebuildKey`
`useMemo` (lines 22-25):

```js
    g: (warehouseLayout && warehouseLayout.zones)
      ? Object.entries(warehouseLayout.zones).map(([id, z]) => [id, z && z.origin, z && z.size, z && z.heightM])
      : null,
  }), [products, zones, warehouseLayout]);
```

to:

```js
    g: (warehouseLayout && warehouseLayout.zones)
      ? Object.entries(warehouseLayout.zones).map(([id, z]) => [id, z && z.origin, z && z.size, z && z.heightM])
      : null,
    n: rebuildNonce,
  }), [products, zones, warehouseLayout, rebuildNonce]);
```

- [ ] **Step 3: Add the `onClearLayout` callback**

In `src/components/Warehouse3D.jsx`, insert after the `onSaveLayout` `useCallback`
block (right after its closing `}, [setWarehouseLayout]);`):

```js
  const onClearLayout = useCallback((zoneId) => {
    setWarehouseLayout((prev) => clearZoneLayout(prev, zoneId));
    setRebuildNonce((n) => n + 1);
  }, [setWarehouseLayout]);
```

- [ ] **Step 4: Pass it to the scene**

In `src/components/Warehouse3D.jsx`, in the `createWarehouseScene(el, data, { … })`
options, add the `onClearLayout` line after `onSaveLayout`:

```js
      canEdit,
      onSaveLayout: canEdit ? onSaveLayout : null,
      onClearLayout: canEdit ? onClearLayout : null,
      onSaveCamera: canEdit ? onSaveCamera : null,
```

- [ ] **Step 5: Commit**

```bash
git add src/components/Warehouse3D.jsx
git commit -m "feat(warehouse3d): onClearLayout callback + rebuild nonce"
```

---

## Task 3: "↺ จัดอัตโนมัติ" button in the zone row

**Files:**
- Modify: `src/lib/warehouse3d/scene.js` — opts (200), zone-row buttons (667-668, 681), handler (after 695)

No unit test (WebGL). Verification = full suite green + build + manual.

- [ ] **Step 1: Read the `onClearLayout` option**

In `src/lib/warehouse3d/scene.js`, add after line 200
(`const onSaveLayout = …`):

```js
  const onClearLayout = typeof opts.onClearLayout === "function" ? opts.onClearLayout : null;
```

- [ ] **Step 2: Build the button (only when the zone has a manual layout)**

In `src/lib/warehouse3d/scene.js`, find (lines 667-668):

```js
    const camBtns = `<button class="zr-cam zr-go">📷 มุมกล้องโซนนี้</button>` +
      (canEdit && onSaveCamera ? `<button class="zr-cam zr-save">💾 บันทึกมุมนี้</button>` : ``);
```

Add an `autoBtn` const right after it:

```js
    const camBtns = `<button class="zr-cam zr-go">📷 มุมกล้องโซนนี้</button>` +
      (canEdit && onSaveCamera ? `<button class="zr-cam zr-save">💾 บันทึกมุมนี้</button>` : ``);
    const autoBtn = (canEdit && onClearLayout && zone.layout)
      ? `<button class="zr-cam zr-auto">↺ จัดอัตโนมัติ</button>` : ``;
```

- [ ] **Step 3: Render the button in the actions row**

In `src/lib/warehouse3d/scene.js`, change the actions line (681):

```js
      <div class="zr-actions">${camBtns}</div>
```

to:

```js
      <div class="zr-actions">${camBtns}${autoBtn}</div>
```

- [ ] **Step 4: Wire the click handler (confirm → clear)**

In `src/lib/warehouse3d/scene.js`, find the `.zr-save` handler block (lines 689-695):

```js
    const saveBtn = row.querySelector(".zr-save");
    if (saveBtn) saveBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      onSaveCamera(zone.id, captureCamera());
      saveBtn.textContent = "✓ บันทึกแล้ว";
      setT(() => { saveBtn.textContent = "💾 บันทึกมุมนี้"; }, 1600);
    });
```

Insert the auto handler right after that block:

```js
    const autoBtn2 = row.querySelector(".zr-auto");
    if (autoBtn2) autoBtn2.addEventListener("click", (e) => {
      e.stopPropagation();
      if (window.confirm("ล้างตำแหน่งที่ลากเองของโซนนี้ แล้วกลับไปจัดอัตโนมัติ?")) onClearLayout(zone.id);
    });
```

(`autoBtn2` avoids colliding with the `autoBtn` HTML-string const above.)

- [ ] **Step 5: Run the full suite + build**

Run: `npm test`
Expected: PASS (no test exercises the scene).

Run: `npm run build`
Expected: builds with no errors (only the pre-existing chunk-size warning).

- [ ] **Step 6: Commit**

```bash
git add src/lib/warehouse3d/scene.js
git commit -m "feat(warehouse3d): per-zone จัดอัตโนมัติ button to clear manual layout"
```

---

## Manual verification (after Task 3)

In the running app (localhost shares prod Supabase — clicking ↺ writes
`warehouse_layout`; this is the intended F/G fix, so do it only with the user's
go-ahead):

1. โกดัง 3D → a zone with a saved drag arrangement (e.g. F, G, E) shows "↺ จัดอัตโนมัติ"
   in its card; zones without one don't.
2. Click ↺ → confirm → the zone's products immediately re-arrange automatically
   (F/G snap against the z=30 wall; order ขวา→ซ้าย from the aisle).

---

## Self-review notes

- **Spec coverage:** `clearZoneLayout` (drop layout, keep siblings, same-ref when
  empty) → Task 1; `onClearLayout` + rebuild nonce → Task 2; per-zone button shown
  only with a layout + confirm + clear → Task 3. Data flow (clear → rebuild → auto)
  covered by Task 2 nonce + Task 3 button.
- **Names consistent:** `clearZoneLayout`, `onClearLayout`, `rebuildNonce`, `zr-auto`
  used identically across helper, React, and scene.
- **No placeholders:** every step has concrete code/commands/expected output.
