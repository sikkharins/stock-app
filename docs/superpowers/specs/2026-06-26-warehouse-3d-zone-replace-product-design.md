# Zone editor — replace a product in place, keeping its arrangement

Date: 2026-06-26
Status: approved (design)

## Goal

In the zone editor, let the user change **which product** occupies a row while
keeping that row's **order position** and its arrangement settings (แถว `cols`,
ชั้น `layers`, orientation `orient`). Triggered by clicking the product name in
the row.

Extends [[2026-06-26-warehouse-3d-zone-box-arrangement-design]] and
[[2026-06-26-warehouse-3d-zone-box-orientation-design]].

## Background

A zone holds `productIds: [id, ...]` (order = array order) and
`boxConfig[pid] = { cols?, layers?, orient? }` keyed **by product id**. Today the
only way to change a row's product is remove (which deletes its `boxConfig`) then
add (which appends at the end with no config) — losing both position and settings.

## Data transform (pure)

Add an exported pure function in `src/components/Zones.jsx`:

```js
export function replaceProductId(zone, oldId, newId) {
  if (newId == null) return zone;
  if (String(newId) === String(oldId)) return zone;                       // same product
  if ((zone.productIds || []).some((x) => String(x) === String(newId)))   // already in zone
    return zone;
  const productIds = (zone.productIds || []).map((x) =>
    String(x) === String(oldId) ? newId : x);                             // in-place, order kept
  const boxConfig = { ...(zone.boxConfig || {}) };
  if (boxConfig[String(oldId)]) {
    boxConfig[String(newId)] = boxConfig[String(oldId)];                  // move แถว/ชั้น/orient
    delete boxConfig[String(oldId)];
  }
  return { ...zone, productIds, boxConfig };
}
```

- Returns the **same** zone unchanged when `newId` is null, equals `oldId`, or is
  already present elsewhere in the zone (duplicates are not created).
- Preserves array position (`map`, not remove+push).
- Moves the `boxConfig` entry to the new id; if the old id had none, only
  `productIds` changes.

## UI changes (`src/components/Zones.jsx`)

- New state: `const [replacing, setReplacing] = useState(null)` — the product id of
  the row currently being replaced (`null` = none).
- Each product row's name becomes a **button** (`title="คลิกเพื่อเปลี่ยนสินค้า"`,
  styled flat/text via a new `nameBtn` style). Clicking it sets `replacing = id`.
- When `replacing === id`, the row renders, in place of the name + แถว/ชั้น/orient/×
  controls: an inline `ProductPicker` (`value={id}`,
  `onChange={(nid) => replaceProduct(id, nid)}`, same `products`/`pName`/`getAvail`
  props as the add picker) plus a small **ยกเลิก** button that calls
  `setReplacing(null)`. The `‹ › #n` prefix stays visible.
- `replaceProduct(oldId, newId)` handler:

```js
  const replaceProduct = (oldId, newId) => {
    if (newId != null && String(newId) !== String(oldId)
        && editing.productIds.some((x) => String(x) === String(newId))) {
      window.alert("สินค้านี้อยู่ในโซนนี้แล้ว");
      return; // keep the picker open so they can choose another
    }
    setEditing((z) => replaceProductId(z, oldId, newId));
    setReplacing(null);
  };
```

- Reset replace mode on entering/leaving the editor: add `setReplacing(null)` to
  `startAdd`, `startEdit`, `cancel`, and `save` (next to the existing `setPick(null)`).

`nameBtn` style (module level, near `numIB`/`arrowBtn`/`orientBtn`):

```js
const nameBtn = { flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 0, color: "var(--text)", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
```

## Data flow

Click name → `replacing = id` → inline `ProductPicker` → select `newId` →
`replaceProduct` → `replaceProductId` transform → `setEditing` updates draft →
`save()` persists `productIds` + `boxConfig` as today. The 3D scene already reads
`productIds` (order) and `boxConfig[pid]` (arrangement), so the replaced product
renders in the same slot with the same แถว/ชั้น/orient. No scene/merge changes.

## Backward compatibility

- The name turning from a `<span>` into a `<button>` keeps the same text content;
  existing behaviour (reorder, แถว/ชั้น, orientation, remove) is unchanged.
- Removing a product still deletes its `boxConfig` (existing `removeProduct`).

## Edge cases

- Select the same product → no change (transform returns same zone), picker closes.
- Select a product already in the zone → alert, no change, picker stays open.
- Old row had no `boxConfig` → only `productIds` is updated.
- Replace while a product is mid-other-state: `replacing` resets on editor
  enter/leave so a stale id never reopens a picker in a different zone.

## Testing

- **Unit (`replaceProductId`)** in `src/components/Zones.test.tsx`:
  - replaces id in place (order preserved) and moves `boxConfig` to the new id.
  - `newId` already in zone → returns same zone.
  - `newId === oldId` → returns same zone.
  - old id had no `boxConfig` → `productIds` updated, `boxConfig` unaffected.
- **Smoke (`Zones`)**: clicking a product name enters replace mode — the
  ProductPicker search input (`placeholder` "ค้นหาสินค้า (ชื่อ/ยี่ห้อ/รหัส)...")
  appears and the row's แถว/ชั้น inputs are hidden; clicking ยกเลิก restores the row.

## Out of scope

- Bulk replace / multi-select.
- Changing arrangement defaults; orientation and แถว/ชั้น semantics are unchanged.
- Filtering already-in-zone products out of the picker list (handled by the
  duplicate guard + alert instead).
