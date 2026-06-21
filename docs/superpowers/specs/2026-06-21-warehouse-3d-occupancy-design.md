# Spec — โกดัง 3D Phase B: occupancy (กล่องจริงต่อ SKU + overflow)

วันที่: 2026-06-21 · ฟีเจอร์: `warehouse_3d` · ก้อน B จากการแตก "ทำหมดเลย" (A→B→C→D→E)
อ่านคู่กับ [handoff doc](../../warehouse-3d-handoff.md) (สถาปัตยกรรม/ไฟล์/วิธี verify) และ memory `project_warehouse_3d.md`

## เป้าหมาย
ให้แท็บโกดัง 3D แสดง **กล่องสินค้าจริงเรียงในแต่ละโซน** ตาม stock จริง เพื่อเทียบกับภาพ CCTV ที่ AI ใช้นับ stock — โซนไหนเต็ม/ล้น เห็นได้ทันที

## บริบทสำคัญ (อ่านก่อนลงมือ — ของส่วนใหญ่ทำเสร็จแล้ว)
การ render กล่องถูก implement ไว้แล้วเกือบครบใน `src/lib/warehouse3d/scene.js` (พอร์ตจาก standalone เดิม) แต่**ไม่เคยรันกับสินค้าจริง** เพราะ seed `productIds` ว่าง และยังไม่มีโซนจริงที่ผูกสินค้า. การผูกสินค้า→โซนทำได้แล้วในแท็บ "โซน" ([Zones.jsx](../../../src/components/Zones.jsx) → `ProductPicker` → `zone.productIds`).

**มีอยู่แล้ว ห้ามสร้างซ้ำ:**
- `volumeOf(p)` (cubicM → dims → `SIZECLASS_VOL` fallback), `boxDims(p)` (ขนาดจริง ม.)
- loop `ZONES.forEach` → `zone.productIds.forEach` วางกล่องต่อ SKU เป็น cluster แล้ว tile clusters ในโซน (curX/curZ band)
- `InstancedMesh` 1 instance/หน่วย เรียง cols×rows×layers; รองรับ manual drag layout (`zone.layout[pid]`)
- volume occupancy: `st.volProducts`, `st.fill = volProducts/zoneVol×100`, `st.zoneVol`
- แผงรายการโซน: `ความเต็มพื้นที่ {st.fill}%` + fill bar สีตาม `fillColor()` (เขียว<50 / เหลือง<80 / ส้ม≤100 / **แดง>100**) + chip เตือนเมื่อ `st.overflow`
- noLayDown: กล่องวางตั้งเสมอ (`dummy.rotation` = 0) + ป้ายเตือนในแผง
- pile fallback (`usePile`) + pallet + ป้าย ×N; ลาก/จัดเรียงกล่องในโหมดจัดเรียง + save layout

## Scope ของ B (4 อย่าง — refine + verify ไม่ใช่ build)

### 1. Verify ว่า render จริงได้ (pipeline ไม่เคยรันกับสินค้า)
- สร้าง dev harness ชั่วคราว (ดูหัวข้อ Verification) ป้อน products + zones(`productIds`) ปลอม
- ยืนยัน: กล่องถูกสร้าง (instance counts), `st.fill`/`st.overflow` คำนวณถูก, แผงโซนโชว์ %/units/แถวสินค้า/chip ถูกต้อง, ไม่มี console error
- **บั๊กที่คาดว่าจะเจอ** ถือเป็นงานของ B ที่ต้องแก้

### 2. สีต่อ SKU (ปัจจุบันสีตามโซน)
- ปัญหา: ทั้งกล่อง/pile/swatch ใช้ `mix(CARDBOARD, zone.color, ~0.28)` → ทุก SKU ในโซนสีเดียวกัน แยกไม่ออก
- แก้: เพิ่ม `productColor(p)` = palette[ hash(p.id) % N ] — **เสถียร** (สินค้าตัวเดียวกันสีเดิมทุกโซน/ทุก render); ใช้ palette ที่อ่านออกบนโทน cardboard
- ใช้ `mix(CARDBOARD, productColor(p), t)` แทน `zone.color` สำหรับ material ของ InstancedMesh + pile; อัปเดต swatch `zp-sw` ในแผงให้ตรง
- **เฟรม/พื้นโซนยังใช้ `zone.color`** (เอกลักษณ์โซนคงไว้)

### 3. Overflow = ซ้อนทะลุเพดาน + โซนแดง (ตามที่ผู้ใช้เลือก)
- ปัจจุบัน: `usePile` ติดเมื่อ `layersUsed > layersMax` หรือ footprint เกิน inner → ยุบเป็นกอง (ขัดกับที่เลือก)
- แก้ packing ของ instanced path — **overflow ต้องเป็นแนวตั้ง (ทะลุเพดาน) ไม่ใช่แนวนอน**:
  - คุม footprint (cols×rows) ของ cluster ให้ **อยู่ในขอบเขตโซนเสมอ** (ไม่กินพื้นที่เกิน inner หรือเกิน share ที่ tile ได้) — ของล้นจึงไประบายทางความสูงเท่านั้น
  - `layers = ceil(stock / perLayer)` **ไม่ cap ที่ `layersMax`** → ถ้าเกิน layersMax กล่องซ้อนสูงเกิน `WAREHOUSE.heightM` (โผล่เหนือเพดาน) = ภาพเตือน
  - เอาเงื่อนไข `layersUsed > layersMax` / footprint ออกจาก `usePile` (เหลือเฉพาะ safety valve ข้อ 4)
  - ตั้ง `st.overflow = true` เมื่อ `layers > layersMax` (ยอด stack เกินเพดาน) หรือ `st.fill > 100`
- โซนแดง: เมื่อ overflow → tint `zf.material.color` + `frame.material.color` ไปทางแดง (`#e0503a`); chip เตือนในแผงมีอยู่แล้ว

### 4. ดัน `REP_THRESHOLD` 200 → ~5,000 (ต่อ SKU)
- ช่วงจริง 300–3,000/โซน (รวมทุก SKU) → ต่อ SKU มักต่ำกว่า 5,000 → เรนเดอร์กล่องจริงเสมอ
- เก็บ pile ไว้เป็น safety valve กรณีสุดโต่งเท่านั้น (ตัวเลขเป็นค่าคงที่ มี comment ว่าปรับได้)

### Refactor เพื่อ testability (ส่วนหนึ่งของ B)
- สกัด logic การวางกล่อง (pure math) ออกจาก scene.js เป็นฟังก์ชันบริสุทธิ์ใน util ใหม่ เช่น
  `planBoxes(product, { innerW, innerL, ceilingH, repThreshold }) → { usePile, cols, rows, layers, footW, footL, overflowAboveCeiling }`
- scene.js เรียก `planBoxes` แล้วเอาผลไปวาง (THREE) — แยก "คิด" ออกจาก "วาด"
- เขียน vitest ให้ `planBoxes`: เคส normal / overflow แนวสูง / safety-valve pile / dims หาย (fallback) / noLayDown

## สิ่งที่ไม่อยู่ใน B (out of scope — ไปก้อนอื่น)
- CCTV overlay → C · ลากย้าย/รีไซส์ตัวโซน + ตัดสินบ้าน geometry → D · เพดานต่อโซน + touch → E
- ไม่แก้ UI ผูกสินค้าในแท็บโซน (มีแล้ว)

## Data flow (ไม่เปลี่ยน)
`sh.products + sh.zones(productIds) + sh.warehouseLayout` → `buildWarehouseData()` → `{WAREHOUSE,ZONES,PRODUCTS}` → `createWarehouseScene()` → scene.js วาดกล่อง. การเปลี่ยนทั้งหมดอยู่ใน scene.js + util `planBoxes` ใหม่ (ไม่แตะ App.jsx / persistence / bridge ยกเว้นถ้าจำเป็น)

## Verification (สำคัญ — login ไม่ได้ + WebGL screenshot timeout)
- vitest กับ `planBoxes` = หลักฐานหลักของ logic (เร็ว ตรวจ overflow/threshold/fallback ได้แม่น)
- dev harness `wh3d-dev.html` (ลบหลังเสร็จ ห้าม commit): ป้อน fake products หลายแบบ (stock <200, ~1,500, >5,000 เพื่อ trigger pile, หนึ่งตัว noLayDown, หนึ่งตัว dims หาย) + fake zones ผูก productIds → ตรวจ DOM แผงโซน (`.zone-row .zr-meta` %, `.fillbar`, `.zr-warn`, แถวสินค้า) ผ่าน `preview_eval`
- instance counts / สี / overflow: ใส่ debug return ชั่วคราวจาก `createWarehouseScene` (เช่น `_debug: { zoneState }`) อ่านผ่าน eval แล้ว **ลบก่อน commit** — เพราะ screenshot WebGL timeout เสมอ
- `npm run typecheck` · `npx eslint <ไฟล์>` · `npx vitest run`

## Risks / gotchas
- localhost = Supabase prod ([[feedback-preview-writes-prod]]): dev harness ใช้ callback stub เท่านั้น ห้ามกด save/นำเข้า/ยืนยันใน UI จริงตอน verify
- commit ตรง master, push = Vercel auto-deploy, **commit/push เมื่อผู้ใช้สั่งเท่านั้น** ([[feedback-branching]])
- ระวัง [[feedback-usememo-tdz]] / [[feedback-inline-component-remount]] ถ้าแตะ Warehouse3D.jsx (ไม่ควรต้องแตะ)
- ตอบ chat ห้าม emoji ([[feedback-no-emoji]]); LF→CRLF warning ของ git ไม่เป็นไร

## Definition of done
- โซนที่ผูกสินค้าจริงแสดงกล่องสี-ต่อ-SKU เรียงตาม stock; โซนล้นซ้อนทะลุเพดาน + แดง; fill% ถูก
- `planBoxes` มี vitest ครอบเคสหลักและผ่าน; typecheck/lint สะอาด; ไม่มี dev harness หลงเหลือใน repo
