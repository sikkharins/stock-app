# SO — พิมพ์ฟอร์มต่อเนื่อง (Epson LQ-2190 overlay)

**Date:** 2026-06-18
**Scope:** ไฟล์ใหม่ `src/components/PrintSOForm.js` + เพิ่มปุ่ม 1 ปุ่มใน `src/components/Sales.jsx` (SO view modal). ไม่แตะ `printDoc`/`PrintDocument.jsx` เดิม

## Problem
กระดาษต่อเนื่องที่ใช้กับ LQ-2190 **มีฟอร์มพิมพ์สำเร็จมาแล้ว** (เส้น/หัวข้อ/ช่อง — ใบส่งสินค้า/ใบกำกับภาษี ของ หจก. ทีเอส อีเลคโทรนิค) ต้องการให้พิมพ์ SO โดย "ยิงเฉพาะข้อมูลลงช่องให้ตรง" (overlay) ไม่ใช่วาดฟอร์มใหม่แบบ `printDoc` เดิมที่เป็น A4 เต็มใบ

## Goal
สร้างเส้นทางพิมพ์แยกใหม่ ที่พิมพ์ **ตัวอักษรดำล้วน ไม่มีเส้น/กล่อง** ลงพิกัดที่กำหนด (mm) ให้ตกในช่องฟอร์มจริง + รองรับการ **จูน offset** กับเครื่องจริงภายหลัง (ตอนนี้ยังไม่ได้ทดสอบเครื่อง — ตั้งค่าประมาณไว้ก่อน)

## ค่ากระดาษ (ผู้ใช้วัดจริง)
- กว้าง **205 mm** × สูง **279 mm**
- **12 บรรทัด** สินค้า/ฟอร์ม

## Design

### ไฟล์ + trigger
- ไฟล์ใหม่ `src/components/PrintSOForm.js` → `export function printSOForm(so, products, contacts)`
- รูปแบบเหมือน `printDoc`: สร้าง HTML string แล้ว `window.open` + `document.write` (หน้าต่างพิมพ์แยก)
- เพิ่มปุ่มที่ 3 ใน SO modal (`Sales.jsx` ~บรรทัด 616-619) ข้าง "พิมพ์ / PDF" และ "เช็คของขึ้นรถ":
  `<button onClick={()=>printSOForm(viewSO,products,contacts)}>พิมพ์ฟอร์มต่อเนื่อง (LQ-2190)</button>`
- import `printSOForm` ที่หัวไฟล์ `Sales.jsx`

### โครงสร้าง LAYOUT (หัวใจ — แก้พิกัดที่เดียว)
object คงที่บนสุดของไฟล์ หน่วยเป็น **mm** ทั้งหมด ค่าเริ่มต้นเป็น "ค่าประมาณ" รอจูน:
```
PAGE = { w:205, h:279 }
ROWS = { count:12, top:115, height:11 }   // top = y ของบรรทัดแรก, height = ระยะต่อบรรทัด
COLS = { no:10, name:20, qty:115, unit:130, price:160, discount:178, amount:200 }
FIELDS = {
  custName:{x:35,y:55}, custAddr:{x:12,y:62,lineH:6}, custTaxId:{x:45,y:80},
  docNo:{x:148,y:48}, docDate:{x:148,y:58},
  payTerm:{x:25,y:92}, dueDate:{x:90,y:92}, salesman:{x:150,y:92},
  totals:{ x:200, subTotal:232, discount:240, goods:248, vat:256, grand:264 },
  note:{x:12,y:248}
}
```
- การ render: container absolute เต็มหน้า, แต่ละ field เป็น `<div style="position:absolute;left:Xmm;top:Ymm">` text ดำล้วน font monospace/Sarabun ขนาดคงที่ (เริ่ม ~12px)
- คอลัมน์ตัวเลข (qty/price/amount) ใช้ `text-align:right` อิง x ขวาของคอลัมน์; ชื่อสินค้า/หน่วย align ซ้าย
- บรรทัดสินค้า: loop ใช้ `top = ROWS.top + i*ROWS.height`

### การจูนตำแหน่ง (offset)
- แถบเครื่องมือ `.no-print` บนหน้าพิมพ์: input **offset X / offset Y (mm)** + ปุ่ม ◀▶▲▼ ขยับทีละ 0.5mm
- เก็บใน `localStorage` คีย์ `so_form_offset` `{x,y}` → จำค่าครั้งหน้า
- offset ใช้กับ container ด้วย `transform: translate(Xmm, Ymm)` (ขยับทั้งใบพร้อมกัน)
- toggle **"แสดงกรอบฟอร์มจางๆ"**: วาด rect/เส้นช่องจำลอง (สีเทาจาง) ทับ เพื่อพิมพ์ลงกระดาษเปล่ามาทาบฟอร์มจริงเช็คก่อนจูน — ค่า default = ปิด
- `@page { size:205mm 279mm; margin:0 }`; ใน toolbar เขียนเตือน "ตั้ง printer เป็น Actual size / 100% — ห้าม Fit to page"

### ข้อมูล → ช่อง (mapping)
| ช่องฟอร์ม | ที่มา |
|---|---|
| รหัสลูกค้า | **เว้นว่าง** (ระบบไม่มี field นี้) |
| ชื่อลูกค้า | `contact.nameT \|\| contact.name` |
| ที่อยู่ | `contact.address` (ตัดบรรทัดตาม lineH ถ้ายาว) |
| เลขผู้เสียภาษี | `contact.taxId` |
| เลขที่ | `so.legacyNum` (รูปแบบ IV2026/06115) |
| วันที่ | `toBE(so.date)` |
| เงื่อนไขชำระ | `so.payType==="cash"` → "เงินสด" ; ไม่งั้น "เครดิต {creditDays} วัน" |
| ครบกำหนด | เครดิต → `toBE(so.date + creditDays)` ; เงินสด → เว้นว่าง |
| พนักงานขาย | `contact.salesPerson` |
| ตาราง: ลำดับ/รายการ/จำนวน/หน่วย/ราคา/หน่วย/จำนวนเงิน | ดูหัวข้อ "การคำนวณ" |
| ส่วนลด (รายบรรทัด) | **เว้นว่าง** (แอปเก็บส่วนลดเป็นยอดรวม) |

### ตัวแทนออก VAT (override กล่องลูกค้า)
ถ้า `so.useVatRep && so.vatRepName` → กล่องลูกค้า **ใช้ข้อมูลตัวแทนแทน**:
- ชื่อลูกค้า → `so.vatRepName`
- ที่อยู่ → `so.vatRepAddress`
- เลขผู้เสียภาษี → `so.vatRepIdCard` (เลขบัตร ปชช. 13 หลัก ใช้เป็นเลขผู้เสียภาษีบุคคล)

ไม่ได้เลือกตัวแทน → ใช้ข้อมูลลูกค้าตามปกติ

### การคำนวณ (ก่อน VAT — ตรงคอลัมน์ Unit Price Below VAT)
ฟอร์มจริงคิดราคาแบบ **ก่อน VAT** แล้วบวก VAT ท้ายบิล → **เมื่อ `so.includeVat===true`** ใช้สูตร exclusive แบบเดียวกับโหมด `vatMode:"exclusive"` ใน `printDoc`; **ถ้าไม่คิด VAT ใช้ราคาเต็มตรงๆ ไม่หาร 107**:
- ราคา/หน่วย = includeVat ? `round2(price * 100/107)` : `price`
- จำนวนเงิน(บรรทัด) = includeVat ? `round2(qty * price * 100/107)` : `qty * price`
- รายการที่มี `parts` (เช่นแอร์ ร้อน+เย็น) → แตกเป็นหลายบรรทัดเหมือน `printDoc` (นับลำดับต่อบรรทัด ไม่ใช่ต่อ item)
- ชื่อรายการ = `product.nameT || product.name`

ยอดรวม (มุมขวาล่าง):
| ช่อง | ค่า |
|---|---|
| รวมก่อน VAT (Sub Total Before VAT) | Σ ราคาก่อน VAT รายบรรทัด = `subEx` |
| หักส่วนลด (Cash Discount) | `discEx = round2(so.discountAmt * 100/107)` (ถ้ามี) |
| มูลค่าสินค้า (Goods Value) | `subEx - discEx` |
| ภาษีมูลค่าเพิ่ม (VAT 7%) | `so.includeVat` → `round2(after - (subEx - discEx))` ; ไม่คิด VAT → เว้นว่าง |
| รวมทั้งสิ้น (Grand Total) | `after = sub - so.discountAmt` (ยอดรวม VAT) ; ไม่คิด VAT → = มูลค่าสินค้า |

> หมายเหตุ: `so.discountAmt` รวมส่วนลดทุกชนิด (disc + extra + reward) อยู่แล้ว (ดู `soBase` ใน Sales.jsx)

### สินค้าเกิน 12 บรรทัด
- แบ่งเป็นหลายฟอร์ม (page-break ทุก 12 บรรทัด)
- ทุกใบ: ซ้ำหัวลูกค้า + เลขที่/วันที่/เงื่อนไข
- ยอดรวม: พิมพ์เฉพาะ **ใบสุดท้าย**

### Edge cases
- เงินสด → เงื่อนไขชำระ "เงินสด", ครบกำหนดเว้นว่าง
- ไม่คิด VAT (`includeVat=false`) → ช่อง VAT เว้นว่าง, รวมทั้งสิ้น = มูลค่าสินค้า (ราคาที่พิมพ์ = ราคาเต็ม ไม่หาร 107 — ดู note ด้านล่าง)
- `legacyNum` ว่าง → เว้นช่องเลขที่ (ไม่ fallback เป็น soNum เพราะฟอร์มผูกระบบ IV)

> **ข้อควรตัดสินตอนทำ:** ถ้า SO ไม่คิด VAT ราคาไม่ควรหาร 100/107 (ไม่มี VAT ให้ถอด) — ใช้ราคาเต็มตรงๆ. ให้เช็ค `so.includeVat`: true → ใช้สูตร ×100/107 ; false → ใช้ราคาเต็ม

## Verification
- typecheck + vite build เขียว
- preview read-only: เปิด SO ที่มีอยู่ กดปุ่มใหม่ → ตรวจหน้าต่างพิมพ์ render ตำแหน่ง field + ยอดรวม (อย่ากด print จริงที่อาจกระทบ prod — ref `feedback_preview_writes_prod`; ปุ่มนี้แค่เปิด preview ไม่ write DB จึงปลอดภัย แต่ห้ามสั่งพิมพ์ทับ prod data)
- ตรวจ toggle "แสดงกรอบ" + offset ขยับแล้วตำแหน่งเลื่อนจริง + ค่า persist ใน localStorage
- เคสตัวแทน VAT: เปิด SO ที่ `useVatRep` → กล่องลูกค้าโชว์ชื่อ/ที่อยู่/เลขบัตรตัวแทน

## ไม่แตะ
- `PrintDocument.jsx` / `printDoc` เดิม (A4) — 2 ปุ่มเดิมคงพฤติกรรม
- logic SO, การคำนวณ totals ในแอป, ข้อมูล vatRep
- การพิมพ์ของ QT/PO
