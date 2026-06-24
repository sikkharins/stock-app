# ตั้งค่าสถานีพิมพ์ออฟฟิศ (SO → A4)

## 1. Supabase
รัน `docs/sql/2026-06-24-print_jobs.sql` ใน SQL editor (สร้างตาราง print_jobs + RLS)

## 2. Vercel env vars
- `PRINT_STATION_TOKEN` = สุ่มค่ายาว ๆ (เช่น `openssl rand -hex 16`)
- ใช้ของเดิมที่มีอยู่แล้ว: `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_DEFAULT_GROUP_ID`,
  `SUPABASE_SERVICE_ROLE_KEY` (และ `SUPABASE_URL` ถ้าตั้งไว้)
- redeploy หลังตั้ง env

## 3. Raspberry Pi 3 B+
- ติดตั้ง Raspberry Pi OS + Chromium + CUPS
- ต่อเครื่องพิมพ์ A4 ผ่าน USB → ตั้งเป็น **default printer** ใน CUPS
  (`http://localhost:631` → Administration → Set as Server Default)
- ตรวจว่าพิมพ์ "ขนาดจริง" ไม่ scale เพี้ยน (เป็นรูป A4 จึงยืดหยุ่น)
- autostart Chromium kiosk-printing:
  `chromium-browser --kiosk-printing --noerrdialogs https://<โดเมนแอป>/print-station.html?token=<TOKEN>`
  (ใส่ใน `~/.config/lxsession/LXDE-pi/autostart` หรือ systemd user service)

## 4. ทดสอบ end-to-end
- ในแอป: เปิดใบ SO → "เช็คของขึ้นรถ" → "ส่งไปพิมพ์ที่ออฟฟิศ"
- หน้าสถานีบน RPi ควรเห็นงานใน "รอพิมพ์" แล้วพิมพ์ออกภายใน ~8 วิ → ย้ายไป "พิมพ์แล้วล่าสุด"
- กลุ่ม LINE ได้ข้อความสรุป (ถ้า quota ยังไม่เต็ม)

## หมายเหตุ
- งานค้างถ้า RPi ปิด → เปิดมาพิมพ์ต่อ; ปุ่ม "ล้างคิวที่ค้าง" กันพิมพ์ทะลัก
- สถานีเดียวเท่านั้น (เปิดหลายหน้าพร้อมกันอาจพิมพ์ซ้ำ)
- ปุ่ม "ส่งไปพิมพ์ที่ออฟฟิศ" โผล่เฉพาะหน้า "เช็คของขึ้นรถ" (ฟอร์มจัดของขึ้นรถ) เท่านั้น
