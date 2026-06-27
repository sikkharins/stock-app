# 3D layout immediate-save Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the 3D warehouse's `warehouse_layout` writes (arrange/camera/geometry/clear) to Supabase immediately instead of after the 800ms autosave debounce, so a refresh right after saving keeps the change.

**Architecture:** App exposes a `saveNow(sbKey, value)` that writes localStorage + `saveKeyWithMerge` at once. Pure `applyZoneLayout`/`mergeZoneEntry` build the next `warehouse_layout`. The four `Warehouse3D` callbacks compute the next value from refs (latest, since the scene caches callbacks), `setWarehouseLayout`, and call `saveNow`.

**Tech Stack:** React, Vitest. (App/scene wiring is not unit-tested; pure helpers are.)

Spec: `docs/superpowers/specs/2026-06-27-warehouse-3d-immediate-save-design.md`

---

## Task 1: Pure `applyZoneLayout` + `mergeZoneEntry`

**Files:**
- Modify: `src/utils/warehouse3d.js` (add 2 exports next to `clearZoneLayout`)
- Test: `src/utils/warehouse3d.test.ts` (extend import line 2; add a `describe`)

- [ ] **Step 1: Write the failing tests**

Add the two names to the import on line 2 of `src/utils/warehouse3d.test.ts`:

```ts
import { buildWarehouseData, autoPlaceZones, DEFAULT_WAREHOUSE, clearZoneLayout, applyZoneLayout, mergeZoneEntry } from "./warehouse3d.js";
```

Append this block to the file:

```ts
describe("applyZoneLayout", () => {
  test("merge layout เข้าโซน เก็บ key อื่น + โซนอื่น", () => {
    const wl = { zones: { z1: { camera: { fov: 55 } } }, warehouse: { widthM: 54 } };
    const out = applyZoneLayout(wl, { z1: { 1: { x: 1, z: 2 } }, z2: { 3: { x: 0, z: 0 } } });
    expect(out.zones.z1).toEqual({ camera: { fov: 55 }, layout: { 1: { x: 1, z: 2 } } });
    expect(out.zones.z2).toEqual({ layout: { 3: { x: 0, z: 0 } } });
    expect(out.warehouse).toEqual({ widthM: 54 });
  });
  test("warehouseLayout ว่าง -> สร้าง zones", () => {
    expect(applyZoneLayout(undefined, { z1: { 1: { x: 1 } } }))
      .toEqual({ zones: { z1: { layout: { 1: { x: 1 } } } } });
  });
});

describe("mergeZoneEntry", () => {
  test("patch เข้าโซน เก็บ key อื่น + โซนอื่นไม่ถูกแตะ", () => {
    const wl = { zones: { z1: { layout: { 1: {} } }, z2: { camera: {} } } };
    const out = mergeZoneEntry(wl, "z1", { camera: { fov: 60 } });
    expect(out.zones.z1).toEqual({ layout: { 1: {} }, camera: { fov: 60 } });
    expect(out.zones.z2).toEqual({ camera: {} });
  });
  test("warehouseLayout ว่าง -> สร้าง entry", () => {
    expect(mergeZoneEntry(undefined, "z1", { origin: { x: 1, z: 2 } }))
      .toEqual({ zones: { z1: { origin: { x: 1, z: 2 } } } });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/warehouse3d.test.ts`
Expected: FAIL — `applyZoneLayout is not a function` / `mergeZoneEntry is not a function`.

- [ ] **Step 3: Add the helpers**

In `src/utils/warehouse3d.js`, insert immediately after the `clearZoneLayout` function
(before the `// Lay out the given zones in a grid…` comment):

```js
// Merge per-zone drag layouts into warehouse_layout (used by the arrange-save). Pure.
export function applyZoneLayout(warehouseLayout, layoutByZone) {
  const next = { ...(warehouseLayout || {}) };
  const zones = { ...(next.zones || {}) };
  for (const zid of Object.keys(layoutByZone || {})) {
    zones[zid] = { ...(zones[zid] || {}), layout: layoutByZone[zid] };
  }
  next.zones = zones;
  return next;
}

// Merge a patch (e.g. {camera} or {origin,size,heightM}) into one zone's entry. Pure.
export function mergeZoneEntry(warehouseLayout, zoneId, patch) {
  const next = { ...(warehouseLayout || {}) };
  const zones = { ...(next.zones || {}) };
  zones[zoneId] = { ...(zones[zoneId] || {}), ...patch };
  next.zones = zones;
  return next;
}

```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/warehouse3d.test.ts`
Expected: PASS (all prior + 4 new cases).

- [ ] **Step 5: Commit**

```bash
git add src/utils/warehouse3d.js src/utils/warehouse3d.test.ts
git commit -m "feat(warehouse3d): applyZoneLayout + mergeZoneEntry pure helpers"
```

---

## Task 2: `saveNow` in App + expose via sh

**Files:**
- Modify: `src/App.jsx` — add `saveNow` after `saveKeyWithMerge` (~line 297); add to `sh` (line 429)

No unit test (touches Supabase/storage). Verified by build + Task 3 manual test.

- [ ] **Step 1: Add `saveNow`**

In `src/App.jsx`, find the end of `saveKeyWithMerge` (line ~296-297):

```js
    if(res?.error)console.warn("Save error:",sbKey,res.error);
  };
```

Insert directly after it:

```js
  // Persist one config key immediately (explicit 3D layout saves) instead of waiting
  // for the 800ms autosave debounce. Skips if the value is already the last-synced one.
  const saveNow=(sbKey,value)=>{
    const js=JSON.stringify(value);
    if(js===lastSyncedJsonRef.current[sbKey])return;
    saveData("v3_"+sbKey,value);
    saveKeyWithMerge(sbKey,value,js);
  };
```

- [ ] **Step 2: Expose `saveNow` in `sh`**

In `src/App.jsx` line 429, find `warehouseLayout,setWarehouseLayout,` inside the `sh`
object and change it to:

```js
warehouseLayout,setWarehouseLayout,saveNow,
```

- [ ] **Step 3: Build to confirm no error**

Run: `npm run build`
Expected: builds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat(app): saveNow for immediate config persist; expose via sh"
```

---

## Task 3: 3D callbacks persist immediately

**Files:**
- Modify: `src/components/Warehouse3D.jsx` — import (2), destructure (10), refs (after 14), callbacks (29-66)

No unit test (renders the WebGL scene). Verified by full suite + build + manual.

- [ ] **Step 1: Import the helpers**

In `src/components/Warehouse3D.jsx`, change line 2:

```js
import { buildWarehouseData, claudeDesignZones, clearZoneLayout } from "../utils/warehouse3d.js";
```

to:

```js
import { buildWarehouseData, claudeDesignZones, clearZoneLayout, applyZoneLayout, mergeZoneEntry } from "../utils/warehouse3d.js";
```

- [ ] **Step 2: Destructure `saveNow`**

In `src/components/Warehouse3D.jsx`, change line 10:

```js
  const { products, zones, setZones, warehouseLayout, setWarehouseLayout, canE } = sh;
```

to:

```js
  const { products, zones, setZones, warehouseLayout, setWarehouseLayout, saveNow, canE } = sh;
```

- [ ] **Step 3: Add latest-value refs**

In `src/components/Warehouse3D.jsx`, after the `rebuildNonce` line (14), add:

```js
  const whRef = useRef(warehouseLayout); whRef.current = warehouseLayout;
  const saveNowRef = useRef(saveNow); saveNowRef.current = saveNow;
```

- [ ] **Step 4: Rewrite the four callbacks**

In `src/components/Warehouse3D.jsx`, replace the whole block (lines 29-66 — the comment
through the end of `onSaveZoneGeom`):

```js
  // Persist with functional updates (no stale closure, stable identity).
  const onSaveLayout = useCallback((layoutByZone) => {
    setWarehouseLayout((prev) => {
      const next = { ...(prev || {}) };
      const zonesL = { ...(next.zones || {}) };
      for (const zid of Object.keys(layoutByZone)) {
        zonesL[zid] = { ...(zonesL[zid] || {}), layout: layoutByZone[zid] };
      }
      next.zones = zonesL;
      return next;
    });
  }, [setWarehouseLayout]);

  const onClearLayout = useCallback((zoneId) => {
    setWarehouseLayout((prev) => clearZoneLayout(prev, zoneId));
    setRebuildNonce((n) => n + 1);
  }, [setWarehouseLayout]);

  const onSaveCamera = useCallback((zoneId, camera) => {
    setWarehouseLayout((prev) => {
      const next = { ...(prev || {}) };
      const zonesL = { ...(next.zones || {}) };
      zonesL[zoneId] = { ...(zonesL[zoneId] || {}), camera };
      next.zones = zonesL;
      return next;
    });
  }, [setWarehouseLayout]);

  const onSaveZoneGeom = useCallback((zoneId, geom) => {
    setWarehouseLayout((prev) => {
      const next = { ...(prev || {}) };
      const zonesL = { ...(next.zones || {}) };
      zonesL[zoneId] = { ...(zonesL[zoneId] || {}), origin: geom.origin, size: geom.size };
      if (geom.heightM != null) zonesL[zoneId].heightM = geom.heightM;
      next.zones = zonesL;
      return next;
    });
  }, [setWarehouseLayout]);
```

with:

```js
  // Compute next from refs (latest), set state, and persist immediately via saveNow.
  // Refs are required because the scene caches these callbacks (it rebuilds only on
  // geometry/nonce, not on layout/camera saves), so a closure value would go stale.
  const onSaveLayout = useCallback((layoutByZone) => {
    const next = applyZoneLayout(whRef.current, layoutByZone);
    setWarehouseLayout(next); saveNowRef.current?.("warehouse_layout", next);
  }, [setWarehouseLayout]);

  const onClearLayout = useCallback((zoneId) => {
    const next = clearZoneLayout(whRef.current, zoneId);
    setWarehouseLayout(next); saveNowRef.current?.("warehouse_layout", next);
    setRebuildNonce((n) => n + 1);
  }, [setWarehouseLayout]);

  const onSaveCamera = useCallback((zoneId, camera) => {
    const next = mergeZoneEntry(whRef.current, zoneId, { camera });
    setWarehouseLayout(next); saveNowRef.current?.("warehouse_layout", next);
  }, [setWarehouseLayout]);

  const onSaveZoneGeom = useCallback((zoneId, geom) => {
    const patch = { origin: geom.origin, size: geom.size };
    if (geom.heightM != null) patch.heightM = geom.heightM;
    const next = mergeZoneEntry(whRef.current, zoneId, patch);
    setWarehouseLayout(next); saveNowRef.current?.("warehouse_layout", next);
  }, [setWarehouseLayout]);
```

- [ ] **Step 5: Run the full suite + build**

Run: `npm test`
Expected: PASS.

Run: `npm run build`
Expected: builds with no errors (only the pre-existing chunk-size warning).

- [ ] **Step 6: Commit**

```bash
git add src/components/Warehouse3D.jsx
git commit -m "feat(warehouse3d): persist layout/camera/geom/clear immediately via saveNow"
```

---

## Manual verification (after Task 3)

In the running app (localhost shares prod Supabase — this writes `warehouse_layout`, so
only with the user's go-ahead):

1. โกดัง 3D → ✋ จัดเรียง → drag a product → "บันทึกการจัดเรียงทั้งหมด".
2. Immediately refresh the page → the arrangement persists (no revert to before-move).
3. Optionally repeat with two consecutive drag-saves to confirm the second doesn't undo
   the first (ref-based latest value, not stale closure).

---

## Self-review notes

- **Spec coverage:** `saveNow` → Task 2; `applyZoneLayout`/`mergeZoneEntry` → Task 1;
  four callbacks compute-from-ref + setState + saveNow → Task 3; ref rationale (scene
  caches callbacks) → Task 3 Step 3/4 comment. `clearZoneLayout` reused (existing).
- **Names consistent:** `saveNow`, `applyZoneLayout`, `mergeZoneEntry`, `whRef`,
  `saveNowRef` used identically across App, helpers, and Warehouse3D.
- **No placeholders:** every step has concrete code/commands/expected output.
