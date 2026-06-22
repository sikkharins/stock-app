# โกดัง 3D Phase D — แก้ตัวโซนใน 3D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มโหมด "✥ แก้โซน" ในแท็บ 3D — ลากย้าย + กรอกเลขรีไซซ์ตัวโซน (snap 0.5ม.) แล้วเซฟ origin/size ลง `warehouse_layout` (บ้านเดียวของ geometry)

**Architecture:** เลือกโซน → แสดง **เส้น preview rect** ที่ขยับตามการลาก/กรอกเลข (ของจริงไม่ขยับจนกด "บันทึกโซน"); เซฟผ่าน `onSaveZoneGeom` → merge `warehouse_layout.zones[id].{origin,size}` → `rebuildKey` เปลี่ยน → rebuild ฉาก (repack กล่องตาม footprint ใหม่)

**Tech Stack:** React + Vite, three.js, vitest. แตะ `boxPlan.js`, `Warehouse3D.jsx`, `scene.js`

อ่านประกอบ: spec `docs/superpowers/specs/2026-06-21-warehouse-3d-zone-edit-design.md`

---

## File Structure
- **Modify** `src/lib/warehouse3d/boxPlan.js` — เพิ่ม pure `snapClampZoneRect()`
- **Modify** `src/lib/warehouse3d/boxPlan.test.ts` — test
- **Modify** `src/components/Warehouse3D.jsx` — `onSaveZoneGeom` callback + ขยาย `rebuildKey`
- **Modify** `src/lib/warehouse3d/scene.js` — โหมดแก้โซน (ปุ่ม/panel/เลือก/ลาก/รีไซซ์/เซฟ)
- **Temp (ห้าม commit)** `wh3d-dev.html`

## Gotchas
- localhost = Supabase prod — harness ใช้ `onSaveZoneGeom` stub, ห้ามกด "บันทึกโซน" ใน UI จริง
- [[feedback_usememo_tdz]]: rebuildKey เป็น useMemo — แก้ inline ไม่เพิ่ม helper ใหม่ที่อ้างก่อนประกาศ
- commit/push ตรง master เมื่อสั่ง; chat ห้าม emoji; LF→CRLF ไม่เป็นไร
- scene.js แก้โดยอ้างเนื้อโค้ด (search/replace)

---

### Task D1: pure `snapClampZoneRect()` + test

**Files:**
- Modify: `src/lib/warehouse3d/boxPlan.js`
- Test: `src/lib/warehouse3d/boxPlan.test.ts`

- [ ] **Step 1: เขียน test ที่ fail**

เพิ่มท้าย `src/lib/warehouse3d/boxPlan.test.ts`:
```ts
import { snapClampZoneRect } from "./boxPlan.js";

const WH = { widthM: 54, lengthM: 30 };

describe("snapClampZoneRect", () => {
  it("snap origin + size เป็นทวีคูณ 0.5", () => {
    const r = snapClampZoneRect({ x: 1.2, z: 2.7 }, { w: 11.3, l: 7.8 }, WH);
    expect(r).toEqual({ origin: { x: 1, z: 2.5 }, size: { w: 11.5, l: 8 } });
  });
  it("clamp size ไม่เกินโกดัง และไม่ต่ำกว่า 0.5", () => {
    expect(snapClampZoneRect({ x: 0, z: 0 }, { w: 100, l: 0.1 }, WH))
      .toEqual({ origin: { x: 0, z: 0 }, size: { w: 54, l: 0.5 } });
  });
  it("clamp origin ไม่ให้ origin+size เลยขอบ", () => {
    const r = snapClampZoneRect({ x: 50, z: 28 }, { w: 12, l: 8 }, WH);
    expect(r.origin).toEqual({ x: 42, z: 22 }); // 54-12, 30-8
  });
  it("ค่าพอดีขอบผ่านเหมือนเดิม", () => {
    const r = snapClampZoneRect({ x: 42, z: 22 }, { w: 12, l: 8 }, WH);
    expect(r).toEqual({ origin: { x: 42, z: 22 }, size: { w: 12, l: 8 } });
  });
});
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `npx vitest run src/lib/warehouse3d/boxPlan.test.ts`
Expected: FAIL — `snapClampZoneRect is not a function`

- [ ] **Step 3: implement (เพิ่มท้าย boxPlan.js)**

```js
// Snap a zone footprint to a 0.5 m grid and clamp it inside the warehouse. Pure.
export function snapClampZoneRect(origin, size, warehouse, step = 0.5) {
  const snap = (v) => Math.round(v / step) * step;
  const W = warehouse.widthM, L = warehouse.lengthM;
  const w = Math.min(Math.max(snap(size.w), step), W);
  const l = Math.min(Math.max(snap(size.l), step), L);
  const x = Math.min(Math.max(snap(origin.x), 0), W - w);
  const z = Math.min(Math.max(snap(origin.z), 0), L - l);
  return { origin: { x, z }, size: { w, l } };
}
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `npx vitest run src/lib/warehouse3d/boxPlan.test.ts`
Expected: PASS (รวมของเดิม)

- [ ] **Step 5: typecheck + commit**

Run: `npm run typecheck`
```bash
git add src/lib/warehouse3d/boxPlan.js src/lib/warehouse3d/boxPlan.test.ts
git commit -m "feat(warehouse-3d): snapClampZoneRect() zone footprint snap/clamp"
```

---

### Task D2: Warehouse3D.jsx — onSaveZoneGeom + rebuildKey

**Files:**
- Modify: `src/components/Warehouse3D.jsx`

- [ ] **Step 1: ขยาย rebuildKey ให้รวม per-zone origin/size**

หา:
```js
    w: (warehouseLayout && warehouseLayout.warehouse) || null,
  }), [products, zones, warehouseLayout]);
```
แทนด้วย:
```js
    w: (warehouseLayout && warehouseLayout.warehouse) || null,
    // per-zone geometry: rebuild when origin/size changes (NOT on camera/layout saves)
    g: (warehouseLayout && warehouseLayout.zones)
      ? Object.entries(warehouseLayout.zones).map(([id, z]) => [id, z && z.origin, z && z.size])
      : null,
  }), [products, zones, warehouseLayout]);
```

- [ ] **Step 2: เพิ่ม onSaveZoneGeom callback**

หา (จบ onSaveCamera useCallback):
```js
  const onSaveCamera = useCallback((zoneId, camera) => {
    setWarehouseLayout((prev) => {
      const next = { ...(prev || {}) };
      const zonesL = { ...(next.zones || {}) };
      zonesL[zoneId] = { ...(zonesL[zoneId] || {}), camera };
      next.zones = zonesL;
      return next;
    });
  }, [setWarehouseLayout]);
```
เพิ่มต่อท้าย:
```js
  const onSaveZoneGeom = useCallback((zoneId, geom) => {
    setWarehouseLayout((prev) => {
      const next = { ...(prev || {}) };
      const zonesL = { ...(next.zones || {}) };
      zonesL[zoneId] = { ...(zonesL[zoneId] || {}), origin: geom.origin, size: geom.size };
      next.zones = zonesL;
      return next;
    });
  }, [setWarehouseLayout]);
```

- [ ] **Step 3: ส่ง onSaveZoneGeom เข้า opts**

หา:
```js
      onSaveCamera: canEdit ? onSaveCamera : null,
      // closure reads the latest relay URL on every click + cache-busts with Date.now()
      snapshotUrl: (token) => cctvSnapshotUrl(getRelayUrl(), token, Date.now()),
    });
```
แทนด้วย:
```js
      onSaveCamera: canEdit ? onSaveCamera : null,
      onSaveZoneGeom: canEdit ? onSaveZoneGeom : null,
      // closure reads the latest relay URL on every click + cache-busts with Date.now()
      snapshotUrl: (token) => cctvSnapshotUrl(getRelayUrl(), token, Date.now()),
    });
```

- [ ] **Step 4: typecheck + lint + commit**

Run: `npm run typecheck`
Run: `npx eslint src/components/Warehouse3D.jsx`
Expected: clean (verify จริงรวมใน D5)
```bash
git add src/components/Warehouse3D.jsx
git commit -m "feat(warehouse-3d): onSaveZoneGeom + rebuild on zone geometry change"
```

---

### Task D3: scene.js — โหมดแก้โซน (ปุ่ม + panel + เลือกโซน)

**Files:**
- Modify: `src/lib/warehouse3d/scene.js`

- [ ] **Step 1: import + รับ opt**

หา `import { planBoxes, productColor } from "./boxPlan.js";`
แทนด้วย:
```js
import { planBoxes, productColor, snapClampZoneRect } from "./boxPlan.js";
```
หา `const snapshotUrl = typeof opts.snapshotUrl === "function" ? opts.snapshotUrl : null;`
เพิ่มบรรทัดถัดไป:
```js
  const onSaveZoneGeom = typeof opts.onSaveZoneGeom === "function" ? opts.onSaveZoneGeom : null;
```

- [ ] **Step 2: เก็บ zone floors ให้ raycast เลือกได้**

หา `const pickables = [];`
แทนด้วย:
```js
  const pickables = [];
  const zoneFloors = [];
```
หา (ใน build loop):
```js
    zf.rotation.x = -Math.PI / 2; zf.position.set(cx, 0.02, cz); zf.userData.zonePart = true; group.add(zf);
```
แทนด้วย:
```js
    zf.rotation.x = -Math.PI / 2; zf.position.set(cx, 0.02, cz); zf.userData.zonePart = true; group.add(zf);
    zf.userData.zoneId = zone.id; zoneFloors.push(zf);
```

- [ ] **Step 3: ปุ่ม toolbar + panel HTML**

หา `      <button class="tbtn" id="btnMove">✋ จัดเรียง</button>`
แทนด้วย:
```js
      <button class="tbtn" id="btnMove">✋ จัดเรียง</button>
      <button class="tbtn" id="btnZoneEdit">✥ แก้โซน</button>
```
หา (จบ movePanel):
```js
      <button class="tbtn mp-copy" id="mpCopy">💾 บันทึกการจัดเรียงทั้งหมด</button>
    </div>
  </div>
```
แทนด้วย:
```js
      <button class="tbtn mp-copy" id="mpCopy">💾 บันทึกการจัดเรียงทั้งหมด</button>
    </div>
    <div id="zoneEditPanel" class="panel">
      <div class="mp-title">✥ แก้โซน</div>
      <div class="mp-hint">คลิกเลือกโซน · ลากบนพื้น = ย้าย (snap 0.5ม.) · กรอกกว้าง/ยาว = รีไซซ์ · คลิกขวาค้าง = หมุนกล้อง</div>
      <div id="zeSel" class="mp-sel">— ยังไม่ได้เลือกโซน —</div>
      <div class="ze-row">
        <label>กว้าง <input id="zeW" type="number" step="0.5" min="0.5" /></label>
        <label>ยาว <input id="zeL" type="number" step="0.5" min="0.5" /></label>
      </div>
      <button class="tbtn mp-copy" id="zeSave" disabled>💾 บันทึกโซน</button>
    </div>
  </div>
```

- [ ] **Step 4: CSS ของ panel + ปุ่มซ่อนเริ่มต้น**

หา `.wh3d .cc-bar { padding:8px 16px;` (รายการ CSS ที่เพิ่มใน Phase C) — เพิ่ม "ก่อนหน้า" บรรทัดนั้น:
```js
.wh3d #zoneEditPanel { display:none; }
.wh3d.zoneediting #zoneEditPanel { display:block; }
.wh3d .ze-row { display:flex; gap:8px; margin:8px 0; }
.wh3d .ze-row label { font-size:11px; color:var(--w3-muted); display:flex; flex-direction:column; gap:3px; flex:1; }
.wh3d .ze-row input { width:100%; box-sizing:border-box; padding:5px 7px; border:1px solid var(--w3-line); border-radius:6px; background:var(--w3-bg); color:var(--w3-text); font-family:inherit; }
```
(ถ้าไม่มี var `--w3-bg` ให้ใช้ `#0a0d12`; ตรวจในไฟล์ — ถ้าไม่มีให้ใส่ `background:#11151c`)

- [ ] **Step 5: state + ฟังก์ชัน setZoneEdit + เลือกโซน + preview rect**

หา (ท้ายสุดของ block ลากกล่อง — บรรทัด):
```js
  addWin("pointerup", () => { if (dragUnit || dragging) { dragUnit = null; dragging = null; renderer.domElement.style.cursor = ""; } });
```
เพิ่มต่อท้าย:
```js
  // ===== zone-edit mode: move/resize a zone footprint, save to warehouse_layout =====
  let zoneEditMode = false, zeId = null, zePending = null, zeDragging = false;
  const zeOff = new THREE.Vector3();
  const btnZoneEdit = gid("btnZoneEdit");
  if (!canEdit || !onSaveZoneGeom) { btnZoneEdit.remove(); }

  const zePreview = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, depthTest: false }));
  zePreview.renderOrder = 1000; zePreview.visible = false; scene.add(zePreview);
  function setPreviewRect(ox, oz, w, l) {
    const y = 0.12;
    const pts = [ox, y, oz, ox + w, y, oz, ox + w, y, oz, ox + w, y, oz + l,
      ox + w, y, oz + l, ox, y, oz + l, ox, y, oz + l, ox, y, oz];
    zePreview.geometry.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    zePreview.geometry.computeBoundingSphere();
    zePreview.visible = true;
  }
  function zeReadout() {
    const sel = gid("zeSel"), save = gid("zeSave");
    if (!zeId || !zePending) { sel.innerHTML = "— ยังไม่ได้เลือกโซน —"; save.disabled = true; return; }
    const z = ZONES.find((z) => z.id === zeId);
    const { origin: o, size: s } = zePending;
    sel.innerHTML = `<b>โซน ${z ? z.name : zeId}</b><br>x ${o.x} · z ${o.z} ม. · กว้าง ${s.w} · ยาว ${s.l} ม.`;
    save.disabled = false;
  }
  function selectZone(id) {
    const z = ZONES.find((z) => z.id === id);
    if (!z) return;
    zeId = id;
    zePending = snapClampZoneRect({ x: z.origin.x, z: z.origin.z }, { w: z.size.w, l: z.size.l }, WAREHOUSE);
    setPreviewRect(zePending.origin.x, zePending.origin.z, zePending.size.w, zePending.size.l);
    gid("zeW").value = zePending.size.w;
    gid("zeL").value = zePending.size.l;
    zeReadout();
  }
  function setZoneEdit(on) {
    zoneEditMode = on;
    root.classList.toggle("zoneediting", on);
    btnZoneEdit.classList.toggle("active", on);
    controls.mouseButtons = on
      ? { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
      : { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    if (on && moveMode) setMove(false);
    if (!on) { zeId = null; zePending = null; zeDragging = false; zePreview.visible = false; zeReadout(); }
    else { hidePopup(); }
  }
  if (canEdit && onSaveZoneGeom) btnZoneEdit.addEventListener("click", () => setZoneEdit(!zoneEditMode));
```

- [ ] **Step 6: ป้องกัน move-mode กับ zone-edit ชนกัน**

หา (ใน `setMove`):
```js
  function setMove(on) {
    moveMode = on;
    root.classList.toggle("moving", on);
```
แทนด้วย:
```js
  function setMove(on) {
    moveMode = on;
    if (on && typeof setZoneEdit === "function" && zoneEditMode) setZoneEdit(false);
    root.classList.toggle("moving", on);
```
(หมายเหตุ: `setMove` ถูกนิยามก่อน `setZoneEdit`; `zoneEditMode`/`setZoneEdit` เป็น hoisted function/closure vars — guard `typeof` กัน TDZ ของ let `zoneEditMode` ถ้า setMove ถูกเรียกตอน init; ถ้าไม่เคยเรียก setMove ก่อน init ก็ตัด guard ได้ แต่คงไว้เพื่อปลอดภัย)

- [ ] **Step 7: typecheck + lint + commit**

Run: `npm run typecheck`
Run: `npx eslint src/lib/warehouse3d/scene.js`
Expected: clean
```bash
git add src/lib/warehouse3d/scene.js
git commit -m "feat(warehouse-3d): zone-edit mode scaffold (toolbar, panel, select + preview)"
```

---

### Task D4: scene.js — ลากย้าย + รีไซซ์ + บันทึก

**Files:**
- Modify: `src/lib/warehouse3d/scene.js`

- [ ] **Step 1: pointer handlers ของ zone-edit (เลือก + ลาก)**

หา (บรรทัดที่เพิ่งเพิ่มท้าย Task D3 Step 5):
```js
  if (canEdit && onSaveZoneGeom) btnZoneEdit.addEventListener("click", () => setZoneEdit(!zoneEditMode));
```
เพิ่มต่อท้าย:
```js
  renderer.domElement.addEventListener("pointerdown", (e) => {
    if (!zoneEditMode) return;
    ndc(e); raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(zoneFloors.filter((m) => m.visible), false);
    if (!hits.length) return;
    const id = hits[0].object.userData.zoneId;
    if (id !== zeId) selectZone(id);
    const fp = floorAt(e);
    if (fp && zePending) { zeDragging = true; zeOff.set(fp.x - zePending.origin.x, 0, fp.z - zePending.origin.z); renderer.domElement.style.cursor = "grabbing"; }
  });
  renderer.domElement.addEventListener("pointermove", (e) => {
    if (!zoneEditMode || !zeDragging || !zePending) return;
    const fp = floorAt(e); if (!fp) return;
    const snapped = snapClampZoneRect({ x: fp.x - zeOff.x, z: fp.z - zeOff.z }, zePending.size, WAREHOUSE);
    zePending = snapped;
    setPreviewRect(snapped.origin.x, snapped.origin.z, snapped.size.w, snapped.size.l);
    zeReadout();
  });
  addWin("pointerup", () => { if (zeDragging) { zeDragging = false; renderer.domElement.style.cursor = ""; } });
```

- [ ] **Step 2: รีไซซ์ด้วยเลข (live preview)**

เพิ่มต่อจาก block Step 1:
```js
  function zeResize() {
    if (!zePending) return;
    const w = parseFloat(gid("zeW").value), l = parseFloat(gid("zeL").value);
    if (!isFinite(w) || !isFinite(l)) return;
    zePending = snapClampZoneRect(zePending.origin, { w, l }, WAREHOUSE);
    setPreviewRect(zePending.origin.x, zePending.origin.z, zePending.size.w, zePending.size.l);
    zeReadout();
  }
  if (canEdit && onSaveZoneGeom) {
    gid("zeW").addEventListener("change", zeResize);
    gid("zeL").addEventListener("change", zeResize);
    gid("zeSave").addEventListener("click", () => {
      if (!zeId || !zePending || !onSaveZoneGeom) return;
      onSaveZoneGeom(zeId, snapClampZoneRect(zePending.origin, zePending.size, WAREHOUSE));
      const b = gid("zeSave"); b.textContent = "✓ บันทึกแล้ว";
      setT(() => { b.textContent = "💾 บันทึกโซน"; }, 1600);
    });
  }
```

- [ ] **Step 3: typecheck + lint**

Run: `npm run typecheck`
Run: `npx eslint src/lib/warehouse3d/scene.js`
Expected: clean

- [ ] **Step 4: commit**

```bash
git add src/lib/warehouse3d/scene.js
git commit -m "feat(warehouse-3d): zone-edit drag move + numeric resize + save geometry"
```

---

### Task D5: verify dev harness + cleanup

**Files:**
- Temp: `wh3d-dev.html`

- [ ] **Step 1: สร้าง dev harness (onSaveZoneGeom stub เก็บค่า)**

`wh3d-dev.html` ที่ root:
```html
<div id="host" style="position:fixed;inset:0"></div>
<script type="module">
  import { buildWarehouseData } from "/src/utils/warehouse3d.js";
  import { createWarehouseScene } from "/src/lib/warehouse3d/scene.js";
  const products = [{ id:"p1", code:"A1", nameT:"กล่อง", stock:80, widthCm:40,lengthCm:40,heightCm:40, unit:"ชิ้น" }];
  const zones = [
    { id:"Z1", name:"โซน 1", origin:{x:1,z:1}, size:{w:12,l:8}, productIds:["p1"] },
    { id:"Z2", name:"โซน 2", origin:{x:20,z:1}, size:{w:8,l:8}, productIds:[] },
  ];
  const data = buildWarehouseData(products, zones, {});
  window.__SAVED = [];
  window.__SCENE = createWarehouseScene(document.getElementById("host"), data, {
    canEdit:true, onSaveLayout:()=>{}, onSaveCamera:()=>{},
    onSaveZoneGeom:(id,geom)=>{ window.__SAVED.push({id,geom}); },
    snapshotUrl:()=>"",
  });
</script>
```

- [ ] **Step 2: รัน + force ขนาด + เปิดโหมดแก้โซน**

- `preview_start` (stock-app), เปิด `http://localhost:5173/wh3d-dev.html`
- `preview_eval`: `document.getElementById('host').style.cssText='position:fixed;left:0;top:0;width:1300px;height:760px'; window.dispatchEvent(new Event('resize'));`
- `preview_eval`: `document.getElementById('btnZoneEdit').click(); document.documentElement; ({editing: document.querySelector('.wh3d').classList.contains('zoneediting')})` — Expected: `editing:true`

- [ ] **Step 3: ตรวจเลือก + resize + save (จำลองผ่าน eval)**

- เลือกโซน Z1 (เรียก selectZone ผ่าน path จริงไม่ได้ตรง ๆ — กดผ่าน raycast ยาก ใน eval; ใช้คลิกปุ่ม save ต้องเลือกก่อน). ตรวจ resize+save logic โดยจำลองการเลือกผ่าน DOM ไม่ได้ → ตรวจผ่าน "set input + dispatch change + click save" หลังเลือก. เพื่อเลือกโซนใน eval ให้ยิง pointer บนพื้น Z1:
  `preview_eval`:
  ```js
  (() => {
    const cv = document.querySelector('#host canvas'); const r = cv.getBoundingClientRect();
    // กลางจอค่อนซ้าย ~ โซน Z1 (origin 1..13 x). ยิงหลายจุดให้โดนพื้นโซน
    function hit(px,py){ ['pointerdown','pointerup'].forEach(t=>cv.dispatchEvent(new PointerEvent(t,{clientX:r.left+px,clientY:r.top+py,bubbles:true}))); }
    return 'ready';
  })()
  ```
  หมายเหตุ: ถ้าเลือกผ่าน raycast ใน eval ยาก ให้ใช้ทางลัด debug: เพิ่ม `window.__SCENE` ยังไม่พอ (ไม่ export selectZone). **ทางที่เชื่อถือได้กว่า**: ตรวจ `snapClampZoneRect` ผ่าน import ตรง + ตรวจว่า panel/ปุ่มโผล่ถูก:
  `preview_eval`:
  ```js
  (async () => {
    const m = await import('/src/lib/warehouse3d/boxPlan.js');
    const snapped = m.snapClampZoneRect({x:50,z:1},{w:12,l:8},{widthM:54,lengthM:30});
    return {
      panelShown: getComputedStyle(document.getElementById('zoneEditPanel')).display,
      hasW: !!document.getElementById('zeW'),
      saveDisabled: document.getElementById('zeSave').disabled,
      snappedOriginX: snapped.origin.x, // 42 (clamp)
    };
  })()
  ```
  Expected: `panelShown:"block"`, `hasW:true`, `saveDisabled:true` (ยังไม่เลือก), `snappedOriginX:42`

- [ ] **Step 4: ตรวจ select + save จริงผ่าน raycast (ถ้าเลือกได้)**

ยิง pointerdown ที่กลางโซน Z1 บน canvas แล้วตรวจว่า preview/readout ติด + กด save → `window.__SAVED` มีค่า origin/size ที่ snap แล้ว:
```js
(() => {
  const cv = document.querySelector('#host canvas'); const r = cv.getBoundingClientRect();
  const opt = {clientX:r.left+r.width*0.42, clientY:r.top+r.height*0.62, bubbles:true, button:0};
  cv.dispatchEvent(new PointerEvent('pointerdown', opt));
  window.dispatchEvent(new PointerEvent('pointerup', opt));
  const selTxt = document.getElementById('zeSel').textContent;
  const disabled = document.getElementById('zeSave').disabled;
  if (!disabled) document.getElementById('zeSave').click();
  return { selTxt, disabled, saved: window.__SAVED };
})()
```
Expected: ถ้า raycast โดนพื้นโซน → `disabled:false`, `selTxt` มีชื่อโซน, `saved` มี `{id, geom:{origin,size}}` (origin/size เป็นทวีคูณ 0.5)
ถ้ายิงไม่โดน (มุมกล้อง) → ปรับพิกัด px,py แล้วลองใหม่; ผ่านได้ก็พอ (logic save/snap ยืนยันด้วย Step 3 + vitest แล้ว)
- `preview_console_logs` level error — Expected: ไม่มี

- [ ] **Step 5: ลบ harness + test/typecheck/lint + ปิด server**

```bash
rm -f wh3d-dev.html
```
Run: `npx vitest run` (Expected: ของเรา (boxPlan/warehouse3d/cameraCapture) ผ่าน; DeliveryPlanning อาจยังแดง — ไม่เกี่ยว)
Run: `npm run typecheck` · `npx eslint src/lib/warehouse3d/ src/components/Warehouse3D.jsx`
- `preview_stop`, ยืนยัน `git status` ไม่มี `wh3d-dev.html`

- [ ] **Step 6: commit (ถ้ามีแก้ระหว่าง verify)**

```bash
git add -A -- src/lib/warehouse3d src/components/Warehouse3D.jsx
git commit -m "test(warehouse-3d): verify zone-edit via dev harness"
```

---

## Self-Review

**Spec coverage:**
- โหมดแก้โซนแยกจากลากกล่อง → D3 (btnZoneEdit + setZoneEdit + กัน moveMode ชน) · เลือกโซน raycast → D3/D4 · ลากย้าย live + snap/clamp → D4 (pointer handlers + snapClampZoneRect) · รีไซซ์เลข + frame preview live → D4 (zeResize + setPreviewRect) · บันทึก → onSaveZoneGeom → D4 + D2 · merge warehouse_layout + rebuild → D2 (callback + rebuildKey.g) · บ้าน geometry = warehouse_layout → D2 · pure helper + test → D1 · verify stub ไม่เขียน prod → D5
ครบทุกข้อใน spec

**Placeholder scan:** ไม่มี TBD — D5 Step 4 มี fallback ชัด (ถ้า raycast ไม่โดนให้ปรับพิกัด; logic ยืนยันด้วย Step 3 + vitest)

**Type consistency:** `onSaveZoneGeom(zoneId, {origin,size})` — scene เรียก (D4) ด้วย `snapClampZoneRect(...)` ซึ่งคืน `{origin,size}`; Warehouse3D รับ `(zoneId, geom)` ใช้ `geom.origin/geom.size` (D2) ตรงกัน · `snapClampZoneRect(origin,size,warehouse,step?)` นิยาม D1 ใช้ D3/D4 ตรง · `zePending = {origin,size}` ใช้สม่ำเสมอ · rebuildKey.g อ่าน warehouse_layout.zones[].origin/size ที่ D2 callback เขียน — ตรงกัน

**หมายเหตุ:** D2/D3/D4 (React/scene DOM) ไม่ unit-test — verify ผ่าน D5 dev harness + typecheck/lint; helper (D1) unit-test เต็ม. การลากผ่าน raycast ใน harness อาจเปราะ (ขึ้นกับมุมกล้อง) — มี fallback ตรวจ logic ผ่าน import ตรง + vitest
