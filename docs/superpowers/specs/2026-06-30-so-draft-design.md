# SO Draft — Design Spec

วันที่: 2026-06-30
ขอบเขต: เพิ่มความสามารถบันทึก/กู้คืน Sales Order ที่ยังกรอกไม่เสร็จ แบ่งเป็น 2 ส่วนอิสระ

## เป้าหมาย

1. **Safety net** — กรอกฟอร์มสร้าง SO ค้างไว้แล้วปิด/ออกโปรแกรม ข้อมูลไม่หาย (auto-save ลงเครื่อง)
2. **Draft SO** — ตั้งใจเซฟ SO ที่ยังไม่เสร็จเป็น "ร่าง" เก็บในระบบ กลับมาทำต่อ/โปรโมตเป็น SO จริงทีหลังได้ โดยร่างยังไม่กินเลข ไม่จองสต็อก ไม่เข้าระบบเงิน/รายงาน

ผู้ใช้ยืนยัน: เอาทั้งสองส่วน

## ส่วน A — Auto-save safety net (localStorage)

### พฤติกรรม
- ทำงานเฉพาะฟอร์ม **สร้างใหม่** (modal `addSO`) เท่านั้น ไม่รวมโหมดแก้ไข (`editSO`) เพราะ edit มี record อยู่แล้ว
- ระหว่างฟอร์มเปิด เซฟ state หลักลง `localStorage` key เดียว แบบ debounce (~500ms) ทุกครั้งที่ค่าเปลี่ยน
- ฟิลด์ที่เซฟ: `form, incVat, payType, discPct, creditDays, extraDiscPct, extraDiscAmt`
- **ไม่เซฟ** state โปรโม (`pendingClaims, pendingSaves, selectedWalletIds`) เพราะอ้างอิง object โปรโมสด เสี่ยง stale — กู้แค่ฟิลด์หลัก (ครอบคุณค่า ~90%)

### การกู้คืน
- เปิดฟอร์มสร้างใหม่ครั้งถัดไป ถ้ามี autosave ที่ "มีเนื้อ" (เลือกลูกค้า **หรือ** มีสินค้าอย่างน้อย 1 รายการที่มี `productId`) → **เติมค่ากลับอัตโนมัติ** (ผู้ใช้เลือก auto-restore)
- โชว์แถบเล็กด้านบนฟอร์ม: `กู้ฟอร์มที่ค้างไว้แล้ว` พร้อมปุ่ม `[เริ่มฟอร์มเปล่า]`
- กด "เริ่มฟอร์มเปล่า" → reset ฟอร์มเป็น `ef` + ล้าง autosave key

### การล้าง autosave
ล้าง key เมื่อเกิดเหตุใดเหตุหนึ่ง:
- สร้าง SO สำเร็จ (`doSave` สาขาสร้างใหม่)
- กด "บันทึกร่าง"
- กด "เริ่มฟอร์มเปล่า"

### Key
- `localStorage` key: `so_form_autosave`
- เก็บเป็น JSON `{form, incVat, payType, discPct, creditDays, extraDiscPct, extraDiscAmt, savedAt}`
- อ่านแบบ defensive: ถ้า parse พังหรือ schema ไม่ตรง ให้ทิ้งเงียบๆ ไม่ throw

### ไฟล์ที่แตะ
- `src/components/Sales.jsx` — เพิ่ม effect autosave + logic restore ใน effect ที่เปิด `addSO` ([Sales.jsx:37](src/components/Sales.jsx:37)) และปุ่ม "+ สร้างใบขาย" ([Sales.jsx:442](src/components/Sales.jsx:442)); เพิ่มแถบ restore ใน `renderForm` ([Sales.jsx:194](src/components/Sales.jsx:194))

## ส่วน B — Draft SO status (record จริง)

### โมเดลข้อมูล
- เพิ่มสถานะใหม่ `status: "draft"`
- Draft record อยู่ใน array `sales` เดียวกัน (persist/sync เหมือน SO ปกติ) แต่:
  - `soNum: ""` — ยังไม่กินเลข (`nextDocNum` นับจาก soNum ที่ไม่ว่าง จึงไม่กระทบ)
  - เก็บเฉพาะฟิลด์ที่ `openEdit` ([Sales.jsx:169](src/components/Sales.jsx:169)) ต้องใช้: `customerId, date, items, includeVat, payType, discPct, creditDays, extraDiscPct, extraDiscAmt, useVatRep, vatRepName, vatRepAddress, vatRepIdCard, note, legacyNum, eventId, eventPackPurchases`
  - ไม่เก็บ `origPrices, vatAmount, appliedRewards, discountAmt` (คำนวณ/รันโปรโมตอน promote)
  - มี `savedAt` (todayStr) สำหรับแสดง

### บันทึกร่าง
- ปุ่มใหม่ใน footer ฟอร์ม: **"บันทึกร่าง"** อยู่คู่ "สร้างใบขาย" (ทั้ง addSO และตอนแก้ไขร่าง)
- ฟังก์ชันใหม่ `saveDraft(soId)`:
  - validation เบา: ต้องมี `customerId` **หรือ** มีสินค้า ≥1 รายการที่เลือก `productId` (กันร่างเปล่า) — ไม่เช็คสต็อก ไม่เช็คอนุมัติ ไม่รันโปรโม
  - `soId` ว่าง → push record ใหม่ `{id:Date.now(), soNum:"", status:"draft", savedAt, ...draftFields}`
  - `soId` มี (แก้ร่างเดิม) → update record นั้นในที่เดิม คง `id`
  - log ผ่าน `addA("บันทึกร่าง SO", "")` (ปรับข้อความได้)
  - ล้าง autosave key + ปิด modal

### กลับมาทำต่อ
- เปิดร่างจากรายการ → ใช้ `openEdit(draftSO)` เดิม (โหลดฟิลด์กลับเข้าฟอร์มได้อยู่แล้ว) เปิด modal `editSO`
- footer ตอนแก้ร่าง โชว์ 2 ปุ่ม: **"บันทึกร่าง"** (อัปเดตร่าง) และ **"สร้างใบขาย"** (โปรโมต)

### โปรโมตร่าง -> SO จริง
- ใน `doSave` ([Sales.jsx:52](src/components/Sales.jsx:52)) ตรวจ `oldSO?.status === "draft"`:
  - ถือเป็นการสร้างใหม่: `newSoNum = nextDocNum("SO", sales, "soNum")` (แทนการคงเลขเดิมที่บรรทัด [Sales.jsx:112](src/components/Sales.jsx:112))
  - set status = `needsApproval ? "pending_special_approval" : "pending_delivery"` (แทน keepStatus ที่ [Sales.jsx:137](src/components/Sales.jsx:137))
  - คง `id` เดิม (update in place ไม่ push ใหม่ ไม่ทิ้งร่างค้าง)
  - รันโปรโม/รางวัล/อนุมัติ ตาม flow ปกติทั้งหมด
- ผู้ใช้ยืนยัน: ถ้าราคาต่ำกว่าทุน/ต้องอนุมัติพิเศษ ให้เด้ง flow อนุมัติตามปกติ (มาจาก `needsApproval` เดิม ไม่ต้องทำพิเศษ)

### รายการ SO (list/filter/stats)
- เพิ่มแท็บกรอง **"ร่าง"** ในแถวฟิลเตอร์ ([Sales.jsx:446](src/components/Sales.jsx:446)) พร้อมจำนวน; สี badge เทา (`var(--dim)`)
- แถว draft:
  - แสดงเลขที่เป็น `—` (soNum ว่าง)
  - badge "ร่าง" เทา
  - ปุ่ม: `[แก้ไขร่าง]` `[ลบ]` เท่านั้น — ไม่มี "จัดส่ง"/"ยืนยัน"
- กันออกจาก stats:
  - `mySO`/`stats` ([Sales.jsx:41-42](src/components/Sales.jsx:41)) — `totAmt` และ `total` ต้องไม่รวม draft (เพิ่ม filter `s.status!=="draft"` ตอนคำนวณ stat ที่รวมทุกสถานะ)
  - แท็บ "ทั้งหมด" = SO จริงเท่านั้น (ไม่รวมร่าง); ร่างดูได้เฉพาะแท็บ "ร่าง"

### ลบร่าง
- ใช้ `confirmDel` ([Sales.jsx:149](src/components/Sales.jsx:149)) ได้ตามปกติ — ร่างไม่มี linkedPO/payment/completed-stock จึงเข้าสาขา `setSales(filter)` ตรงๆ ปลอดภัย

## จุดเสี่ยง leak เข้ารายงาน — ผล audit

ตรวจ consumer ของ `sales` แล้ว ความเสี่ยงต่ำกว่าที่กังวล เพราะ draft กันตัวเองได้ 2 ชั้น: (1) `status==="draft"` ไม่ match ฟิลเตอร์สถานะเดิมใดๆ (2) `soNum===""`

- `src/utils/customerStats.ts:93` — กรอง `status==="completed"` → draft ไม่เข้า **(ปลอดภัยเอง)**
- `src/components/ui/GlobalSearch.jsx:54` — ค้นด้วย `soNum.includes(s)`; `"".includes(non-empty)===false` → draft ไม่โผล่ **(ปลอดภัยเอง)**
- consumer อื่นที่กรองตามสถานะเฉพาะ (Dashboard/Finance/Delivery/Reports) → draft ไม่เข้าโดยปริยาย

จุดที่ต้องกัน explicit (นับ/รวม "ทุกสถานะ"):
- `Sales.jsx` `mySO`/`stats.totAmt`/`stats.total` — ต้อง exclude draft (อยู่ในส่วน B แล้ว)

แผน implement ต้องไล่เช็คเพิ่มเฉพาะจุดที่ aggregate `sales` แบบไม่กรองสถานะ (count รวม / sum รวม) ที่อยู่นอก Sales.jsx เช่น Dashboard total, AISOBot context, BackupManager — ยืนยันด้วย grep หา `sales.length` / `sales.reduce` ที่ไม่มี filter status ตอนทำ plan

## Non-goals (YAGNI)
- ไม่ทำ auto-save สำหรับโหมดแก้ไข SO ที่มีอยู่แล้ว
- ไม่ sync draft-in-progress ข้ามเครื่อง (safety net เป็น localStorage ต่อเครื่อง); ส่วน Draft record sync ผ่าน sales ปกติ
- ไม่กู้ state โปรโมใน autosave
- ไม่ให้ draft กินเลข SO / ไม่มี draftNum รันเลข
