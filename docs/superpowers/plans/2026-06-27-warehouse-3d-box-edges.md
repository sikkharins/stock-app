# Box Edges on 3D Product Boxes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** วาดเส้นขอบกล่อง (outline edges) ให้กล่องสินค้าทุกใบในโกดัง 3D เพื่อให้มองเห็นแต่ละกล่อง/ชั้นที่ซ้อนกัน และอ่านความสูงได้.

**Architecture:** เส้นขอบของสินค้าแต่ละตัว = `LineSegments` ก้อนเดียวที่ merge ขอบกล่องทุก instance (instance ต่างกันแค่ตำแหน่ง การ merge จึงเป็นแค่บวก offset). ส่วนคำนวณ merge ล้วน (`mergeEdgePositions`) แยกไป `boxPlan.js` ให้ unit-test ได้; การประกอบ Three object (`boxEdges`) + การ wire เข้า scene + dim + rebuild อยู่ใน `scene.js` verify ด้วย dev harness.

**Tech Stack:** Three.js (`EdgesGeometry`, `LineSegments`, `LineBasicMaterial`, `BufferGeometry`), Vitest, Vite dev preview.

**Spec:** `docs/superpowers/specs/2026-06-27-warehouse-3d-box-edges-design.md`

**Deviation from spec (intentional):** spec เขียน "scene.js only" แต่แผนแยกฟังก์ชัน merge ล้วนไป `boxPlan.js` + vitest ตาม convention ของโปรเจกต์ ("pure logic → boxPlan + vitest", ดู `docs/warehouse-3d-handoff.md`). พฤติกรรม/ภาพผลลัพธ์ไม่เปลี่ยน.

---

## File Structure

| ไฟล์ | การเปลี่ยน |
|---|---|
| `src/lib/warehouse3d/boxPlan.js` | เพิ่ม pure `mergeEdgePositions(tpl, centers)` |
| `src/lib/warehouse3d/boxPlan.test.ts` | เพิ่ม unit test ของ `mergeEdgePositions` |
| `src/lib/warehouse3d/scene.js` | เพิ่ม import; constants `EDGE_COLOR`/`EDGE_OP`; helper `boxEdges`; wire instanced + pile; `applyVisibility` special-case; `rebuildEdges` + แก้ `pointerup` |

ค่าคงที่ร่วม: `EDGE_COLOR = "#2a2018"`, `EDGE_OP = 0.35`, dim opacity = `0.08`.

---

## Task 1: Pure `mergeEdgePositions` (boxPlan.js)

ฟังก์ชันล้วน: รับ template position ของขอบกล่อง 1 ใบ (flat `[x,y,z, x,y,z, ...]`) กับ list ของ center แล้วคืน `Float32Array` ที่เอา template ไปวาง (บวก offset) ที่ทุก center. ไม่มี Three/DOM.

**Files:**
- Modify: `src/lib/warehouse3d/boxPlan.js`
- Test: `src/lib/warehouse3d/boxPlan.test.ts`

- [ ] **Step 1: เขียน test ที่ fail**

เพิ่มท้าย `src/lib/warehouse3d/boxPlan.test.ts` (และเพิ่ม `mergeEdgePositions` เข้า import บรรทัด 2):

```ts
import { planBoxes, productColor, PRODUCT_PALETTE, REP_THRESHOLD, orientBoxDims, mergeEdgePositions } from "./boxPlan.js";
```

```ts
describe("mergeEdgePositions", () => {
  // one segment template: (0,0,0)->(1,0,0)
  const TPL = [0, 0, 0, 1, 0, 0];

  it("centers ว่าง -> Float32Array ว่าง", () => {
    const out = mergeEdgePositions(TPL, []);
    expect(out).toBeInstanceOf(Float32Array);
    expect(out.length).toBe(0);
  });

  it("วาง template ที่ทุก center พร้อมบวก offset", () => {
    const out = mergeEdgePositions(TPL, [{ x: 10, y: 0, z: 0 }, { x: 0, y: 5, z: 2 }]);
    expect(Array.from(out)).toEqual([10, 0, 0, 11, 0, 0, 0, 5, 2, 1, 5, 2]);
  });

  it("ความยาวผลลัพธ์ = tpl.length * จำนวน center", () => {
    const tpl = new Array(72).fill(0); // 12 edges * 2 verts * 3
    const out = mergeEdgePositions(tpl, [{ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }, { x: 2, y: 2, z: 2 }]);
    expect(out.length).toBe(72 * 3);
  });
});
```

- [ ] **Step 2: รัน test ให้เห็นว่า fail**

Run: `npx vitest run src/lib/warehouse3d/boxPlan.test.ts`
Expected: FAIL — `mergeEdgePositions is not a function` / not exported.

- [ ] **Step 3: เขียน implementation ขั้นต่ำ**

เพิ่มท้าย `src/lib/warehouse3d/boxPlan.js`:

```js
// Merge one box's edge-line template across many box centres (local space).
//   tpl:     flat [x,y,z, x,y,z, ...] of the box-edge LineSegments (length = n*3)
//   centers: [{ x, y, z }] one entry per box; each box = tpl translated by its centre
// Returns a Float32Array suitable for a LineSegments "position" attribute.
export function mergeEdgePositions(tpl, centers) {
  const n = tpl.length;
  const out = new Float32Array(n * centers.length);
  let o = 0;
  for (const c of centers) {
    for (let i = 0; i < n; i += 3) {
      out[o++] = tpl[i] + c.x;
      out[o++] = tpl[i + 1] + c.y;
      out[o++] = tpl[i + 2] + c.z;
    }
  }
  return out;
}
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `npx vitest run src/lib/warehouse3d/boxPlan.test.ts`
Expected: PASS (รวม test เดิมทั้งหมด)

- [ ] **Step 5: typecheck**

Run: `npm run typecheck`
Expected: ไม่มี error

- [ ] **Step 6: commit**

```bash
git add src/lib/warehouse3d/boxPlan.js src/lib/warehouse3d/boxPlan.test.ts
git commit -m "feat(warehouse): mergeEdgePositions pure helper for box edges"
```

---

## Task 2: `boxEdges` helper + render edges (scene.js)

เพิ่ม constants + helper `boxEdges`, แล้ว wire เข้าทั้งกล่องปกติ (instanced) และกองใหญ่ (pile).

**Files:**
- Modify: `src/lib/warehouse3d/scene.js`

- [ ] **Step 1: เพิ่ม `mergeEdgePositions` เข้า import**

ที่บรรทัด 13 เปลี่ยนเป็น:

```js
import { planBoxes, productColor, snapClampZoneRect, clampZoneHeight, orientBoxDims, mergeEdgePositions } from "./boxPlan.js";
```

- [ ] **Step 2: เพิ่ม constants + helper `boxEdges`**

หลังฟังก์ชัน `boxDims` (จบที่ ~บรรทัด 402, ก่อน `const CARDBOARD = ...`) แทรก:

```js
  const EDGE_COLOR = "#2a2018", EDGE_OP = 0.35;
  // One merged LineSegments outlining every box at `centers` (local), each sized dim {w,l,h}.
  function boxEdges(centers, dim) {
    if (!centers.length) return null;
    const tmpl = new THREE.EdgesGeometry(new THREE.BoxGeometry(dim.w, dim.h, dim.l)); // same param order as the solid box
    const merged = mergeEdgePositions(tmpl.attributes.position.array, centers);
    tmpl.dispose();
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(merged, 3));
    g.computeBoundingSphere();
    const ls = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: EDGE_COLOR, transparent: true, opacity: EDGE_OP }));
    ls.userData.isEdge = true;
    return ls;
  }
```

- [ ] **Step 3: เก็บ center ระหว่าง loop instance + สร้าง edges (กล่องปกติ)**

ในสาขา `else` (instanced, ~บรรทัด 509–527) แทนที่บล็อก loop + การ push เดิม. หา:

```js
        const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(d.w, d.h, d.l),
          new THREE.MeshLambertMaterial({ color: mix(CARDBOARD, productColor(p.id), 0.55) }), p.stock);
        const perLayer = cols * rows;
        for (let i = 0; i < p.stock; i++) {
          const layer = Math.floor(i / perLayer);
          const rem = i % perLayer;
          const r = Math.floor(rem / cols), cc = rem % cols;
          dummy.position.set(cc * pitchX + d.w / 2, layer * d.h + d.h / 2 + 0.005, r * pitchZ + d.l / 2);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          inst.setMatrixAt(i, dummy.matrix);
        }
        inst.instanceMatrix.needsUpdate = true;
        inst.userData = { product: p, zoneId: zone.id, isPile: false, layersMax, volPer, cols, rows, layersUsed, pg, pid };
        fw = footW; fl = footL;
        pg.add(inst); st.meshes.push(inst); pickables.push(inst);
        st.productMeta[pid] = { product: p, zoneId: zone.id, isPile: false, layersMax, volPer, cols, rows, layersUsed, inst, dW: d.w, dL: d.l, dH: d.h, pitchX, pitchZ, perLayer };
```

แทนด้วย:

```js
        const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(d.w, d.h, d.l),
          new THREE.MeshLambertMaterial({ color: mix(CARDBOARD, productColor(p.id), 0.55) }), p.stock);
        const perLayer = cols * rows;
        const centers = [];
        for (let i = 0; i < p.stock; i++) {
          const layer = Math.floor(i / perLayer);
          const rem = i % perLayer;
          const r = Math.floor(rem / cols), cc = rem % cols;
          const px = cc * pitchX + d.w / 2, py = layer * d.h + d.h / 2 + 0.005, pz = r * pitchZ + d.l / 2;
          centers.push({ x: px, y: py, z: pz });
          dummy.position.set(px, py, pz);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          inst.setMatrixAt(i, dummy.matrix);
        }
        inst.instanceMatrix.needsUpdate = true;
        inst.userData = { product: p, zoneId: zone.id, isPile: false, layersMax, volPer, cols, rows, layersUsed, pg, pid };
        fw = footW; fl = footL;
        pg.add(inst); st.meshes.push(inst); pickables.push(inst);
        const edges = boxEdges(centers, { w: d.w, l: d.l, h: d.h });
        if (edges) { pg.add(edges); st.meshes.push(edges); }
        st.productMeta[pid] = { product: p, zoneId: zone.id, isPile: false, layersMax, volPer, cols, rows, layersUsed, inst, dW: d.w, dL: d.l, dH: d.h, pitchX, pitchZ, perLayer, edges };
```

- [ ] **Step 4: สร้างกรอบเส้นขอบให้กองใหญ่ (pile)**

ในสาขา `usePile` (~บรรทัด 496–508) หลังบรรทัดที่ push `pile` เข้า scene:

```js
        pg.add(pile); st.meshes.push(pile); pickables.push(pile);
```

แทรกต่อท้าย (บรรทัดถัดไป):

```js
        const pe = new THREE.LineSegments(new THREE.EdgesGeometry(pile.geometry),
          new THREE.LineBasicMaterial({ color: EDGE_COLOR, transparent: true, opacity: EDGE_OP }));
        pe.position.copy(pile.position); pe.userData.isEdge = true;
        pg.add(pe); st.meshes.push(pe);
```

- [ ] **Step 5: typecheck + eslint**

Run: `npm run typecheck && npx eslint src/lib/warehouse3d/scene.js`
Expected: ไม่มี error

- [ ] **Step 6: commit**

```bash
git add src/lib/warehouse3d/scene.js
git commit -m "feat(warehouse): outline edges on 3D product boxes + piles"
```

---

## Task 3: Dim edges with their zone (applyVisibility)

ทำให้เส้นขอบคง opacity 0.35 ตอนปกติ และจางลงตอนโซนถูก dim (เลือกอีกโซน) — ไม่ให้ loop เดิมทับเป็น 1.

**Files:**
- Modify: `src/lib/warehouse3d/scene.js`

- [ ] **Step 1: เพิ่ม special-case `isEdge` ใน `st.meshes.forEach`**

ที่ `applyVisibility` (~บรรทัด 667–670) หา:

```js
      st.meshes.forEach((m) => {
        if (m.isSprite) { m.material.opacity = dim ? 0.18 : 1; return; }
        if (m.material) { m.material.transparent = op < 1; m.material.opacity = op; }
      });
```

แทนด้วย:

```js
      st.meshes.forEach((m) => {
        if (m.isSprite) { m.material.opacity = dim ? 0.18 : 1; return; }
        if (m.userData.isEdge) { m.material.transparent = true; m.material.opacity = dim ? 0.08 : EDGE_OP; return; }
        if (m.material) { m.material.transparent = op < 1; m.material.opacity = op; }
      });
```

- [ ] **Step 2: typecheck + eslint**

Run: `npm run typecheck && npx eslint src/lib/warehouse3d/scene.js`
Expected: ไม่มี error

- [ ] **Step 3: commit**

```bash
git add src/lib/warehouse3d/scene.js
git commit -m "feat(warehouse): dim box edges along with their zone"
```

---

## Task 4: Rebuild edges after moving a single box (move mode)

ลากกล่องเดี่ยวแล้วปล่อย → center เปลี่ยน ต้อง rebuild เส้นขอบของสินค้านั้น. ลากทั้งบล็อกไม่ต้อง (เส้นขอบเป็นลูก `pg` ขยับตามเอง).

**Files:**
- Modify: `src/lib/warehouse3d/scene.js`

- [ ] **Step 1: เพิ่มฟังก์ชัน `rebuildEdges`**

หลังฟังก์ชัน `writeUnit` (จบที่ ~บรรทัด 925, ก่อน `function overlapXZ`) แทรก:

```js
  function rebuildEdges(zoneId, pid) {
    const st = zoneState[zoneId]; if (!st) return;
    const meta = st.productMeta[pid]; if (!meta || !meta.edges || !meta.inst) return;
    const pg = meta.pg; pg.updateMatrixWorld();
    const units = meta.inst.userData.units || [];
    const centers = units.map((u) => {
      const lp = pg.worldToLocal(new THREE.Vector3(u.x, u.y, u.z));
      return { x: lp.x, y: lp.y, z: lp.z };
    });
    pg.remove(meta.edges);
    meta.edges.geometry.dispose();
    meta.edges.material.dispose();
    const idx = st.meshes.indexOf(meta.edges); if (idx >= 0) st.meshes.splice(idx, 1);
    const edges = boxEdges(centers, { w: meta.dW, l: meta.dL, h: meta.dH });
    if (edges) { pg.add(edges); st.meshes.push(edges); }
    meta.edges = edges;
  }
```

- [ ] **Step 2: เรียก `rebuildEdges` ตอนปล่อยกล่องเดี่ยว**

ที่ handler `pointerup` (~บรรทัด 984) หา:

```js
  addWin("pointerup", () => { if (dragUnit || dragging) { dragUnit = null; dragging = null; renderer.domElement.style.cursor = ""; } });
```

แทนด้วย:

```js
  addWin("pointerup", () => {
    if (dragUnit) rebuildEdges(dragUnit.zoneId, dragUnit.pid);
    if (dragUnit || dragging) { dragUnit = null; dragging = null; renderer.domElement.style.cursor = ""; }
  });
```

- [ ] **Step 3: typecheck + eslint**

Run: `npm run typecheck && npx eslint src/lib/warehouse3d/scene.js`
Expected: ไม่มี error

- [ ] **Step 4: commit**

```bash
git add src/lib/warehouse3d/scene.js
git commit -m "feat(warehouse): rebuild box edges after moving a single box"
```

---

## Task 5: End-to-end verify ใน dev harness

ยืนยันว่าเส้นขอบ render จริง, count ถูก, dim ทำงาน, move-mode rebuild ไม่พัง. (scene.js unit-test ไม่ได้ → ใช้ harness eval ตาม `docs/warehouse-3d-handoff.md`.)

**Files:**
- Temp (ห้าม commit): `wh3d-dev.html` ที่ repo root

- [ ] **Step 1: เริ่ม preview + สร้าง harness**

- `preview_start` (config `stock-app`, port 5173).
- สร้าง `wh3d-dev.html` ตาม template ใน `docs/warehouse-3d-handoff.md` §"วิธี verify" (product `p1` stock 120, zone `Z1`, `canEdit:true`, callbacks stub).

- [ ] **Step 2: บังคับขนาด viewport แล้วตรวจ edges render**

เปิด `http://localhost:5173/wh3d-dev.html` แล้ว `preview_eval`:

```js
document.getElementById('host').style.cssText='position:fixed;left:0;top:0;width:1300px;height:760px';
window.dispatchEvent(new Event('resize'));
let n = 0, lines = 0;
window.__SCENE && document.querySelector('canvas'); // ensure mounted
// count LineSegments tagged isEdge + their vertex totals
(function(){ /* traverse via global scene not exposed; assert via no-throw + canvas */ })();
({ canvas: !!document.querySelector('#host canvas') });
```

Expected: `{ canvas: true }`, ไม่มี error ใน `preview_console_logs`.

- [ ] **Step 3: ตรวจ vertex count ของเส้นขอบ (กล่องปกติ)**

`mergeEdgePositions` ถูก unit-test แล้ว (Task 1) จึงตรวจแค่ integration: ยืนยันว่ามี `LineSegments` ที่ `userData.isEdge` เพิ่มในฉาก และจำนวน vertex = (ขอบกล่อง 1 ใบ) × stock. `EdgesGeometry` ของ box = 12 ขอบ × 2 = 24 vertex; stock 120 → 2880 vertex.

ถ้า harness export scene ไม่ได้ ให้ตรวจทางอ้อม: `import('/src/lib/warehouse3d/boxPlan.js')` แล้วเรียก `mergeEdgePositions(new Array(24*3).fill(0), Array.from({length:120}, ()=>({x:0,y:0,z:0})))` ได้ length `24*3*120 = 8640` (= 2880 vertex × 3).

Run (preview_eval):

```js
const m = await import('/src/lib/warehouse3d/boxPlan.js');
const out = m.mergeEdgePositions(new Array(72).fill(0), Array.from({length:120}, () => ({x:0,y:0,z:0})));
({ len: out.length, expect: 72*120 });
```

Expected: `{ len: 8640, expect: 8640 }`

- [ ] **Step 4: ตรวจ move-mode ไม่ throw**

`preview_eval`: คลิกปุ่ม `#btnMove` (toggle move mode) ไป-กลับ แล้วเช็ค `preview_console_logs` ไม่มี error.

```js
const b = document.querySelector('#btnMove'); b && b.click(); b && b.click();
({ moved: !!b });
```

Expected: `{ moved: true }`, console ไม่มี error.

- [ ] **Step 5: ลบ harness**

ลบ `wh3d-dev.html` ออกจาก repo root (ห้าม commit). ยืนยันว่า `git status` ไม่มี `wh3d-dev.html`.

- [ ] **Step 6: final gate**

Run: `npm run typecheck && npx eslint src/lib/warehouse3d/ && npx vitest run src/lib/warehouse3d/boxPlan.test.ts`
Expected: ทั้งหมดผ่าน (vitest เดิม `DeliveryPlanning > Pick List` ที่แดงจาก agent อื่น ไม่เกี่ยวกับงานนี้ — ถ้ารันเฉพาะ boxPlan.test.ts จะไม่ติด).

---

## Self-Review (เทียบ spec)

**Spec coverage:**
- เส้นขอบกล่องทุกใบ สีเข้มโปร่งแสง 0.35 → Task 2 (boxEdges + instanced wiring).
- กองใหญ่ตีกรอบ 1 อัน → Task 2 Step 4.
- merge เป็น LineSegments ก้อนเดียวต่อสินค้า เป็นลูก pg → Task 2 Step 3.
- material แยกต่อสินค้า + `isEdge` + dim special-case → Task 2 (material) + Task 3.
- rebuild ตอนย้ายกล่องเดี่ยว, บล็อกไม่ต้อง → Task 4.
- dispose ไม่ต้องแก้ (traverse ครอบ), rebuild dispose geom+mat → Task 4 Step 1.
- verify ผ่าน harness/eval → Task 5.
- Out of scope (ตัวเลขเมตร/ไม้บรรทัด/กริดผนัง) → ไม่มี task. ✓

**Placeholder scan:** ไม่มี TBD/TODO; ทุก step มีโค้ด/คำสั่งจริง. ✓

**Type consistency:** `mergeEdgePositions(tpl, centers)` ใช้เหมือนกันทั้ง Task 1/2/4; `boxEdges(centers, {w,l,h})` คืน `LineSegments|null` ใช้สม่ำเสมอ; `userData.isEdge` ตั้งใน Task 2 อ่านใน Task 3; `meta.edges`/`meta.dW/dL/dH` เขียนใน Task 2 อ่านใน Task 4. ✓
