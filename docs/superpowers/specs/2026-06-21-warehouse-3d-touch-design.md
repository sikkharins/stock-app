# Spec — โกดัง 3D Phase E2: touch/tablet

วันที่: 2026-06-21 · ฟีเจอร์: `warehouse_3d` · ก้อน E2 (จาก E = E1 ceiling + E2 touch)
อ่านคู่กับ [handoff](../../warehouse-3d-handoff.md), memory `project_warehouse_3d.md`

## เป้าหมาย
ให้แท็บโกดัง 3D ใช้งานบน tablet/touch ได้ลื่น โดยเฉพาะ "โหมดแก้" (✋ จัดเรียงกล่อง / ✥ แก้โซน) ที่นิ้วเดียวต้องลากวัตถุได้ ไม่ใช่หมุนกล้องทับ

## การตัดสินใจ
- **Mirror desktop ลง touch:** โหมดปกติ นิ้วเดียว = หมุนกล้อง; โหมดแก้ นิ้วเดียว = ลากวัตถุ, สองนิ้ว = หมุน/ซูม (เหมือน left/right mouse)

## บริบท (ของที่มี — verify+tune ไม่ใช่ build)
- `OrbitControls` (three r0.184) ตั้ง `canvas.style.touchAction='none'` ให้เองในตัว → ไม่ต้องตั้งเพิ่ม
- drag ทั้งหมด (กล่อง: `pointerdown/move/up`; โซน Phase D) ใช้ **PointerEvent** ซึ่งครอบ touch แล้ว (verified ผ่าน dispatched PointerEvent ใน D5/E1.5)
- **ช่องว่างเดียว:** `setMove` (`scene.js:891`) + `setZoneEdit` (`:1021`) ตั้งแค่ `controls.mouseButtons` (LEFT:null ในโหมดแก้) แต่**ไม่ตั้ง `controls.touches`** → นิ้วเดียวยังเป็น `TOUCH.ROTATE` (default) หมุนกล้องทับการลากบน tablet

## Scope ของ E2
1. เพิ่ม `controls.touches` ใน `setMove` + `setZoneEdit` (สมมาตรกับ mouseButtons ที่มี):
   - **on (โหมดแก้):** `{ ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE }` → นิ้วเดียวไม่ขยับกล้อง (ปล่อยให้ drag handler ทำงาน), สองนิ้ว = pinch zoom + rotate
   - **off:** `{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }` (ค่าปกติของ OrbitControls)
2. tap targets: ตรวจ `.tbtn` (ปุ่ม toolbar/panel) ให้สูงพอแตะ; ถ้าต่ำกว่า ~34px ให้เพิ่ม `min-height`

## Out of scope
- ไม่แตะ drag logic (PointerEvent ใช้ได้แล้ว) · ไม่ทำ gesture พิเศษ/haptics/long-press · ไม่ตั้ง touch-action (OrbitControls จัดให้)
- ไม่เปลี่ยน mouseButtons (desktop เดิมไม่กระทบ)

## Verification (touch auto-verify ไม่ได้ — เหมือน WebGL screenshot)
- vitest: ไม่มี pure logic ใหม่ → ไม่เพิ่ม test (เป็นการตั้งค่า OrbitControls)
- dev harness: scene build ได้ ไม่มี console error; drag ด้วย PointerEvent (mouse path) ยังทำงาน (เหมือน D5/E1.5); ตรวจว่า toggle โหมดไม่ throw
- **touch จริง:** ผู้ใช้เช็คบน tablet (auto-verify หลายนิ้วใน OrbitControls ไม่ได้) — code review รับประกันค่า `controls.touches` ถูก
- `npm run typecheck` · `npx eslint` · `npx vitest run`

## Risks / gotchas
- `THREE.TOUCH.DOLLY_ROTATE` = สองนิ้ว zoom+rotate; ถ้าผู้ใช้อยากได้ pan สองนิ้วในโหมดแก้แทน ปรับเป็น `DOLLY_PAN` ได้ (เลือก rotate เพราะโหมดแก้ปกติอยากหมุนดูมุม)
- `controls.touches.ONE = null` → OrbitControls ปล่อย state เป็น NONE (นิ้วเดียวไม่ขยับกล้อง) ตามที่ต้องการ
- localhost = Supabase prod: harness ไม่กดปุ่ม save · commit/push เมื่อสั่ง · chat ห้าม emoji

## Definition of done
- โหมดแก้: `controls.touches.ONE` ไม่ใช่ ROTATE (ปล่อยลากวัตถุ), สองนิ้วคุมกล้อง; โหมดปกติคืนค่าปกติ
- typecheck/eslint สะอาด; scene build ได้ไม่ error; desktop drag เดิมไม่กระทบ; tap targets แตะง่าย
