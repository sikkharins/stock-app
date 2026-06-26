# Handoff — โกดัง 3D (`warehouse_3d`)

อ่านไฟล์นี้ไฟล์เดียวก็ทำงานต่อได้เลย เขียนให้เซสชันใหม่ที่ไม่มี context เดิม (cold start).
memory `project_warehouse_3d.md` เป็น pointer ถาวร — ไฟล์นี้คือรายละเอียดเต็ม.

## สถานะ (2026-06-22)
- **ขึ้น production ครบทุกเฟส A→E2** บน `master` (ล่าสุด `a8da90d`), push แล้ว → Vercel auto-deploy
- **(2026-06-27) เส้นขอบกล่อง (box-edges)** บน `master` (`0c48dad`), push/deploy แล้ว — กล่องทุกใบมีเส้นขอบ 12 เส้นสีเข้มโปร่งแสง (`#2a2018`/op 0.35) ให้เห็นแต่ละกล่อง/ชั้นที่ซ้อน อ่านความสูงได้; pile ตีกรอบ 1 อัน. spec/plan `2026-06-27-warehouse-3d-box-edges`
- roadmap "ทำหมดเลย": **A** ลบ standalone · **B** กล่องจริงต่อ SKU + overflow + สีต่อ SKU · **C** CCTV live overlay · **D** แก้ตัวโซนใน 3D + บ้าน geometry · **E1** เพดานต่อโซน · **E2** touch/tablet — **เสร็จหมดแล้ว**
- typecheck/eslint สะอาด · vitest ผ่าน (ยกเว้น `DeliveryPlanning > Pick List` ที่แดงจากงาน picklist ของ agent อื่น — **ไม่เกี่ยวกับ warehouse_3d**)
- spec/plan ทุกเฟสอยู่ใน `docs/superpowers/specs/` และ `docs/superpowers/plans/` (ไฟล์ `2026-06-21-warehouse-3d-*`)
- **ยังไม่เคยเห็น render ในแอปจริง** (แอปต้อง login, ผู้ช่วยกรอกรหัสไม่ได้) — ทุกเฟส verify ผ่าน dev harness (ดู "วิธี verify"). **touch จริงต้องลองบน tablet เอง**

## ทำอะไรไป / ทำไม
ต่อยอดจาก AI stock count (memory `project_ai_stock_count.md`): โกดัง 3D สเกลจริงในแอป เพื่อเทียบผัง 3D กับภาพ CCTV ที่ AI ใช้นับ stock + เก็บมุมกล้อง CCTV ต่อโซน.
เดิมมีไฟล์ standalone HTML (prompt `docs/warehouse-3d-prompt.md`) → พอร์ตเป็น `src/lib/warehouse3d/scene.js` → ห่อด้วยแท็บ React. **standalone ถูกลบแล้ว (Phase A)** — `scene.js` เป็นแหล่งเดียวของ logic 3D.

## สถาปัตยกรรม + data flow
```
sh.products + sh.zones + sh.warehouseLayout            (App state, จาก Supabase app_data)
        │  buildWarehouseData(products, zones, warehouseLayout)   ← src/utils/warehouse3d.js
        ▼
{ WAREHOUSE, ZONES, PRODUCTS }   (ZONES[].{origin,size,color,productIds,presets,heightM,camera?,layout?})
        │  createWarehouseScene(container, DATA, { canEdit, onSaveLayout, onSaveCamera, onSaveZoneGeom, snapshotUrl })
        ▼                                                          ↑ src/lib/warehouse3d/scene.js
   Three.js scene ใน <div ref> ของ Warehouse3D.jsx → คืน { dispose }
        │  (กดเซฟ) onSaveLayout/onSaveCamera/onSaveZoneGeom → setWarehouseLayout(prev=>…) → autosave → Supabase
        ▲────────────────────────────────────────────────────────────────────────────────────────────────┘
```
ฟีเจอร์ใน scene (หลัง B–E2): กล่องจริงต่อ SKU (`planBoxes`/`productColor`, InstancedMesh) · overflow ซ้อนทะลุเพดาน + โซนแดง · pile fallback เมื่อ stock > `REP_THRESHOLD`(5000) · แผงเทียบ CCTV ("เทียบ CCTV") ดึงเฟรมสดผ่าน `snapshotUrl` ตาม `zone.presets` + drag/drop fallback · โหมด "✥ แก้โซน" ลากย้าย/กรอก w·l·h รีไซซ์ → `onSaveZoneGeom` · เพดานต่อโซน (`zone.heightM`) · touch (`controls.touches` ในโหมดแก้) · เส้นขอบกล่อง (`boxEdges` ใน scene.js + `mergeEdgePositions` ใน boxPlan.js, `LineSegments` merge ก้อนเดียวต่อ SKU เป็นลูก `pg`, `userData.isEdge` → dim ตามโซนใน `applyVisibility`, rebuild ที่ `pointerup` ตอนย้ายกล่องเดี่ยว).

ลำดับความสำคัญ geometry แต่ละโซน (`buildWarehouseData`):
**saved (`warehouse_layout.zones[id]`) > geometry ในตัว zone (seed/นำเข้า) > slot template ผังสเก็ตช์ > auto-place กริด**
- แอป **ไม่มีโซนจริง** (`sh.zones` ว่าง) → seed ผังสเก็ตช์ 19 โซน (productIds ว่าง = ไม่มีกล่อง). มีโซนจริงเมื่อไหร่ override seed + สินค้าจริงโผล่
- ผูกสินค้า→โซน (`zone.productIds`) และ preset กล้อง→โซน (`zone.presets`) ตั้งในแท็บ "โซน" (`Zones.jsx`)
- `WAREHOUSE` = `warehouse_layout.warehouse` ถ้ามี ไม่งั้น `DEFAULT_WAREHOUSE = {54,30,10}`; `heightM` ต่อโซน fallback = ค่ารวมนี้

### ผังจริงจากสเก็ตช์ (`DESIGN_ZONES` ใน warehouse3d.js)
โกดัง 54(X) × 30(Z) × 10(H) ม., 19 โซน:
- คอลัมน์ X: `E/e/i/I`=0(w6) · `D/d/h/H`=6(w12) · `C/c/g/G`=18(w12) · `B/b/f/F`=30(w12) · `A/a/office`=42(w12)
- แถบ Z: บน 0–8 · WAY 8–11 · กลางบน 11–15 · กลางล่าง 15–19 · WAY 19–22 · ล่าง 22–30
- คอลัมน์ขวาพิเศษ: `A`(z0,l8)/way/`a`(z11,l4)/`office`(z15,l15); `b`,`f` = กล่อง 9×4 (เว้น WAY 3m); เส้นเหลืองตีพื้นรอบทุกโซน

## แผนที่ไฟล์
| ไฟล์ | หน้าที่ |
|---|---|
| `src/utils/warehouse3d.js` (+test) | **bridge** — `buildWarehouseData` (ZONES พา origin/size/color/productIds/**presets/heightM**), `claudeDesignZones`, `designSlots`, `autoPlaceZones`, `mapProduct`, `DEFAULT_WAREHOUSE`, `DESIGN_ZONES` |
| `src/lib/warehouse3d/boxPlan.js` (+test) | **pure helpers** (unit-test ได้) — `planBoxes` (packing+overflow แนวตั้ง), `productColor`/`PRODUCT_PALETTE` (สีต่อ SKU), `snapClampZoneRect` (footprint snap/clamp), `clampZoneHeight`, `REP_THRESHOLD`=5000, `mergeEdgePositions` (merge box-edge template ตาม centers → Float32Array สำหรับเส้นขอบกล่อง) |
| `src/lib/warehouse3d/scene.js` | **เอนจิน 3D** `createWarehouseScene(container, DATA, {canEdit,onSaveLayout,onSaveCamera,onSaveZoneGeom,snapshotUrl})` → `{dispose}`. toolbar, การ์ดโซน, โหมดจัดเรียงกล่อง (✋), โหมดแก้โซน (✥), แผงเทียบ CCTV, มุมกล้อง, `ResizeObserver`, touch (`controls.touches`) |
| `src/components/Warehouse3D.jsx` | **React wrapper** — สร้าง DATA, mount scene, ส่ง opts/callbacks (onSave*, `snapshotUrl`=`cctvSnapshotUrl(getRelayUrl(),…)`), persist `setWarehouseLayout`, คุม `rebuildKey` |
| `src/utils/cameraCapture.ts` (+test) | relay กล้อง: `getRelayUrl`/`setRelayUrl`, `pickCaptureTargets`, **`cctvSnapshotUrl(base,token?,t?)`** (สร้าง URL `<img src>` ดึงเฟรม `/snapshot?preset=`) |
| `src/components/Zones.jsx` | แท็บ "โซน" — ผูกสินค้า (`productIds`) + preset กล้อง (`presets`) ต่อโซน |
| `src/App.jsx` | lazy import; `NAV_ICONS.warehouse_3d`; แท็บใน SECTIONS; render `tab==="warehouse_3d"`; state+wiring `warehouseLayout` (5 จุด) |
| `src/utils/constants.js` / `storage.ts` | `ALL_TABS`+`TAB_LABELS`; `KEY_MAP v3_warehouse_layout` |
| `vite.config.js` | `manualChunks` `vendor-three` |
| `docs/warehouse-3d-prompt.md` | prompt ต้นทาง (ไฟล์ standalone ถูกลบแล้ว) |

### persistence — `warehouse_layout` (ทำตามแบบ `so_form_layout`)
รูปร่าง: `{ warehouse?: {widthM,lengthM,heightM}, zones: { [zoneId]: { origin?, size?, color?, heightM?, camera?, layout? } } }`
(หมายเหตุ: **บ้านของ geometry/3D-state = `warehouse_layout`** ตัดสินใน Phase D; `zones` เก็บ business เท่านั้น (name/note/productIds/presets). `zone.origin/size` จาก "นำเข้าผังเป็นโซนจริง" เป็น seed — warehouse_layout override)
wiring 5 จุดใน `App.jsx` (เทียบ `soFormLayout`): state `useState({})` (~87) · ส่งเข้า `sh` · applyData `g("warehouse_layout","v3_warehouse_layout",{})` (~216) · autosave `current.warehouse_layout` + deps (~339/358) · `KEY_MAP` (storage.ts)

### rebuild / persist semantics (สำคัญถ้าจะแก้ Warehouse3D.jsx)
- `rebuildKey` (useMemo) เปลี่ยนเมื่อ **catalog / zone membership / ขนาดโกดัง / per-zone origin·size·heightM** (key `g`) → สร้าง scene ใหม่
- **เซฟมุมกล้อง / เซฟการจัดเรียงกล่อง ไม่ rebuild** (ตั้งใจ); **เซฟโซน (geom/heightM) → rebuild** (repack กล่องตาม footprint/เพดานใหม่)
- callbacks ใช้ `useCallback`, exclude จาก deps ของ mount effect (eslint-disable กำกับ) · ระวัง [[feedback-usememo-tdz]]/[[feedback-inline-component-remount]]

## วิธี verify (สำคัญ — แอป login ไม่ได้ + screenshot WebGL timeout)
1. `preview_start` (มี config `stock-app` ใน `.claude/launch.json`, `npm run dev` port 5173)
2. สร้างไฟล์ชั่วคราว `wh3d-dev.html` ที่ root (mount scene ข้าม login; ใส่ product/zone ปลอม + canEdit + callback stub):
   ```html
   <div id="host" style="position:fixed;inset:0"></div>
   <script type="module">
     import { buildWarehouseData } from "/src/utils/warehouse3d.js";
     import { createWarehouseScene } from "/src/lib/warehouse3d/scene.js";
     const products = [{ id:"p1", code:"A1", nameT:"กล่อง", stock:120, widthCm:40,lengthCm:40,heightCm:40, unit:"ชิ้น" }];
     const zones = [{ id:"Z1", name:"โซน 1", origin:{x:1,z:1}, size:{w:12,l:8}, productIds:["p1"],
                      presets:[{token:"1",name:"มุม A"}] }];
     const data = buildWarehouseData(products, zones, {});
     window.__DATA = data; window.__SAVED = [];
     window.__SCENE = createWarehouseScene(document.getElementById("host"), data, {
       canEdit:true, onSaveLayout:()=>{}, onSaveCamera:()=>{},
       onSaveZoneGeom:(id,geom)=>window.__SAVED.push({id,geom}),
       snapshotUrl:(tok)=>"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
     }); // stub callbacks = ไม่เขียน prod
   </script>
   ```
3. เปิด `http://localhost:5173/wh3d-dev.html` (ใช้ absolute URL; relative อาจ error). preview มักเริ่ม 0×0 → force ขนาดด้วย `preview_eval`:
   `document.getElementById('host').style.cssText='position:fixed;left:0;top:0;width:1300px;height:760px'; window.dispatchEvent(new Event('resize'));`
4. ตรวจแบบ text/eval: `window.__DATA.ZONES`, `.zone-row` + `.zr-meta` (fill%), `.zone-row.overflow`, swatch `.zp-sw` สีต่อ SKU, แผง `#ccLiveBar`/`#cctvImg`, โหมด `#btnZoneEdit`→`#zeSel`/`#zeW/zeL/zeH`→`#zeSave`→`window.__SAVED`, `host.querySelector('canvas')`. ตรวจ pure logic ด้วย `import('/src/lib/warehouse3d/boxPlan.js')` ตรง ๆ
5. **ลบ `wh3d-dev.html` หลังเสร็จ — ห้าม commit**
- ⚠ `preview_screenshot` ของ canvas WebGL **timeout เสมอ** — ใช้ `preview_eval`/console/`__DATA`/`__SAVED` แทน
- ⚠ **touch หลายนิ้ว (OrbitControls) auto-verify ไม่ได้** — ตรวจ no-regression (toggle โหมดไม่ throw) + code review; touch จริงเช็คบน tablet
- คำสั่งอื่น: `npm run typecheck` · `npx eslint src/lib/warehouse3d/` · `npx vitest run`

## ค้าง / ไอเดียต่อยอด
- **A→E2 เสร็จหมดแล้ว** (ไม่มี pending ของ roadmap เดิม)
- ยืนยัน render/interaction ในแอปจริง (ถ้าเซสชันหน้า login ได้): เปิดแท็บ "โกดัง 3D" ตรวจ console + ลองจัดเรียง/เซฟมุม/แก้โซน/ดึง CCTV/touch บน tablet
- ไอเดีย: เพดานต่อโซนแบบมองเห็น (E1 เลือก logic-only), gesture touch ขั้นสูง, ผูกหลายกล้องต่อโซน

## Gotchas
- **localhost = Supabase prod** ([[feedback-preview-writes-prod]]): กดปุ่มเซฟ (มุมกล้อง/จัดเรียง/บันทึกโซน/นำเข้าผัง) = เขียน prod — **อย่ากดตอน verify**; dev harness ใช้ callback stub จึงปลอดภัย
- ปุ่ม **"นำเข้าผังเป็นโซนจริง (19 โซน)"** โผล่เฉพาะแท็บโซนว่าง → `setZones(claudeDesignZones())`
- **logic 3D อยู่ที่เดียว** `scene.js` (standalone ลบแล้ว); **pure logic แยกไป `boxPlan.js`** (ที่ test ได้) — แก้การวางกล่อง/สี/snap แก้ที่ boxPlan + เขียน vitest
- **บ้าน geometry = `warehouse_layout`** (ไม่ใช่ zone record) — เซฟ origin/size/heightM ที่นี่ที่เดียว
- **commit/push ตรง master เมื่อสั่ง** ([[feedback-branching]]); push = Vercel auto-deploy; ไม่มี branch/PR
- ผู้ใช้สื่อสารไทย; ตอบ chat **ห้าม emoji** ([[feedback-no-emoji]]) — emoji ใน UI/โค้ด (✋ ✥ 💾 ◰) คงไว้
- eslint flat config อาจไม่ครอบ `.ts` บางไฟล์ (เช่น `cameraCapture.ts` ขึ้น warning "ignored") — ไม่ใช่ error
