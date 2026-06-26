# Zone box arrangement (order / rows / layers) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the zone editor set, per product, the left→right order plus แถว (boxes along the wall) and ชั้น (stack height); the 3D warehouse then places real boxes accordingly with depth auto-derived to fit stock.

**Architecture:** Per-product shape lives in a new `zone.boxConfig[pid] = { cols, layers }` map on the app zone (edited in the form, persisted with `zones`), kept separate from `zone.layout` (dragged position, stored in `warehouse_layout`). `planBoxes` honors `manualCols` (แถว) and a new `manualLayers` (ชั้น); depth = `ceil(stock/(cols×layers))`. Order stays as `zone.productIds` array order.

**Tech Stack:** React (JSX, plain inline styles), Vitest + @testing-library/react, three.js (scene, not unit-tested).

Spec: `docs/superpowers/specs/2026-06-26-warehouse-3d-zone-box-arrangement-design.md`

Terminology: แถว = scene `cols` (X, along wall) · ชั้น = scene `layers` (vertical) · depth = scene `rows` (Z, auto).

---

## Task 1: `planBoxes` honors ชั้น (manualLayers) with auto depth

**Files:**
- Modify: `src/lib/warehouse3d/boxPlan.js:14-43`
- Test: `src/lib/warehouse3d/boxPlan.test.ts` (append cases to existing `describe("planBoxes")`)

- [ ] **Step 1: Write the failing tests**

Add these `it(...)` cases inside the existing `describe("planBoxes", () => { ... })` block in `src/lib/warehouse3d/boxPlan.test.ts` (after the `manualCols` case at line 44):

```ts
  it("manualCols + manualLayers -> แถว/ชั้น คงที่ ลึกเติมอัตโนมัติให้จุครบ", () => {
    // stock 100, แถว(cols)=5, ชั้น(layers)=2 -> depth rows = ceil(100/(5*2)) = 10
    const p = planBoxes(BOX, ZONE, { stock: 100, manualCols: 5, manualLayers: 2 });
    expect(p.cols).toBe(5);
    expect(p.rows).toBe(10);
    expect(p.layers).toBe(2);
    expect(p.cols * p.rows * p.layers).toBeGreaterThanOrEqual(100);
  });

  it("ชั้น มากกว่าที่ stock เติมได้ -> layers จริงน้อยกว่าที่ขอ (ไม่พัง)", () => {
    // stock 4, แถว 3, ชั้น 3 -> depth = ceil(4/9)=1, perLayer=3, layers actual = ceil(4/3)=2
    const p = planBoxes(BOX, ZONE, { stock: 4, manualCols: 3, manualLayers: 3 });
    expect(p.cols).toBe(3);
    expect(p.rows).toBe(1);
    expect(p.layers).toBe(2);
  });

  it("manualLayers อย่างเดียว (ไม่ใส่แถว) -> cols auto, ชั้น เป็นเพดาน", () => {
    const p = planBoxes(BOX, ZONE, { stock: 100, manualLayers: 4 });
    expect(p.layers).toBeLessThanOrEqual(4);
    expect(p.cols).toBeGreaterThanOrEqual(1);
    expect(p.cols * p.rows * p.layers).toBeGreaterThanOrEqual(100);
  });

  it("แถว/ชั้น เกินขนาดโซน -> overflow true แต่วางครบ (honored exactly)", () => {
    const smallZone = { innerW: 1, innerL: 1, ceilingH: 1 };
    const p = planBoxes(BOX, smallZone, { stock: 50, manualCols: 10, manualLayers: 5 });
    expect(p.cols).toBe(10); // honored, not clamped to zone width
    expect(p.overflow).toBe(true);
    expect(p.cols * p.rows * p.layers).toBeGreaterThanOrEqual(50);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/warehouse3d/boxPlan.test.ts`
Expected: the 4 new cases FAIL (e.g. `manualCols + manualLayers` gets `rows` from the old auto math, not 10; `manualCols: 10` is clamped so `cols` is not 10). Existing cases still PASS.

- [ ] **Step 3: Rewrite `planBoxes` to honor `manualLayers`**

Replace the whole function body of `planBoxes` (lines 14-43) in `src/lib/warehouse3d/boxPlan.js` with:

```js
export function planBoxes(box, zone, opts = {}) {
  const { stock = 0, gap = 0.04, repThreshold = REP_THRESHOLD, manualCols = null, manualLayers = null } = opts;
  const layersMax = Math.max(1, Math.floor(zone.ceilingH / box.h));

  if (stock <= 0) {
    return { usePile: false, cols: 0, rows: 0, layers: 0, perLayer: 0, layersMax, footW: 0, footL: 0, overflow: false };
  }
  if (stock > repThreshold) {
    return { usePile: true, cols: 0, rows: 0, layers: 0, perLayer: 0, layersMax, footW: 0, footL: 0, overflow: false };
  }

  const pitchX = box.w + gap, pitchZ = box.l + gap;
  const maxCols = Math.max(1, Math.floor(zone.innerW / pitchX));
  const maxRows = Math.max(1, Math.floor(zone.innerL / pitchZ));
  const itemsPerLayer = Math.ceil(stock / layersMax);

  // cols (= แถว, boxes along the wall). Manual value honored exactly so the user's
  // count is never silently changed; overflow below flags it if it exceeds the zone.
  let cols;
  if (manualCols) cols = Math.max(1, Math.floor(manualCols));
  else cols = Math.min(Math.max(1, Math.round(Math.sqrt(itemsPerLayer))), maxCols);

  // rows (= depth, away from the wall). manualLayers fixes ชั้น, so depth fills to fit
  // stock; otherwise keep the original auto-rows behaviour.
  let rows;
  if (manualLayers) {
    const L = Math.max(1, Math.floor(manualLayers));
    rows = Math.max(1, Math.ceil(stock / (cols * L)));
  } else {
    rows = Math.min(Math.ceil(itemsPerLayer / cols), maxRows);
  }

  const perLayer = cols * rows;
  const layers = Math.ceil(stock / perLayer); // actual layers placed (<= requested ชั้น)
  const footW = cols * pitchX, footL = rows * pitchZ;
  const overflow = layers > layersMax || cols > maxCols || rows > maxRows;

  return { usePile: false, cols, rows, layers, perLayer, layersMax, footW, footL, overflow };
}
```

Note: in the auto path `cols`/`rows` are clamped to `maxCols`/`maxRows`, so the new
`cols > maxCols || rows > maxRows` overflow terms only ever fire for manual values —
auto-only zones keep the original `layers > layersMax` overflow behaviour unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/warehouse3d/boxPlan.test.ts`
Expected: PASS (all old + 4 new cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/warehouse3d/boxPlan.js src/lib/warehouse3d/boxPlan.test.ts
git commit -m "feat(warehouse3d): planBoxes honors manualLayers with auto depth"
```

---

## Task 2: Pass `boxConfig` through the zone merge

**Files:**
- Modify: `src/utils/warehouse3d.js:158` (inside the `baseZones.map` that builds `ZONES`)
- Test: `src/utils/warehouse3d.test.ts` (new `describe`)

- [ ] **Step 1: Write the failing tests**

Append to `src/utils/warehouse3d.test.ts`:

```ts
describe("buildWarehouseData — boxConfig passthrough", () => {
  test("carries boxConfig from the app zone into the scene zone", () => {
    const z = [{ id: "z1", productIds: [1], boxConfig: { 1: { cols: 3, layers: 2 } } }];
    const { ZONES } = build([product()], z, {});
    expect(ZONES[0].boxConfig).toEqual({ 1: { cols: 3, layers: 2 } });
  });

  test("omits boxConfig when the zone has none", () => {
    const { ZONES } = build([product()], [{ id: "z1", productIds: [1] }], {});
    expect(ZONES[0].boxConfig).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/warehouse3d.test.ts`
Expected: the first new test FAILS (`ZONES[0].boxConfig` is `undefined` — the merge drops it). The second already passes.

- [ ] **Step 3: Add the passthrough**

In `src/utils/warehouse3d.js`, find (line ~157-159):

```js
    if (saved.camera || z.camera) out.camera = saved.camera || z.camera;
    if (saved.layout || z.layout) out.layout = saved.layout || z.layout;
    return out;
```

Insert one line so it reads:

```js
    if (saved.camera || z.camera) out.camera = saved.camera || z.camera;
    if (saved.layout || z.layout) out.layout = saved.layout || z.layout;
    if (z.boxConfig) out.boxConfig = z.boxConfig; // per-product แถว/ชั้น from the form
    return out;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/warehouse3d.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/warehouse3d.js src/utils/warehouse3d.test.ts
git commit -m "feat(warehouse3d): pass zone.boxConfig through to the scene"
```

---

## Task 3: Feed `boxConfig` into `planBoxes` in the scene

**Files:**
- Modify: `src/lib/warehouse3d/scene.js:471-475`

No unit test — `scene.js` drives WebGL and is intentionally untested (see the header
comment in `boxPlan.js`). Verification is the full suite staying green plus a manual
3D check.

- [ ] **Step 1: Wire boxConfig into the planBoxes call**

In `src/lib/warehouse3d/scene.js`, find (lines 471-475):

```js
      const manual = zone.layout && zone.layout[pid] ? zone.layout[pid] : null;
      const pitchX = d.w + GAP, pitchZ = d.l + GAP;
      const plan = planBoxes(d, { innerW, innerL, ceilingH: zone.heightM }, {
        stock: p.stock, gap: GAP, manualCols: manual && manual.cols ? manual.cols : null,
      });
```

Replace with:

```js
      const manual = zone.layout && zone.layout[pid] ? zone.layout[pid] : null;
      const cfg = zone.boxConfig && zone.boxConfig[pid] ? zone.boxConfig[pid] : null;
      const pitchX = d.w + GAP, pitchZ = d.l + GAP;
      const plan = planBoxes(d, { innerW, innerL, ceilingH: zone.heightM }, {
        stock: p.stock, gap: GAP,
        manualCols: cfg && cfg.cols ? cfg.cols : null,
        manualLayers: cfg && cfg.layers ? cfg.layers : null,
      });
```

(`manual` is still used unchanged for the dragged-position branch later in the loop;
`boxConfig` only feeds the box plan, never positioning.)

- [ ] **Step 2: Run the full suite to confirm no regression**

Run: `npm test`
Expected: PASS (no test exercises the WebGL path; this confirms nothing else broke).

- [ ] **Step 3: Commit**

```bash
git add src/lib/warehouse3d/scene.js
git commit -m "feat(warehouse3d): scene reads boxConfig for per-SKU แถว/ชั้น"
```

---

## Task 4: Zone editor — ordered rows with แถว / ชั้น inputs

**Files:**
- Modify: `src/components/Zones.jsx`
- Test: `src/components/Zones.test.tsx` (new)

- [ ] **Step 1: Write the failing smoke test**

Create `src/components/Zones.test.tsx`:

```tsx
import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import ZonePage from "./Zones.jsx";

function Harness({ initialZones }: { initialZones: any[] }) {
  const [zones, setZones] = useState<any[]>(initialZones);
  // No brand: nameOf() = `${brand||""} ${pN(p)}`.trim(), so the row shows just "AAA"/"BBB".
  const products = [
    { id: 1, code: "P-1", name: "AAA", brand: "", stock: 10 },
    { id: 2, code: "P-2", name: "BBB", brand: "", stock: 20 },
  ];
  const sh: any = {
    zones, setZones, products,
    pN: (p: any) => p?.name ?? "—",
    canE: () => true,
  };
  return <ZonePage sh={sh} />;
}

const names = () =>
  screen.getAllByText(/^(AAA|BBB)$/).map((n) => n.textContent);

async function openEditor(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText("แก้ไข"));
}

describe("ZonePage editor — ordered product rows", () => {
  test("renders one ordered row per product with แถว/ชั้น inputs", async () => {
    const user = userEvent.setup();
    render(<Harness initialZones={[{ id: "z1", name: "Z1", productIds: [1, 2] }]} />);
    await openEditor(user);

    expect(screen.getByText("#1")).toBeTruthy();
    expect(screen.getByText("#2")).toBeTruthy();
    expect(screen.getAllByText("แถว").length).toBe(2);
    expect(screen.getAllByText("ชั้น").length).toBe(2);
    expect(names()).toEqual(["AAA", "BBB"]);
  });

  test("‹/› reorders products; ‹ disabled on first, › on last", async () => {
    const user = userEvent.setup();
    render(<Harness initialZones={[{ id: "z1", name: "Z1", productIds: [1, 2] }]} />);
    await openEditor(user);

    const leftBtns = screen.getAllByTitle("เลื่อนซ้าย") as HTMLButtonElement[];
    const rightBtns = screen.getAllByTitle("เลื่อนขวา") as HTMLButtonElement[];
    expect(leftBtns[0].disabled).toBe(true);
    expect(rightBtns[rightBtns.length - 1].disabled).toBe(true);

    await user.click(rightBtns[0]); // move AAA right
    expect(names()).toEqual(["BBB", "AAA"]);
  });

  test("typing แถว writes the input value (auto when empty)", async () => {
    const user = userEvent.setup();
    render(<Harness initialZones={[{ id: "z1", name: "Z1", productIds: [1] }]} />);
    await openEditor(user);

    const inputs = screen.getAllByPlaceholderText("auto") as HTMLInputElement[];
    expect(inputs.length).toBe(2); // แถว + ชั้น for the single product
    await user.type(inputs[0], "3");
    expect(inputs[0].value).toBe("3");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/Zones.test.tsx`
Expected: FAIL — the current editor renders chips, so `getByText("#1")`, `getAllByText("แถว")`, and `getByTitle("เลื่อนขวา")` are not found.

- [ ] **Step 3: Add style helpers + state helpers in `Zones.jsx`**

In `src/components/Zones.jsx`, add two module-level style helpers right after the `blank` definition (line 7):

```js
const numIB = { width: 46, boxSizing: "border-box", background: "var(--bg)", border: "1px solid var(--line2)", borderRadius: 6, padding: "4px 6px", fontSize: 12, color: "var(--text)", fontFamily: "inherit" };
const arrowBtn = (disabled) => ({ width: 22, height: 22, borderRadius: 6, border: "1px solid var(--line2)", background: "var(--bg)", color: disabled ? "var(--line2)" : "var(--blue)", cursor: disabled ? "default" : "pointer", fontFamily: "inherit", fontSize: 14, lineHeight: "18px", padding: 0 });
```

Then, inside the component, replace the existing `removeProduct` (line 41) with a
version that also clears the product's `boxConfig`, and add `moveProduct` +
`setBoxCfg` next to it:

```js
  const removeProduct = (id) => setEditing((z) => {
    const boxConfig = { ...(z.boxConfig || {}) };
    delete boxConfig[String(id)];
    return { ...z, productIds: z.productIds.filter((x) => String(x) !== String(id)), boxConfig };
  });
  const moveProduct = (idx, dir) => setEditing((z) => {
    const arr = [...z.productIds];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return z;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    return { ...z, productIds: arr };
  });
  const setBoxCfg = (id, key, raw) => setEditing((z) => {
    const n = parseInt(raw, 10);
    const cur = { ...(z.boxConfig || {}) };
    const entry = { ...(cur[String(id)] || {}) };
    if (raw === "" || !Number.isFinite(n) || n < 1) delete entry[key];
    else entry[key] = n;
    if (Object.keys(entry).length) cur[String(id)] = entry;
    else delete cur[String(id)];
    return { ...z, boxConfig: cur };
  });
```

- [ ] **Step 4: Replace the product chip list with ordered rows**

In `src/components/Zones.jsx`, replace the chip block (lines 71-79, the
`<div style={{ ... flexWrap: "wrap" ... }}>…</div>` that maps `editing.productIds`)
with:

```jsx
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
            {editing.productIds.length === 0 && <span style={{ fontSize: 12.5, color: "var(--dim)" }}>ยังไม่ได้ผูกสินค้า</span>}
            {editing.productIds.map((id, idx) => {
              const cfg = (editing.boxConfig || {})[String(id)] || {};
              return (
                <div key={String(id)} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg2)", border: "1px solid var(--line)", borderRadius: 8, padding: "6px 8px" }}>
                  <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                    <button onClick={() => moveProduct(idx, -1)} disabled={idx === 0} title="เลื่อนซ้าย" style={arrowBtn(idx === 0)}>‹</button>
                    <button onClick={() => moveProduct(idx, 1)} disabled={idx === editing.productIds.length - 1} title="เลื่อนขวา" style={arrowBtn(idx === editing.productIds.length - 1)}>›</button>
                  </div>
                  <span style={{ fontSize: 12, color: "var(--dim)", width: 24, textAlign: "center", flexShrink: 0 }}>#{idx + 1}</span>
                  <span style={{ flex: 1, fontSize: 12.5, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nameOf(id)}</span>
                  <label style={{ fontSize: 11, color: "var(--dim)", display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                    แถว
                    <input type="number" min="1" value={cfg.cols ?? ""} placeholder="auto" onChange={(e) => setBoxCfg(id, "cols", e.target.value)} style={numIB} />
                  </label>
                  <label style={{ fontSize: 11, color: "var(--dim)", display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                    ชั้น
                    <input type="number" min="1" value={cfg.layers ?? ""} placeholder="auto" onChange={(e) => setBoxCfg(id, "layers", e.target.value)} style={numIB} />
                  </label>
                  <button onClick={() => removeProduct(id)} title="ลบ" style={{ width: 20, height: 20, borderRadius: 10, border: "none", background: "var(--line2)", color: "var(--text)", cursor: "pointer", fontSize: 13, lineHeight: "20px", padding: 0, flexShrink: 0 }}>×</button>
                </div>
              );
            })}
          </div>
```

(`nameOf` is the existing helper at line 50; `numIB`/`arrowBtn` are the module-level
helpers from Step 3. No component is defined inside render, and no `useMemo` is
involved — consistent with the project's known React pitfalls.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/Zones.test.tsx`
Expected: PASS (all 3 cases).

- [ ] **Step 6: Run the full suite + build**

Run: `npm test`
Expected: PASS.

Run: `npm run build`
Expected: builds with no TypeScript/Vite errors (catches `.ts`-extension import
mistakes that vitest hides — see project note on TS import extensions).

- [ ] **Step 7: Commit**

```bash
git add src/components/Zones.jsx src/components/Zones.test.tsx
git commit -m "feat(zones): per-product order + แถว/ชั้น inputs in zone editor"
```

---

## Manual verification (after Task 4)

In the running app (note: localhost shares the prod Supabase — do not click
save/confirm on real data without permission; reading/zoning a test zone is fine):

1. Zones tab → edit a zone with a few products. Rows show `‹ › #n name แถว[] ชั้น[]`.
2. Use ‹/› to reorder; save.
3. Warehouse 3D tab → the products render left→right in the new order; a product with
   แถว=N, ชั้น=M shows N boxes wide along the wall, M high, depth filling to fit stock.
4. Leaving แถว/ชั้น blank renders like before (auto).
5. Setting แถว/ชั้น larger than the zone tints the zone as overflow but still places
   every unit.

---

## Self-review notes

- **Spec coverage:** order → `productIds` reorder (Task 4); แถว/ชั้น inputs → Task 4 +
  `boxConfig` plumbing (Tasks 2-3) + `planBoxes` math (Task 1); auto depth + overflow →
  Task 1; backward compat (no `boxConfig` = auto) → Task 1 auto path + Task 2 omit case.
- **Names consistent across tasks:** `boxConfig`, `{ cols, layers }`, `manualCols`,
  `manualLayers`, `moveProduct`, `setBoxCfg` used identically in every task.
- **No placeholders:** every code/test/command step is concrete.
