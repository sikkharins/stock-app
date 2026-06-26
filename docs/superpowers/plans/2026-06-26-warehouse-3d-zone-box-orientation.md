# Zone box orientation (long/wide parallel to wall) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per product in a zone, choose whether the carton's ยาว (length) or กว้าง (width) side runs parallel to the wall, defaulting to ยาวขนานกำแพง, so the 3D warehouse orients boxes correctly.

**Architecture:** A new pure `orientBoxDims(d, orient)` in `boxPlan.js` swaps the footprint `w`/`l` (default `"long"` = ยาว along the wall). `scene.js` orients `boxDims(p)` via the existing per-product `cfg = zone.boxConfig[pid]` before planning/drawing. The zone editor adds a per-row ยาว/กว้าง toggle writing `boxConfig[pid].orient` (`"wide"` stored, `"long"` = default/cleared).

**Tech Stack:** React (JSX, inline styles), Vitest + @testing-library/react, three.js (scene, not unit-tested).

Spec: `docs/superpowers/specs/2026-06-26-warehouse-3d-zone-box-orientation-design.md`

Terms: `boxDims` → `{ w: widthCm/100 (กว้าง), l: lengthCm/100 (ยาว), h: heightCm/100 }`. `planBoxes` uses `box.w` along the wall (X), `box.l` for depth (Z).

---

## Task 1: Pure `orientBoxDims` helper

**Files:**
- Modify: `src/lib/warehouse3d/boxPlan.js` (add export; place after `planBoxes`, before `PRODUCT_PALETTE`)
- Test: `src/lib/warehouse3d/boxPlan.test.ts` (new `describe`; extend the import on line 2)

- [ ] **Step 1: Write the failing tests**

Edit the import on line 2 of `src/lib/warehouse3d/boxPlan.test.ts` to add `orientBoxDims`:

```ts
import { planBoxes, productColor, PRODUCT_PALETTE, REP_THRESHOLD, orientBoxDims } from "./boxPlan.js";
```

Then append this block to the file:

```ts
describe("orientBoxDims", () => {
  const d = { w: 0.4, l: 0.8, h: 1.2 };
  it('"long" (default) วางยาวขนานกำแพง -> สลับ w/l', () => {
    expect(orientBoxDims(d, "long")).toEqual({ w: 0.8, l: 0.4, h: 1.2 });
  });
  it("ไม่ระบุ orient -> default long (สลับ)", () => {
    expect(orientBoxDims(d, undefined)).toEqual({ w: 0.8, l: 0.4, h: 1.2 });
  });
  it('"wide" -> คงเดิม (กว้างขนานกำแพง)', () => {
    expect(orientBoxDims(d, "wide")).toEqual({ w: 0.4, l: 0.8, h: 1.2 });
  });
  it("คง h เสมอ", () => {
    expect(orientBoxDims(d, "wide").h).toBe(1.2);
    expect(orientBoxDims(d, "long").h).toBe(1.2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/warehouse3d/boxPlan.test.ts`
Expected: FAIL — `orientBoxDims` is not exported (`orientBoxDims is not a function`). Existing cases still pass.

- [ ] **Step 3: Add the helper**

In `src/lib/warehouse3d/boxPlan.js`, insert after the closing `}` of `planBoxes`
(line 43) and before `// Distinct, readable swatch colours…`:

```js
// Orient a box footprint relative to the wall (X = along the wall, Z = depth).
//   "long"  (default): ยาว (l) runs along the wall  -> swap w/l
//   "wide"           : กว้าง (w) runs along the wall -> unchanged
export function orientBoxDims(d, orient) {
  if (orient === "wide") return { w: d.w, l: d.l, h: d.h };
  return { w: d.l, l: d.w, h: d.h };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/warehouse3d/boxPlan.test.ts`
Expected: PASS (all old + 4 new cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/warehouse3d/boxPlan.js src/lib/warehouse3d/boxPlan.test.ts
git commit -m "feat(warehouse3d): orientBoxDims pure helper (default long parallel to wall)"
```

---

## Task 2: Apply orientation in the scene

**Files:**
- Modify: `src/lib/warehouse3d/scene.js:13` (import) and `:468-472` (loop head)

No unit test (WebGL path is untested). Verification = full suite staying green +
Task 1's `orientBoxDims` unit coverage + manual 3D check.

- [ ] **Step 1: Add the import**

In `src/lib/warehouse3d/scene.js`, change line 13 from:

```js
import { planBoxes, productColor, snapClampZoneRect, clampZoneHeight } from "./boxPlan.js";
```

to:

```js
import { planBoxes, productColor, snapClampZoneRect, clampZoneHeight, orientBoxDims } from "./boxPlan.js";
```

- [ ] **Step 2: Compute `cfg` first and orient `d`**

In `src/lib/warehouse3d/scene.js`, find (lines 468-472):

```js
      const d = boxDims(p);
      const volPer = volumeOf(p);
      st.volProducts += volPer * p.stock;
      const manual = zone.layout && zone.layout[pid] ? zone.layout[pid] : null;
      const cfg = zone.boxConfig && zone.boxConfig[pid] ? zone.boxConfig[pid] : null;
```

Replace with (move `cfg` to the top, orient `d`, drop the now-duplicate `cfg`):

```js
      const cfg = zone.boxConfig && zone.boxConfig[pid] ? zone.boxConfig[pid] : null;
      const d = orientBoxDims(boxDims(p), cfg && cfg.orient ? cfg.orient : "long");
      const volPer = volumeOf(p);
      st.volProducts += volPer * p.stock;
      const manual = zone.layout && zone.layout[pid] ? zone.layout[pid] : null;
```

The following `pitchX`/`planBoxes` lines already reference `cfg` and `d` and stay
unchanged. `volumeOf(p)` uses raw product cm (orientation-independent).

- [ ] **Step 3: Run the full suite to confirm no regression**

Run: `npm test`
Expected: PASS (407 → still all passing; no test drives the WebGL path).

- [ ] **Step 4: Commit**

```bash
git add src/lib/warehouse3d/scene.js
git commit -m "feat(warehouse3d): scene orients boxes per boxConfig.orient (default long)"
```

---

## Task 3: Per-row orientation toggle in the zone editor

**Files:**
- Modify: `src/components/Zones.jsx`
- Test: `src/components/Zones.test.tsx` (add one case)

- [ ] **Step 1: Write the failing test**

Append this test inside the existing `describe("ZonePage editor — ordered product
rows", ...)` block in `src/components/Zones.test.tsx`:

```tsx
  test("orientation toggle defaults to ยาว and flips to กว้าง", async () => {
    const user = userEvent.setup();
    render(<Harness initialZones={[{ id: "z1", name: "Z1", productIds: [1] }]} />);
    await openEditor(user);

    const btn = screen.getByTitle("ด้านที่ขนานกำแพง") as HTMLButtonElement;
    expect(btn.textContent).toBe("ยาว");        // default long
    await user.click(btn);
    expect(btn.textContent).toBe("กว้าง");       // -> wide
    await user.click(btn);
    expect(btn.textContent).toBe("ยาว");        // -> back to default (key cleared)
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/Zones.test.tsx`
Expected: FAIL — no element with `title="ด้านที่ขนานกำแพง"` exists yet.

- [ ] **Step 3: Add the `orientBtn` style + `toggleOrient` helper**

In `src/components/Zones.jsx`, add to the module-level style helpers (right after
the `arrowBtn` definition near the top):

```js
const orientBtn = { minWidth: 40, height: 22, padding: "0 6px", borderRadius: 6, border: "1px solid var(--line2)", background: "var(--bg)", color: "var(--blue)", cursor: "pointer", fontFamily: "inherit", fontSize: 11, lineHeight: "20px" };
```

Then add this helper next to `setBoxCfg` inside the component:

```js
  const toggleOrient = (id) => setEditing((z) => {
    const cur = { ...(z.boxConfig || {}) };
    const entry = { ...(cur[String(id)] || {}) };
    if (entry.orient === "wide") delete entry.orient; // back to default "long"
    else entry.orient = "wide";
    if (Object.keys(entry).length) cur[String(id)] = entry;
    else delete cur[String(id)];
    return { ...z, boxConfig: cur };
  });
```

- [ ] **Step 4: Add the toggle button to each row**

In `src/components/Zones.jsx`, inside the product row, find the ชั้น label
immediately followed by the remove button:

```jsx
                  <label style={{ fontSize: 11, color: "var(--dim)", display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                    ชั้น
                    <input type="number" min="1" value={cfg.layers ?? ""} placeholder="auto" onChange={(e) => setBoxCfg(id, "layers", e.target.value)} style={numIB} />
                  </label>
                  <button onClick={() => removeProduct(id)} title="ลบ" style={{ width: 20, height: 20, borderRadius: 10, border: "none", background: "var(--line2)", color: "var(--text)", cursor: "pointer", fontSize: 13, lineHeight: "20px", padding: 0, flexShrink: 0 }}>×</button>
```

Insert the orientation toggle between the ชั้น `</label>` and the remove `<button>`:

```jsx
                  <label style={{ fontSize: 11, color: "var(--dim)", display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                    ชั้น
                    <input type="number" min="1" value={cfg.layers ?? ""} placeholder="auto" onChange={(e) => setBoxCfg(id, "layers", e.target.value)} style={numIB} />
                  </label>
                  <button onClick={() => toggleOrient(id)} title="ด้านที่ขนานกำแพง" style={orientBtn}>{cfg.orient === "wide" ? "กว้าง" : "ยาว"}</button>
                  <button onClick={() => removeProduct(id)} title="ลบ" style={{ width: 20, height: 20, borderRadius: 10, border: "none", background: "var(--line2)", color: "var(--text)", cursor: "pointer", fontSize: 13, lineHeight: "20px", padding: 0, flexShrink: 0 }}>×</button>
```

(`cfg` is the existing `const cfg = (editing.boxConfig || {})[String(id)] || {}`
already declared at the top of the row's `.map` callback.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/Zones.test.tsx`
Expected: PASS (all 4 cases).

- [ ] **Step 6: Run the full suite + build**

Run: `npm test`
Expected: PASS.

Run: `npm run build`
Expected: builds with no errors (only the pre-existing chunk-size warning).

- [ ] **Step 7: Commit**

```bash
git add src/components/Zones.jsx src/components/Zones.test.tsx
git commit -m "feat(zones): per-product ยาว/กว้าง orientation toggle in zone editor"
```

---

## Manual verification (after Task 3)

In the running app (localhost shares prod Supabase — do NOT click บันทึก on real
data without permission; opening the editor draft and reading is fine):

1. Zones tab → edit a zone with dimensioned products. Each row shows a ยาว/กว้าง
   toggle defaulting to "ยาว".
2. Warehouse 3D tab → with everything default, dimensioned products now sit with
   their long side along the wall (rotated 90° vs before); cube products unchanged.
3. Toggle a product to "กว้าง" → its box footprint rotates 90° in 3D.

---

## Self-review notes

- **Spec coverage:** data model `orient` → Task 3 (`toggleOrient`) + Task 2 (read);
  `orientBoxDims` default-long swap → Task 1; scene application + cfg-ordering fix →
  Task 2; UI toggle default "ยาว", stores "wide", clears on return → Task 3;
  backward-compat default flip → exercised by Task 1 default + Task 2 wiring.
- **Names consistent:** `orientBoxDims`, `orient`, `"wide"`/`"long"`, `toggleOrient`,
  `orientBtn`, `cfg` used identically across tasks and matching the prior
  arrangement feature's `boxConfig`/`cfg` names.
- **No placeholders:** every step has concrete code/commands/expected output.
