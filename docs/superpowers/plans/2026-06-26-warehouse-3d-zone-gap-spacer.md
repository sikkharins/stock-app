# Zone gap / spacer items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user insert gap/spacer items (empty space, 10 cm per แถว) into a zone's left→right order; the 3D warehouse reserves that width and shows a faint floor marker.

**Architecture:** A gap is a sentinel id (`"gap-…"`) in `zone.productIds` with width in `boxConfig[gapId].cols` (each = 10 cm). Pure `isGapId`/`gapWidthM` helpers (in `boxPlan.js`) are shared by the scene (advance cursor + draw marker) and the editor (gap row + count). No merge/StockCount changes.

**Tech Stack:** React (JSX, inline styles), Vitest + @testing-library/react, three.js (scene, not unit-tested).

Spec: `docs/superpowers/specs/2026-06-26-warehouse-3d-zone-gap-spacer-design.md`

---

## Task 1: Pure `isGapId` + `gapWidthM` helpers

**Files:**
- Modify: `src/lib/warehouse3d/boxPlan.js` (add two exports after `orientBoxDims`)
- Test: `src/lib/warehouse3d/boxPlan.test.ts` (extend import on line 2; add a `describe`)

- [ ] **Step 1: Write the failing tests**

Change the import on line 2 of `src/lib/warehouse3d/boxPlan.test.ts` to add the two
names:

```ts
import { planBoxes, productColor, PRODUCT_PALETTE, REP_THRESHOLD, orientBoxDims, isGapId, gapWidthM } from "./boxPlan.js";
```

Append this block to the file:

```ts
describe("isGapId / gapWidthM", () => {
  it("isGapId: true เฉพาะ string ขึ้นต้น gap-", () => {
    expect(isGapId("gap-123-45")).toBe(true);
    expect(isGapId(5)).toBe(false);
    expect(isGapId("5")).toBe(false);
    expect(isGapId(undefined)).toBe(false);
  });
  it("gapWidthM: แต่ละแถว = 0.10 ม.", () => {
    expect(gapWidthM({ cols: 3 })).toBeCloseTo(0.30);
    expect(gapWidthM({})).toBeCloseTo(0.10);
    expect(gapWidthM(null)).toBeCloseTo(0.10);
    expect(gapWidthM({ cols: 0 })).toBeCloseTo(0.10);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/warehouse3d/boxPlan.test.ts`
Expected: FAIL — `isGapId is not a function` / `gapWidthM is not a function`.

- [ ] **Step 3: Add the helpers**

In `src/lib/warehouse3d/boxPlan.js`, insert after the `orientBoxDims` function
(right before the `// Distinct, readable swatch colours…` comment):

```js
// A gap/spacer entry in zone.productIds (reserved empty space, not a product).
export function isGapId(id) {
  return typeof id === "string" && id.startsWith("gap-");
}

// Gap width in metres from its boxConfig entry. Each แถว (cols) = 10 cm; min 1.
export function gapWidthM(cfg) {
  const cols = Math.max(1, Math.floor((cfg && cfg.cols) || 1));
  return cols * 0.10;
}

```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/warehouse3d/boxPlan.test.ts`
Expected: PASS (all prior + 2 new cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/warehouse3d/boxPlan.js src/lib/warehouse3d/boxPlan.test.ts
git commit -m "feat(warehouse3d): isGapId + gapWidthM helpers for spacer items"
```

---

## Task 2: Render gaps in the scene

**Files:**
- Modify: `src/lib/warehouse3d/scene.js:13` (import), `:480` (loop), `:621`+`:653` (popup count)

No unit test (WebGL path untested). Verification = full suite green + manual 3D check.

- [ ] **Step 1: Extend the boxPlan import**

In `src/lib/warehouse3d/scene.js`, change line 13 from:

```js
import { planBoxes, productColor, snapClampZoneRect, clampZoneHeight, orientBoxDims } from "./boxPlan.js";
```

to:

```js
import { planBoxes, productColor, snapClampZoneRect, clampZoneHeight, orientBoxDims, isGapId, gapWidthM } from "./boxPlan.js";
```

- [ ] **Step 2: Add the gap branch at the top of the product loop**

In `src/lib/warehouse3d/scene.js`, find (lines 480-482):

```js
    zone.productIds.forEach((pid) => {
      const p = productById[pid];
      if (!p) return;
```

Replace with:

```js
    zone.productIds.forEach((pid) => {
      if (isGapId(pid)) {
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
      }
      const p = productById[pid];
      if (!p) return;
```

(`curX`, `curZ`, `bandDepth`, `innerXMax`, `innerL`, `ox`, `MARGIN`, `GAP`, `group`,
`st`, `THREE` are all in scope from the lines above the loop. The gap is never added
to `pickables`/`productMeta`/`UNITS`/`OBSTACLES`, so it is not draggable and
`mpCopy` drag-save skips it.)

- [ ] **Step 3: Exclude gaps from the popup product count**

In `src/lib/warehouse3d/scene.js`, find (line 621):

```js
    const totalUnits = zone.productIds.reduce((s, pid) => s + (productById[pid]?.stock || 0), 0);
```

Add a line right after it:

```js
    const realCount = zone.productIds.filter((pid) => !isGapId(pid)).length;
```

Then find (line 653):

```js
        <div class="zp-head">สินค้า ${zone.productIds.length} รายการ · รวม ${totalUnits.toLocaleString()} ชิ้น</div>
```

and replace `${zone.productIds.length}` with `${realCount}`:

```js
        <div class="zp-head">สินค้า ${realCount} รายการ · รวม ${totalUnits.toLocaleString()} ชิ้น</div>
```

(The product-list `.map` already returns `""` for gaps via `if (!p) return ""`.)

- [ ] **Step 4: Run the full suite to confirm no regression**

Run: `npm test`
Expected: PASS (no test drives the WebGL path).

- [ ] **Step 5: Commit**

```bash
git add src/lib/warehouse3d/scene.js
git commit -m "feat(warehouse3d): render gap spacers as faint floor markers, advance cursor"
```

---

## Task 3: Gap items in the zone editor

**Files:**
- Modify: `src/components/Zones.jsx`
- Test: `src/components/Zones.test.tsx` (add one smoke case)

- [ ] **Step 1: Write the failing smoke test**

Append this test inside the existing `describe("ZonePage editor — ordered product
rows", ...)` block in `src/components/Zones.test.tsx`:

```tsx
  test("'+ ช่องว่าง' adds a gap row (10cm/แถว, excluded from count)", async () => {
    const user = userEvent.setup();
    render(<Harness initialZones={[{ id: "z1", name: "Z1", productIds: [1] }]} />);
    await openEditor(user);

    expect(screen.getByText("สินค้าที่ควรอยู่ในโซนนี้ (1)")).toBeTruthy();
    await user.click(screen.getByText("+ ช่องว่าง"));

    expect(screen.getByText("ช่องว่าง")).toBeTruthy();
    expect(screen.getByText("= 10 ซม.")).toBeTruthy();                  // default 1 แถว
    expect(screen.getByText("สินค้าที่ควรอยู่ในโซนนี้ (1)")).toBeTruthy(); // gap not counted

    const gapInput = screen.getByPlaceholderText("1") as HTMLInputElement; // gap แถว input
    await user.clear(gapInput);
    await user.type(gapInput, "3");
    expect(screen.getByText("= 30 ซม.")).toBeTruthy();

    const removes = screen.getAllByTitle("ลบ");
    await user.click(removes[removes.length - 1]);                       // gap is the last row
    expect(screen.queryByText("ช่องว่าง")).toBeNull();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/Zones.test.tsx`
Expected: FAIL — no "+ ช่องว่าง" button exists.

- [ ] **Step 3: Import `isGapId` and add the `addGap` handler**

In `src/components/Zones.jsx`, add to the imports (after the `ProductPicker` import
on line 4):

```js
import { isGapId } from "../lib/warehouse3d/boxPlan.js";
```

Add the `addGap` handler right after the existing `addProduct` (the
`const addProduct = (id) => { … };` block):

```js
  const addGap = () => setEditing((z) => {
    const gid = "gap-" + Date.now() + "-" + Math.floor(Math.random() * 1e6);
    return { ...z, productIds: [...z.productIds, gid], boxConfig: { ...(z.boxConfig || {}), [gid]: { cols: 1 } } };
  });
```

- [ ] **Step 4: Exclude gaps from the header count**

In `src/components/Zones.jsx`, change line 128 from:

```jsx
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>สินค้าที่ควรอยู่ในโซนนี้ ({editing.productIds.length})</div>
```

to:

```jsx
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>สินค้าที่ควรอยู่ในโซนนี้ ({editing.productIds.filter((id) => !isGapId(id)).length})</div>
```

- [ ] **Step 5: Branch the row on `isGapId` (gap row vs product row)**

In `src/components/Zones.jsx`, the row currently opens its variable content with
`{replacing === id ? ( … ) : ( … )}` (line 140). Wrap it in an outer gap check by
replacing the line:

```jsx
                  {replacing === id ? (
```

with:

```jsx
                  {isGapId(id) ? (
                    <>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--dim)" }}>ช่องว่าง</span>
                      <label style={{ fontSize: 11, color: "var(--dim)", display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                        แถว
                        <input type="number" min="1" value={cfg.cols ?? ""} placeholder="1" onChange={(e) => setBoxCfg(id, "cols", e.target.value)} style={numIB} />
                      </label>
                      <span style={{ fontSize: 11, color: "var(--dim)", flexShrink: 0 }}>= {(cfg.cols || 1) * 10} ซม.</span>
                      <button onClick={() => removeProduct(id)} title="ลบ" style={{ width: 20, height: 20, borderRadius: 10, border: "none", background: "var(--line2)", color: "var(--text)", cursor: "pointer", fontSize: 13, lineHeight: "20px", padding: 0, flexShrink: 0 }}>×</button>
                    </>
                  ) : replacing === id ? (
```

(This adds the gap branch and turns the existing `replacing` ternary into the
middle of a 3-way: gap → replace-mode → normal product. The closing `)}` on line
161 is unchanged.)

- [ ] **Step 6: Add the "+ ช่องว่าง" button after the add picker**

In `src/components/Zones.jsx`, find the add ProductPicker (line 166):

```jsx
          <ProductPicker value={pick} onChange={addProduct} products={products} pName={pN} getAvail={(pid) => { const p = products.find((x) => String(x.id) === String(pid)); return p ? p.stock : 0; }} unit="" avail={0} />
```

Add the button right after it:

```jsx
          <ProductPicker value={pick} onChange={addProduct} products={products} pName={pN} getAvail={(pid) => { const p = products.find((x) => String(x.id) === String(pid)); return p ? p.stock : 0; }} unit="" avail={0} />
          <button onClick={addGap} style={{ marginTop: 8, fontSize: 12, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--line2)", background: "var(--bg)", color: "var(--blue)", cursor: "pointer", fontFamily: "inherit" }}>+ ช่องว่าง</button>
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run src/components/Zones.test.tsx`
Expected: PASS (all prior cases + the new gap test).

- [ ] **Step 8: Run the full suite + build**

Run: `npm test`
Expected: PASS.

Run: `npm run build`
Expected: builds with no errors (only the pre-existing chunk-size warning).

- [ ] **Step 9: Commit**

```bash
git add src/components/Zones.jsx src/components/Zones.test.tsx
git commit -m "feat(zones): + ช่องว่าง spacer items (10cm per แถว) in zone editor"
```

---

## Manual verification (after Task 3)

In the running app (localhost shares prod Supabase — do NOT click บันทึก on real
data without permission; opening the editor draft and reading is fine):

1. Zones tab → edit a zone with products → click "+ ช่องว่าง". A row "ช่องว่าง" with
   a แถว input and "= 10 ซม." readout appears at the end; the "สินค้า (N)" count does
   not increase.
2. Reorder the gap with ‹ › so it sits between two products; set แถว to 3 (= 30 ซม.).
3. Warehouse 3D tab → between those products there is a faint floor patch ~30 cm
   wide, and the following products are pushed right by that width.

---

## Self-review notes

- **Spec coverage:** sentinel id + `boxConfig.cols` width → Task 3 (`addGap`) + Task 1
  helpers; `isGapId`/`gapWidthM` → Task 1; scene cursor advance + faint floor marker
  + not draggable → Task 2 Step 2; popup count excludes gaps → Task 2 Step 3; editor
  gap row + "+ ช่องว่าง" + header count → Task 3; AI/merge/drag-save unaffected →
  verified in spec, no code touched there.
- **Names consistent:** `isGapId`, `gapWidthM`, `addGap`, `"gap-"` prefix, `cols`
  width unit used identically across tasks; matches existing `boxConfig`/`cfg`/
  `setBoxCfg`/`removeProduct`/`moveProduct`.
- **No placeholders:** every step has concrete code/commands/expected output.
