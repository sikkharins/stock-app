# Prompt to paste into Claude Code

เปิด terminal ใน `C:\Users\sikkh\OneDrive\Desktop\stock-app` แล้วรัน:

```bash
claude
```

จากนั้น paste prompt นี้:

---

```
ผมมีไฟล์ design handoff อยู่ที่ design-handoff-apple-theme/ ในโปรเจกต์นี้

อ่าน design-handoff-apple-theme/README.md ทั้งหมดก่อน แล้วช่วยทำตามนี้:

1. อ่าน + เข้าใจ design tokens (Light + Dark), component mapping, และ critical behaviors ทั้งหมดใน README

2. เปิด Apple Preview.html (ในโฟลเดอร์เดียวกัน) เป็น visual reference — มี 5 หน้าใน 2 themes

3. เริ่ม implement ตามลำดับใน section "Implementation order":
   - Step 1: สร้าง theme tokens + toggle ก่อน
   - Step 2: refactor ui primitives (Btn, Field, Modal, Badge, StatCard, SearchBar, Sel, ProductPicker)
   - Step 3: ปรับ App.jsx (sidebar + topbar)
   - Step 4: ค่อย ๆ ทำหน้าตามลำดับ Dashboard → Products → Sales → Reports → ที่เหลือ

4. ทุกครั้งที่ทำเสร็จแต่ละ step ให้ทดสอบโดย:
   - npm run dev → เปิด http://localhost:5174
   - ตรวจว่า theme toggle ทำงาน
   - ตรวจว่า business logic ไม่พัง (login, create SO, stock check, VAT rep)

5. ห้ามเปลี่ยน:
   - โครงสร้าง state ใน App.jsx
   - shape ของ localStorage keys (v3_*)
   - business logic ใน utils/helpers.js, utils/storage.js
   - data structures ใน data/initData.js
   - การ print (PrintDocument.jsx ต้องคงสีขาว/ดำเสมอ)

ถ้าเจอ component ที่ไม่แน่ใจว่าควรปรับยังไง ให้ดู Apple Preview.html ก่อน
ถ้ายังไม่ชัดให้ถามผมก่อนทำ

เริ่มจาก step 1 เลยครับ
```

---

## Tips สำหรับ Claude Code

- ใช้ `git checkout -b apple-theme` ก่อนเริ่ม เผื่อจะ rollback
- หลังแต่ละ step ให้ `git commit` เป็น checkpoint
- ถ้า Claude Code ขัดข้องตรงไหน ส่งภาพหน้าจอ + ไฟล์ component ที่กำลังแก้กลับมาให้ผมดูได้ใน chat ใหม่
