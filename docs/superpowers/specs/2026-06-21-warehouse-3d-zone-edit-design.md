# Spec — โกดัง 3D Phase D: แก้ตัวโซนใน 3D + บ้าน geometry

วันที่: 2026-06-21 · ฟีเจอร์: `warehouse_3d` · ก้อน D จากการแตก "ทำหมดเลย" (A→B→C→D→E)
อ่านคู่กับ [handoff](../../warehouse-3d-handoff.md), memory `project_warehouse_3d.md`

## เป้าหมาย
ให้ผู้ใช้ย้าย/รีไซซ์ "ตัวโซน" (origin/size) ในแท็บ 3D แล้วเซฟถาวร และตัดสินให้ geometry มีบ้านเดียว เลิกความเสี่ยง 2-source-of-truth ที่ flag ไว้ตั้งแต่ Phase B

## การตัดสินใจหลัก (เคาะแล้ว)
- **Interaction:** ลากย้ายบนพื้น (reuse raycast/`floorAt`) + รีไซซ์ด้วยกรอกเลข w/l; snap 0.5 ม.
- **บ้าน geometry = `warehouse_layout`:** เซฟ origin/size ไป `warehouse_layout.zones[id]` (เหมือน camera/layout). `zones` เก็บแค่ business (name/note/productIds/presets). `zone.origin/size` (จาก "นำเข้าผังเป็นโซนจริง") เป็น **seed เริ่มต้น** เท่านั้น — `warehouse_layout` override (ตรงกับ priority เดิมใน buildWarehouseData: `saved > intrinsic > placement`)

## บริบท (ของที่มี)
- buildWarehouseData ขา `saved.origin && saved.size` มี priority สูงสุดอยู่แล้ว แต่ยังไม่มี UI เขียน origin/size ลง warehouse_layout
- scene.js: แต่ละโซน = `group` เดียว (floor `zf` + frame + yellow edges + label + กล่องทุก pg อยู่ใน group นี้) — แต่ children ใช้พิกัด absolute, group อยู่ที่ (0,0,0); ย้ายทั้งโซนทำได้ด้วยตั้ง `group.position` (delta)
- move-mode เดิม (✋ จัดเรียง) ลาก "กล่อง" → เซฟ `warehouse_layout.zones[id].layout`. Phase D เพิ่มโหมดแก้ "โซน" แยกต่างหาก
- Warehouse3D.jsx มี `onSaveCamera`/`onSaveLayout` (functional merge เข้า warehouse_layout) เป็น pattern ให้ทำตาม; `rebuildKey` คุม rebuild เฉพาะ catalog/zones/dims

## Scope ของ D
1. **โหมดใหม่ "✥ แก้โซน"** (toggle, เฉพาะ canEdit) แยกจาก ✋ จัดเรียง. เปิดแล้วคลิกตัวโซน (raycast zone floor/frame) เพื่อเลือก; ออกโหมดล้าง selection
2. **ย้าย (drag):** ลากโซนที่เลือกบนพื้น → ตั้ง `group.position` live, snap 0.5, clamp ในขอบโกดัง (origin ∈ [0, widthM−w] × [0, lengthM−l])
3. **รีไซซ์ (numeric):** แผงเล็กของโซนที่เลือก — input w, l (ม.) + อ่าน origin x/z; snap/clamp ด้วย helper. ระหว่างพิมพ์ **preview เฉพาะกรอบ/พื้นโซน (frame+floor outline) แบบ live** (ถูก); **กล่องข้างใน repack ตอนกด "บันทึกโซน" (rebuild)** — ไม่ repack ทุกครั้งที่พิมพ์
4. **บันทึกโซน:** ปุ่ม → `onSaveZoneGeom(zoneId, {origin, size})` → Warehouse3D.jsx merge เข้า `warehouse_layout.zones[id]` (functional update) → **rebuild scene** (repack กล่องตาม footprint ใหม่)
5. **rebuild trigger:** ขยาย `rebuildKey` ใน Warehouse3D.jsx ให้รวม per-zone `origin/size` จาก warehouse_layout (camera/layout **ยังไม่** rebuild เหมือนเดิม)
6. **pure helper:** `snapClampZoneRect(origin, size, warehouse, step=0.5)` → `{origin, size}` snap+clamp (+vitest)

## Data flow
```
(แก้ใน 3D) drag/numeric → snapClampZoneRect → onSaveZoneGeom(id,{origin,size})
   → Warehouse3D: setWarehouseLayout(prev => merge zones[id].{origin,size})   [warehouse_layout]
   → rebuildKey เปลี่ยน → effect สร้าง scene ใหม่
   → buildWarehouseData: saved.origin/size (priority สูงสุด) → ZONES → scene วางใหม่
```

## Out of scope
- แก้ "สี" โซน (คงจาก palette/import) · แก้ "ความสูง" ต่อโซน (→ Phase E) · touch (→ E)
- ไม่กันโซนซ้อนกัน (ผู้ใช้คุมเอง) — แค่ clamp ในขอบโกดัง + snap
- แก้ตอน seed (โซนตัวอย่าง 19 โซน) — แก้ได้เฉพาะเมื่อมีโซนจริง (sh.zones)
- ไม่แตะ persistence wiring เดิม (ใช้ setWarehouseLayout ที่มี), ไม่แตะ Zones.jsx

## Verification (login ไม่ได้ + WebGL screenshot timeout)
- vitest: `snapClampZoneRect` — snap 0.5, clamp size (min/max), clamp origin ไม่ให้เลยขอบ, ค่าพอดีขอบ
- dev harness `wh3d-dev.html` (ลบหลังเสร็จ): โซนจริง 2-3 โซน + canEdit. ตรวจผ่าน `preview_eval`:
  - เปิด "✥ แก้โซน" → คลิกโซน → selection ติด
  - จำลองลาก (เรียก path ย้าย หรือ set origin) → `group.position`/readout เปลี่ยน, snap 0.5
  - กรอก resize → footprint อัปเดต
  - "บันทึกโซน" → ตรวจ `onSaveZoneGeom` callback ถูกเรียกด้วย {origin,size} ที่ snap แล้ว (stub callback เก็บค่า), ไม่มี console error
  - (ไม่กดเซฟใน UI จริง/ไม่เขียน prod — harness ใช้ callback stub)
- `npm run typecheck` · `npx eslint` · `npx vitest run`

## Risks / gotchas
- localhost = Supabase prod ([[feedback-preview-writes-prod]]): harness ใช้ `onSaveZoneGeom` stub, ห้ามกด "บันทึกโซน" ใน UI จริงตอน verify
- rebuild หลังเซฟ = ฉากกระตุกครั้งเดียว (ยอมรับได้ เพราะ geometry เปลี่ยนทั้ง layout); drag ระหว่างทำไม่ rebuild (แค่ group.position)
- กล่องที่เคยจัดเรียง (layout) อิง origin → ย้ายโซนแล้วกล่องตามไป; ย่อโซนจนกล่องล้น → overflow แดง (Phase B จัดการ)
- ระวัง [[feedback-usememo-tdz]]/[[feedback-inline-component-remount]] ถ้าแตะ Warehouse3D.jsx (rebuildKey/useMemo)
- commit/push ตรง master เมื่อสั่ง ([[feedback-branching]]); chat ห้าม emoji; LF→CRLF ไม่เป็นไร

## Definition of done
- เปิดโหมดแก้โซน → ลากย้าย (snap 0.5, ไม่หลุดขอบ) + กรอก w/l รีไซซ์ → บันทึก → เปิดใหม่ค่าคงอยู่ (warehouse_layout)
- `snapClampZoneRect` มี vitest ผ่าน; typecheck/eslint สะอาด; ไม่มี dev harness ค้าง
- 2-source-of-truth หาย: geometry แก้/เซฟผ่าน warehouse_layout ที่เดียว
