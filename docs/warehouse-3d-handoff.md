# Handoff — โกดัง 3D (warehouse_3d) ฟีเจอร์

อ่านไฟล์นี้ก่อนทำงานต่อกับฟีเจอร์โกดัง 3D เขียนให้เซสชันใหม่ที่ไม่มี context เดิม

## สถานะ (2026-06-21)
- **ขึ้น production แล้ว** — commit `8efb0ae` บน `master`, push แล้ว → Vercel auto-deploy
- typecheck/lint สะอาด · `src/utils/warehouse3d.test.ts` 14/14 ผ่าน
- ยังไม่เคยเห็น render **ในแอปจริง** (แอปต้อง login, ผู้ช่วยกรอกรหัสไม่ได้) — verify ผ่าน dev harness แทน (ดูหัวข้อ "วิธี verify")

## ทำอะไรไป / ทำไม
ต่อยอดจาก [[project-ai-stock-count]]: ทำโกดัง 3D สเกลจริงในแอป เพื่อเทียบผังกับภาพ CCTV ที่ AI ใช้นับ stock เริ่มจากให้ Claude Design สร้างไฟล์ standalone (`public/warehouse-3d.html`, prompt อยู่ใน `docs/warehouse-3d-prompt.md`) แล้วพอร์ตเข้าแอปเป็นแท็บ React + ต่อข้อมูลจริง

## สถาปัตยกรรม + data flow
```
sh.products + sh.zones + sh.warehouseLayout
        │  buildWarehouseData()  (src/utils/warehouse3d.js)
        ▼
{ WAREHOUSE, ZONES, PRODUCTS }
        │  createWarehouseScene(container, data, opts)  (src/lib/warehouse3d/scene.js)
        ▼
   Three.js scene ใน <div ref> ของ Warehouse3D.jsx
```
- **โซนจริงว่าง → seed ผังสเก็ตช์อัตโนมัติ** (19 โซน). พอมีโซนจริงใน `sh.zones` จะ override seed
- **geometry/มุมกล้อง/การจัดเรียง** เก็บถาวรใน config ใหม่ `warehouse_layout` (Supabase `app_data`, ทำตามแบบ `so_form_layout` เป๊ะ). ลำดับความสำคัญ: saved (warehouse_layout) > geometry ในตัว zone (seed/นำเข้า) > auto-place
- **ผังจริงจากสเก็ตช์ผู้ใช้** (อยู่ใน `DESIGN_ZONES` ใน warehouse3d.js): โกดัง 54×30×10 ม.; คอลัมน์ X = 6/12/12/12/12; แถบ Z = บน8·way3·กลางบน4·กลางล่าง4·way3·ล่าง8; คอลัมน์ขวา (A/a/office) พิเศษ = A8/way3/a4/office15; b,f = กล่อง 9×4 มี way 3m ทางขวา; เส้นเหลืองตีพื้นรอบทุกโซน

## ไฟล์
| ไฟล์ | หน้าที่ |
|---|---|
| `src/utils/warehouse3d.js` | bridge ข้อมูล: `buildWarehouseData`, `claudeDesignZones` (seed 19 โซน), `designSlots`, `autoPlaceZones`, `DEFAULT_WAREHOUSE` |
| `src/utils/warehouse3d.test.ts` | unit test ของ util (vitest) |
| `src/lib/warehouse3d/scene.js` | เอนจิน 3D `createWarehouseScene(container,{WAREHOUSE,ZONES,PRODUCTS},{canEdit,onSaveLayout,onSaveCamera})` คืน `{dispose}` |
| `src/components/Warehouse3D.jsx` | React wrapper + toolbar (นำเข้า/export), เรียก scene, persist ผ่าน setWarehouseLayout |
| `src/App.jsx` | lazy import, NAV_ICONS/SECTIONS, render `tab==="warehouse_3d"`, state+wiring `warehouseLayout` (5 จุดแบบ soFormLayout: state/getSetters/applyData/autosave+deps/sh) |
| `src/utils/constants.js` | ALL_TABS + TAB_LABELS (`warehouse_3d`) |
| `src/utils/storage.ts` | KEY_MAP เพิ่ม `v3_warehouse_layout: "warehouse_layout"` |
| `vite.config.js` | manualChunks เพิ่ม `vendor-three` |
| `public/warehouse-3d.html` | standalone (CDN three) ไว้ iterate กับ Claude Design |

## วิธี verify (สำคัญ — แอป login ไม่ได้)
1. `npm run dev` (Vite) — มี preview server อยู่แล้วในเครื่องมือ
2. สร้างไฟล์ชั่วคราว `wh3d-dev.html` ที่ root:
   ```html
   <div id="host" style="position:fixed;inset:0"></div>
   <script type="module">
     import { buildWarehouseData } from "/src/utils/warehouse3d.js";
     import { createWarehouseScene } from "/src/lib/warehouse3d/scene.js";
     const data = buildWarehouseData([], [], {}); // [] zones -> seed สเก็ตช์
     window.__DATA = data;
     createWarehouseScene(document.getElementById("host"), data, { canEdit:true, onSaveLayout:()=>{}, onSaveCamera:()=>{} });
   </script>
   ```
3. เปิด `/wh3d-dev.html`. preview window มักเริ่มที่ 0×0 → force ขนาด: `document.getElementById('host').style.cssText='position:fixed;left:0;top:0;width:1200px;height:700px'; window.dispatchEvent(new Event('resize'))`
4. ตรวจ `window.__DATA.ZONES` (พิกัด), `.zone-row` count, console errors. **ลบ `wh3d-dev.html` หลังเสร็จ** (ห้าม commit)
- `preview_screenshot` ของ canvas WebGL **timeout เสมอ** (ข้อจำกัด tool) — อย่าเสียเวลา, ใช้ eval/console/__DATA แทน
- `npm run typecheck` · `npx eslint <ไฟล์>` · `npx vitest run src/utils/warehouse3d.test.ts`

## ค้าง / ทำต่อได้ (เรียงความสำคัญ)
1. **ลากย้าย/รีไซส์ตัวโซนใน 3D + เซฟ** — ตอนนี้โหมดจัดเรียงย้ายได้แค่กล่องสินค้าในโซน ตัวโซนปรับผ่าน data เท่านั้น
2. **ผูกสินค้าจริงเข้าโซน** (แท็บ "โซน") แล้ว 3D จะโชว์กล่องตามจำนวนจริง (ตอนนี้โซน seed productIds ว่าง = ไม่มีกล่อง)
3. **ความสูงเพดานต่อโซน** — ตอนนี้ค่าเดียวทั้งโกดัง (10 ม.)
4. **ยืนยัน render ในแอปจริง** — ถ้า user login ในเซสชันหน้า ขับ preview เปิดแท็บ "โกดัง 3D" ตรวจ console/interaction

## Gotchas
- **localhost = Supabase prod** ([[feedback-preview-writes-prod]]): กด "บันทึกมุมกล้อง/บันทึกการจัดเรียง/นำเข้าผังเป็นโซนจริง" = เขียน prod จริง — อย่ากดตอน verify ถ้าไม่ได้รับอนุญาต
- ปุ่ม "นำเข้าผังเป็นโซนจริง" โผล่เฉพาะตอนแท็บโซนว่าง → `setZones(claudeDesignZones())` เขียน 19 โซนลง `zones`
- **โค้ดเรนเดอร์ซ้ำ 2 ที่**: `src/lib/warehouse3d/scene.js` (แอป) กับ `public/warehouse-3d.html` (standalone) — แก้ logic 3D ต้องแก้ทั้งคู่
- workflow ผู้ใช้ ([[feedback-branching]]): commit ตรง master, push = auto-deploy Vercel, ไม่มี branch/PR — commit/push เมื่อสั่งเท่านั้น
- ผู้ใช้ตอบเป็นไทย, chat ห้าม emoji ([[feedback-no-emoji]])
