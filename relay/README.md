# stock-app camera relay

ดึงเฟรม + PTZ preset จากกล้อง Tapo C560WS ป้อนหน้า "ตรวจนับ AI" — รัน on-demand บนเครื่องที่ต่อ LAN เดียวกับกล้อง (โน้ตบุ๊กหน้างาน)

## เตรียม
1. แอป Tapo → ตั้ง **Camera Account** (Advanced Settings) + ตั้ง **preset** เล็งกล้องไปจุดที่ต้องการแล้วเซฟ
2. ติดตั้ง **ffmpeg** ให้อยู่ใน PATH
3. `cd relay && npm install`
4. คัดลอก `.env.example` -> `.env` เติม CAM_IP/USER/PASS

## รัน
- จริง: `node --env-file=.env server.js`
- mock (ไม่มีกล้อง): `node server.js`

## ใช้กับแอป
เปิดเบราว์เซอร์เครื่องเดียวกัน -> "ตรวจนับ AI" -> "ดึงจากกล้อง" (relay url default `http://localhost:8765`)

## endpoints
- `GET /presets` -> `{presets:[{token,name}], mock}`
- `GET /snapshot?preset=<token>` -> image/jpeg (ไม่ใส่ preset = มุมปัจจุบัน)

ONVIF call อิง https://github.com/earino/tapo-control (ตรวจ license ก่อน copy) — โค้ดนี้เขียนเอง
