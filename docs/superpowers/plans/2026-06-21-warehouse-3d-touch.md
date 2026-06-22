# โกดัง 3D Phase E2 — touch/tablet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** บน tablet โหมดแก้ (จัดเรียงกล่อง/แก้โซน) ให้นิ้วเดียวลากวัตถุ (ไม่หมุนกล้องทับ), สองนิ้วคุมกล้อง; ปุ่มแตะง่าย

**Architecture:** เพิ่ม `controls.touches` ใน `setMove`/`setZoneEdit` (สมมาตรกับ `controls.mouseButtons` ที่มี) + bump tap target เฉพาะ `@media (pointer: coarse)` (desktop ไม่กระทบ). drag ใช้ PointerEvent อยู่แล้ว (touch ครอบ), OrbitControls ตั้ง touchAction='none' ให้แล้ว

**Tech Stack:** three.js OrbitControls, CSS. แตะ `scene.js` ไฟล์เดียว

อ่านประกอบ: spec `docs/superpowers/specs/2026-06-21-warehouse-3d-touch-design.md`

---

## File Structure
- **Modify** `src/lib/warehouse3d/scene.js` — controls.touches (×2 โหมด) + coarse-pointer CSS
- **Temp (ห้าม commit)** `wh3d-dev.html`

## Gotchas
- ไม่มี pure logic ใหม่ → ไม่มี unit test เพิ่ม; touch จริงเช็คบน tablet ด้วยตา (auto-verify หลายนิ้วใน OrbitControls ไม่ได้)
- block `controls.mouseButtons = on ? ... : ...` มี **2 ที่เหมือนกันเป๊ะ** (setMove + setZoneEdit) → ใช้ Edit `replace_all: true` ให้ทั้งคู่ได้ touches เหมือนกัน
- localhost = Supabase prod: harness ไม่กดปุ่ม save; commit/push เมื่อสั่ง; chat ห้าม emoji

---

### Task E2.1: controls.touches + coarse-pointer tap targets

**Files:** Modify `src/lib/warehouse3d/scene.js`

- [ ] **Step 1: เพิ่ม controls.touches ทั้ง setMove + setZoneEdit (replace_all)**

ใช้ Edit `replace_all: true` กับ:
```js
    controls.mouseButtons = on
      ? { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
      : { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
```
แทนด้วย:
```js
    controls.mouseButtons = on
      ? { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
      : { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    controls.touches = on
      ? { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE }
      : { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
```
(ได้กับทั้ง setMove และ setZoneEdit: โหมดแก้ → นิ้วเดียวไม่ขยับกล้อง ปล่อยลากวัตถุ, สองนิ้ว = zoom+rotate; โหมดปกติ → ค่า default)

- [ ] **Step 2: bump tap target เฉพาะ touch (coarse pointer)**

หา:
```js
.wh3d .tbtn.active { background:var(--w3-accent); border-color:var(--w3-accent); color:#fff; }
```
เพิ่มบรรทัดถัดไป:
```js
@media (pointer: coarse) { .wh3d .tbtn { min-height:38px; padding-top:9px; padding-bottom:9px; } .wh3d .ze-row input { min-height:36px; } }
```

- [ ] **Step 3: typecheck + lint**

Run: `npm run typecheck`
Run: `npx eslint src/lib/warehouse3d/scene.js`
Expected: clean (THREE.TOUCH เป็น enum ของ three; ถ้า eslint/tsc บ่นว่า unused — ไม่มี เพราะใช้ในนิพจน์)

- [ ] **Step 4: commit**
```bash
git add src/lib/warehouse3d/scene.js
git commit -m "feat(warehouse-3d): touch controls in edit modes + coarse-pointer tap targets"
```

---

### Task E2.2: verify (no regression) + cleanup

**Files:** Temp `wh3d-dev.html`

- [ ] **Step 1: harness**

`wh3d-dev.html` ที่ root:
```html
<div id="host" style="position:fixed;inset:0"></div>
<script type="module">
  import { buildWarehouseData } from "/src/utils/warehouse3d.js";
  import { createWarehouseScene } from "/src/lib/warehouse3d/scene.js";
  const products = [{ id:"p1", code:"A1", nameT:"กล่อง", stock:60, widthCm:50,lengthCm:50,heightCm:50, unit:"ชิ้น" }];
  const zones = [{ id:"Z1", name:"โซน 1", origin:{x:1,z:1}, size:{w:12,l:8}, productIds:["p1"] }];
  const data = buildWarehouseData(products, zones, {});
  window.__SCENE = createWarehouseScene(document.getElementById("host"), data, {
    canEdit:true, onSaveLayout:()=>{}, onSaveCamera:()=>{}, onSaveZoneGeom:()=>{}, snapshotUrl:()=>"",
  });
</script>
```

- [ ] **Step 2: รัน + ตรวจ no regression**
- `preview_start` (stock-app), เปิด `http://localhost:5173/wh3d-dev.html`, force host size + resize
- `preview_eval`: `document.getElementById('btnMove').click(); document.getElementById('btnZoneEdit').click(); document.getElementById('btnZoneEdit').click(); ({ ok: !!document.querySelector('#host canvas') })` — toggle โหมดไปมาแล้วไม่ throw; Expected: `ok:true`
- `preview_console_logs` level error — Expected: ไม่มี (THREE.TOUCH ใช้ได้ ไม่มี ReferenceError)
- (mouse drag ยังโอเค — ยืนยันแล้วจาก D5/E1.5 path เดิม ไม่เปลี่ยน)

- [ ] **Step 3: ลบ harness + test/typecheck/lint + ปิด server**
```bash
rm -f wh3d-dev.html
npx vitest run        # ของเราผ่าน; DeliveryPlanning อาจแดง (picklist อื่น)
npm run typecheck
npx eslint src/lib/warehouse3d/
```
- `preview_stop`, ยืนยัน `git status` ไม่มี `wh3d-dev.html`

- [ ] **Step 4: commit (ถ้ามีแก้ระหว่าง verify)** — ถ้าไม่มี ข้าม

---

## Self-Review

**Spec coverage:** controls.touches ในโหมดแก้ (on: ONE null/TWO DOLLY_ROTATE; off: default) → E2.1 Step 1 · tap targets coarse-pointer → E2.1 Step 2 · verify no regression + touch=user → E2.2. ครบ

**Placeholder scan:** ไม่มี TBD — ทุก step มีโค้ด/คำสั่ง/ค่าที่คาด

**Type consistency:** `controls.touches = on ? {ONE,TWO} : {ONE,TWO}` ใช้ `THREE.TOUCH.*` (มีใน three ที่ import แล้ว) สมมาตรกับ `controls.mouseButtons` (`THREE.MOUSE.*`) ที่ทำงานอยู่ · `replace_all:true` ครอบ block เหมือนกัน 2 ที่ (setMove/setZoneEdit) ตรงเจตนา

**หมายเหตุ:** ไม่มี unit test ใหม่ (เป็น config OrbitControls); verify = harness no-regression + code review; touch จริง = ผู้ใช้บน tablet
