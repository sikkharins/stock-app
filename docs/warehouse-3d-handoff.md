# Handoff — โกดัง 3D (`warehouse_3d`)

อ่านไฟล์นี้ไฟล์เดียวก็ทำงานต่อได้เลย เขียนให้เซสชันใหม่ที่ไม่มี context เดิม (cold start).
memory `project_warehouse_3d.md` เป็น pointer ถาวร — ไฟล์นี้คือรายละเอียดเต็ม.

## สถานะ (2026-06-21)
- **ขึ้น production แล้ว** — commit `8efb0ae` บน `master`, push แล้ว → Vercel auto-deploy
- typecheck/lint สะอาด · `src/utils/warehouse3d.test.ts` ผ่านครบ (`npx vitest run src/utils/warehouse3d.test.ts`)
- **ยังไม่เคยเห็น render ในแอปจริง** — แอปต้อง login และผู้ช่วยกรอกรหัสเองไม่ได้ จึง verify ผ่าน dev harness แทน (ดูหัวข้อ "วิธี verify")

## ทำอะไรไป / ทำไม
ต่อยอดจาก AI stock count (memory `project_ai_stock_count.md`): ทำโกดัง 3D สเกลจริงฝังในแอป เพื่อเทียบผัง 3D กับภาพ CCTV ที่ AI ใช้นับ stock และเก็บมุมกล้อง CCTV ต่อโซนไว้ถาวร.
flow การพัฒนา: เดิมให้ Claude Design สร้างไฟล์ standalone HTML (prompt อยู่ใน `docs/warehouse-3d-prompt.md`) → พอร์ตเอนจินเข้าแอปเป็น `src/lib/warehouse3d/scene.js` → ห่อด้วยแท็บ React + ต่อข้อมูลจริง. **ไฟล์ standalone ถูกลบแล้ว** (ไม่ได้ใช้ iterate ต่อ) — `scene.js` เป็นแหล่งเดียวของ logic 3D.

## สถาปัตยกรรม + data flow
```
sh.products + sh.zones + sh.warehouseLayout            (App state, จาก Supabase app_data)
        │  buildWarehouseData(products, zones, warehouseLayout)   ← src/utils/warehouse3d.js
        ▼
{ WAREHOUSE, ZONES, PRODUCTS }                          (DATA shape เดียวกับ standalone HTML)
        │  createWarehouseScene(container, DATA, { canEdit, onSaveLayout, onSaveCamera })  ← scene.js
        ▼
   Three.js scene ใน <div ref> ของ Warehouse3D.jsx → คืน { dispose }
        │  (กดเซฟ) onSaveLayout / onSaveCamera  →  setWarehouseLayout(prev => …)  →  autosave → Supabase
        ▲────────────────────────────────────────────────────────────────────────────────────────┘
```

ลำดับความสำคัญของ geometry แต่ละโซน (ใน `buildWarehouseData`):
**saved (`warehouse_layout.zones[id]`) > geometry ในตัว zone (seed/นำเข้า) > slot template ตามผังสเก็ตช์ > auto-place กริด**
- ถ้าแอป **ยังไม่มีโซนจริง** (`sh.zones` ว่าง) → seed ผังสเก็ตช์ 19 โซน (productIds ว่าง = ไม่มีกล่องสินค้า). พอมีโซนจริงใน `sh.zones` จะ override seed อัตโนมัติ และสินค้าจริงจึงโผล่
- `WAREHOUSE` = `warehouse_layout.warehouse` ถ้ามี ไม่งั้น `DEFAULT_WAREHOUSE = {54, 30, 10}` (กว้าง×ยาว×สูง ม.)

### ผังจริงจากสเก็ตช์ผู้ใช้ (`DESIGN_ZONES` ใน warehouse3d.js)
โกดัง 54(X) × 30(Z) × 10(H) ม., 19 โซน:
- คอลัมน์ X: `E/e/i/I`=0 (w6) · `D/d/h/H`=6 (w12) · `C/c/g/G`=18 (w12) · `B/b/f/F`=30 (w12) · `A/a/office`=42 (w12)
- แถบ Z: บน 0–8 · WAY 8–11 (3m) · กลางบน 11–15 (4m) · กลางล่าง 15–19 (4m) · WAY 19–22 (3m) · ล่าง 22–30 (8m)
- คอลัมน์ขวาพิเศษ: `A`(z0,l8) / way 3m / `a`(z11,l4) / `office`(z15,l15)
- `b`,`f` = กล่อง 9×4 (เว้น WAY 3m ทางขวาในคอลัมน์ B)
- เส้นเหลืองตีพื้นรอบทุกโซน (วาดใน scene.js)
- หมายเหตุ: comment ใน `DESIGN_ZONES` เขียน H=8 แต่ `DEFAULT_WAREHOUSE.heightM=10` — ค่าจริงที่ใช้คือ 10

## แผนที่ไฟล์
| ไฟล์ | หน้าที่ |
|---|---|
| `src/utils/warehouse3d.js` | **bridge ข้อมูล** — `buildWarehouseData`, `claudeDesignZones` (seed 19 โซน), `designSlots`, `autoPlaceZones`, `mapProduct`, `DEFAULT_WAREHOUSE`, `DESIGN_ZONES` |
| `src/utils/warehouse3d.test.ts` | unit test ของ util (vitest) |
| `src/lib/warehouse3d/scene.js` | **เอนจิน 3D** `createWarehouseScene(container, {WAREHOUSE,ZONES,PRODUCTS}, {canEdit,onSaveLayout,onSaveCamera})` → คืน `{dispose}`. มี toolbar, การ์ดโซน, โหมดจัดเรียง, จับมุมกล้อง, `ResizeObserver` |
| `src/components/Warehouse3D.jsx` | **React wrapper** — สร้าง DATA, mount scene, toolbar (นำเข้าผัง / export JSON), persist ผ่าน `setWarehouseLayout`. คุม rebuild ด้วย `rebuildKey` |
| `src/App.jsx` | lazy import; `NAV_ICONS.warehouse_3d="◰"`; แท็บใน SECTIONS "พื้นที่ทำงาน"; render `tab==="warehouse_3d"` (บรรทัด ~525); state+wiring `warehouseLayout` |
| `src/utils/constants.js` | `ALL_TABS` + `TAB_LABELS` เพิ่ม `warehouse_3d` |
| `src/utils/storage.ts` | `KEY_MAP` เพิ่ม `v3_warehouse_layout: "warehouse_layout"` |
| `vite.config.js` | `manualChunks` เพิ่ม `vendor-three` (แยก bundle three.js) |
| `docs/warehouse-3d-prompt.md` | prompt ต้นทางที่เคยใช้สร้าง standalone (ตัวไฟล์ standalone ถูกลบแล้ว) |

### persistence — config ใหม่ `warehouse_layout` (ทำตามแบบ `so_form_layout` เป๊ะ)
รูปร่าง: `{ warehouse?: {widthM,lengthM,heightM}, zones: { [zoneId]: { origin?, size?, color?, camera?, layout? } } }`
wiring 5 จุดใน `App.jsx` (เทียบกับ `soFormLayout` ได้ทุกจุด):
1. **state**: `const [warehouseLayout, setWarehouseLayout] = useState({})` (~บรรทัด 87)
2. **getSetters / sh**: ส่ง `warehouseLayout`, `setWarehouseLayout` (และ `canE`, `zones`, `setZones`, `products`) เข้า object `sh`
3. **applyData (โหลด)**: `out.warehouse_layout = g("warehouse_layout","v3_warehouse_layout",{})` แล้ว `setWarehouseLayout(...)` (~บรรทัด 216)
4. **autosave**: `warehouse_layout: warehouseLayout` ใน `current` (~339) + อยู่ใน deps array ของ effect autosave (~358)
5. **KEY_MAP** (`storage.ts`): `v3_warehouse_layout → warehouse_layout`

### rebuild / persist semantics (สำคัญ ถ้าจะแก้ Warehouse3D.jsx)
- `rebuildKey` (useMemo) เปลี่ยนเฉพาะเมื่อ **catalog / zone membership / ขนาดโกดัง** เปลี่ยน → effect สร้าง scene ใหม่
- **เซฟมุมกล้อง / เซฟการจัดเรียง ไม่ rebuild scene** (ตั้งใจ) — แค่ update state + persist ผ่าน functional update (`setWarehouseLayout(prev => …)`) เพื่อไม่ให้ฉากกระตุกตอนเซฟ
- callbacks `onSaveLayout/onSaveCamera` ใช้ `useCallback` (identity คงที่) ถูก exclude จาก deps ของ mount effect โดยตั้งใจ (มี eslint-disable กำกับ)

## วิธี verify (สำคัญ — แอป login ไม่ได้ + screenshot WebGL timeout)
1. `npm run dev` (Vite) — ใช้ preview tool ที่มีอยู่ (`preview_start` แล้ว `preview_eval`/`preview_console_logs`/`preview_network`)
2. สร้างไฟล์ชั่วคราว `wh3d-dev.html` ที่ root (เพื่อ mount scene โดยข้าม login):
   ```html
   <div id="host" style="position:fixed;inset:0"></div>
   <script type="module">
     import { buildWarehouseData } from "/src/utils/warehouse3d.js";
     import { createWarehouseScene } from "/src/lib/warehouse3d/scene.js";
     const data = buildWarehouseData([], [], {}); // [] zones -> seed สเก็ตช์ 19 โซน
     window.__DATA = data;
     createWarehouseScene(document.getElementById("host"), data,
       { canEdit:true, onSaveLayout:()=>{}, onSaveCamera:()=>{} }); // stub callbacks = ไม่เขียน prod
   </script>
   ```
3. เปิด `/wh3d-dev.html`. preview window มักเริ่มที่ 0×0 → force ขนาดด้วย `preview_eval`:
   ```js
   document.getElementById('host').style.cssText='position:fixed;left:0;top:0;width:1200px;height:700px';
   window.dispatchEvent(new Event('resize'));
   ```
4. ตรวจผลแบบ text-based: `window.__DATA.ZONES` (พิกัด/สี), จำนวน `.zone-row`/การ์ดโซน, console errors, `host.querySelector('canvas')` มีจริง
5. **ลบ `wh3d-dev.html` หลังเสร็จ — ห้าม commit**
- ⚠ `preview_screenshot` ของ canvas WebGL **timeout เสมอ** (ข้อจำกัด tool) — อย่าเสียเวลาถ่ายภาพ ใช้ `preview_eval` / console / `window.__DATA` พิสูจน์แทน
- คำสั่งตรวจอื่น: `npm run typecheck` · `npx eslint <ไฟล์>` · `npx vitest run src/utils/warehouse3d.test.ts`

## ค้าง / ทำต่อได้ (เรียงตามความสำคัญ)
1. **ลากย้าย/รีไซส์ตัวโซนใน 3D แล้วเซฟ** — โหมดจัดเรียงตอนนี้ขยับได้แค่ "กล่องสินค้า" ในโซน; ตัวโซน (origin/size) ปรับผ่าน data เท่านั้น ยังลากใน 3D ไม่ได้
2. **ผูกสินค้าจริงเข้าโซน** (ในแท็บ "โซน" → `zone.productIds`) เพื่อให้ 3D โชว์กล่องตามจำนวน stock จริง — ตอนนี้โซน seed มี `productIds` ว่าง = ไม่มีกล่อง
3. **ความสูงเพดานต่อโซน** — ปัจจุบันใช้ค่าเดียวทั้งโกดัง (`heightM` ระดับ warehouse)
4. **ยืนยัน render ในแอปจริง** — ถ้าเซสชันหน้า user login ได้ ให้ขับ preview เปิดแท็บ "โกดัง 3D" ตรวจ console + interaction (จัดเรียง/เซฟมุมกล้อง)

## Gotchas
- **localhost = Supabase prod** (memory `feedback_preview_writes_prod`): กดปุ่ม "บันทึกมุมนี้ / บันทึกการจัดเรียง / นำเข้าผังเป็นโซนจริง" = เขียน prod จริง — **อย่ากดตอน verify ถ้าไม่ได้รับอนุญาต** (ใน dev harness ใช้ callback stub จึงปลอดภัย)
- ปุ่ม **"นำเข้าผังเป็นโซนจริง (19 โซน)"** โผล่เฉพาะตอนแท็บโซนว่าง (`zones.length===0`) → `setZones(claudeDesignZones())` เขียน 19 โซนลง `zones`
- **logic 3D อยู่ที่เดียว**: `src/lib/warehouse3d/scene.js` (standalone `public/warehouse-3d.html` ถูกลบแล้ว — ไม่มีโค้ดเรนเดอร์ซ้ำให้ sync อีกต่อไป)
- **workflow commit/push** (memory `feedback_branching`): commit ตรง `master`, push = Vercel auto-deploy, **ไม่มี feature branch / PR** — commit & push เมื่อผู้ใช้สั่งเท่านั้น
- ผู้ใช้สื่อสารเป็นไทย; ตอบ chat **ห้ามใช้ emoji** (memory `feedback_no_emoji`) — แต่ emoji ใน UI/โค้ดเดิม (✋ 💾 ↧ ⬇ ◰) คงไว้ตามเดิม
