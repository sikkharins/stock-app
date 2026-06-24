# ส่ง SO ไปพิมพ์ที่ออฟฟิศ (แทนการส่งรูปเข้า LINE) — Design

- วันที่: 2026-06-24
- สถานะ: รอตรวจ spec ก่อนทำ plan
- ผู้เกี่ยวข้อง: solo dev (TS Electronics stock-app)

## ปัญหา / ที่มา

ปัจจุบันการส่งใบ SO ไปออฟฟิศทำผ่าน LINE: เปิดใบ SO (`printDoc` ใน
`src/components/PrintDocument.jsx`) → กดปุ่ม "ส่งเข้า LINE" → `html2canvas` แปลงเป็น
รูป → อัปขึ้น Supabase Storage → `api/line-send.js` push เข้า กลุ่ม LINE ทั้ง
**ข้อความ + รูป**

LINE หยุดส่งรูป (น่าจะเต็ม push quota รายเดือน — text+image นับเป็น 2 ข้อความต่อครั้ง)
ต้องการเปลี่ยนเป็น:

1. LINE ส่ง **ข้อความล้วน** อย่างเดียว (แค่แจ้งเตือน เบา quota)
2. รูปใบ SO ส่งไป **พิมพ์ที่ออฟฟิศอัตโนมัติ** แทน

## บริบทที่ยืนยันแล้ว (จากการ brainstorm)

- เซลสร้าง/ส่ง SO อยู่ **นอกออฟฟิศ** → ยิงตรงเข้าเครื่องพิมพ์ในวง LAN ไม่ได้ ต้องมีคิวกลาง
- ออฟฟิศมี **เครื่อง always-on** = Raspberry Pi 3 Model B+ ใช้เป็น "สถานีพิมพ์"
- รูปที่ออฟฟิศพิมพ์ = **ฟอร์ม "จัดของขึ้นรถ"** = `printDoc("so", so, products, contacts, {vatMode:"exclusive"})`
  (ปุ่ม "เช็คของขึ้นรถ" เดิม — ราคาก่อน VAT, ฟอนต์ใหญ่, ไม่มี header บริษัท, crop ครึ่งบน)
  พิมพ์เป็น **A4** ออกที่ **เครื่องพิมพ์ A4 แยกอีกเครื่อง** (ตั้งเป็น default printer ของ RPi)
  — ฟอร์มนี้คือตัวที่ history เคยส่งเข้า LINE อยู่แล้ว (comment crop "LINE-friendly")
- **LQ-2190 ไม่เกี่ยวกับงานนี้** (เป็นงานคนละส่วน ผ่าน `PrintSOForm.js` เดิม) — อยู่นอกขอบเขต
- ต้องการ **พิมพ์อัตโนมัติเต็ม** ผ่าน Chromium `--kiosk-printing` (ไม่ต้องกด dialog ทีละใบ)
- สถานีพิมพ์เป็น **หน้า standalone ไม่ต้อง login** (เบา เหมาะกับ RPi 3 B+ มากกว่าโหลดแอป React เต็มตัว)

## เป้าหมาย

- เซลกดปุ่มเดียวจากหน้า "เช็คของขึ้นรถ" → ฟอร์มจัดของขึ้นรถเข้าคิว แล้วพิมพ์ออกที่ออฟฟิศเองภายในไม่กี่วินาที
- LINE ส่งข้อความสรุป SO (ชื่อร้าน/รายการ/VAT แทน/เครดิต) แบบ best-effort (LINE ล้มไม่กระทบการพิมพ์)
- สถานีพิมพ์รันบน RPi ได้แบบเบา ไม่ต้อง login ทุกครั้ง
- ไม่ฝัง Supabase key ในหน้า public

## Non-goals (นอกขอบเขต — YAGNI)

- พิมพ์ที่ LQ-2190 / ฟอร์มต่อเนื่อง (PrintSOForm) — งานคนละส่วน
- เลือกปลายทางหลายเครื่องพิมพ์ / routing
- หลายสถานีพิมพ์พร้อมกัน (สมมติสถานีเดียว)
- offline queue ฝั่งเซล (ถ้าเน็ตหลุดตอนกดส่ง = เด้ง error ให้กดใหม่)
- realtime subscription (ใช้ polling พอ)
- คงปุ่ม/flow ส่ง **รูป** เข้า LINE เดิมไว้ (จะถูกแทนที่)

## สถาปัตยกรรม / Flow

```
เซล (นอกออฟฟิศ)                   Vercel + Supabase                RPi 3 B+ (always-on)
เปิด "เช็คของขึ้นรถ" (exclusive)                                    public/print-station.html
  └ กด "ส่งไปพิมพ์ที่ออฟฟิศ"                                        (Chromium --kiosk-printing)
      │ html2canvas ฟอร์มจัดของขึ้นรถ → PNG dataURL                  │
      └ POST /api/print-and-notify ──► อัปรูป → Storage              │ loop ทุก ~8 วิ:
            │                          insert print_jobs (pending)   │  GET /api/print-jobs?token=&status=pending
            └ LINE push ข้อความล้วน (best-effort)                    │  เจอ pending →
                                                                     │   POST status=printing
                                                                     │   iframe srcdoc=<img รูป> @page A4
                                                                     │   iframe.print()  → A4 printer (default)
                                                                     │   POST status=printed
```

## ส่วนประกอบ

### 1. ตาราง `print_jobs` (Supabase)

```sql
create table if not exists print_jobs (
  id          bigint generated always as identity primary key,
  doc_num     text not null,
  image_url   text not null,
  status      text not null default 'pending',  -- pending | printing | printed | error | cleared
  created_at  timestamptz not null default now(),
  printed_at  timestamptz,
  created_by  text
);
create index if not exists print_jobs_status_idx on print_jobs (status, created_at);

-- เปิด RLS แบบไม่มี policy = บล็อก anon/authenticated ทั้งหมด
-- (service role bypass RLS อยู่แล้ว — มีแต่ฝั่ง server ที่แตะตารางนี้)
alter table print_jobs enable row level security;
```

รูปเก็บใน bucket `line-images` เดิม (public-read อยู่แล้ว) ใช้ prefix `print/`

### 2. `api/print-and-notify.js` (ใหม่) — ฝั่งเซลส่งงาน

รับ POST จากใบ SO ทำตามลำดับ:

1. validate `imageDataUrl` (ต้องขึ้นต้น `data:image/`)
2. parse + อัป PNG ขึ้น Storage path `print/{docNum sanitized}-{Date.now()}.png` (reuse logic เดียวกับ `line-send.js`)
3. `getPublicUrl` → `image_url`
4. insert แถวลง `print_jobs` (`status='pending'`, `doc_num`, `image_url`, `created_by`)
5. push LINE **ข้อความล้วน** (type text เท่านั้น) แบบ **best-effort** — ถ้า LINE fail (quota/อื่น ๆ)
   **ไม่** ทำให้ request ล้ม (เพราะ office print คือช่องทางหลักแล้ว)

`message` เป็นข้อความสำเร็จรูปที่ฝั่ง client build มาแล้ว (ดู §4) — server แค่ส่งต่อเป็น text

Request:
```json
{ "imageDataUrl": "data:image/png;base64,...", "docNum": "SO-2026-0001",
  "message": "ใบขาย SO-2026-0001\nร้าน: ...\nรายการ:\n- ...\nการชำระ: เครดิต 45 วัน",
  "user": "somchai" }
```
Response 200:
```json
{ "success": true, "jobId": 123, "imageUrl": "https://.../print/....png",
  "lineSent": true, "lineError": null }
```
Errors: 400 รูปไม่ถูกต้อง, 500 อัป/insert ล้ม. (LINE ล้ม → ยัง 200 แต่ `lineSent:false`)

env ที่ใช้: `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_DEFAULT_GROUP_ID`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY` (มีอยู่แล้วจาก line-send)

### 3. `api/print-jobs.js` (ใหม่) — ฝั่งสถานีอ่าน/อัปเดตคิว

ใช้ **service role ฝั่ง server** ทั้งหมด → หน้า standalone ไม่ต้องมี Supabase key
ป้องกันด้วย token (env `PRINT_STATION_TOKEN`)

- `GET /api/print-jobs?token=XXX&status=pending`
  - 401 ถ้า token ผิด
  - 200 → `{ "jobs": [ { "id", "docNum", "imageUrl", "createdAt" } ] }` (เรียงตาม created_at)
  - รองรับ `status=printed` (limit ล่าสุด ~20) สำหรับโชว์ประวัติ/พิมพ์ซ้ำ
- `POST /api/print-jobs` body `{ "token":"XXX", "id":123, "status":"printing|printed|error|cleared" }`
  - 401 ถ้า token ผิด
  - อัป `status` (+ `printed_at=now()` เมื่อ printed) → `{ "success": true }`

### 4. ปุ่มในฟอร์มจัดของขึ้นรถ — `src/components/PrintDocument.jsx`

- ลบปุ่ม "ส่งเข้า LINE" + ฟังก์ชัน `sendToLine` เดิมออก
- เพิ่มปุ่ม **"ส่งไปพิมพ์ที่ออฟฟิศ"** — แสดง **เฉพาะตอน `isExclusive` (โหมดจัดของขึ้นรถ)** เท่านั้น
  (หน้า SO เต็มปกติไม่มีปุ่มนี้ → บังคับว่าออฟฟิศได้ฟอร์มจัดของขึ้นรถเสมอ)
- `onClick`: reuse โค้ด capture เดิมของ `sendToLine` ทั้งหมด รวม **crop ครึ่งบนของ exclusive**
  → PNG dataURL → `POST /api/print-and-notify` พร้อม `docNum`, `message`
- alert ผลลัพธ์: สำเร็จ / ล้มเหลว (+ แจ้งถ้า LINE ไม่ออกแต่เข้าคิวพิมพ์แล้ว)
- workflow ผู้ใช้: เปิดใบ SO → "เช็คของขึ้นรถ" → ในป็อปอัปกด "ส่งไปพิมพ์ที่ออฟฟิศ"
- `api/line-send.js` กลายเป็นไม่ถูกเรียก → คงไฟล์ไว้ก่อน (ลบทีหลังได้) ระบุใน plan

**การ build ข้อความ LINE** (ทำใน `printDoc` ฝั่ง outer JS ซึ่งมี `data`/`products`/`contacts`
ครบ แล้ว `JSON.stringify` ฉีดเข้าป็อปอัปเหมือน `docNum` เดิม):

```
{t.th} {t.num}                         // เช่น "ใบขาย SO-2026-0001"
ร้าน: {contact.nameT || contact.name}
รายการ:
- {pr.nameT||pr.name} x{it.qty} {pr.unit}     // ต่อ item; ถ้ามี parts แตกตามบรรทัด
- ...
ออก VAT ในนาม: {data.vatRepName}        // เฉพาะเมื่อ data.useVatRep && data.vatRepName
การชำระ: เงินสด | เครดิต {data.creditDays} วัน   // ตาม data.payType
```

- `contact` = `contacts.find(c => c.id === data.customerId)`
- ตัดความยาวข้อความที่ ~4500 ตัวอักษร (LINE จำกัด 5000) ถ้ารายการยาวมาก

### 5. `public/print-station.html` (ใหม่) — สถานีพิมพ์ standalone

หน้าเดียวจบ vanilla JS (ไม่มี build step, เสิร์ฟตรงจาก Vercel ที่ `/print-station.html`):

- อ่าน `token` จาก URL (`?token=XXX`) — ไม่ฝังใน source
- loop poll `GET /api/print-jobs?status=pending` ทุก ~8 วินาที
- ประมวลผล **ทีละใบ** (sequential), ใบที่ยังไม่ได้ทำเท่านั้น:
  1. `POST status=printing` (กันพิมพ์ซ้ำ)
  2. set `<iframe>` srcdoc =
     ```html
     <!doctype html><html><head><style>
       @page{size:A4;margin:8mm} html,body{margin:0} img{width:100%;display:block}
     </style></head><body><img src="{imageUrl}">
     <script>window.onload=function(){window.focus();window.print();
       parent.postMessage({printed:true},'*');}</script></body></html>
     ```
  3. รอ `postMessage({printed:true})` → `POST status=printed` → ใบถัดไป
- UI: หัวข้อ "สถานีพิมพ์ออฟฟิศ", สถานะ poll ล่าสุด, ใบที่กำลังพิมพ์, จำนวน pending,
  ประวัติพิมพ์ล่าสุด (ปุ่ม "พิมพ์ซ้ำ" ต่อใบ), toggle "หยุด/เริ่ม พิมพ์อัตโนมัติ",
  ปุ่ม "ล้างคิวที่ค้าง" (POST status=cleared ทุกใบ pending โดยไม่พิมพ์)

## การจัดการ error / edge cases

- **เซลกดส่งตอนเน็ตหลุด** → POST fail → alert ให้กดใหม่ (ไม่มี offline queue ฝั่งเซล)
- **RPi ปิด/เน็ตหลุด** → งานค้างเป็น `pending` ใน DB; เปิดสถานีมาใหม่จะพิมพ์ที่ค้างทั้งหมด
  → มีปุ่ม "ล้างคิว" กันพิมพ์ทะลักถ้าค้างเยอะ
- **เบราว์เซอร์เช็คผลพิมพ์จริงไม่ได้** → `printed` = "สั่งพิมพ์แล้ว"; กระดาษติด/หมดใช้ปุ่ม "พิมพ์ซ้ำ"
- **กันพิมพ์ซ้ำ** → mark `printing` ก่อนสั่งพิมพ์ + GET เอาเฉพาะ `pending` (สมมติสถานีเดียว)
- **งานค้าง `printing` (สถานี crash กลางคัน)** → ตอนสถานีเริ่มทำงานใหม่ เรียก `POST status=pending`
  คืนงาน `printing` ทั้งหมดกลับเป็น `pending` (สถานีเดียว → ทุก `printing` คืองานกำพร้า)
  รองรับด้วย `GET ?status=printing` เพื่อดึงรายการมา reset
- **LINE เต็ม quota** → endpoint ยัง insert คิว + ตอบ success (`lineSent:false`) → การพิมพ์ไม่กระทบ

## Security

- หน้า standalone **ไม่มี** Supabase key — คุยผ่าน API (service role) เท่านั้น ป้องกันด้วย `PRINT_STATION_TOKEN`
- `print_jobs` เปิด RLS ไม่มี policy → แตะได้แค่ service role
- รูป SO อยู่ใน bucket public เดิม (ระดับความ sensitive เท่ากับ flow LINE เดิมที่ส่งเข้ากลุ่มอยู่แล้ว) — ยอมรับได้
- token ส่งผ่าน query string ของ URL kiosk (อยู่บนเครื่อง RPi เครื่องเดียว) — ยอมรับได้สำหรับ internal tool

## ตั้งค่าครั้งเดียว (ออฟฟิศ)

1. รัน SQL สร้างตาราง `print_jobs` (+ index + enable RLS) บน Supabase
2. ตั้ง env `PRINT_STATION_TOKEN` บน Vercel (สุ่มค่า)
3. RPi 3 B+:
   - ติดตั้ง CUPS + driver เครื่อง A4, ตั้งเครื่อง A4 เป็น **default printer**
   - autostart Chromium: `chromium-browser --kiosk-printing https://<แอป>/print-station.html?token=XXX`
   - (caveat) ตรวจว่าพิมพ์ "ขนาดจริง/ไม่ scale เพี้ยน" บน A4 — เป็นรูปจึงยืดหยุ่นกว่าฟอร์ม dot-matrix

## แผนทดสอบ (คร่าว ๆ)

- `api/print-and-notify`: รูป valid → insert + ตอบ jobId; รูป invalid → 400; LINE fail → ยัง 200 lineSent:false
- `api/print-jobs`: token ผิด → 401; GET pending คืนเฉพาะ pending; POST เปลี่ยน status ได้
- ปุ่มใบ SO: กดแล้ว POST ถูก endpoint + payload ถูก (docNum/message)
- สถานี: mock GET คืน 1 ใบ → iframe โหลด → print() ถูกเรียก → POST printed (ทดสอบบนเครื่อง dev ด้วย printer จำลอง/Save as PDF)
- ระวัง: dev share prod Supabase — อย่ากดส่งจริงระหว่างเทสต์โดยไม่ขออนุญาต

## จุดที่เคาะแล้ว (decisions)

- รูปที่พิมพ์ = **ฟอร์มจัดของขึ้นรถ (exclusive)** ไม่ใช่ใบ SO เต็ม → ปุ่มอยู่ในหน้าเช็คของขึ้นรถเท่านั้น
- ข้อความ LINE = ชื่อร้าน + รายการสินค้า + ออก VAT แทน (ถ้ามี) + เครดิตเทอม (build ฝั่ง client)
- เก็บ "รูป" ไม่ใช่ "ข้อมูล SO render ใหม่" → WYSIWYG + สถานีเบา
- หน้า standalone + serverless+token (ไม่ใช่ in-app tab / ไม่ฝัง anon key) → เหมาะ RPi 3 B+
- ปุ่มเดียว ทิ้ง flow ส่งรูปเข้า LINE เดิม
- LINE best-effort ข้อความล้วน
- polling ~8 วิ (ไม่ใช้ realtime)
