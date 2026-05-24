# 📦 Stock & Order Management System

## ส่วนที่ 1: วิธีติดตั้ง Claude Code + โปรเจกต์

### ขั้นตอนที่ 1: ติดตั้ง Node.js
1. ไปที่ https://nodejs.org
2. ดาวน์โหลด **LTS** (ปุ่มสีเขียว)
3. ติดตั้ง — กด Next ไปเรื่อยๆ จนเสร็จ
4. เปิด Terminal (Windows: กด Win+R พิมพ์ `cmd`) แล้วพิมพ์:
```
node --version
```
ถ้าขึ้นเลข version แสดงว่าสำเร็จ

### ขั้นตอนที่ 2: ติดตั้ง Claude Code
1. เปิด Terminal พิมพ์:
```
npm install -g @anthropic-ai/claude-code
```
2. หลังติดตั้งเสร็จ พิมพ์:
```
claude
```
3. จะให้ login ด้วย Anthropic account — ทำตามขั้นตอนบนหน้าจอ

### ขั้นตอนที่ 3: สร้างโปรเจกต์
เปิด Terminal แล้วพิมพ์ทีละบรรทัด:
```
npm create vite@latest stock-app -- --template react
cd stock-app
npm install
npm install recharts lucide-react
```

### ขั้นตอนที่ 4: วางไฟล์โค้ด
1. ลบไฟล์ใน `src/` ทิ้งทั้งหมด
2. สร้างโครงสร้างตามที่จะให้ในขั้นตอนถัดไป
3. วางไฟล์โค้ดแต่ละไฟล์ตาม path ที่กำหนด

### ขั้นตอนที่ 5: รันโปรเจกต์
```
npm run dev
```
เปิด browser ไปที่ http://localhost:5173

### ขั้นตอนที่ 6: ใช้ Claude Code แก้ไข
เปิด Terminal ใหม่ (อยู่ใน folder stock-app) แล้วพิมพ์:
```
claude
```
จากนั้นสั่งงานเป็นภาษาไทยได้เลย เช่น:
- "เพิ่ม Activity Tracking กลับมา"
- "แก้ไขหน้า Dashboard ให้แสดง PO ล่าสุด"
- "เพิ่มรายงานเป้ายอดขาย"

---

## ส่วนที่ 2: โครงสร้างไฟล์โปรเจกต์

```
stock-app/
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.jsx
│   ├── App.jsx                    ← หน้าหลัก + login + routing
│   ├── data/
│   │   └── initData.js            ← ข้อมูลเริ่มต้นทั้งหมด
│   ├── utils/
│   │   ├── helpers.js             ← ฟังก์ชันช่วย (fmt, toBE, etc.)
│   │   ├── constants.js           ← ค่าคงที่ (TABS, STOCK_STATUS, etc.)
│   │   └── storage.js             ← โหลด/บันทึก localStorage
│   ├── components/
│   │   ├── ui/                    ← UI primitives
│   │   │   ├── Field.jsx
│   │   │   ├── Badge.jsx
│   │   │   ├── StatCard.jsx
│   │   │   ├── Modal.jsx
│   │   │   ├── SearchBar.jsx
│   │   │   ├── Btn.jsx
│   │   │   ├── Sel.jsx
│   │   │   └── ProductPicker.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Products.jsx
│   │   ├── CategoryManager.jsx    ← จัดการหมวดสินค้า
│   │   ├── StockLog.jsx
│   │   ├── PurchaseOrders.jsx
│   │   ├── Sales.jsx              ← ใบขาย
│   │   ├── Quotes.jsx             ← ใบเสนอราคา
│   │   ├── Finance.jsx
│   │   ├── Reports/
│   │   │   ├── ReportsPage.jsx
│   │   │   ├── Overview.jsx
│   │   │   ├── Compare.jsx
│   │   │   ├── Targets.jsx
│   │   │   ├── VATRepReport.jsx
│   │   │   ├── AuditLog.jsx
│   │   │   └── PriceHistory.jsx
│   │   ├── Contacts.jsx           ← ลูกค้า + ซัพพลายเออร์
│   │   ├── Users.jsx
│   │   └── ActivityModal.jsx
```

---

## ส่วนที่ 3: สรุปฟีเจอร์ทั้งหมด (รวมที่หายไป ✅ = มีอยู่, ❌ = หายต้องเพิ่ม)

### 🔐 ระบบ Login & สิทธิ์
- ✅ 6 ประเภท User: Admin, Manager, Warehouse, Accountant, Sales (4คน), Supplier (2คน)
- ✅ สิทธิ์ 5 ระดับต่อเมนู: เข้าถึง/ดู/สร้าง/แก้ไข/ลบ (checkbox grid)
- ❌ Dashboard Widgets กำหนดได้ตาม User
- ❌ Activity Tracking — login/logout, หน้าที่เข้าใช้, ระยะเวลาแต่ละหน้า

### 1. Dashboard
- ✅ สรุปยอดพื้นฐาน: สินค้า, มูลค่าสต็อก, ยอดขาย, กำไร
- ✅ แจ้งเตือนสต็อกต่ำ
- ❌ PO ล่าสุด
- ❌ ประวัติสต็อกล่าสุด
- ❌ เป้ายอดขาย (เซลส์เห็นเฉพาะของตัวเอง)
- ❌ Supplier เห็นเฉพาะข้อมูลตัวเอง
- ❌ Dashboard Widgets ตาม User

### 2. สินค้า
- ✅ จัดกลุ่มตามยี่ห้อ, กรองตามหมวด/ยี่ห้อ/สถานะสต็อก
- ✅ สถานะสต็อก 4 ระดับ: Active/Slow/Dead/Fossil
- ✅ ปรับสต็อก, แก้ไข, ลบ (มี confirm)
- ✅ ประวัติราคา อัตโนมัติ
- ✅ จัดการหมวด/หมวดย่อย (เพิ่ม/แก้ไข/ลบ)
- ✅ Searchable Product Picker

### 3. ประวัติสต็อก
- ✅ บันทึก IN/OUT/ปรับเพิ่ม/ปรับลด พร้อมผู้บันทึก
- ✅ กรองตามประเภท/สินค้า

### 4. ใบสั่งซื้อ (PO)
- ✅ สร้าง, ดู, รับของ (confirm + เพิ่มสต็อกอัตโนมัติ)
- ✅ ยกเลิก

### 5. การขาย
- ✅ ใบขาย (SO): สร้าง, ดู, แก้ไข (เฉพาะรอจัดส่ง), ลบ (confirm), จัดส่ง (ตัดสต็อก)
- ✅ Searchable Product Picker + แสดงสต็อก real-time
- ✅ บล็อกถ้าขายเกินสต็อก
- ✅ ส่วนลด: 0%, 1%, 2%, 3%, 5%
- ✅ เครดิต: 7, 15, 30, 45, 60, 90 วัน
- ✅ ตัวแทนรับ VAT: checkbox เปิด/ปิด + dropdown เลือกจากรายชื่อลูกค้า
- ❌ ใบเสนอราคา (QT): สร้าง/ส่ง/อนุมัติ/แปลงเป็น SO/หมดอายุ
- ❌ ใบขายที่มาจาก QT แสดง badge บอกที่มา

### 6. การเงิน
- ✅ AP (จ่ายซัพพลายเออร์) + AR (เก็บเงินลูกค้า)
- ✅ กรองสถานะ, บันทึกการชำระ

### 7. รายงาน
- ✅ ภาพรวมรายเดือน (bar chart ยอดขาย vs สั่งซื้อ, Top 5)
- ✅ Audit Log
- ✅ ประวัติราคา
- ❌ เปรียบเทียบเดือนนี้ vs เดือนก่อน (+/- %)
- ❌ เป้ายอดขาย (ตั้งเป้ารายเดือนต่อเซลส์, progress bar)
- ❌ ตัวแทน VAT รายปี (สรุปยอดตามตัวแทน ตั้งแต่ 1 ม.ค.)

### 8. ซัพพลายเออร์
- ✅ CRUD ข้อมูล

### 9. ลูกค้า
- ✅ CRUD + กำหนดเซลส์ดูแล, Tax ID, ที่อยู่
- ✅ ตัวแทน VAT หลายคนต่อร้าน (ชื่อ, ที่อยู่, เลขบัตร ปชช.)

### จัดการ User
- ✅ CRUD User, checkbox grid สิทธิ์ 5 ระดับ
- ❌ ตั้งค่า Dashboard Widgets ต่อ User
- ❌ ผูกเซลส์/Supplier
- ❌ ประวัติการใช้งาน (Activity Tracking)

### ฟีเจอร์เสริม
- ✅ 🔔 Notifications พื้นฐาน (สต็อกต่ำ, PO ค้าง, QT หมดอายุ)
- ✅ 🗑 Confirm ก่อนลบทุกจุด
- ✅ 💾 Auto-save (persistent storage, prefix v3_)
- ❌ 📊 Activity Tracking เต็มรูปแบบ
- ❌ 🔔 Notifications ครบ: Dead/Fossil Stock, เครดิตใกล้/เกินกำหนด
- ✅ สลับภาษาไทย/อังกฤษ
- ❌ วันที่แสดงเป็น DD/MM/พ.ศ. (มีบางส่วน)

---

## ส่วนที่ 4: โครงสร้างข้อมูล

### Product
```js
{
  id, code, name, nameT, brand, categoryId, subcategoryId,
  size, price, cost, stock, minStock, unit, distributor
}
```

### Contact (Customer/Supplier)
```js
{
  id, type: "customer"|"supplier",
  name, nameT, phone, email, address, taxId,
  salesPerson,  // เฉพาะ customer
  vatReps: [{   // เฉพาะ customer — หลายคนได้
    id, name, address, idCard
  }]
}
```

### Sales Order (SO)
```js
{
  id, soNum, customerId, date, status: "pending_delivery"|"completed",
  items: [{ productId, qty, price }],
  includeVat, vatAmount, payType: "cash"|"credit",
  discountAmt, discPct, creditDays,
  fromQuote,  // QT number ถ้าแปลงมา
  useVatRep: boolean,  // ติ๊กออก VAT ให้ตัวแทนหรือไม่
  vatRepName, vatRepAddress, vatRepIdCard
}
```

### Purchase Order (PO)
```js
{
  id, poNum, supplierId, date, status: "pending"|"received"|"cancelled",
  items: [{ productId, qty, cost }]
}
```

### Quote (QT)
```js
{
  id, qtNum, customerId, date, validUntil,
  status: "draft"|"sent"|"approved"|"converted"|"cancelled",
  items: [{ productId, qty, price }],
  includeVat, payType, note, discPct, creditDays, convertedTo
}
```

### Stock Log
```js
{
  id, date, productId, type: "in"|"out"|"adjust_in"|"adjust_out",
  qty, qtyBefore, qtyAfter, ref, note, user
}
```

### Payment
```js
{
  id, refId: "PO-xxx"|"SO-xxx", type: "ap"|"ar",
  amount, method, date, note
}
```

### User
```js
{
  id, username, password, role,
  salesName,     // ถ้าเป็น Sales
  supplierName,  // ถ้าเป็น Supplier
  dashboardWidgets: ["products","stock_value","sales_total",...],
  perms: {
    dashboard: { access, read, create, edit, delete },
    products: { ... },
    ...
  }
}
```

### Sales Target
```js
{ id, salesName, month: "2025-01", target: 100000 }
```

### Audit Log
```js
{ id, date, action, detail, user }
```

### Price History
```js
{ id, date, productId, field: "price"|"cost", oldVal, newVal, user }
```

### Activity Log (Session)
```js
{
  userId, username, role, salesName, supplierName,
  loginTime, loginTimeStr, logoutTime, logoutTimeStr,
  totalDuration,
  tabHistory: [{ tab, enterTime, endTime, duration }]
}
```

### Category
```js
{
  id, name,
  subs: [{ id, name }]
}
```

---

## ส่วนที่ 5: คำสั่งสำหรับ Claude Code

หลังจากวางไฟล์โค้ดเรียบร้อยแล้ว เปิด Claude Code แล้วสั่ง:

```
ช่วยเพิ่มฟีเจอร์ที่ยังขาด (มาร์คด้วย ❌ ในเอกสาร SYSTEM_SPEC.md)
เริ่มจาก:
1. ใบเสนอราคา (Quotes) — สร้าง/ส่ง/อนุมัติ/แปลง SO
2. Activity Tracking
3. Dashboard widgets + PO ล่าสุด + สต็อกล่าสุด
4. รายงาน: เปรียบเทียบเดือน + เป้ายอดขาย + ตัวแทน VAT
```

Claude Code จะอ่านไฟล์ทั้งหมดในโปรเจกต์ เข้าใจโครงสร้าง แล้วเพิ่มให้ทีละไฟล์โดยไม่กระทบไฟล์อื่นครับ
