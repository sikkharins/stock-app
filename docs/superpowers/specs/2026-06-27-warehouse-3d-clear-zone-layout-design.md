# 3D zone — "จัดอัตโนมัติ" (clear manual drag layout)

Date: 2026-06-27
Status: approved (design)

## Goal

Add a per-zone "↺ จัดอัตโนมัติ" button in the 3D zone list that clears a zone's saved
manual drag arrangement (`warehouse_layout.zones[id].layout`), so the zone reverts to
automatic placement (flow-axis + arrangeRot + auto wall-anchor). Needed because any
zone that was drag-arranged and saved keeps fixed per-product positions that bypass
all the auto features.

## Background

In `scene.js`, each product uses a manual position when `zone.layout[pid]` exists:

```js
const manual = zone.layout && zone.layout[pid] ? zone.layout[pid] : null;
if (manual) { bx = ox + manual.x; bz = oz + manual.z; rotRad = -(manual.rot)…; }
else { /* placeInBand + arrange (auto) */ }
```

`zone.layout` is `warehouse_layout.zones[id].layout`, written by the existing "💾
บันทึกการจัดเรียง" (`onSaveLayout`). Once present, auto-anchor/arrangeRot/flow-axis are
ignored for that zone. There is currently no way to clear it. Removing a product and
re-adding does NOT help — `layout` is keyed by product id, and the same product keeps
the same id.

`Warehouse3D.jsx` `rebuildKey` deliberately excludes `layout` (so drag-saves don't
rebuild the scene), so clearing alone won't refresh the view — a rebuild must be
forced.

## Pure helper (new, in `src/utils/warehouse3d.js`)

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

Only `layout` is removed; `camera`, `origin`, `size`, `heightM` on the same zone entry
are preserved.

## React wiring (`src/components/Warehouse3D.jsx`)

- Import `clearZoneLayout`; add `useState` to the React import.
- Add `const [rebuildNonce, setRebuildNonce] = useState(0);`.
- Include the nonce in `rebuildKey` (`n: rebuildNonce`) and its dependency array, so a
  clear forces one scene rebuild even though `layout` is not otherwise in the key.
- New callback:

```js
  const onClearLayout = useCallback((zoneId) => {
    setWarehouseLayout((prev) => clearZoneLayout(prev, zoneId));
    setRebuildNonce((n) => n + 1);
  }, [setWarehouseLayout]);
```

- Pass to the scene: `onClearLayout: canEdit ? onClearLayout : null` (next to the other
  `onSave*` callbacks).

## Scene (`src/lib/warehouse3d/scene.js`)

- Destructure `onClearLayout` from the options object (alongside `onSaveLayout` etc.).
- In the zone-row build, add a button **only when** `canEdit && onClearLayout &&
  zone.layout`:

```js
const autoBtn = (canEdit && onClearLayout && zone.layout)
  ? `<button class="zr-cam zr-auto">↺ จัดอัตโนมัติ</button>` : ``;
```

  and render it in the actions row: `<div class="zr-actions">${camBtns}${autoBtn}</div>`.
- Wire it (modeled on the existing `.zr-save` handler), with a confirm:

```js
const autoBtn = row.querySelector(".zr-auto");
if (autoBtn) autoBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  if (window.confirm("ล้างตำแหน่งที่ลากเองของโซนนี้ แล้วกลับไปจัดอัตโนมัติ?")) onClearLayout(zone.id);
});
```

Reuses the existing `.zr-cam` button style.

## Data flow

Click ↺ → confirm → `onClearLayout(zoneId)` → `setWarehouseLayout(clearZoneLayout(...))`
(persists, drops `layout`) + `setRebuildNonce(+1)` → `rebuildKey` changes → effect
re-runs `buildWarehouseData` (merge yields no `layout` for the zone) → scene rebuilds
→ products place via the auto path (flow-axis + arrangeRot + auto wall-anchor).

## Backward compatibility

- Zones without a manual layout never show the button (`zone.layout` falsy).
- "💾 บันทึกการจัดเรียง" still works (writes `layout` again); the nonce only changes on
  clear, so normal drag-saves still don't force a rebuild.
- `arrangeRot`, `boxConfig`, camera, geometry untouched.

## Edge cases

- `clearZoneLayout` on a zone with no layout / no entry returns the same reference →
  no state churn, no rebuild.
- A zone entry that held only `layout` is removed entirely (kept tidy); entries that
  also hold camera/geometry keep those.

## Testing

- **Unit (`warehouse3d`)** `clearZoneLayout`:
  - removes `layout`, keeps sibling keys (`camera`) on the same zone entry.
  - drops the whole entry when it held only `layout`.
  - returns the same reference when the zone has no `layout` (and when the zone entry
    is absent).
- **Manual (after build):** a zone with a saved drag arrangement shows "↺ จัดอัตโนมัติ";
  clicking it (confirm) clears the manual layout and the products immediately
  re-arrange automatically (e.g. F/G snap to the z=30 wall). Zones without a saved
  layout do not show the button. (Clicking writes to prod `warehouse_layout` — only do
  it with the user's go-ahead, since it is exactly the F/G fix they want.)

## Out of scope

- A global "clear all zones' layouts" button.
- Undo of a clear (re-arrange + save restores it).
- Clearing `arrangeRot`/`boxConfig` (this only clears dragged positions).
