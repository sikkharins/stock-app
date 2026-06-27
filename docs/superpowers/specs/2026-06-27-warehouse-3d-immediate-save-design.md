# 3D warehouse — persist layout saves immediately (no 800ms gap)

Date: 2026-06-27
Status: approved (design)

## Goal

Make the 3D warehouse's explicit `warehouse_layout` writes (arrange-save, camera-save,
zone-geometry-save, clear-to-auto) persist to Supabase **immediately** instead of
waiting for the 800ms autosave debounce. Fixes: drag → "บันทึกการจัดเรียงทั้งหมด" →
quick refresh currently reverts because the change is still only in memory.

## Background (root cause)

Today `Warehouse3D` callbacks call `setWarehouseLayout(...)` (in-memory only). The only
persistence is App's autosave `useEffect` ([App.jsx](src/App.jsx)): an 800ms debounce
that diffs dirty keys, writes localStorage, and async-saves to Supabase via
`saveKeyWithMerge`. The `beforeunload` flush only covers an **in-flight** batch
(`pendingSaveRef`), not the pending debounce. So a refresh within ~800ms of an explicit
save loses it. (Confirmed: zones with older saves have full persisted layout; the
save→reload roundtrip itself is correct.)

## Design

### App.jsx — expose `saveNow(sbKey, value)`

A plain function defined in the component body (recreated each render, so it closes over
the current `saveKeyWithMerge`), added to the `sh` object:

```js
const saveNow = (sbKey, value) => {
  const js = JSON.stringify(value);
  if (js === lastSyncedJsonRef.current[sbKey]) return; // already persisted
  saveData("v3_" + sbKey, value);     // localStorage immediately (sync)
  saveKeyWithMerge(sbKey, value, js); // push to Supabase now (version-guarded)
};
```

- Reuses the existing optimistic-locked `saveKeyWithMerge` (updates
  `lastSynced*`/`versionsRef` on success).
- The debounced autosave is unchanged; once `saveNow` lands, the next debounce sees
  `warehouse_layout` not-dirty and skips it. If the debounce fires before `saveNow`'s
  async write resolves, both write the same value under version guard / last-write-wins
  — harmless.

### utils/warehouse3d.js — pure helpers

Extract the `warehouse_layout` mutations (currently inline in the callbacks) so they are
testable and reusable by both the state update and the immediate save:

```js
// Merge per-zone drag layouts into warehouse_layout (used by the arrange-save).
export function applyZoneLayout(warehouseLayout, layoutByZone) {
  const next = { ...(warehouseLayout || {}) };
  const zones = { ...(next.zones || {}) };
  for (const zid of Object.keys(layoutByZone || {})) {
    zones[zid] = { ...(zones[zid] || {}), layout: layoutByZone[zid] };
  }
  next.zones = zones;
  return next;
}

// Merge a patch (e.g. {camera} or {origin,size,heightM}) into one zone's entry.
export function mergeZoneEntry(warehouseLayout, zoneId, patch) {
  const next = { ...(warehouseLayout || {}) };
  const zones = { ...(next.zones || {}) };
  zones[zoneId] = { ...(zones[zoneId] || {}), ...patch };
  next.zones = zones;
  return next;
}
```

`clearZoneLayout` (existing) is the third mutation.

### Warehouse3D.jsx — compute next (from refs), set state, save now

**Why refs:** the scene caches these callbacks — `createWarehouseScene` is only re-run
on `rebuildKey`/`canEdit` changes, and `rebuildKey` excludes `layout`/`camera`. So after
a layout/camera save (no rebuild) the scene still holds the *previous* callback. Reading
the next value from the callback's **closure** `warehouseLayout` would then be stale on a
second save and clobber the first. To stay correct (matching today's functional-updater
behaviour) the callbacks read the latest value from refs and are stable (`useCallback`
with `[]`).

```js
const { …, warehouseLayout, setWarehouseLayout, saveNow, canE } = sh;

// Latest-value refs so the (scene-cached) callbacks never read stale state.
const whRef = useRef(warehouseLayout); whRef.current = warehouseLayout;
const saveNowRef = useRef(saveNow); saveNowRef.current = saveNow;

const onSaveLayout = useCallback((layoutByZone) => {
  const next = applyZoneLayout(whRef.current, layoutByZone);
  setWarehouseLayout(next); saveNowRef.current?.("warehouse_layout", next);
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

const onClearLayout = useCallback((zoneId) => {
  const next = clearZoneLayout(whRef.current, zoneId);
  setWarehouseLayout(next); saveNowRef.current?.("warehouse_layout", next);
  setRebuildNonce((n) => n + 1);
}, [setWarehouseLayout]);
```

(Imports `applyZoneLayout`, `mergeZoneEntry`, `clearZoneLayout` from `warehouse3d.js`.
The latest `warehouseLayout`/`saveNow` are read through `whRef`/`saveNowRef`, so the deps
stay minimal (`[setWarehouseLayout]`, which is stable) and the cached callbacks are
always correct.)

This replaces the previous functional-updater bodies; correctness is preserved by the
refs (always latest) rather than by `setWarehouseLayout(prev => …)`.

## Backward compatibility

- Other data (products, sales, …) keeps the existing 800ms autosave — untouched.
- The autosave still also covers `warehouse_layout` as a fallback (it just usually finds
  it already saved by `saveNow`).
- No data-model change; same `warehouse_layout` shape.

## Edge cases

- `saveNow` early-returns when the value already equals the last-synced JSON (no
  redundant write, e.g. clicking save twice).
- If `saveNow` is somehow absent (older `sh`), the `?.` no-ops and the debounce still
  persists (graceful degradation).
- `clearZoneLayout` returning the same reference (nothing to clear): `saveNow` sees
  unchanged JSON → skips; `setWarehouseLayout(next)` is a no-op state set.

## Testing

- **Unit (`warehouse3d`)**:
  - `applyZoneLayout`: merges `layout` for given zones, preserves existing zone keys
    (e.g. `camera`), creates the `zones` map when absent.
  - `mergeZoneEntry`: merges a patch into one zone entry, preserving other keys and other
    zones.
- **Manual (after build):** drag a product in arrange mode → "บันทึกการจัดเรียงทั้งหมด" →
  immediately refresh → the arrangement persists (no revert). (Writes prod
  `warehouse_layout` — only with the user's go-ahead.)

## Out of scope

- A global unload-flush of all pending debounced saves (option 2) — separate task.
- Changing the autosave debounce for non-3D data.
- Reading localStorage back on load to reconcile vs Supabase.
