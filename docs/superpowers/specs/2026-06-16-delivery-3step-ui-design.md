# Delivery Planning — 3-step UI clarity + wording

**Date:** 2026-06-16
**Scope:** `src/components/DeliveryPlanning.jsx` (layout + labels). Light touch — no logic changes.

## Problem
หน้าวางแผนจัดส่งแสดงทุกอย่างพร้อมกัน (dropdown รถเล็กใน header, stats, SO list, summary) ผู้ใช้ไม่รู้ว่าต้อง "เลือกรถก่อน แล้วค่อยเลือก SO" ลำดับไม่ชัด

## Goal
ทำให้ flow เป็นขั้นตอนชัดเจนด้วยการ **เพิ่มเลขขั้น** (ไม่ใช่ wizard, ไม่ gate/บังคับ) คง layout + logic เดิมทั้งหมด

## Design

### ① เลือกรถขนส่ง (card ใหม่ เต็มกว้าง บนสุด)
- ดึง dropdown รถ + วันที่ ออกจาก header inline เดิม → ใส่ใน card นี้
- badge เลข "1" วงกลม (พื้น info) + หัวข้อ "เลือกรถขนส่ง"
- แสดง: dropdown รถ · วันที่จัดส่ง · **ความจุ X m³** (ตัวใหญ่ สี info) · พนักงานขับรถ
- มุมขวา card: ปุ่ม [จัดการรถ] [ประวัติรอบ (n)] (ย้ายจาก header เดิม)
- border 2px info ให้เด่นเป็นจุดเริ่ม

### ② เลือก SO ที่จะจัดส่ง (พาเนลซ้าย — เพิ่ม header เลข)
- badge "2" + "เลือก SO ที่จะจัดส่ง" + ตัวบอกความคืบหน้า "เลือกแล้ว X/Y · Z m³" (มุมขวา header)
- คงเดิม: toggle รายการ/แผนที่, ช่องค้นหาเขต, การ์ด SO, ปุ่มล้างที่เลือก

### ③ สรุป & จัดส่ง (พาเนลขวา — เปลี่ยนหัว)
- "สรุปรอบจัดส่ง — รถ X" → badge "3" + "สรุป & จัดส่ง"
- คงเดิม: gauge ปริมาตร, ยอดขาย, ปลายทาง, รายชื่อปลายทาง, หมวดสินค้า, ปุ่ม

### Stats row เดิม (4 cards: SO รอจัดส่ง/เลือกแล้ว/ปริมาตร/ยอด)
- ตัดออก — ข้อมูลซ้ำกับ Step 1 (ความจุ) + Step 2 progress + Step 3 summary แล้ว ลดความรก
- (desktop เดิมโชว์ stats row, mobile ซ่อนอยู่แล้ว)

### Mobile
- ขั้น 1 card เต็มกว้างบนสุด
- คงพฤติกรรม mobile เดิม: summary (③) running-total collapsible อยู่บน, SO list (②) ตามลง — ไม่รื้อ (ตกลงไว้ session ก่อน)
- step badge ยังโชว์บน header ของแต่ละพาเนล

## Wording changes (ทั้งไฟล์)
| เดิม | ใหม่ |
|---|---|
| (header ไม่มี) | "① เลือกรถขนส่ง" |
| "คนขับประจำรถ" (truck form) | "พนักงานขับรถ" |
| "· คนขับ {name}" (run history/truck list) | "· พนักงานขับรถ {name}" |
| "· คนขับ:" (confirmRun modal) | "· พนักงานขับรถ:" |
| "ยังไม่ตั้งคนขับ ..." | "ยังไม่ตั้งพนักงานขับรถ ..." |
| "ยืนยันส่งเสร็จหลังคนขับกลับมา" | "...หลังพนักงานขับรถกลับมา" |
| "สร้าง Pick List" (ปุ่ม) | "พิมพ์ใบจัดของ" |
| modal title "Pick List — ..." | "ใบจัดของ — ..." |
| print `<title>Pick List` | "ใบจัดของ" |
| print header "PICK LIST" | "ใบจัดของ" |

## ไม่แตะ
- modal key `oM("pickList")` / `modal === "pickList"` (internal id)
- ตัวแปร `pickList` useMemo (internal)
- logic เลือก SO, OSRM, สร้าง/พิมพ์ใบจัดของ, commitRun, ประวัติรอบ, admin edit/delete, stock deduction

## Verification
- typecheck + vite build เขียว
- preview read-only: เปิดหน้า, ดู layout 3 ขั้น desktop + mobile (ห้าม trigger save/print ที่ commit prod — ref `feedback_preview_writes_prod`)
