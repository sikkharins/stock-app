# Stock-to-Sales Ratio — กราฟแท่งสต็อกเฉลี่ย ÷ ยอดขาย

วันที่: 2026-06-25
สถานะ: design (รออนุมัติก่อนทำแผน)

## ปัญหา / สิ่งที่อยากได้

อยากเห็นภาพว่าแต่ละยี่ห้อ / หมวดสินค้า "ถือสต็อกหนักเกินไปเมื่อเทียบกับยอดขายไหม" ผ่านอัตราส่วน
**สต็อกเฉลี่ย (มูลค่า) ÷ ยอดขาย (มูลค่า)** เป็นกราฟแท่งสวยๆ แยกตาม:

1. รวมทั้งร้าน
2. แต่ละยี่ห้อ
3. แต่ละหมวดสินค้า
4. แต่ละหมวดสินค้า × แต่ละยี่ห้อ

อัตราส่วนสูง = ถือสต็อกเยอะเมื่อเทียบยอดขาย (จมทุน/ขายช้า); ต่ำ = หมุนเร็ว/อาจเสี่ยงขาด

## ขอบเขต / เงื่อนไขที่ยืนยันแล้ว

- **หน่วย = มูลค่า (฿)** ทั้งเศษและส่วน
- **สต็อกเฉลี่ย = (มูลค่าสต็อกต้นงวด + มูลค่าสต็อกปลายงวด) / 2** (ค่าเฉลี่ยสินค้าคงคลังแบบบัญชี)
- **งวด = เลือกได้ รายเดือน / รายไตรมาส / รายปี**
- **ราคาที่ใช้คิดมูลค่าสต็อก = `price` (ราคาขาย)** — ให้เศษ/ส่วนอยู่ฐานราคาขายเหมือนกัน และตรงกับที่แอปแสดงมูลค่าสต็อกที่อื่น (StockValueDonut, stockValueSeries)
- **กราฟหมวด×ยี่ห้อ = กราฟแท่งกลุ่ม** (ไม่ใช่ heatmap)
- "รวม" แสดงเป็น KPI ตัวเลขด้านบน (ไม่ใช่กราฟแท่งแท่งเดียว) แล้วตามด้วยกราฟแท่ง 3 อัน (ยี่ห้อ / หมวด / หมวด×ยี่ห้อ)
- **default งวด = งวดที่จบล่าสุด** (กันยอดขายงวดปัจจุบันที่ยังไม่ครบทำให้อัตราส่วนเพี้ยน)
- วางใน **หน้า Reports** เป็นแท็บใหม่
- แนวทางที่เลือก: **A — util บริสุทธิ์ + component recharts + แท็บใหม่** (ทดสอบแยกได้)

## เป้าหมาย (success criteria)

- เลือกงวด (เดือน/ไตรมาส/ปี + งวดไหน) แล้วเห็นอัตราส่วนสต็อกเฉลี่ย÷ยอดขาย เป็น KPI รวม + กราฟแท่ง 3 อัน
- ตัวเลขถูกต้อง: สต็อกเฉลี่ยมาจาก reconstruct ต้น/ปลายงวดผ่าน stock logs จริง
- ไม่กระทบหน้าตา/พฤติกรรมเดิมของแท็บอื่นใน Reports

## ส่วนที่ไม่อยู่ในขอบเขตรอบนี้ (YAGNI)

- กราฟ trend ของอัตราส่วนข้ามหลายงวด (รอบนี้โฟกัสที่ breakdown ตามกลุ่มของงวดเดียว)
- ตัวเลือกสลับฐานราคาเป็น `cost` ใน UI (default `price` พอ — ถ้าต้องการทีหลังเพิ่มเป็น toggle ได้)
- heatmap สำหรับหมวด×ยี่ห้อ
- drill-down คลิกแท่งแล้วเจาะลงสินค้า
- export / พิมพ์

## ดีไซน์ (แนวทาง A)

### 1. โครงสร้างไฟล์

- `src/utils/stockToSalesRatio.ts` — pure functions (วางนอก component; ทดสอบได้, เลี่ยง TDZ/inline-component ที่เคยเจอ)
- `src/utils/stockToSalesRatio.test.ts` — vitest
- `src/components/Reports/StockToSales.jsx` — UI ใช้ recharts รับ props จาก `sh`
- แก้ `src/components/Reports/ReportsPage.jsx`:
  - เพิ่มแท็บ `["stocksales","สต็อก/ขาย"]` ใน `TABS`
  - destructure `logs` จาก `sh` (มีอยู่แล้ว — `App.jsx:429`)
  - render `<StockToSales products={products} sales={sales} logs={logs} cats={cats}/>`

### 2. รูปแบบข้อมูล (ที่มีอยู่จริง)

- product: `{ id:number, brand?:string, categoryId, price:number, cost:number, stock:number }`
- log (ทุกแถวมี `qtyBefore`/`qtyAfter` — กรองตอนโหลดที่ `App.jsx:220`):
  `{ productId:number, type:string, qty:number, date:string(ISO), qtyBefore:number, qtyAfter:number }`
- sale (SO): `{ status:string, date:string, items:[{ productId, qty, price }] }`
- cat: `{ id, name }`

### 3. สูตรใน `stockToSalesRatio.ts`

**3.1 จำนวนสต็อก ณ "สิ้นวัน" ที่กำหนด — `stockUnitsAt(productId, isoDate, logsByProduct, currentStock)`**
- logs ของสินค้านั้น เรียงตาม date
- คืน `qtyAfter` ของ log ล่าสุดที่ `date <= isoDate (สิ้นวัน)`
- ถ้าไม่มี log ก่อน/เท่ากับวันนั้น แต่มี log ในอนาคต → คืน `qtyBefore` ของ log แรกสุด (สต็อกก่อนความเคลื่อนไหวแรก)
- ถ้าสินค้านั้นไม่มี log เลย → คืน `currentStock` (`p.stock`) — ถือว่าสต็อกคงที่
- หมายเหตุ: "สต็อกปลายงวด" ของงวดปัจจุบันที่ยังไม่จบ = สต็อกปัจจุบัน (วันสิ้นงวดอยู่อนาคต → log ล่าสุดคือปัจจุบัน)

**3.2 มูลค่าสต็อกของกลุ่ม ณ วันที่ — `stockValueAt(products, isoDate, filterFn)`**
- `Σ` ของสินค้าที่ผ่าน `filterFn` ของ `stockUnitsAt(...) × p.price`

**3.3 ขอบเขตงวด — `periodBounds(granularity, periodKey)`**
- granularity: `"month" | "quarter" | "year"`
- คืน `{ startDate, endDate }` (ISO `YYYY-MM-DD`)
  - ต้นงวด = วันแรกของงวด; "สต็อกต้นงวด" = สต็อกสิ้นวัน **ก่อน** วันแรก (คือสิ้นวันสุดท้ายของงวดก่อน) เพื่อให้ "ต้นงวด" สะท้อนสภาพก่อนงวดเริ่ม
  - ปลายงวด = วันสุดท้ายของงวด
- รายการงวดให้เลือก: เดือน ~12 งวดล่าสุด / ไตรมาส ~8 / ปี ~5 (อิงวันนี้)

**3.4 ยอดขายในงวดของกลุ่ม — `salesValueIn(sales, startDate, endDate, filterItemFn)`**
- `Σ` SO ที่ `status !== "cancelled"` และ `date` อยู่ในช่วง `[startDate, endDate]`
- ภายในแต่ละ SO `Σ` ของ item ที่ `filterItemFn(product)` ผ่าน ของ `qty × price` (ราคาในบรรทัด SO = รายได้จริง)

**3.5 อัตราส่วน — `ratio(avgStockValue, salesValue)`**
- ถ้า `salesValue <= 0` → `null` (ไม่นิยาม — UI แสดง "—"/ซ่อน)
- ไม่งั้น → `avgStockValue / salesValue`

**3.6 ฟังก์ชันรวม — `computeStockToSales(products, logs, sales, cats, { granularity, periodKey })`**
คืน:
```
{
  period: { granularity, periodKey, startDate, endDate, label },
  total:    { ratio, avgStock, sales },
  byBrand:  [{ key, label, ratio, avgStock, sales }],   // เรียง ratio มาก→น้อย, ตัด sales=0
  byCat:    [{ key, label, ratio, avgStock, sales }],
  byCatBrand: { cats:[catLabel], brands:[brandLabel], rows:[{ category, [brand]:ratio }] } // รูปสำหรับ grouped bar
}
```
- จัด `logsByProduct` (Map productId → logs เรียงวันที่) ครั้งเดียวแล้วใช้ซ้ำทุกกลุ่ม
- brand ว่าง → `"ไม่ระบุ"`; categoryId หาไม่เจอใน cats → `"ไม่ระบุ"`
- คำนวณ avgStock ทั้งร้านครั้งเดียว, ต่อ brand/cat ด้วยการ filter

### 4. UI ใน `StockToSales.jsx`

โครงตามสไตล์ `Overview.jsx` (card `--panel`/`--line`, `fmt()`, `COLORS`, `BarTip` แบบเดียวกัน):

- **แถวตัวเลือกงวด** (บนสุด):
  - toggle granularity: `เดือน / ไตรมาส / ปี`
  - dropdown เลือกงวด — default = งวดที่จบล่าสุด (เช่นวันนี้ มิ.ย. → default = พ.ค.); งวดปัจจุบันเลือกได้แต่ติดป้าย "(ยังไม่จบ)"
- **KPI "รวม"**: ตัวเลขอัตราส่วนใหญ่ + บรรทัดเล็ก "สต็อกเฉลี่ย ฿X · ยอดขาย ฿Y" + คำอธิบายหน่วย ("= ถือสต็อกพอขาย ~N <งวด>")
- **กราฟ 1 — ตามยี่ห้อ**: BarChart แท่งเดี่ยว เรียงมาก→น้อย + `ReferenceLine` ค่ารวม
- **กราฟ 2 — ตามหมวดสินค้า**: BarChart แท่งเดี่ยว + `ReferenceLine` ค่ารวม
- **กราฟ 3 — ตามหมวด×ยี่ห้อ**: BarChart **กลุ่ม** (แกน X = หมวด, หนึ่ง `<Bar>` ต่อยี่ห้อ, ไม่มี stackId), legend ยี่ห้อ, สีชุด `COLORS` เดียวกับ Overview
- tooltip แสดงอัตราส่วน (ทศนิยม ~2 ตำแหน่ง) + บรรทัดเสริม สต็อกเฉลี่ย/ยอดขาย ของแท่งนั้น
- ทุกกราฟใช้ `ResponsiveContainer`; ไม่มีข้อมูล → ข้อความ "ยังไม่มีข้อมูล" แบบ Overview

### 5. เคสขอบ

- ยอดขายกลุ่ม = 0 → `ratio=null` → ซ่อนแท่งนั้น (ไม่โชว์ 0 หรือ ∞)
- สต็อกเฉลี่ย = 0 แต่มียอดขาย → ratio = 0 (แสดงปกติ)
- สินค้าไม่มี brand/category → กลุ่ม "ไม่ระบุ"
- หมวด×ยี่ห้อ ที่ทั้งสต็อกและยอดขายเป็น 0 → ไม่อยู่ในแถว/ซีรีส์
- งวดปัจจุบัน (ยังไม่จบ): ปลายงวด = สต็อกปัจจุบัน, ยอดขาย = ต้นงวดถึงวันนี้ → ติดป้าย "(ยังไม่จบ)" เพื่อกันเข้าใจผิด
- ไม่มี log ก่อนวันต้นงวด → fallback ตาม 3.1 (qtyBefore ของ log แรก หรือ stock ปัจจุบัน)

### 6. เทสต์ (`stockToSalesRatio.test.ts`)

- `stockUnitsAt`: log ก่อนวันที่ (คืน qtyAfter ถูกใบ), ไม่มี log ก่อนหน้า (คืน qtyBefore ของใบแรก), ไม่มี log เลย (คืน stock ปัจจุบัน)
- `periodBounds`: เดือน/ไตรมาส/ปี คืนต้น-ปลายถูก; ต้นงวด = สิ้นวันก่อนวันแรก
- สต็อกเฉลี่ย = (ต้น+ปลาย)/2 ถูกต้องเมื่อมีความเคลื่อนไหวกลางงวด
- `salesValueIn`: นับเฉพาะในช่วง, ตัด cancelled, กรองกลุ่มถูก
- `ratio`: ยอดขาย=0 → null; ปกติ → หารถูก
- `computeStockToSales`: จัดกลุ่ม brand/category ถูก, "ไม่ระบุ" ทำงาน, byCatBrand รูปร่างถูกสำหรับ grouped bar, เรียงมาก→น้อย, ตัดกลุ่มยอดขาย=0

## ความเสี่ยง / หมายเหตุ

- การ reconstruct สต็อกพึ่ง `qtyAfter`/`qtyBefore` ในแต่ละ log — แม่นถ้า log ครบจากวันต้นงวดถึงปัจจุบัน (เป็นจริงในแอปนี้เพราะ log กรอง `qtyBefore!==undefined` แล้ว)
- ฐานราคา `price` (ขาย) ทำให้อัตราส่วนเป็น "มูลค่าขายของสต็อก ÷ รายได้" — ไม่ใช่ตัวเลขต้นทุนจริง; พอสำหรับเทียบกลุ่ม
- เป็น component อ่านอย่างเดียว ไม่บันทึกอะไร ความเสี่ยงต่อข้อมูลเดิม = 0
