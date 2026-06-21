# โกดัง 3D Phase B — occupancy (กล่องจริงต่อ SKU + overflow) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้แท็บโกดัง 3D แสดงกล่องสินค้าจริงต่อ SKU (สีต่อ SKU) เรียงตาม stock จริง, ล้นทะลุเพดาน + โซนแดงเมื่อเกินความจุ

**Architecture:** สกัด logic การวางกล่อง (pure math) + การเลือกสีต่อ SKU ออกจาก `scene.js` ไปไฟล์ `src/lib/warehouse3d/boxPlan.js` ที่ unit-test ได้ (vitest) แล้วให้ `scene.js` เรียกใช้ — แยก "คิด" ออกจาก "วาด" เพราะ WebGL screenshot timeout ทำให้ test ฝั่ง render ตรง ๆ ไม่ได้ การเปลี่ยน behavior (overflow แนวตั้ง, threshold, สีต่อ SKU, โซนแดง) ทำใน scene.js + boxPlan แล้ว verify ด้วย dev harness + DOM panel

**Tech Stack:** React + Vite, three.js (bundler import), vitest. แก้เฉพาะ `src/lib/warehouse3d/` — ไม่แตะ App.jsx / persistence / bridge

อ่านประกอบ: spec `docs/superpowers/specs/2026-06-21-warehouse-3d-occupancy-design.md`, handoff `docs/warehouse-3d-handoff.md`

---

## File Structure
- **Create** `src/lib/warehouse3d/boxPlan.js` — pure helpers: `planBoxes()`, `productColor()`, `PRODUCT_PALETTE`, `REP_THRESHOLD`. ไม่ import three/DOM
- **Create** `src/lib/warehouse3d/boxPlan.test.ts` — vitest ของ boxPlan
- **Modify** `src/lib/warehouse3d/scene.js` — เรียก planBoxes แทน inline math; ใช้ productColor; โซนแดงเมื่อ overflow
- **Temp (ห้าม commit)** `wh3d-dev.html` ที่ root — dev harness สำหรับ verify, ลบทิ้งใน Task 6

## Gotchas (อ่านก่อน)
- localhost = Supabase prod — dev harness ใช้ callback stub เท่านั้น **ห้ามกด save/นำเข้า/ยืนยันใน UI จริง**
- commit/push ตรง master เมื่อผู้ใช้สั่ง; push = Vercel auto-deploy
- ตอบ chat ห้าม emoji; git เตือน LF→CRLF ไม่เป็นไร
- scene.js แก้โดยอ้าง "เนื้อโค้ด" (search/replace) ไม่อ้างเลขบรรทัด เพราะบรรทัดขยับหลังแก้

---

### Task 1: Pure planner `planBoxes()` ใน boxPlan.js

**Files:**
- Create: `src/lib/warehouse3d/boxPlan.js`
- Test: `src/lib/warehouse3d/boxPlan.test.ts`

- [ ] **Step 1: เขียน test ที่ fail ก่อน**

`src/lib/warehouse3d/boxPlan.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { planBoxes, REP_THRESHOLD } from "./boxPlan.js";

const ZONE = { innerW: 10, innerL: 10, ceilingH: 10 };
const BOX = { w: 0.4, l: 0.4, h: 0.4 }; // 40cm cube

describe("planBoxes", () => {
  it("stock = 0 -> ทุกค่าเป็นศูนย์ ไม่ใช้ pile", () => {
    const p = planBoxes(BOX, ZONE, { stock: 0 });
    expect(p).toMatchObject({ usePile: false, cols: 0, rows: 0, layers: 0, perLayer: 0, overflow: false });
  });

  it("stock พอดี -> ไม่ overflow, footprint อยู่ในโซน", () => {
    const p = planBoxes(BOX, ZONE, { stock: 100, gap: 0.04 });
    expect(p.usePile).toBe(false);
    expect(p.cols).toBeGreaterThanOrEqual(1);
    expect(p.rows).toBeGreaterThanOrEqual(1);
    expect(p.layers).toBeLessThanOrEqual(p.layersMax); // ไม่ล้นแนวตั้ง
    expect(p.footW).toBeLessThanOrEqual(ZONE.innerW + 1e-9);
    expect(p.footL).toBeLessThanOrEqual(ZONE.innerL + 1e-9);
    expect(p.cols * p.rows * p.layers).toBeGreaterThanOrEqual(100); // จุครบ
  });

  it("กล่องใหญ่ในโซนเล็ก -> ล้นแนวตั้ง (overflow) แต่ footprint ไม่เกินโซน", () => {
    const bigBox = { w: 2, l: 2, h: 3 };
    const smallZone = { innerW: 4, innerL: 4, ceilingH: 9 }; // layersMax = 3
    const p = planBoxes(bigBox, smallZone, { stock: 200, gap: 0.04 });
    expect(p.usePile).toBe(false);
    expect(p.layers).toBeGreaterThan(p.layersMax); // ทะลุเพดาน
    expect(p.overflow).toBe(true);
    expect(p.footW).toBeLessThanOrEqual(smallZone.innerW + 1e-9);
    expect(p.footL).toBeLessThanOrEqual(smallZone.innerL + 1e-9);
    expect(p.cols * p.rows * p.layers).toBeGreaterThanOrEqual(200);
  });

  it("stock > REP_THRESHOLD -> usePile", () => {
    const p = planBoxes(BOX, ZONE, { stock: REP_THRESHOLD + 1 });
    expect(p.usePile).toBe(true);
  });

  it("manualCols override -> ใช้ cols ที่กำหนด (clamp กับความกว้างโซน)", () => {
    const p = planBoxes(BOX, ZONE, { stock: 100, manualCols: 3 });
    expect(p.cols).toBe(3);
  });

  it("REP_THRESHOLD ถูกดันขึ้นเป็น 5000", () => {
    expect(REP_THRESHOLD).toBe(5000);
  });
});
```

- [ ] **Step 2: รัน test ให้เห็นว่า fail**

Run: `npx vitest run src/lib/warehouse3d/boxPlan.test.ts`
Expected: FAIL — `Failed to resolve import "./boxPlan.js"` / `planBoxes is not a function`

- [ ] **Step 3: เขียน implementation ขั้นต่ำ**

`src/lib/warehouse3d/boxPlan.js`:
```js
// Pure box-placement + colour helpers for the 3D warehouse scene.
// No three.js / DOM here so this stays unit-testable (WebGL screenshots time out).

// Per-SKU safety valve: stock above this renders as one aggregated "pile" instead of
// per-unit boxes. Raised from 200 -> 5000 so the real 300-3,000/zone range draws real boxes.
export const REP_THRESHOLD = 5000;

// Plan how one product's `stock` units pack inside a zone. Lengths in metres.
//   box:  { w, l, h }            one unit's dimensions
//   zone: { innerW, innerL, ceilingH }
//   opts: { stock, gap=0.04, repThreshold=REP_THRESHOLD, manualCols=null }
// Footprint is always clamped to the zone, so any excess stacks UPWARD (overflow=true
// when the stack rises past the ceiling) rather than spilling sideways.
export function planBoxes(box, zone, opts = {}) {
  const { stock = 0, gap = 0.04, repThreshold = REP_THRESHOLD, manualCols = null } = opts;
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
  let cols = Math.max(1, Math.round(Math.sqrt(itemsPerLayer)));
  cols = Math.min(cols, maxCols);
  if (manualCols) cols = Math.min(Math.max(1, manualCols), maxCols);

  let rows = Math.ceil(itemsPerLayer / cols);
  rows = Math.min(rows, maxRows);

  const perLayer = cols * rows;
  const layers = Math.ceil(stock / perLayer); // UNCAPPED -> may exceed layersMax = vertical overflow
  const footW = cols * pitchX, footL = rows * pitchZ;
  const overflow = layers > layersMax;

  return { usePile: false, cols, rows, layers, perLayer, layersMax, footW, footL, overflow };
}
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `npx vitest run src/lib/warehouse3d/boxPlan.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: typecheck + commit**

Run: `npm run typecheck` (Expected: ไม่มี error)
```bash
git add src/lib/warehouse3d/boxPlan.js src/lib/warehouse3d/boxPlan.test.ts
git commit -m "feat(warehouse-3d): pure planBoxes() planner with vertical-overflow packing"
```

---

### Task 2: สีต่อ SKU `productColor()` ใน boxPlan.js

**Files:**
- Modify: `src/lib/warehouse3d/boxPlan.js`
- Test: `src/lib/warehouse3d/boxPlan.test.ts`

- [ ] **Step 1: เพิ่ม test ที่ fail**

เพิ่มท้าย `boxPlan.test.ts`:
```ts
import { productColor, PRODUCT_PALETTE } from "./boxPlan.js";

describe("productColor", () => {
  it("deterministic — id เดิมได้สีเดิมเสมอ", () => {
    expect(productColor("sku-123")).toBe(productColor("sku-123"));
  });
  it("คืนสีที่อยู่ใน palette", () => {
    expect(PRODUCT_PALETTE).toContain(productColor("anything"));
  });
  it("id ต่างกันกระจายได้หลายสี (ไม่ใช่สีเดียวทั้งหมด)", () => {
    const colors = new Set(Array.from({ length: 30 }, (_, i) => productColor("p" + i)));
    expect(colors.size).toBeGreaterThan(1);
  });
  it("รับ id ที่เป็นตัวเลขได้ (cast เป็น string)", () => {
    expect(productColor(42)).toBe(productColor("42"));
  });
});
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `npx vitest run src/lib/warehouse3d/boxPlan.test.ts`
Expected: FAIL — `productColor is not a function`

- [ ] **Step 3: เพิ่ม implementation ใน boxPlan.js**

เพิ่มท้าย `src/lib/warehouse3d/boxPlan.js`:
```js
// Distinct, readable swatch colours for per-SKU box tinting (blended with cardboard in the scene).
export const PRODUCT_PALETTE = [
  "#d98b4a", "#e0c14a", "#7bbf5a", "#4aab9b", "#4a86d9",
  "#8a6ad9", "#d05a9b", "#c0573a", "#5a9bd0", "#9bbf3a",
];

// Stable colour per product id (same id -> same colour across zones/renders). FNV-1a hash.
export function productColor(id) {
  const s = String(id);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return PRODUCT_PALETTE[Math.abs(h) % PRODUCT_PALETTE.length];
}
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `npx vitest run src/lib/warehouse3d/boxPlan.test.ts`
Expected: PASS (10 tests รวม Task 1)

- [ ] **Step 5: commit**

```bash
git add src/lib/warehouse3d/boxPlan.js src/lib/warehouse3d/boxPlan.test.ts
git commit -m "feat(warehouse-3d): stable per-SKU productColor() palette"
```

---

### Task 3: ให้ scene.js เรียก planBoxes (overflow แนวตั้ง + threshold ใหม่)

**Files:**
- Modify: `src/lib/warehouse3d/scene.js`

- [ ] **Step 1: เพิ่ม import ที่หัวไฟล์**

หา `import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";` แล้วเพิ่มบรรทัดถัดไป:
```js
import { planBoxes, productColor, REP_THRESHOLD } from "./boxPlan.js";
```

- [ ] **Step 2: ลบ REP_THRESHOLD ตัวเก่า**

หา `const REP_THRESHOLD = 200;` แล้วลบทั้งบรรทัด (ใช้ตัว import แทน)

- [ ] **Step 3: แทน inline packing math ด้วย planBoxes**

หา block นี้ (อยู่ใน `zone.productIds.forEach`):
```js
      const layersMax = Math.max(1, Math.floor(WAREHOUSE.heightM / d.h));

      const manual = zone.layout && zone.layout[pid] ? zone.layout[pid] : null;

      const pitchX = d.w + GAP, pitchZ = d.l + GAP;
      let itemsPerLayer = Math.ceil(p.stock / layersMax);
      let cols = Math.max(1, Math.round(Math.sqrt(itemsPerLayer)));
      cols = Math.min(cols, Math.max(1, Math.floor(innerW / pitchX)));
      if (manual && manual.cols) cols = Math.max(1, manual.cols);
      let rows = Math.ceil(itemsPerLayer / cols);
      let layersUsed = Math.ceil(p.stock / (cols * rows));
      const footW = cols * pitchX, footL = rows * pitchZ;

      const usePile = p.stock > REP_THRESHOLD || (!manual && (layersUsed > layersMax || footW > innerW || footL > innerL));
```
แทนด้วย:
```js
      const manual = zone.layout && zone.layout[pid] ? zone.layout[pid] : null;
      const pitchX = d.w + GAP, pitchZ = d.l + GAP;
      const plan = planBoxes(d, { innerW, innerL, ceilingH: WAREHOUSE.heightM }, {
        stock: p.stock, gap: GAP, manualCols: manual && manual.cols ? manual.cols : null,
      });
      const { usePile, cols, rows, layersMax, footW, footL } = plan;
      const layersUsed = plan.layers; // uncapped -> stacks above ceiling when overflowing
      if (plan.overflow) st.overflow = true;
```
(ชื่อตัวแปร `usePile/cols/rows/layersMax/layersUsed/footW/footL/pitchX/pitchZ` คงเดิม โค้ดวางกล่องด้านล่างจึงใช้ได้ไม่ต้องแก้)

- [ ] **Step 4: typecheck + lint**

Run: `npm run typecheck`
Run: `npx eslint src/lib/warehouse3d/scene.js src/lib/warehouse3d/boxPlan.js`
Expected: ไม่มี error (ถ้ามี unused var `REP_THRESHOLD` import ที่ยังไม่ได้ใช้ — ปล่อยไว้ จะใช้พิสูจน์ทาง runtime; ถ้า eslint บ่น no-unused-vars ให้คงไว้เพราะ Task นี้เป็นการเปลี่ยน logic, REP_THRESHOLD ถูกใช้ใน boxPlan แล้ว — ลบ import REP_THRESHOLD ออกจาก scene.js ถ้าไม่ได้อ้างใน scene)

- [ ] **Step 5: verify ด้วย dev harness (สร้างไฟล์ใน Task 6 ก็ได้ — ที่นี่ตรวจ smoke เร็ว)**

ถ้ายังไม่มี `wh3d-dev.html` ให้ทำ Step 1-2 ของ Task 6 ก่อน แล้ว:
- `preview_start` (npm run dev), เปิด `/wh3d-dev.html`, force ขนาด host
- `preview_console_logs` — Expected: ไม่มี error แดง
- `preview_eval`: `document.querySelectorAll('.zone-row').length` — Expected: = จำนวนโซน fixture
Expected: scene สร้างได้ ไม่ throw

- [ ] **Step 6: commit**

```bash
git add src/lib/warehouse3d/scene.js
git commit -m "refactor(warehouse-3d): scene uses planBoxes — overflow stacks through ceiling, threshold 5000"
```

---

### Task 4: กล่องสีต่อ SKU ใน scene.js

**Files:**
- Modify: `src/lib/warehouse3d/scene.js`

- [ ] **Step 1: เปลี่ยนสี material ของ InstancedMesh เป็นต่อ SKU**

หา:
```js
        const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(d.w, d.h, d.l),
          new THREE.MeshLambertMaterial({ color: mix(CARDBOARD, zone.color, 0.28) }), p.stock);
```
แทนด้วย:
```js
        const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(d.w, d.h, d.l),
          new THREE.MeshLambertMaterial({ color: mix(CARDBOARD, productColor(p.id), 0.55) }), p.stock);
```

- [ ] **Step 2: เปลี่ยนสี material ของ pile เป็นต่อ SKU**

หา:
```js
        const pile = new THREE.Mesh(new THREE.BoxGeometry(side, ph, side),
          new THREE.MeshLambertMaterial({ color: mix(CARDBOARD, zone.color, 0.30) }));
```
แทนด้วย:
```js
        const pile = new THREE.Mesh(new THREE.BoxGeometry(side, ph, side),
          new THREE.MeshLambertMaterial({ color: mix(CARDBOARD, productColor(p.id), 0.55) }));
```

- [ ] **Step 3: เปลี่ยน swatch ในแผงรายการโซนเป็นต่อ SKU**

หา:
```js
    const totalUnits = zone.productIds.reduce((s, pid) => s + (productById[pid]?.stock || 0), 0);
    const boxColor = mix(CARDBOARD, zone.color, 0.28);
    const prodHtml = zone.productIds.map((pid) => {
      const p = productById[pid];
      if (!p) return "";
      return `<div class="zp-item" data-pid="${pid}">
        <span class="zp-sw" style="background:${boxColor}"></span>
```
แทนด้วย (ลบ `boxColor` ระดับโซน, คำนวณสีต่อ SKU ในแต่ละแถว):
```js
    const totalUnits = zone.productIds.reduce((s, pid) => s + (productById[pid]?.stock || 0), 0);
    const prodHtml = zone.productIds.map((pid) => {
      const p = productById[pid];
      if (!p) return "";
      const sw = mix(CARDBOARD, productColor(p.id), 0.55);
      return `<div class="zp-item" data-pid="${pid}">
        <span class="zp-sw" style="background:${sw}"></span>
```

- [ ] **Step 4: typecheck + lint + verify**

Run: `npm run typecheck` · `npx eslint src/lib/warehouse3d/scene.js`
Expected: ไม่มี error, ไม่มี unused `boxColor`
- ใน dev harness: `preview_eval` ตรวจว่าสอง SKU ในโซนเดียวกันมี swatch ต่างสี:
  `[...document.querySelectorAll('.zone-row[data-zone="Z1"] .zp-sw')].map(e=>getComputedStyle(e).backgroundColor)`
  Expected: ค่าสีไม่เหมือนกันทุกอัน

- [ ] **Step 5: commit**

```bash
git add src/lib/warehouse3d/scene.js
git commit -m "feat(warehouse-3d): tint boxes + panel swatches per SKU"
```

---

### Task 5: โซนแดงเมื่อ overflow / เกินความจุ

**Files:**
- Modify: `src/lib/warehouse3d/scene.js`

- [ ] **Step 1: ตั้งสีโซนเป็นแดงหลังคำนวณ fill**

หา:
```js
    const zoneVol = zone.size.w * zone.size.l * WAREHOUSE.heightM;
    st.fill = Math.min(999, (st.volProducts / zoneVol) * 100);
    st.zoneVol = zoneVol;
  });
```
แทนด้วย:
```js
    const zoneVol = zone.size.w * zone.size.l * WAREHOUSE.heightM;
    st.fill = Math.min(999, (st.volProducts / zoneVol) * 100);
    st.zoneVol = zoneVol;
    if (st.overflow || st.fill > 100) {
      const RED = "#e0503a";
      st.floorMat.color.set(mix(zone.color, RED, 0.7));
      st.frameMat.color.set(RED);
      st.baseOpacity = 0.28; st.floorMat.opacity = 0.28;
    }
  });
```
(`st.floorMat`/`st.frameMat` ถูกตั้งไว้แล้วตอนสร้าง zoneState; `.color.set()` รับ style string จาก `mix()` ได้)

- [ ] **Step 2: typecheck + lint**

Run: `npm run typecheck` · `npx eslint src/lib/warehouse3d/scene.js`
Expected: ไม่มี error

- [ ] **Step 3: verify ใน dev harness**

- โซนที่ตั้งให้ล้น (Z2 ใน fixture) ต้องมี chip เตือน:
  `preview_eval`: `!!document.querySelector('.zone-row[data-zone="Z2"].overflow')` — Expected: `true`
  `preview_eval`: `document.querySelector('.zone-row[data-zone="Z2"] .zr-meta span:last-child').textContent` — Expected: % สูง (>100 หรือใกล้)
- ไม่มี console error

- [ ] **Step 4: commit**

```bash
git add src/lib/warehouse3d/scene.js
git commit -m "feat(warehouse-3d): tint zone red on overflow / over-capacity"
```

---

### Task 6: Verification pass เต็ม + cleanup

**Files:**
- Temp: `wh3d-dev.html` (ลบท้าย task)

- [ ] **Step 1: สร้าง dev harness (ถ้ายังไม่มี)**

`wh3d-dev.html` ที่ root โปรเจกต์ (fixture เลือกให้ครอบ: ปกติ, ล้นแนวตั้ง, pile, noLayDown, dims หาย):
```html
<div id="host" style="position:fixed;inset:0"></div>
<script type="module">
  import { buildWarehouseData } from "/src/utils/warehouse3d.js";
  import { createWarehouseScene } from "/src/lib/warehouse3d/scene.js";
  const products = [
    { id:"p1", code:"A1", nameT:"กล่องเล็ก", stock:120, widthCm:40, lengthCm:40, heightCm:40, unit:"ชิ้น" },
    { id:"p2", code:"A2", nameT:"ลังกลาง", stock:1500, widthCm:60, lengthCm:40, heightCm:50, unit:"ลัง" },
    { id:"p3", code:"A3", nameT:"ของล้น", stock:200, widthCm:200, lengthCm:200, heightCm:300, unit:"ชิ้น" },
    { id:"p4", code:"A4", nameT:"ตั้งเท่านั้น", stock:60, widthCm:30, lengthCm:30, heightCm:120, noLayDown:true, unit:"ชิ้น" },
    { id:"p5", code:"A5", nameT:"ไม่มีขนาด", stock:50, sizeClass:"M", unit:"ชิ้น" },
    { id:"p6", code:"A6", nameT:"พีคสุด", stock:6000, widthCm:30, lengthCm:30, heightCm:30, unit:"ชิ้น" },
  ];
  const zones = [
    { id:"Z1", name:"โซน 1", origin:{x:1,z:1},  size:{w:12,l:8}, productIds:["p1","p2","p4"] },
    { id:"Z2", name:"โซน 2 ล้น", origin:{x:15,z:1}, size:{w:4,l:4}, productIds:["p3"] },
    { id:"Z3", name:"โซน 3", origin:{x:1,z:12}, size:{w:12,l:8}, productIds:["p5","p6"] },
  ];
  const data = buildWarehouseData(products, zones, {});
  window.__DATA = data;
  window.__SCENE = createWarehouseScene(document.getElementById("host"), data,
    { canEdit:true, onSaveLayout:()=>{}, onSaveCamera:()=>{} }); // stub = ไม่เขียน prod
</script>
```

- [ ] **Step 2: รัน + force ขนาด**

- `preview_start` ถ้ายังไม่รัน, เปิด `/wh3d-dev.html`
- `preview_eval`: `document.getElementById('host').style.cssText='position:fixed;left:0;top:0;width:1200px;height:700px'; window.dispatchEvent(new Event('resize'));`

- [ ] **Step 3: ตรวจผลทั้งหมดผ่าน preview_eval / console**

- `preview_console_logs` — Expected: ไม่มี error
- `document.querySelectorAll('.zone-row').length` — Expected: `3`
- Z2 ล้น: `!!document.querySelector('.zone-row[data-zone="Z2"].overflow')` — Expected: `true`
- สีต่อ SKU ใน Z1: `new Set([...document.querySelectorAll('.zone-row[data-zone="Z1"] .zp-sw')].map(e=>getComputedStyle(e).backgroundColor)).size` — Expected: `> 1`
- canvas มีจริง: `!!document.querySelector('#host canvas')` — Expected: `true`
- ตรวจ plan ตรงตามคาด (ตรวจ math ผ่าน import ตรง): `preview_eval` แบบ async import:
  `import('/src/lib/warehouse3d/boxPlan.js').then(m=>JSON.stringify(m.planBoxes({w:2,l:2,h:3},{innerW:3.3,innerL:3.3,ceilingH:9},{stock:200})))`
  Expected: `overflow:true, usePile:false`

- [ ] **Step 4: ลบ dev harness + รัน test/typecheck/lint ครบ**

```bash
rm wh3d-dev.html
```
Run: `npx vitest run` (Expected: PASS ทั้งหมด รวม warehouse3d.test + boxPlan.test)
Run: `npm run typecheck` (Expected: clean)
Run: `npx eslint src/lib/warehouse3d/` (Expected: clean)
- ยืนยัน `git status` ไม่มี `wh3d-dev.html` หลงเหลือ

- [ ] **Step 5: commit (ถ้ามีการแก้ระหว่าง verify)**

ถ้า Step 3 เจอบั๊กแล้วแก้ scene.js/boxPlan ให้ commit; ถ้าไม่มีการแก้ ข้าม step นี้
```bash
git add -A -- src/lib/warehouse3d
git commit -m "test(warehouse-3d): verify occupancy render via dev harness"
```

---

## Self-Review (ผู้เขียนแผนตรวจเอง)

**Spec coverage:**
- งาน 1 verify จริง → Task 6 (dev harness fixtures ครอบ normal/overflow/pile/noLayDown/dims หาย)
- งาน 2 สีต่อ SKU → Task 2 (productColor) + Task 4 (apply ใน scene + swatch)
- งาน 3 overflow ทะลุเพดาน + โซนแดง → Task 1 (planBoxes overflow แนวตั้ง) + Task 3 (wire) + Task 5 (โซนแดง)
- งาน 4 ดัน REP_THRESHOLD→5000 → Task 1 (ค่าใน boxPlan) + Task 3 (scene ใช้ตัว import)
- refactor planBoxes + vitest → Task 1
ครบทุกข้อใน spec

**Placeholder scan:** ไม่มี TBD/“handle edge cases” — ทุก step มีโค้ด/คำสั่ง/ค่าที่คาดจริง

**Type consistency:** `planBoxes` คืน `{usePile,cols,rows,layers,perLayer,layersMax,footW,footL,overflow}` — Task 3 destructure ชื่อตรงกัน (map `plan.layers`→`layersUsed` ชัดเจน); `productColor(id)` รับ id ทั้งใน boxPlan.test และ scene (`productColor(p.id)`) ตรงกัน; `REP_THRESHOLD` export จาก boxPlan ใช้ที่เดียว

**หมายเหตุ verify:** scene.js เป็น THREE/DOM — พิสูจน์ผ่าน vitest (planBoxes/productColor) + dev harness DOM panel + console + canvas presence; ภาพ 3D ตรง ๆ screenshot ไม่ได้ (WebGL timeout) จึงพึ่ง code review สำหรับลักษณะภาพ
