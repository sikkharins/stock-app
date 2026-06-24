# SO → Office A4 Auto-Print Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** แทนการส่งรูป SO เข้า LINE ด้วยการส่งฟอร์ม "จัดของขึ้นรถ" เข้าคิวพิมพ์ที่ Supabase ให้สถานีพิมพ์ standalone บน RPi พิมพ์ A4 อัตโนมัติ + LINE ส่งข้อความสรุปแบบ best-effort

**Architecture:** ปุ่มในฟอร์มจัดของขึ้นรถ ([PrintDocument.jsx](../../../src/components/PrintDocument.jsx)) → `html2canvas` → POST `/api/print-and-notify` (อัปรูป Storage + insert `print_jobs` + LINE text) → หน้า `public/print-station.html` บน RPi (Chromium `--kiosk-printing`) poll `/api/print-jobs` แล้วพิมพ์รูปผ่าน iframe

**Tech Stack:** React 19 + Vite, Vercel serverless (Node ESM handlers), Supabase JS, vitest, vanilla JS (สถานี)

**Spec:** [docs/superpowers/specs/2026-06-24-so-office-print-design.md](../specs/2026-06-24-so-office-print-design.md)

---

## File Structure

- Create `docs/sql/2026-06-24-print_jobs.sql` — DDL ของตาราง `print_jobs` (รันมือใน Supabase)
- Create `src/utils/officeMessage.ts` — ฟังก์ชัน pure `buildOfficeMessage(...)` (มี unit test)
- Create `src/utils/officeMessage.test.ts` — vitest tests
- Create `api/print-and-notify.js` — เซลส่งงาน: อัปรูป + insert คิว + LINE text best-effort
- Create `api/print-jobs.js` — สถานีอ่าน/อัปเดตคิว (service role + token)
- Create `public/print-station.html` — สถานีพิมพ์ standalone
- Create `docs/print-station-setup.md` — วิธีตั้งค่า env + RPi/Chromium/CUPS
- Modify `src/components/PrintDocument.jsx` — เปลี่ยนปุ่ม LINE → "ส่งไปพิมพ์ที่ออฟฟิศ" (เฉพาะโหมด exclusive)

หมายเหตุความปลอดภัย: dev share prod Supabase (ดู memory `feedback_preview_writes_prod`) — **อย่ายิง endpoint จริงใส่ prod ระหว่างเทสต์โดยไม่ขออนุญาต** งาน unit test ทำกับฟังก์ชัน pure เท่านั้น

---

### Task 1: ตาราง `print_jobs` (SQL setup)

**Files:**
- Create: `docs/sql/2026-06-24-print_jobs.sql`

- [ ] **Step 1: สร้างไฟล์ SQL**

สร้าง `docs/sql/2026-06-24-print_jobs.sql`:

```sql
-- คิวงานพิมพ์ SO ที่ออฟฟิศ (รันใน Supabase SQL editor)
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
-- (มีแต่ฝั่ง server ที่ใช้ service role ซึ่ง bypass RLS แตะตารางนี้)
alter table print_jobs enable row level security;
```

- [ ] **Step 2: รัน SQL บน Supabase (manual)**

เปิด Supabase Dashboard → SQL Editor → วางเนื้อหาไฟล์ → Run
ตรวจ: Table editor เห็นตาราง `print_jobs` และ RLS = enabled

- [ ] **Step 3: Commit**

```bash
git add docs/sql/2026-06-24-print_jobs.sql
git commit -m "feat(print): print_jobs queue table DDL"
```

---

### Task 2: ฟังก์ชัน `buildOfficeMessage` + tests (TDD)

**Files:**
- Create: `src/utils/officeMessage.ts`
- Test: `src/utils/officeMessage.test.ts`

- [ ] **Step 1: เขียน test ที่ยังไม่ผ่าน**

สร้าง `src/utils/officeMessage.test.ts`:

```ts
import { describe, test, expect } from "vitest";
import { buildOfficeMessage } from "./officeMessage";

const products = [
  { id: 1, nameT: "ตู้เย็น Samsung", unit: "เครื่อง" },
  { id: 2, nameT: "แอร์ Daikin 12000", unit: "เครื่อง" },
];
const contacts = [{ id: 10, nameT: "ร้านสมชาย" }];

describe("buildOfficeMessage", () => {
  test("เงินสด พื้นฐาน", () => {
    const so = { customerId: 10, items: [{ productId: 1, qty: 2 }], payType: "cash" };
    const msg = buildOfficeMessage("ใบขาย", "SO-1", so, products, contacts);
    expect(msg).toContain("ใบขาย SO-1");
    expect(msg).toContain("ร้าน: ร้านสมชาย");
    expect(msg).toContain("- ตู้เย็น Samsung x2 เครื่อง");
    expect(msg).toContain("การชำระ: เงินสด");
    expect(msg).not.toContain("ออก VAT");
  });

  test("เครดิต + ตัวแทนออก VAT", () => {
    const so = { customerId: 10, items: [{ productId: 2, qty: 1 }], payType: "credit", creditDays: 45, useVatRep: true, vatRepName: "บจก เอบีซี" };
    const msg = buildOfficeMessage("ใบขาย", "SO-2", so, products, contacts);
    expect(msg).toContain("ออก VAT ในนาม: บจก เอบีซี");
    expect(msg).toContain("การชำระ: เครดิต 45 วัน");
  });

  test("ไม่เจอสินค้า/ลูกค้า → ใช้ -", () => {
    const so = { customerId: 999, items: [{ productId: 999, qty: 3 }], payType: "cash" };
    const msg = buildOfficeMessage("ใบขาย", "SO-3", so, products, contacts);
    expect(msg).toContain("ร้าน: -");
    expect(msg).toContain("- - x3");
  });

  test("ตัดความยาวที่ maxLen", () => {
    const items = Array.from({ length: 500 }, () => ({ productId: 1, qty: 1 }));
    const so = { customerId: 10, items, payType: "cash" };
    const msg = buildOfficeMessage("ใบขาย", "SO-4", so, products, contacts, 200);
    expect(msg.length).toBeLessThanOrEqual(200);
  });
});
```

- [ ] **Step 2: รัน test ให้ FAIL**

Run: `npm test -- officeMessage`
Expected: FAIL — `buildOfficeMessage` / module ยังไม่มี

- [ ] **Step 3: เขียน implementation**

สร้าง `src/utils/officeMessage.ts`:

```ts
// สร้างข้อความ LINE แจ้งเตือนเมื่อส่ง SO เข้าคิวพิมพ์ที่ออฟฟิศ
// ข้อความล้วน: ชื่อร้าน + รายการสินค้า (1 บรรทัด/รายการ) + ตัวแทนออก VAT (ถ้ามี) + เงื่อนไขชำระ

export interface OmItem { productId: number; qty: number; }
export interface OmSO {
  customerId: number;
  items: OmItem[];
  useVatRep?: boolean;
  vatRepName?: string | null;
  payType?: string;
  creditDays?: number;
}
export interface OmProduct { id: number; nameT?: string; name?: string; unit?: string; }
export interface OmContact { id: number; nameT?: string; name?: string; }

export function buildOfficeMessage(
  titleTH: string,
  docNum: string,
  so: OmSO,
  products: OmProduct[],
  contacts: OmContact[],
  maxLen = 4500
): string {
  const contact = contacts.find((c) => c.id === so.customerId);
  const customerName = (contact && (contact.nameT || contact.name)) || "-";
  const lines: string[] = [];
  lines.push(`${titleTH} ${docNum}`.trim());
  lines.push(`ร้าน: ${customerName}`);
  lines.push("รายการ:");
  (so.items || []).forEach((it) => {
    const pr = products.find((p) => p.id === it.productId);
    const name = (pr && (pr.nameT || pr.name)) || "-";
    const unit = (pr && pr.unit) || "";
    lines.push(`- ${name} x${it.qty}${unit ? " " + unit : ""}`);
  });
  if (so.useVatRep && so.vatRepName) {
    lines.push(`ออก VAT ในนาม: ${so.vatRepName}`);
  }
  lines.push(
    so.payType === "credit"
      ? `การชำระ: เครดิต ${so.creditDays || 0} วัน`
      : "การชำระ: เงินสด"
  );
  let out = lines.join("\n");
  if (out.length > maxLen) out = out.slice(0, maxLen - 1) + "…";
  return out;
}
```

- [ ] **Step 4: รัน test ให้ PASS**

Run: `npm test -- officeMessage`
Expected: PASS ทั้ง 4 เคส

- [ ] **Step 5: Commit**

```bash
git add src/utils/officeMessage.ts src/utils/officeMessage.test.ts
git commit -m "feat(print): buildOfficeMessage LINE summary text"
```

---

### Task 3: `api/print-and-notify.js` (เซลส่งงาน)

**Files:**
- Create: `api/print-and-notify.js`

- [ ] **Step 1: เขียน endpoint**

สร้าง `api/print-and-notify.js` (mirror โครงสร้างจาก `api/line-send.js`):

```js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const { imageDataUrl, docNum, message, user } = req.body || {};
    if (!imageDataUrl || typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Missing or invalid imageDataUrl' });
    }

    const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const groupId = process.env.LINE_DEFAULT_GROUP_ID;
    const supabaseUrl = process.env.SUPABASE_URL || 'https://lqgvwxyjzpsoflczyzik.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseServiceKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set in env' });

    const m = imageDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!m) return res.status(400).json({ error: 'Invalid data URL format' });
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
    const buffer = Buffer.from(m[2], 'base64');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const fileName = 'print/' + (docNum || 'doc').replace(/[^a-zA-Z0-9-_]/g, '_') + '-' + Date.now() + '.' + ext;
    const { error: upErr } = await supabase.storage
      .from('line-images')
      .upload(fileName, buffer, { contentType: 'image/' + ext, upsert: false });
    if (upErr) return res.status(500).json({ error: 'Upload failed: ' + upErr.message });

    const { data: pub } = supabase.storage.from('line-images').getPublicUrl(fileName);
    const publicUrl = pub?.publicUrl;
    if (!publicUrl) return res.status(500).json({ error: 'Could not resolve public URL' });

    const { data: job, error: insErr } = await supabase
      .from('print_jobs')
      .insert({ doc_num: docNum || '', image_url: publicUrl, status: 'pending', created_by: user || null })
      .select('id')
      .single();
    if (insErr) return res.status(500).json({ error: 'Queue insert failed: ' + insErr.message });

    // LINE text — best-effort: ห้ามทำให้ request ล้มถ้า LINE fail
    let lineSent = false, lineError = null;
    if (lineToken && groupId && message) {
      try {
        const lineRes = await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + lineToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: groupId, messages: [{ type: 'text', text: String(message).slice(0, 5000) }] }),
        });
        if (lineRes.ok) lineSent = true;
        else lineError = 'LINE API ' + lineRes.status + ': ' + (await lineRes.text());
      } catch (e) { lineError = e.message || String(e); }
    } else {
      lineError = 'LINE not configured or empty message';
    }

    return res.status(200).json({ success: true, jobId: job.id, imageUrl: publicUrl, lineSent, lineError });
  } catch (e) {
    return res.status(500).json({ error: 'Server error: ' + (e.message || String(e)) });
  }
}
```

- [ ] **Step 2: ตรวจ syntax ผ่าน lint**

Run: `npm run lint`
Expected: ไม่มี error ใหม่จากไฟล์นี้

- [ ] **Step 3: Commit**

```bash
git add api/print-and-notify.js
git commit -m "feat(print): /api/print-and-notify upload + queue + LINE text"
```

---

### Task 4: `api/print-jobs.js` (สถานีอ่าน/อัปเดตคิว)

**Files:**
- Create: `api/print-jobs.js`

- [ ] **Step 1: เขียน endpoint**

สร้าง `api/print-jobs.js`:

```js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const token = req.method === 'GET' ? req.query.token : (req.body && req.body.token);
  const expected = process.env.PRINT_STATION_TOKEN;
  if (!expected || token !== expected) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const supabaseUrl = process.env.SUPABASE_URL || 'https://lqgvwxyjzpsoflczyzik.supabase.co';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseServiceKey) { res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set in env' }); return; }
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    if (req.method === 'GET') {
      const status = req.query.status || 'pending';
      let q;
      if (status === 'printed') {
        q = supabase.from('print_jobs').select('id, doc_num, image_url, created_at')
          .eq('status', 'printed').order('printed_at', { ascending: false }).limit(20);
      } else {
        q = supabase.from('print_jobs').select('id, doc_num, image_url, created_at')
          .eq('status', status).order('created_at', { ascending: true });
      }
      const { data, error } = await q;
      if (error) return res.status(500).json({ error: error.message });
      const jobs = (data || []).map((r) => ({ id: r.id, docNum: r.doc_num, imageUrl: r.image_url, createdAt: r.created_at }));
      return res.status(200).json({ jobs });
    }

    if (req.method === 'POST') {
      const { id, status } = req.body || {};
      const allowed = ['pending', 'printing', 'printed', 'error', 'cleared'];
      if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

      if (id == null) {
        // bulk: คืน orphaned printing -> pending (สถานีเริ่มใหม่)
        if (status === 'pending') {
          const { error } = await supabase.from('print_jobs').update({ status: 'pending' }).eq('status', 'printing');
          if (error) return res.status(500).json({ error: error.message });
          return res.status(200).json({ success: true });
        }
        // bulk: ล้างคิว pending -> cleared
        if (status === 'cleared') {
          const { error } = await supabase.from('print_jobs').update({ status: 'cleared' }).eq('status', 'pending');
          if (error) return res.status(500).json({ error: error.message });
          return res.status(200).json({ success: true });
        }
        return res.status(400).json({ error: 'Missing id' });
      }

      const patch = { status };
      if (status === 'printed') patch.printed_at = new Date().toISOString();
      const { error } = await supabase.from('print_jobs').update(patch).eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: 'Server error: ' + (e.message || String(e)) });
  }
}
```

- [ ] **Step 2: ตรวจ syntax ผ่าน lint**

Run: `npm run lint`
Expected: ไม่มี error ใหม่จากไฟล์นี้

- [ ] **Step 3: Commit**

```bash
git add api/print-jobs.js
git commit -m "feat(print): /api/print-jobs station read/update (token-gated)"
```

---

### Task 5: ปุ่ม "ส่งไปพิมพ์ที่ออฟฟิศ" ใน `PrintDocument.jsx`

**Files:**
- Modify: `src/components/PrintDocument.jsx`

- [ ] **Step 1: import + คำนวณ officeMessage**

เพิ่มบรรทัดบนสุดของไฟล์ (หลังบรรทัดแรกที่มี `const CO = {`? — วางไว้บรรทัดแรกสุดของไฟล์):

```js
import { buildOfficeMessage } from "../utils/officeMessage.js";
```

ในฟังก์ชัน `printDoc` ใกล้ ๆ บรรทัด `const apiOrigin = window.location.origin;` เพิ่ม:

```js
  const officeMessage = type === "so" ? buildOfficeMessage(t.th, t.num, data, products, contacts) : "";
```

> หมายเหตุ: `t` ถูกประกาศหลัง `apiOrigin` (`const t = titles[type];`) ดังนั้นวาง `officeMessage` ไว้ **หลัง** บรรทัด `const t = titles[type];`

- [ ] **Step 2: เปลี่ยนปุ่มใน toolbar**

แทนที่บรรทัดปุ่ม LINE เดิม:

```html
  <button onclick="sendToLine()" style="padding:9px 18px;background:#06C755;color:#fff;border:none;border-radius:7px;font-size:14px;cursor:pointer;font-family:inherit;">📤 ส่งเข้า LINE</button>
```

ด้วย (แสดงเฉพาะโหมด exclusive = ฟอร์มจัดของขึ้นรถ):

```html
  ${isExclusive ? `<button onclick="sendToOffice()" style="padding:9px 18px;background:#06C755;color:#fff;border:none;border-radius:7px;font-size:14px;cursor:pointer;font-family:inherit;">📤 ส่งไปพิมพ์ที่ออฟฟิศ</button>` : ""}
```

- [ ] **Step 3: เพิ่มตัวแปร + ฟังก์ชัน sendToOffice แทน sendToLine**

ลบฟังก์ชัน `async function sendToLine() { ... }` ทั้งก้อนออก แล้วเพิ่มตัวแปรไว้ต้น `<script>` (ใต้บรรทัด `<script>`):

```js
var OFFICE_MSG = ${JSON.stringify(officeMessage)};
var DOC_NUM = ${JSON.stringify(t.num)};
var API_ORIGIN = ${JSON.stringify(apiOrigin)};
var VAT_MODE = ${JSON.stringify(vatMode)};
```

แล้ววางฟังก์ชันนี้แทน:

```js
async function sendToOffice() {
  if (typeof html2canvas !== 'function') {
    alert('ยังโหลด html2canvas ไม่เสร็จ ลองอีกครั้งใน 1-2 วินาที');
    return;
  }
  if (!confirm('ส่งฟอร์มจัดของขึ้นรถนี้ไปพิมพ์ที่ออฟฟิศ?')) return;

  var toolbar = document.querySelector('.no-print');
  if (toolbar) toolbar.style.display = 'none';
  try {
    var canvas = await html2canvas(document.body, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    if (toolbar) toolbar.style.display = '';

    var finalCanvas = canvas;
    if (VAT_MODE === 'exclusive') {
      var cropped = document.createElement('canvas');
      cropped.width = canvas.width;
      cropped.height = Math.floor(canvas.height / 2);
      var ctx = cropped.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cropped.width, cropped.height);
      ctx.drawImage(canvas, 0, 0);
      finalCanvas = cropped;
    }

    var dataUrl = finalCanvas.toDataURL('image/png');
    var resp = await fetch(API_ORIGIN + '/api/print-and-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageDataUrl: dataUrl, docNum: DOC_NUM, message: OFFICE_MSG }),
    });

    var result = await resp.json().catch(function() { return { error: 'Invalid JSON response' }; });
    if (resp.ok && result.success) {
      alert('✅ ส่งเข้าคิวพิมพ์ที่ออฟฟิศแล้ว' + (result.lineSent ? ' (แจ้ง LINE แล้ว)' : ' — LINE ไม่ออก: ' + (result.lineError || '')));
    } else {
      alert('❌ ส่งไม่สำเร็จ: ' + (result.error || ('HTTP ' + resp.status)));
    }
  } catch (err) {
    if (toolbar) toolbar.style.display = '';
    alert('❌ เกิดข้อผิดพลาด: ' + (err.message || err));
  }
}
```

- [ ] **Step 4: ตรวจ build + lint**

Run: `npm run build`
Expected: build ผ่าน ไม่มี error
Run: `npm run lint`
Expected: ไม่มี error ใหม่

- [ ] **Step 5: Commit**

```bash
git add src/components/PrintDocument.jsx
git commit -m "feat(print): replace LINE-send with ส่งไปพิมพ์ที่ออฟฟิศ in จัดของขึ้นรถ"
```

---

### Task 6: `public/print-station.html` (สถานีพิมพ์)

**Files:**
- Create: `public/print-station.html`

- [ ] **Step 1: เขียนหน้าสถานี**

สร้าง `public/print-station.html`:

```html
<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>สถานีพิมพ์ออฟฟิศ</title>
<style>
  body{font-family:system-ui,'Sarabun',sans-serif;margin:0;padding:16px;background:#111;color:#eee}
  h1{font-size:18px;margin:0 0 8px}
  .row{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
  button{padding:8px 14px;border:1px solid #444;border-radius:8px;background:#222;color:#eee;cursor:pointer;font-size:14px}
  button.on{background:#1d9e75;border-color:#1d9e75;color:#fff}
  .status{font-size:13px;color:#9ad}
  .status.err{color:#f77}
  .job{display:flex;gap:10px;align-items:center;padding:8px;border-bottom:1px solid #333;font-size:14px}
  .job .num{font-weight:600;min-width:150px}
  .muted{color:#888}
  #frame{position:fixed;left:-9999px;top:0;width:210mm;height:297mm;border:0}
</style>
</head>
<body>
<h1>สถานีพิมพ์ออฟฟิศ</h1>
<div class="row">
  <button id="toggle" class="on">● พิมพ์อัตโนมัติ: เปิด</button>
  <button id="clear">ล้างคิวที่ค้าง</button>
  <span class="status" id="status">เริ่มต้น…</span>
</div>
<div class="row"><strong>รอพิมพ์ (<span id="pcount">0</span>)</strong></div>
<div id="pending"></div>
<div class="row" style="margin-top:14px"><strong>พิมพ์แล้วล่าสุด</strong></div>
<div id="printed"></div>
<iframe id="frame"></iframe>
<script>
(function(){
  var params = new URLSearchParams(location.search);
  var TOKEN = params.get('token') || '';
  var POLL_MS = 8000;
  var auto = true, busy = false;
  var statusEl = document.getElementById('status');
  function setStatus(t, isErr){ statusEl.textContent = t; statusEl.className = 'status' + (isErr ? ' err' : ''); }

  function api(path, opts){
    return fetch(path, opts).then(function(r){
      return r.json().catch(function(){ return {}; }).then(function(j){
        if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
        return j;
      });
    });
  }
  function getJobs(status){ return api('/api/print-jobs?token=' + encodeURIComponent(TOKEN) + '&status=' + status); }
  function post(body){ return api('/api/print-jobs', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(Object.assign({ token: TOKEN }, body)) }); }

  function printImage(url){
    return new Promise(function(resolve){
      var frame = document.getElementById('frame');
      var html = '<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:8mm}html,body{margin:0}img{width:100%;display:block}</style></head><body><img src="' + url + '"><scr' + 'ipt>window.onload=function(){setTimeout(function(){window.focus();window.print();parent.postMessage({printed:true},"*");},150);}</scr' + 'ipt></body></html>';
      function onMsg(e){ if (e.data && e.data.printed){ window.removeEventListener('message', onMsg); resolve(); } }
      window.addEventListener('message', onMsg);
      frame.srcdoc = html;
    });
  }

  function renderList(el, jobs, withReprint){
    el.innerHTML = '';
    jobs.forEach(function(j){
      var d = document.createElement('div'); d.className = 'job';
      var num = document.createElement('span'); num.className = 'num'; num.textContent = j.docNum || ('#' + j.id); d.appendChild(num);
      var t = document.createElement('span'); t.className = 'muted'; t.textContent = new Date(j.createdAt).toLocaleString('th-TH'); d.appendChild(t);
      if (withReprint){ var b = document.createElement('button'); b.textContent = 'พิมพ์ซ้ำ'; b.onclick = function(){ printImage(j.imageUrl); }; d.appendChild(b); }
      el.appendChild(d);
    });
  }

  async function tick(){
    try{
      var pend = (await getJobs('pending')).jobs || [];
      document.getElementById('pcount').textContent = pend.length;
      renderList(document.getElementById('pending'), pend, false);
      if (auto && !busy && pend.length){
        busy = true;
        var job = pend[0];
        setStatus('กำลังพิมพ์ ' + (job.docNum || job.id) + '…');
        await post({ id: job.id, status: 'printing' });
        try { await printImage(job.imageUrl); await post({ id: job.id, status: 'printed' }); }
        catch (err) { await post({ id: job.id, status: 'error' }); }
        busy = false;
      }
      var printed = (await getJobs('printed')).jobs || [];
      renderList(document.getElementById('printed'), printed, true);
      setStatus('อัปเดต ' + new Date().toLocaleTimeString('th-TH') + ' · รอพิมพ์ ' + pend.length);
    } catch (err){ setStatus('ผิดพลาด: ' + err.message, true); busy = false; }
  }

  document.getElementById('toggle').onclick = function(){
    auto = !auto; this.className = auto ? 'on' : '';
    this.textContent = '● พิมพ์อัตโนมัติ: ' + (auto ? 'เปิด' : 'ปิด');
  };
  document.getElementById('clear').onclick = function(){
    if (confirm('ล้างคิวที่ค้างทั้งหมด (ไม่พิมพ์)?')) post({ status: 'cleared' }).then(tick);
  };

  if (!TOKEN){ setStatus('ไม่มี token ใน URL (ต้องเปิดด้วย ?token=...)', true); return; }
  // เริ่มต้น: คืนงาน orphaned printing -> pending แล้วค่อย poll
  post({ status: 'pending' }).catch(function(){}).then(function(){ tick(); setInterval(tick, POLL_MS); });
})();
</script>
</body>
</html>
```

- [ ] **Step 2: ตรวจว่าเสิร์ฟได้ (dev)**

Run: `npm run dev` แล้วเปิด `http://localhost:5173/print-station.html?token=test` ในเบราว์เซอร์
Expected: เห็นหน้า "สถานีพิมพ์ออฟฟิศ"; ถ้า token ไม่ตรง env จริง สถานะจะขึ้น "ผิดพลาด: Unauthorized" (ปกติ เพราะยังไม่ตั้ง env) — แค่ยืนยันว่าหน้า render ได้และยิง API ได้
> อย่ากด "ส่งไปพิมพ์ที่ออฟฟิศ" จากใบจริงตอนเทสต์ถ้ายังไม่ต้องการ insert งานจริงลง prod queue

- [ ] **Step 3: Commit**

```bash
git add public/print-station.html
git commit -m "feat(print): standalone office print-station page"
```

---

### Task 7: เอกสารตั้งค่า (env + RPi/Chromium/CUPS)

**Files:**
- Create: `docs/print-station-setup.md`

- [ ] **Step 1: เขียนเอกสารตั้งค่า**

สร้าง `docs/print-station-setup.md`:

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add docs/print-station-setup.md
git commit -m "docs(print): office print-station setup guide"
```

---

## Self-Review checklist (ผู้เขียนแผนตรวจแล้ว)

- **Spec coverage:** print_jobs(T1) · officeMessage(T2) · print-and-notify(T3) · print-jobs API(T4) · ปุ่ม+exclusive+message(T5) · สถานี+poll+iframe+reprint+clear+orphan-recover(T6) · setup/env/RPi(T7) — ครบทุกหัวข้อ spec
- **Placeholder scan:** ไม่มี TODO/วลีลอย — โค้ดเต็มทุก step
- **Type consistency:** endpoint คืน `{jobs:[{id,docNum,imageUrl,createdAt}]}` ตรงกับที่สถานีใช้; `buildOfficeMessage(titleTH,docNum,so,products,contacts,maxLen?)` signature ตรงกับที่ T5 เรียก (`t.th, t.num, data, products, contacts`); status set `pending|printing|printed|error|cleared` ใช้สอดคล้องทุกที่
- **Verify ก่อนปิด task:** test (T2), lint (T3,T4), build+lint (T5), dev render (T6)

## ความเสี่ยง / จุดต้องระวังตอน execute

- **prod Supabase shared กับ dev** → unit test แตะแต่ฟังก์ชัน pure; การยิง endpoint จริงให้ทำตอน verify e2e เท่านั้น และระวัง insert งานจริงลงคิว prod
- **Chromium kiosk-printing scaling** บน RPi เป็นจุดต้องจูนหน้างาน (Task 7 step 4)
- หลัง execute เสร็จ: push เข้า master = auto-deploy Vercel (ตาม memory `feedback_branching`) — ยืนยันกับเจ้าของก่อน push
```

