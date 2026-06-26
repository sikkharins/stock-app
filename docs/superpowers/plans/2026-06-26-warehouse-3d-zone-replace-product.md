# Zone replace-product-in-place Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user change which product occupies a row in the zone editor (by clicking its name) while keeping that row's order position and its แถว/ชั้น/orient settings.

**Architecture:** A pure `replaceProductId(zone, oldId, newId)` (exported from `Zones.jsx`) swaps the id in `productIds` in place and moves the `boxConfig` entry to the new id. The row's product name becomes a button; clicking it puts the row into "replace mode" (`replacing` state) showing an inline `ProductPicker` whose selection calls the transform.

**Tech Stack:** React (JSX, inline styles), Vitest + @testing-library/react.

Spec: `docs/superpowers/specs/2026-06-26-warehouse-3d-zone-replace-product-design.md`

---

## Task 1: Pure `replaceProductId` transform

**Files:**
- Modify: `src/components/Zones.jsx` (add exported fn after the style consts, before `export default function ZonePage`)
- Test: `src/components/Zones.test.tsx` (extend import on line 5; add a `describe`)

- [ ] **Step 1: Write the failing tests**

Change line 5 of `src/components/Zones.test.tsx`:

```tsx
import ZonePage from "./Zones.jsx";
```

to:

```tsx
import ZonePage, { replaceProductId } from "./Zones.jsx";
```

Then append this block to the end of `src/components/Zones.test.tsx`:

```tsx
describe("replaceProductId", () => {
  const zone = { id: "z1", productIds: [1, 2, 3], boxConfig: { 2: { cols: 3, layers: 5, orient: "wide" } } };

  it("แทนที่ในตำแหน่งเดิม + ย้าย boxConfig ไป id ใหม่", () => {
    const z = replaceProductId(zone, 2, 9);
    expect(z.productIds).toEqual([1, 9, 3]);
    expect(z.boxConfig).toEqual({ 9: { cols: 3, layers: 5, orient: "wide" } });
  });

  it("newId ซ้ำกับที่มีอยู่ในโซน -> คืนค่าเดิม", () => {
    expect(replaceProductId(zone, 2, 3)).toBe(zone);
  });

  it("newId == oldId -> คืนค่าเดิม", () => {
    expect(replaceProductId(zone, 2, 2)).toBe(zone);
  });

  it("id เดิมไม่มี boxConfig -> เปลี่ยนแค่ productIds", () => {
    const z = replaceProductId(zone, 1, 7);
    expect(z.productIds).toEqual([7, 2, 3]);
    expect(z.boxConfig).toEqual({ 2: { cols: 3, layers: 5, orient: "wide" } });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/Zones.test.tsx`
Expected: FAIL — `replaceProductId is not a function` (not exported yet). Existing
Zones tests still pass.

- [ ] **Step 3: Add the exported pure function**

In `src/components/Zones.jsx`, insert directly before
`export default function ZonePage({ sh }) {` (currently line 13):

```js
export function replaceProductId(zone, oldId, newId) {
  if (newId == null) return zone;
  if (String(newId) === String(oldId)) return zone;
  if ((zone.productIds || []).some((x) => String(x) === String(newId))) return zone;
  const productIds = (zone.productIds || []).map((x) => (String(x) === String(oldId) ? newId : x));
  const boxConfig = { ...(zone.boxConfig || {}) };
  if (boxConfig[String(oldId)]) {
    boxConfig[String(newId)] = boxConfig[String(oldId)];
    delete boxConfig[String(oldId)];
  }
  return { ...zone, productIds, boxConfig };
}

```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/Zones.test.tsx`
Expected: PASS (existing Zones smoke tests + 4 new `replaceProductId` cases).

- [ ] **Step 5: Commit**

```bash
git add src/components/Zones.jsx src/components/Zones.test.tsx
git commit -m "feat(zones): replaceProductId pure transform (keep slot + boxConfig)"
```

---

## Task 2: Wire click-to-replace into the editor row

**Files:**
- Modify: `src/components/Zones.jsx`
- Test: `src/components/Zones.test.tsx` (add one smoke case)

- [ ] **Step 1: Write the failing smoke test**

Append this test inside the existing `describe("ZonePage editor — ordered product
rows", ...)` block in `src/components/Zones.test.tsx`:

```tsx
  test("clicking a product name enters replace mode (extra picker shown, แถว/ชั้น hidden)", async () => {
    const user = userEvent.setup();
    render(<Harness initialZones={[{ id: "z1", name: "Z1", productIds: [1], boxConfig: { 1: { cols: 3 } } }]} />);
    await openEditor(user);

    const search = "ค้นหาสินค้า (ชื่อ/ยี่ห้อ/รหัส)...";
    expect(screen.getAllByPlaceholderText("auto").length).toBe(2);   // แถว + ชั้น visible
    expect(screen.getAllByPlaceholderText(search).length).toBe(1);   // only the bottom add picker

    await user.click(screen.getByTitle("คลิกเพื่อเปลี่ยนสินค้า"));
    expect(screen.getAllByPlaceholderText(search).length).toBe(2);   // inline replace picker added
    expect(screen.queryAllByPlaceholderText("auto").length).toBe(0); // row controls hidden in replace mode

    await user.click(screen.getByTitle("ยกเลิก"));
    expect(screen.getAllByPlaceholderText("auto").length).toBe(2);   // restored
    expect(screen.getAllByPlaceholderText(search).length).toBe(1);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/Zones.test.tsx`
Expected: FAIL — no element with `title="คลิกเพื่อเปลี่ยนสินค้า"` exists (name is a
plain span).

- [ ] **Step 3: Add `nameBtn` style + `replacing` state**

In `src/components/Zones.jsx`, add the `nameBtn` style after the `orientBtn`
definition (line 11):

```js
const nameBtn = { flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 0, color: "var(--text)", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
```

Add the `replacing` state right after the `pick` state:

```js
  const [pick, setPick] = useState(null);
  const [replacing, setReplacing] = useState(null);
```

- [ ] **Step 4: Reset replace mode on editor enter/leave**

In `src/components/Zones.jsx`, update the three handlers (lines 36-38) and the end
of `save` (line 80) to also clear `replacing`:

```js
  const startAdd = () => { setEditing(blank()); setPick(null); setReplacing(null); };
  const startEdit = (z) => { setEditing({ ...z, productIds: [...(z.productIds || [])] }); setPick(null); setReplacing(null); };
  const cancel = () => { setEditing(null); setPick(null); setReplacing(null); };
```

And in `save`, change:

```js
    setEditing(null); setPick(null);
```

to:

```js
    setEditing(null); setPick(null); setReplacing(null);
```

- [ ] **Step 5: Add the `replaceProduct` handler**

In `src/components/Zones.jsx`, insert after the `toggleOrient` helper (right before
the blank line preceding `const save = () => {`):

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

- [ ] **Step 6: Render replace mode in the row**

In `src/components/Zones.jsx`, replace the name span through the remove button
(lines 116-126) — i.e. from `<span style={{ flex: 1, fontSize: 12.5, ...` down to
the `×` `</button>` — with this conditional block:

```jsx
                  {replacing === id ? (
                    <>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <ProductPicker value={id} onChange={(nid) => replaceProduct(id, nid)} products={products} pName={pN} getAvail={(pid) => { const p = products.find((x) => String(x.id) === String(pid)); return p ? p.stock : 0; }} unit="" avail={0} />
                      </div>
                      <button onClick={() => setReplacing(null)} title="ยกเลิก" style={orientBtn}>ยกเลิก</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setReplacing(id)} title="คลิกเพื่อเปลี่ยนสินค้า" style={nameBtn}>{nameOf(id)}</button>
                      <label style={{ fontSize: 11, color: "var(--dim)", display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                        แถว
                        <input type="number" min="1" value={cfg.cols ?? ""} placeholder="auto" onChange={(e) => setBoxCfg(id, "cols", e.target.value)} style={numIB} />
                      </label>
                      <label style={{ fontSize: 11, color: "var(--dim)", display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                        ชั้น
                        <input type="number" min="1" value={cfg.layers ?? ""} placeholder="auto" onChange={(e) => setBoxCfg(id, "layers", e.target.value)} style={numIB} />
                      </label>
                      <button onClick={() => toggleOrient(id)} title="ด้านที่ขนานกำแพง" style={orientBtn}>{cfg.orient === "wide" ? "กว้าง" : "ยาว"}</button>
                      <button onClick={() => removeProduct(id)} title="ลบ" style={{ width: 20, height: 20, borderRadius: 10, border: "none", background: "var(--line2)", color: "var(--text)", cursor: "pointer", fontSize: 13, lineHeight: "20px", padding: 0, flexShrink: 0 }}>×</button>
                    </>
                  )}
```

(The `‹ › #n` prefix on lines 111-115 stays unchanged, before this block.)

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run src/components/Zones.test.tsx`
Expected: PASS (all prior cases + the new replace-mode smoke test).

- [ ] **Step 8: Run the full suite + build**

Run: `npm test`
Expected: PASS.

Run: `npm run build`
Expected: builds with no errors (only the pre-existing chunk-size warning).

- [ ] **Step 9: Commit**

```bash
git add src/components/Zones.jsx src/components/Zones.test.tsx
git commit -m "feat(zones): click product name to replace it in place, keeping arrangement"
```

---

## Manual verification (after Task 2)

In the running app (localhost shares prod Supabase — do NOT click บันทึก on real
data without permission; opening the editor draft and reading is fine):

1. Zones tab → edit a zone with products. Click a product's name → the row shows a
   search picker plus a "ยกเลิก" button; the แถว/ชั้น/ยาว-กว้าง controls hide.
2. Pick a different product → the row keeps its position (#n) and its แถว/ชั้น/orient
   values now apply to the new product.
3. Picking a product already in the zone → alert "สินค้านี้อยู่ในโซนนี้แล้ว".
4. "ยกเลิก" restores the row unchanged.

---

## Self-review notes

- **Spec coverage:** `replaceProductId` transform (in-place + move boxConfig + dup/same
  guards) → Task 1; click-name trigger, `replacing` state, inline picker + ยกเลิก,
  dup alert, reset on enter/leave → Task 2; backward-compat (name span→button, same
  text) → covered by existing tests still passing in Task 1/2 runs.
- **Names consistent:** `replaceProductId`, `replaceProduct`, `replacing`/`setReplacing`,
  `nameBtn` used identically across tasks; `boxConfig`/`cfg`/`orient` match prior features.
- **No placeholders:** every step has concrete code/commands/expected output.
