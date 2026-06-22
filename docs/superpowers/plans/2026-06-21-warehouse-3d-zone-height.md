# โกดัง 3D Phase E1 — เพดานต่อโซน Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้แต่ละโซนตั้งความสูงเพดานเองได้ (logic-only) — มีผลกับ stacking/overflow/fill% เก็บ `warehouse_layout.zones[id].heightM`

**Architecture:** เพิ่ม `heightM` ต่อโซน (saved > intrinsic > WAREHOUSE.heightM) ผ่าน bridge → scene.js ใช้ `zone.heightM` แทนค่ารวมที่ logic; เพิ่มช่อง "สูง" ในแผง "✥ แก้โซน" (Phase D) → `onSaveZoneGeom` พา heightM → rebuild

**Tech Stack:** React + Vite, three.js, vitest. แตะ `boxPlan.js`, `warehouse3d.js`, `Warehouse3D.jsx`, `scene.js`

อ่านประกอบ: spec `docs/superpowers/specs/2026-06-21-warehouse-3d-zone-height-design.md`

---

## File Structure
- **Modify** `src/lib/warehouse3d/boxPlan.js` (+test) — `clampZoneHeight()`
- **Modify** `src/utils/warehouse3d.js` (+test) — bridge `ZONES[].heightM`
- **Modify** `src/components/Warehouse3D.jsx` — onSaveZoneGeom merge heightM + rebuildKey.g
- **Modify** `src/lib/warehouse3d/scene.js` — ใช้ zone.heightM ที่ logic + ช่อง zeH
- **Temp (ห้าม commit)** `wh3d-dev.html`

## Gotchas
- localhost = Supabase prod — harness ใช้ onSaveZoneGeom stub, ห้ามกด "บันทึกโซน" ใน UI จริง
- เพดานโซน clamp ≤ WAREHOUSE.heightM (ไม่ทะลุหลังคาอาคาร) · โซนไม่มี heightM → fallback ค่ารวม
- commit/push ตรง master เมื่อสั่ง; chat ห้าม emoji; LF→CRLF ไม่เป็นไร; scene.js แก้โดยอ้างเนื้อโค้ด

---

### Task E1.1: `clampZoneHeight()` + test

**Files:** Modify `src/lib/warehouse3d/boxPlan.js`, Test `src/lib/warehouse3d/boxPlan.test.ts`

- [ ] **Step 1: เขียน test ที่ fail** — เพิ่มท้าย `boxPlan.test.ts`:
```ts
import { clampZoneHeight } from "./boxPlan.js";

describe("clampZoneHeight", () => {
  it("snap 0.5", () => { expect(clampZoneHeight(3.3, { heightM: 10 })).toBe(3.5); });
  it("ผ่านค่าพอดี", () => { expect(clampZoneHeight(3, { heightM: 10 })).toBe(3); });
  it("clamp สูงสุด = เพดานโกดัง", () => { expect(clampZoneHeight(20, { heightM: 10 })).toBe(10); });
  it("clamp ต่ำสุด = step", () => { expect(clampZoneHeight(0.1, { heightM: 10 })).toBe(0.5); });
  it("ไม่มีค่า → fallback เพดานโกดัง", () => { expect(clampZoneHeight(undefined, { heightM: 10 })).toBe(10); });
});
```

- [ ] **Step 2: รัน fail** — `npx vitest run src/lib/warehouse3d/boxPlan.test.ts` → FAIL (`clampZoneHeight is not a function`)

- [ ] **Step 3: implement** — เพิ่มท้าย `boxPlan.js`:
```js
// Snap a zone ceiling height to 0.5 m and clamp to (0.5 .. warehouse height]. Pure.
export function clampZoneHeight(h, warehouse, step = 0.5) {
  const max = warehouse.heightM;
  const v = Math.round((Number(h) || max) / step) * step;
  return Math.min(Math.max(v, step), max);
}
```

- [ ] **Step 4: รัน pass** — `npx vitest run src/lib/warehouse3d/boxPlan.test.ts` → PASS

- [ ] **Step 5: typecheck + commit**
```bash
npm run typecheck
git add src/lib/warehouse3d/boxPlan.js src/lib/warehouse3d/boxPlan.test.ts
git commit -m "feat(warehouse-3d): clampZoneHeight() per-zone ceiling snap/clamp"
```

---

### Task E1.2: bridge `ZONES[].heightM` + test

**Files:** Modify `src/utils/warehouse3d.js`, Test `src/utils/warehouse3d.test.ts`

- [ ] **Step 1: เขียน test ที่ fail** — เพิ่มท้าย `warehouse3d.test.ts`:
```ts
describe("buildWarehouseData — zone.heightM", () => {
  test("heightM: saved > intrinsic > fallback(warehouse)", () => {
    const zones = [{ id: "z1", productIds: [] }, { id: "z2", productIds: [], heightM: 6 }];
    const { ZONES, WAREHOUSE } = build([], zones, { zones: { z1: { heightM: 4 } } });
    expect(ZONES.find((z) => z.id === "z1").heightM).toBe(4);   // saved
    expect(ZONES.find((z) => z.id === "z2").heightM).toBe(6);   // intrinsic
    const { ZONES: Z2, WAREHOUSE: W2 } = build([], [{ id: "z3", productIds: [] }], {});
    expect(Z2.find((z) => z.id === "z3").heightM).toBe(W2.heightM); // fallback
  });
});
```

- [ ] **Step 2: รัน fail** — `npx vitest run src/utils/warehouse3d.test.ts` → FAIL (heightM undefined)

- [ ] **Step 3: implement** — ใน `warehouse3d.js` หา:
```js
      productIds: Array.isArray(z.productIds) ? z.productIds : [],
      presets: Array.isArray(z.presets) ? z.presets : [],
    };
```
แทนด้วย:
```js
      productIds: Array.isArray(z.productIds) ? z.productIds : [],
      presets: Array.isArray(z.presets) ? z.presets : [],
      heightM: Number(saved.heightM) || Number(z.heightM) || WAREHOUSE.heightM,
    };
```

- [ ] **Step 4: รัน pass** — `npx vitest run src/utils/warehouse3d.test.ts` → PASS

- [ ] **Step 5: typecheck + commit**
```bash
npm run typecheck
git add src/utils/warehouse3d.js src/utils/warehouse3d.test.ts
git commit -m "feat(warehouse-3d): carry per-zone heightM through buildWarehouseData"
```

---

### Task E1.3: Warehouse3D — onSaveZoneGeom merge heightM + rebuildKey

**Files:** Modify `src/components/Warehouse3D.jsx`

- [ ] **Step 1: rebuildKey.g รวม heightM** — หา:
```js
    g: (warehouseLayout && warehouseLayout.zones)
      ? Object.entries(warehouseLayout.zones).map(([id, z]) => [id, z && z.origin, z && z.size])
      : null,
```
แทนด้วย:
```js
    g: (warehouseLayout && warehouseLayout.zones)
      ? Object.entries(warehouseLayout.zones).map(([id, z]) => [id, z && z.origin, z && z.size, z && z.heightM])
      : null,
```

- [ ] **Step 2: onSaveZoneGeom merge heightM** — หา:
```js
      zonesL[zoneId] = { ...(zonesL[zoneId] || {}), origin: geom.origin, size: geom.size };
      next.zones = zonesL;
      return next;
    });
  }, [setWarehouseLayout]);
```
แทนด้วย:
```js
      zonesL[zoneId] = { ...(zonesL[zoneId] || {}), origin: geom.origin, size: geom.size };
      if (geom.heightM != null) zonesL[zoneId].heightM = geom.heightM;
      next.zones = zonesL;
      return next;
    });
  }, [setWarehouseLayout]);
```
(หมายเหตุ: มี `zonesL[zoneId] = {...}` หลายที่ — onSaveLayout/onSaveCamera/onSaveZoneGeom; ตัวที่ตามด้วย `origin: geom.origin, size: geom.size` คือ onSaveZoneGeom)

- [ ] **Step 3: typecheck + lint + commit**
```bash
npm run typecheck
npx eslint src/components/Warehouse3D.jsx
git add src/components/Warehouse3D.jsx
git commit -m "feat(warehouse-3d): persist per-zone heightM + rebuild on change"
```

---

### Task E1.4: scene.js — ใช้ zone.heightM + ช่อง zeH

**Files:** Modify `src/lib/warehouse3d/scene.js`

- [ ] **Step 1: import clampZoneHeight** — หา:
```js
import { planBoxes, productColor, snapClampZoneRect } from "./boxPlan.js";
```
แทนด้วย:
```js
import { planBoxes, productColor, snapClampZoneRect, clampZoneHeight } from "./boxPlan.js";
```

- [ ] **Step 2: planBoxes ใช้ zone.heightM** — หา:
```js
      const plan = planBoxes(d, { innerW, innerL, ceilingH: WAREHOUSE.heightM }, {
```
แทนด้วย:
```js
      const plan = planBoxes(d, { innerW, innerL, ceilingH: zone.heightM }, {
```

- [ ] **Step 3: pile ใช้ zone.heightM** — หา:
```js
        const targetH = Math.min(WAREHOUSE.heightM * 0.85, 3.2);
```
แทนด้วย `const targetH = Math.min(zone.heightM * 0.85, 3.2);`
แล้วหา:
```js
        const ph = Math.min(totalVol / (side * side), WAREHOUSE.heightM * 0.95);
```
แทนด้วย `const ph = Math.min(totalVol / (side * side), zone.heightM * 0.95);`

- [ ] **Step 4: zoneVol ใช้ zone.heightM** — หา:
```js
    const zoneVol = zone.size.w * zone.size.l * WAREHOUSE.heightM;
```
แทนด้วย `const zoneVol = zone.size.w * zone.size.l * zone.heightM;`

- [ ] **Step 5: popup เพดานต่อโซน** — หา:
```js
      ["ซ้อนได้สูงสุด", `${layers} ชั้น (เพดาน ${WAREHOUSE.heightM} ม.)`],
```
แทนด้วย:
```js
      ["ซ้อนได้สูงสุด", `${layers} ชั้น (เพดาน ${(ZONES.find((z) => z.id === ud.zoneId) || {}).heightM || WAREHOUSE.heightM} ม.)`],
```

- [ ] **Step 6: resolvePlacement ลิมิตต่อโซน** — หา:
```js
    if (y + u.h / 2 > WAREHOUSE.heightM + 0.02) return null;
```
แทนด้วย:
```js
    if (y + u.h / 2 > ((ZONES.find((z) => z.id === u.zoneId) || {}).heightM || WAREHOUSE.heightM) + 0.02) return null;
```

- [ ] **Step 7: ช่อง zeH ในแผง** — หา:
```js
        <label>ยาว <input id="zeL" type="number" step="0.5" min="0.5" /></label>
      </div>
```
แทนด้วย:
```js
        <label>ยาว <input id="zeL" type="number" step="0.5" min="0.5" /></label>
        <label>สูง <input id="zeH" type="number" step="0.5" min="0.5" /></label>
      </div>
```

- [ ] **Step 8: zeReadout โชว์สูง** — หา:
```js
    sel.innerHTML = `<b>โซน ${z ? z.name : zeId}</b><br>x ${o.x} · z ${o.z} ม. · กว้าง ${s.w} · ยาว ${s.l} ม.`;
```
แทนด้วย:
```js
    sel.innerHTML = `<b>โซน ${z ? z.name : zeId}</b><br>x ${o.x} · z ${o.z} · กว้าง ${s.w} · ยาว ${s.l} · สูง ${zePending.heightM} ม.`;
```

- [ ] **Step 9: zeSelectZone เติม heightM** — หา:
```js
    zePending = snapClampZoneRect({ x: z.origin.x, z: z.origin.z }, { w: z.size.w, l: z.size.l }, WAREHOUSE);
    setPreviewRect(zePending.origin.x, zePending.origin.z, zePending.size.w, zePending.size.l);
    gid("zeW").value = zePending.size.w;
    gid("zeL").value = zePending.size.l;
    zeReadout();
```
แทนด้วย:
```js
    zePending = snapClampZoneRect({ x: z.origin.x, z: z.origin.z }, { w: z.size.w, l: z.size.l }, WAREHOUSE);
    zePending.heightM = clampZoneHeight(z.heightM, WAREHOUSE);
    setPreviewRect(zePending.origin.x, zePending.origin.z, zePending.size.w, zePending.size.l);
    gid("zeW").value = zePending.size.w;
    gid("zeL").value = zePending.size.l;
    gid("zeH").value = zePending.heightM;
    zeReadout();
```

- [ ] **Step 10: zeResize อ่าน zeH + เก็บ heightM** — หา:
```js
  function zeResize() {
    if (!zePending) return;
    const w = parseFloat(gid("zeW").value), l = parseFloat(gid("zeL").value);
    if (!isFinite(w) || !isFinite(l)) return;
    zePending = snapClampZoneRect(zePending.origin, { w, l }, WAREHOUSE);
    setPreviewRect(zePending.origin.x, zePending.origin.z, zePending.size.w, zePending.size.l);
    zeReadout();
  }
```
แทนด้วย:
```js
  function zeResize() {
    if (!zePending) return;
    const w = parseFloat(gid("zeW").value), l = parseFloat(gid("zeL").value);
    const h = parseFloat(gid("zeH").value);
    if (!isFinite(w) || !isFinite(l)) return;
    const heightM = clampZoneHeight(isFinite(h) ? h : zePending.heightM, WAREHOUSE);
    zePending = snapClampZoneRect(zePending.origin, { w, l }, WAREHOUSE);
    zePending.heightM = heightM;
    setPreviewRect(zePending.origin.x, zePending.origin.z, zePending.size.w, zePending.size.l);
    zeReadout();
  }
```

- [ ] **Step 11: ฟัง change ของ zeH + save พา heightM** — หา:
```js
    gid("zeW").addEventListener("change", zeResize);
    gid("zeL").addEventListener("change", zeResize);
```
แทนด้วย:
```js
    gid("zeW").addEventListener("change", zeResize);
    gid("zeL").addEventListener("change", zeResize);
    gid("zeH").addEventListener("change", zeResize);
```
แล้วหา:
```js
      onSaveZoneGeom(zeId, snapClampZoneRect(zePending.origin, zePending.size, WAREHOUSE));
```
แทนด้วย:
```js
      onSaveZoneGeom(zeId, { ...snapClampZoneRect(zePending.origin, zePending.size, WAREHOUSE), heightM: clampZoneHeight(zePending.heightM, WAREHOUSE) });
```

- [ ] **Step 12: typecheck + lint + commit**
```bash
npm run typecheck
npx eslint src/lib/warehouse3d/scene.js
git add src/lib/warehouse3d/scene.js
git commit -m "feat(warehouse-3d): per-zone ceiling height in stacking/overflow/fill + edit panel"
```

---

### Task E1.5: verify dev harness + cleanup

**Files:** Temp `wh3d-dev.html`

- [ ] **Step 1: harness (onSaveZoneGeom stub เก็บค่า)** — `wh3d-dev.html` ที่ root:
```html
<div id="host" style="position:fixed;inset:0"></div>
<script type="module">
  import { buildWarehouseData } from "/src/utils/warehouse3d.js";
  import { createWarehouseScene } from "/src/lib/warehouse3d/scene.js";
  const products = [{ id:"p1", code:"A1", nameT:"กล่อง", stock:120, widthCm:50,lengthCm:50,heightCm:50, unit:"ชิ้น" }];
  const zones = [{ id:"Z1", name:"โซน 1", origin:{x:1,z:1}, size:{w:12,l:8}, productIds:["p1"] }];
  const data = buildWarehouseData(products, zones, {});
  window.__SAVED = [];
  window.__SCENE = createWarehouseScene(document.getElementById("host"), data, {
    canEdit:true, onSaveLayout:()=>{}, onSaveCamera:()=>{},
    onSaveZoneGeom:(id,geom)=>{ window.__SAVED.push({id,geom}); }, snapshotUrl:()=>"",
  });
</script>
```

- [ ] **Step 2: รัน + force ขนาด + เปิดโหมดแก้โซน + เลือก Z1**
- `preview_start` (stock-app), เปิด `http://localhost:5173/wh3d-dev.html`
- `preview_eval`: force host size + `window.dispatchEvent(new Event('resize'))`
- `preview_eval`: `document.getElementById('btnZoneEdit').click()` แล้วยิง pointerdown กลางโซน (sweep fx 0.15..0.85 / fy 0.3..0.9 จน `!document.getElementById('zeSave').disabled`) — เหมือน Phase D

- [ ] **Step 3: ตรวจ heightM**
- หลังเลือก Z1: `preview_eval` `document.getElementById('zeH').value` — Expected: `"10"` (fallback เพดานโกดัง)
- ตั้งสูง 3: `preview_eval`:
  ```js
  (() => { const el=document.getElementById('zeH'); el.value='3'; el.dispatchEvent(new Event('change',{bubbles:true}));
    document.getElementById('zeSave').click();
    return { sel: document.getElementById('zeSel').textContent, saved: window.__SAVED }; })()
  ```
  Expected: `sel` มี "สูง 3 ม.", `saved` ล่าสุด `geom.heightM === 3`
- (logic effect) `preview_eval`: `import('/src/lib/warehouse3d/boxPlan.js').then(m=>({ tall: m.planBoxes({w:0.5,l:0.5,h:0.5},{innerW:11,innerL:7,ceilingH:10},{stock:120}).layersMax, low: m.planBoxes({w:0.5,l:0.5,h:0.5},{innerW:11,innerL:7,ceilingH:3},{stock:120}).layersMax }))`
  Expected: `tall > low` (เพดานต่ำ → layersMax น้อยลง)
- `preview_console_logs` error — Expected: ไม่มี

- [ ] **Step 4: ลบ harness + test/typecheck/lint + ปิด server**
```bash
rm -f wh3d-dev.html
npx vitest run        # ของเราผ่าน; DeliveryPlanning อาจแดง (picklist อื่น)
npm run typecheck
npx eslint src/lib/warehouse3d/ src/utils/warehouse3d.js src/components/Warehouse3D.jsx
```
- `preview_stop`, ยืนยัน `git status` ไม่มี `wh3d-dev.html`

- [ ] **Step 5: commit (ถ้ามีแก้ระหว่าง verify)**
```bash
git add -A -- src/lib/warehouse3d src/utils src/components/Warehouse3D.jsx
git commit -m "test(warehouse-3d): verify per-zone ceiling via dev harness"
```

---

## Self-Review

**Spec coverage:** bridge heightM → E1.2 · scene ใช้ zone.heightM (planBoxes/pile/zoneVol/popup/resolvePlacement) → E1.4 (Step 2-6) · ช่องสูงในแผง + readout + select/resize/save → E1.4 (Step 7-11) · onSaveZoneGeom merge heightM + rebuildKey → E1.3 · clampZoneHeight pure+test → E1.1 · verify stub ไม่เขียน prod → E1.5. ครบ

**Placeholder scan:** ไม่มี — ทุก step มีโค้ด/คำสั่ง/ค่าที่คาด

**Type consistency:** `clampZoneHeight(h, warehouse, step?)` นิยาม E1.1 ใช้ E1.4 (zeSelectZone/zeResize/zeSave) + ส่ง warehouse=WAREHOUSE ตรง · `ZONES[].heightM` สร้าง E1.2 อ่าน E1.4 (`zone.heightM`, `z.heightM` lookup) ตรง · `onSaveZoneGeom(id, {origin,size,heightM})` — scene ส่ง (E1.4 Step 11) Warehouse3D รับ merge `geom.heightM` (E1.3) ตรง · `zePending.heightM` ใช้สม่ำเสมอ (select/resize/readout/save) · rebuildKey.g รวม heightM (E1.3) ↔ onSaveZoneGeom เขียน heightM ตรง

**หมายเหตุ:** E1.3/E1.4 (React/scene DOM) ไม่ unit-test — verify ผ่าน E1.5 harness + typecheck/lint; helper+bridge (E1.1/E1.2) unit-test เต็ม
