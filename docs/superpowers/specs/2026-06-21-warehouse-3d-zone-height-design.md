# Spec — โกดัง 3D Phase E1: เพดานต่อโซน (per-zone ceiling height)

วันที่: 2026-06-21 · ฟีเจอร์: `warehouse_3d` · ก้อน E1 (E แตกเป็น E1 ceiling / E2 touch)
อ่านคู่กับ [handoff](../../warehouse-3d-handoff.md), memory `project_warehouse_3d.md`, ต่อยอด Phase D (โหมด "✥ แก้โซน")

## เป้าหมาย
ให้แต่ละโซนมีความสูงเพดานของตัวเอง (เช่นโซนชั้นวางเตี้ย) แทนค่ารวมค่าเดียว — มีผลกับการซ้อนกล่อง/overflow/ความเต็ม%

## การตัดสินใจ (เคาะแล้ว)
- **Logic-only:** heightM ต่อโซนมีผลกับ stacking/overflow(แดง)/volume% เท่านั้น — **ไม่วาดเพดานให้เห็น** (overflow แดงบอกว่าสูงเกินอยู่แล้ว)
- **บ้านข้อมูล = `warehouse_layout.zones[id].heightM`** (เดียวกับ origin/size จาก Phase D)

## บริบท (ของที่มี)
- `WAREHOUSE.heightM` (ค่ารวม, default 10) ถูกใช้ที่: ผนัง/แสง, `planBoxes` ceilingH (`scene.js:471`), pile targetH/ph, `zoneVol` (→ fill%, `scene.js:564`), popup "เพดาน N ม." (`:845`), ลิมิตซ้อนตอนลากกล่อง `resolvePlacement` (`:935`), ตำแหน่ง label (`:454`)
- Phase D: แผง "✥ แก้โซน" + `onSaveZoneGeom(id,{origin,size})` → `warehouse_layout.zones[id]`; `rebuildKey.g` รวม per-zone origin/size แล้ว
- buildWarehouseData ขา `saved` (warehouse_layout) priority สูงสุด

## Scope ของ E1
1. **bridge:** `buildWarehouseData` → `ZONES[].heightM = saved.heightM ?? z.heightM ?? WAREHOUSE.heightM` (number)
2. **scene.js ใช้ `zone.heightM` แทน `WAREHOUSE.heightM`** ที่ logic ต่อโซน:
   - `planBoxes(d, { innerW, innerL, ceilingH: zone.heightM }, ...)`
   - `zoneVol = zone.size.w * zone.size.l * zone.heightM`
   - pile `targetH = Math.min(zone.heightM * 0.85, 3.2)`, `ph = Math.min(..., zone.heightM * 0.95)`
   - popup "ซ้อนได้สูงสุด ... เพดาน {zoneHeight} ม." (อ่านจากโซนของสินค้านั้น)
   - drag `resolvePlacement`: ลิมิต `y + u.h/2 > zoneHeightOf(u.zoneId)` (แทน WAREHOUSE.heightM)
   - **คงค่ารวม** ที่: ผนัง/แสง/หลังคาโกดัง, ตำแหน่ง label (ไม่เกี่ยวเพดานโซน)
3. **UI:** เพิ่มช่อง "สูง (ม.)" (`zeH`) ในแผง "✥ แก้โซน"; `zeSelectZone` เติมค่า; เปลี่ยนค่า → อัปเดต pending + readout; "บันทึกโซน" → `onSaveZoneGeom(id, {origin, size, heightM})`
4. **save/rebuild:** ขยาย `onSaveZoneGeom` (Warehouse3D) ให้ merge `heightM` ลง warehouse_layout.zones[id]; ขยาย `rebuildKey.g` ให้รวม `heightM` → rebuild
5. **pure helper:** `clampZoneHeight(h, warehouse, step=0.5)` → snap 0.5 + clamp `[step, warehouse.heightM]` (+vitest)

## Data flow
```
(แก้ใน 3D) zeH input → clampZoneHeight → zePending.heightM
   → "บันทึกโซน" → onSaveZoneGeom(id,{origin,size,heightM})
   → Warehouse3D merge warehouse_layout.zones[id].heightM → rebuildKey.g เปลี่ยน → rebuild
   → buildWarehouseData: ZONES[].heightM (saved) → scene ใช้ต่อโซน
```

## Out of scope
- เพดานที่มองเห็น (เส้น/ระนาบ) — เลือก logic-only · ผนัง/หลังคาโกดัง (คงค่ารวม) · E2 touch
- ไม่เปลี่ยน WAREHOUSE.heightM (ค่ารวมยังเป็น default/fallback + ใช้กับตัวอาคาร)

## Verification (login ไม่ได้ + WebGL screenshot timeout)
- vitest: `clampZoneHeight` (snap 0.5, clamp ต่ำสุด step, สูงสุด = warehouse.heightM); `buildWarehouseData` พา heightM (saved > intrinsic > fallback)
- dev harness `wh3d-dev.html` (ลบหลังเสร็จ): โซนจริง + canEdit. ตรวจผ่าน `preview_eval`:
  - เปิด "✥ แก้โซน" → เลือกโซน → ช่อง zeH มีค่า (fallback warehouse height)
  - กรอกสูงต่ำลง (เช่น 3) → "บันทึกโซน" → `window.__SAVED` ได้ `geom.heightM === 3` (clamp/snap แล้ว)
  - (ตรวจ logic effect) planBoxes ผ่าน import: ceilingH ต่ำ → layersMax ต่ำ → overflow ง่ายขึ้น
- `npm run typecheck` · `npx eslint` · `npx vitest run`

## Risks / gotchas
- localhost = Supabase prod ([[feedback-preview-writes-prod]]): harness ใช้ onSaveZoneGeom stub, ห้ามกด "บันทึกโซน" ใน UI จริงตอน verify
- เพดานโซน > เพดานโกดังไม่ได้ (clamp ≤ WAREHOUSE.heightM) — กล่องไม่ทะลุหลังคาอาคาร แต่ยัง overflow แดงได้ถ้าเกินเพดานโซน
- โซนเก่าที่ไม่มี heightM → fallback ค่ารวม (ไม่ retroactive เปลี่ยน behavior)
- commit/push ตรง master เมื่อสั่ง; chat ห้าม emoji; LF→CRLF ไม่เป็นไร

## Definition of done
- ตั้งความสูงต่อโซนในแผงแก้โซน → บันทึก → เปิดใหม่ค่าคงอยู่ (warehouse_layout); โซนเพดานเตี้ย stacking/overflow/fill% เปลี่ยนตาม
- `clampZoneHeight` + bridge heightM มี vitest ผ่าน; typecheck/eslint สะอาด; ไม่มี dev harness ค้าง
