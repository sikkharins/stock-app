# SO Continuous-Form Print (Epson LQ-2190) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มเส้นทางพิมพ์ SO แบบ overlay ลงกระดาษต่อเนื่อง 205×279mm ที่มีฟอร์มพิมพ์สำเร็จมาแล้ว (พิมพ์เฉพาะข้อมูลลงช่อง) + field รหัสลูกค้าในระบบ

**Architecture:** ไฟล์ใหม่ `src/components/PrintSOForm.js` แยกจาก `printDoc` เดิม — มี pure helper (testable) + `buildSOFormHtml` (สร้าง HTML string จาก LAYOUT พิกัด mm) + `printSOForm` (เปิดหน้าต่างพิมพ์). เพิ่ม field `custCode` ใน Contacts และปุ่มที่ 3 ใน Sales SO modal. ตำแหน่งทุกช่องเป็นค่าคงที่ mm จูนง่าย + offset X/Y เก็บ localStorage.

**Tech Stack:** React 19 (JSX), Vite, Vitest (jsdom), ESM. helpers: `round2`, `AddDue` จาก `../utils/helpers.js`.

**Spec:** `docs/superpowers/specs/2026-06-18-so-continuous-form-print-design.md`

**Reference (วิธี build HTML แล้ว window.open):** `src/components/PrintDocument.jsx`

---

## File Structure

- **Create** `src/components/PrintSOForm.js` — pure helpers + `buildSOFormHtml` + `printSOForm`
- **Create** `src/components/PrintSOForm.test.ts` — unit + smoke tests
- **Modify** `src/components/Contacts.jsx` — เพิ่ม `custCode` ใน empty form + input (customer-only)
- **Modify** `src/components/Sales.jsx` — import + ปุ่ม "พิมพ์ฟอร์มต่อเนื่อง (LQ-2190)"

---

## Task 1: เพิ่ม field รหัสลูกค้า (`custCode`) ใน Contacts

**Files:**
- Modify: `src/components/Contacts.jsx:44` (empty form `ef`)
- Modify: `src/components/Contacts.jsx:453` (เพิ่ม input หลัง "ชื่อ TH")

ฟอร์ม contact เป็น JSX (ไม่มี component test ในโปรเจกต์) — verify ด้วย typecheck + build + preview แทน unit test. การ save spread `...form` (บรรทัด 120) อยู่แล้ว → `custCode` persist อัตโนมัติ.

- [ ] **Step 1: เพิ่ม `custCode` ใน empty form**

แก้บรรทัด 44 จาก:
```js
  const ef={type:ft,name:"",nameT:"",phone:"",email:"",address:"",taxId:"",salesPerson:"",vatReps:[],staff:[]};
```
เป็น (เพิ่ม `custCode:""` หลัง `taxId:""`):
```js
  const ef={type:ft,name:"",nameT:"",phone:"",email:"",address:"",taxId:"",custCode:"",salesPerson:"",vatReps:[],staff:[]};
```

- [ ] **Step 2: เพิ่ม input ในฟอร์ม (customer-only) หลัง "ชื่อ TH"**

หลังบรรทัด 453:
```jsx
        <Field label="ชื่อ TH"><input value={form.nameT||""} onChange={e=>setF("nameT",e.target.value)} style={IB}/></Field>
```
แทรกบรรทัดใหม่:
```jsx
        {isC&&<Field label="รหัสลูกค้า"><input value={form.custCode||""} onChange={e=>setF("custCode",e.target.value)} style={IB}/></Field>}
```

- [ ] **Step 3: typecheck + build**

Run: `npm run typecheck`
Expected: ไม่มี error

Run: `npm run build`
Expected: build เขียว (exit 0)

- [ ] **Step 4: Commit**

```bash
git add src/components/Contacts.jsx
git commit -m "feat(contacts): add customer code (custCode) field for SO continuous-form print"
```

---

## Task 2: PrintSOForm — pure helpers (TDD)

**Files:**
- Create: `src/components/PrintSOForm.js`
- Test: `src/components/PrintSOForm.test.ts`

Pure functions: `toBEShort`, `fmtC`, `resolveBillTo`, `buildRows`, `computeTotals`, `paginate`. คำนวณก่อน VAT เมื่อ `so.includeVat===true` มิฉะนั้นใช้ราคาเต็ม (mirror โหมด exclusive ของ `printDoc`).

- [ ] **Step 1: เขียน test ที่ fail ก่อน**

สร้าง `src/components/PrintSOForm.test.ts`:
```ts
import { describe, test, expect } from "vitest";
import {
  toBEShort,
  fmtC,
  resolveBillTo,
  buildRows,
  computeTotals,
  paginate,
} from "./PrintSOForm.js";

describe("toBEShort", () => {
  test("YYYY-MM-DD -> dd/mm/yy (BE 2-digit)", () => {
    expect(toBEShort("2026-06-17")).toBe("17/06/69"); // 2026+543=2569 -> 69
  });
  test("empty -> empty string", () => {
    expect(toBEShort("")).toBe("");
    expect(toBEShort(undefined)).toBe("");
  });
});

describe("fmtC", () => {
  test("2-decimal grouped", () => {
    expect(fmtC(10280.38)).toBe("10,280.38");
    expect(fmtC(0)).toBe("0.00");
  });
});

describe("resolveBillTo", () => {
  const contact = { nameT: "ร้าน A", address: "123", taxId: "TAX1", custCode: "C001" };
  test("ปกติ -> ใช้ข้อมูลลูกค้า + custCode", () => {
    const so = { useVatRep: false };
    expect(resolveBillTo(so, contact)).toEqual({
      custCode: "C001", name: "ร้าน A", address: "123", taxId: "TAX1",
    });
  });
  test("ตัวแทน VAT -> override ชื่อ/ที่อยู่/เลขบัตร, custCode ว่าง", () => {
    const so = { useVatRep: true, vatRepName: "ตัวแทน X", vatRepAddress: "ADDR X", vatRepIdCard: "RID13" };
    expect(resolveBillTo(so, contact)).toEqual({
      custCode: "", name: "ตัวแทน X", address: "ADDR X", taxId: "RID13",
    });
  });
});

describe("buildRows", () => {
  const products = [{ id: 1, nameT: "ตู้เย็น", unit: "เครื่อง", price: 107 }];
  test("includeVat -> ราคาก่อน VAT (x100/107)", () => {
    const so = { includeVat: true, items: [{ productId: 1, qty: 2, price: 107 }] };
    expect(buildRows(so, products)).toEqual([
      { no: 1, name: "ตู้เย็น", qty: 2, unit: "เครื่อง", unitPrice: 100, amount: 200 },
    ]);
  });
  test("ไม่คิด VAT -> ราคาเต็ม", () => {
    const so = { includeVat: false, items: [{ productId: 1, qty: 2, price: 100 }] };
    expect(buildRows(so, products)).toEqual([
      { no: 1, name: "ตู้เย็น", qty: 2, unit: "เครื่อง", unitPrice: 100, amount: 200 },
    ]);
  });
  test("split parts -> แตกหลายบรรทัด นับ no ต่อบรรทัด", () => {
    const so = { includeVat: true, items: [{ productId: 1, qty: 1, price: 107, parts: [
      { name: "ร้อน", price: 53.5 }, { name: "เย็น", price: 53.5 },
    ] }] };
    const rows = buildRows(so, products);
    expect(rows.length).toBe(2);
    expect(rows[0]).toEqual({ no: 1, name: "ตู้เย็น — ร้อน", qty: 1, unit: "เครื่อง", unitPrice: 50, amount: 50 });
    expect(rows[1].no).toBe(2);
    expect(rows[1].name).toBe("ตู้เย็น — เย็น");
  });
});

describe("computeTotals", () => {
  test("includeVat: subEx/discEx/goods/vat/grand", () => {
    const so = { includeVat: true, discountAmt: 0, items: [{ qty: 2, price: 107 }] };
    expect(computeTotals(so)).toEqual({ subTotal: 200, discount: 0, goods: 200, vat: 14, grand: 214 });
  });
  test("includeVat + discount", () => {
    const so = { includeVat: true, discountAmt: 10.7, items: [{ qty: 1, price: 107 }] };
    expect(computeTotals(so)).toEqual({ subTotal: 100, discount: 10, goods: 90, vat: 6.3, grand: 96.3 });
  });
  test("ไม่คิด VAT -> vat=null, grand=goods", () => {
    const so = { includeVat: false, discountAmt: 0, items: [{ qty: 2, price: 100 }] };
    expect(computeTotals(so)).toEqual({ subTotal: 200, discount: 0, goods: 200, vat: null, grand: 200 });
  });
});

describe("paginate", () => {
  test("25 แถว / 12 -> 3 หน้า [12,12,1]", () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({ no: i + 1 }));
    const pages = paginate(rows, 12);
    expect(pages.map((p) => p.length)).toEqual([12, 12, 1]);
  });
  test("ว่าง -> [[]] (1 หน้าว่าง)", () => {
    expect(paginate([], 12)).toEqual([[]]);
  });
});
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `npm test -- PrintSOForm`
Expected: FAIL — "Failed to resolve import './PrintSOForm.js'" หรือ functions undefined

- [ ] **Step 3: เขียน implementation ขั้นต่ำ**

สร้าง `src/components/PrintSOForm.js`:
```js
import { round2, AddDue } from "../utils/helpers.js";

// YYYY-MM-DD -> dd/mm/yy (พ.ศ. 2 หลัก) ให้พอดีช่องเล็ก เช่น 2026-06-17 -> 17/06/69
export const toBEShort = (d) => {
  const p = (d || "").split("-");
  if (p.length !== 3) return "";
  const yy = String((+p[0] + 543) % 100).padStart(2, "0");
  return p[2] + "/" + p[1] + "/" + yy;
};

// จัดรูปตัวเลข 2 ตำแหน่ง มี comma
export const fmtC = (n) =>
  Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ใครคือผู้รับบิล: ถ้าเลือกตัวแทนออก VAT ใช้ข้อมูลตัวแทนแทนลูกค้า
export function resolveBillTo(so, contact) {
  contact = contact || {};
  if (so.useVatRep && so.vatRepName) {
    return {
      custCode: "",
      name: so.vatRepName,
      address: so.vatRepAddress || "",
      taxId: so.vatRepIdCard || "",
    };
  }
  return {
    custCode: contact.custCode || "",
    name: contact.nameT || contact.name || "",
    address: contact.address || "",
    taxId: contact.taxId || "",
  };
}

// แถวสินค้า — ราคาก่อน VAT เมื่อ includeVat, แตก parts เป็นหลายบรรทัด นับ no ต่อบรรทัด
export function buildRows(so, products) {
  const ex = so.includeVat === true;
  const rows = [];
  let n = 0;
  const push = (it, unit, name, price) => {
    n += 1;
    rows.push({
      no: n,
      name,
      qty: it.qty,
      unit,
      unitPrice: ex ? round2(price * 100 / 107) : round2(price),
      amount: ex ? round2(it.qty * price * 100 / 107) : round2(it.qty * price),
    });
  };
  (so.items || []).forEach((it) => {
    const pr = (products || []).find((x) => x.id === it.productId) || {};
    const baseName = pr.nameT || pr.name || "-";
    const unit = pr.unit || "";
    if (it.parts && it.parts.length > 0) {
      it.parts.forEach((pt) => push(it, unit, baseName + " — " + (pt.name || pt.key || ""), pt.price || 0));
    } else {
      push(it, unit, baseName, it.price || 0);
    }
  });
  return rows;
}

// ยอดรวม 5 ช่อง — mirror สูตร exclusive ของ printDoc เมื่อ includeVat
export function computeTotals(so) {
  const items = so.items || [];
  const sub = items.reduce((s, it) => s + it.qty * (it.price || 0), 0);
  const disc = so.discountAmt || 0;
  const after = sub - disc;
  if (so.includeVat === true) {
    const subEx = items.reduce((s, it) => s + round2(it.qty * (it.price || 0) * 100 / 107), 0);
    const discEx = disc > 0 ? round2(disc * 100 / 107) : 0;
    const goods = round2(subEx - discEx);
    const vat = round2(after - goods);
    return { subTotal: round2(subEx), discount: discEx, goods, vat, grand: round2(after) };
  }
  return { subTotal: round2(sub), discount: round2(disc), goods: round2(sub - disc), vat: null, grand: round2(sub - disc) };
}

// แบ่งแถวเป็นหน้า (อย่างน้อย 1 หน้าเสมอ)
export function paginate(rows, perPage) {
  perPage = perPage || 12;
  const pages = [];
  for (let i = 0; i < rows.length; i += perPage) pages.push(rows.slice(i, i + perPage));
  if (pages.length === 0) pages.push([]);
  return pages;
}
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `npm test -- PrintSOForm`
Expected: PASS ทุก test

- [ ] **Step 5: typecheck**

Run: `npm run typecheck`
Expected: ไม่มี error

- [ ] **Step 6: Commit**

```bash
git add src/components/PrintSOForm.js src/components/PrintSOForm.test.ts
git commit -m "feat(print): SO continuous-form pure helpers (billTo/rows/totals/paginate)"
```

---

## Task 3: buildSOFormHtml — LAYOUT + HTML overlay + smoke tests

**Files:**
- Modify: `src/components/PrintSOForm.js` (เพิ่ม LAYOUT + `buildSOFormHtml`)
- Modify: `src/components/PrintSOForm.test.ts` (เพิ่ม smoke tests)

`buildSOFormHtml(so, products, contacts)` คืน HTML string เต็ม (testable, ไม่เปิดหน้าต่าง). พิกัดทุกช่องอยู่ใน `LAYOUT` แก้ที่เดียว. มี toolbar offset X/Y (localStorage) + toggle กรอบช่วยจูน. **ค่าพิกัดเป็นค่าประมาณ รอจูนกับเครื่องจริง.**

- [ ] **Step 1: เขียน smoke test ที่ fail ก่อน**

เพิ่มท้าย `src/components/PrintSOForm.test.ts`:
```ts
import { buildSOFormHtml } from "./PrintSOForm.js";

describe("buildSOFormHtml", () => {
  const products = [{ id: 1, nameT: "ตู้เย็น", unit: "เครื่อง", price: 107 }];
  const contacts = [{ id: 9, nameT: "ร้าน A", address: "123 ถนน", taxId: "TAX1", custCode: "C001", salesPerson: "เซลส์1" }];
  const baseSO = {
    legacyNum: "IV2026/06115", date: "2026-06-17", customerId: 9,
    payType: "credit", creditDays: 60, includeVat: true, discountAmt: 0,
    items: [{ productId: 1, qty: 2, price: 107 }],
  };

  test("มีเลขที่ ชื่อลูกค้า รหัสลูกค้า เซลส์ และยอดรวม", () => {
    const html = buildSOFormHtml(baseSO, products, contacts);
    expect(html).toContain("IV2026/06115");
    expect(html).toContain("ร้าน A");
    expect(html).toContain("C001");
    expect(html).toContain("เซลส์1");
    expect(html).toContain("214.00"); // grand
    expect(html).toContain("@page");
    expect(html).toContain("205mm 279mm");
  });

  test("ตัวแทน VAT -> โชว์ชื่อ/เลขบัตรตัวแทน", () => {
    const so = { ...baseSO, useVatRep: true, vatRepName: "ตัวแทน X", vatRepAddress: "ADDR X", vatRepIdCard: "RID13" };
    const html = buildSOFormHtml(so, products, contacts);
    expect(html).toContain("ตัวแทน X");
    expect(html).toContain("RID13");
  });

  test("สินค้าเกิน 12 บรรทัด -> 2 หน้า", () => {
    const items = Array.from({ length: 13 }, () => ({ productId: 1, qty: 1, price: 107 }));
    const html = buildSOFormHtml({ ...baseSO, items }, products, contacts);
    expect((html.match(/class="so-page"/g) || []).length).toBe(2);
  });
});
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `npm test -- PrintSOForm`
Expected: FAIL — `buildSOFormHtml is not a function`

- [ ] **Step 3: เพิ่ม LAYOUT + buildSOFormHtml ใน PrintSOForm.js**

แทรกก่อนบรรทัดสุดท้ายของ `src/components/PrintSOForm.js` (หลัง `paginate`):
```js
// ===== LAYOUT (mm) — ค่าประมาณ จูนกับเครื่องจริงภายหลัง =====
const PAGE = { w: 205, h: 279 };
const ROWS = { count: 12, top: 115, height: 11 };
// x ของแต่ละคอลัมน์ (price/amount = ขอบขวา ของตัวเลข)
const COLS = { no: 10, name: 20, qty: 118, unit: 132, price: 165, amount: 200 };
const F = {
  custCode:  { x: 40,  y: 46 },
  custName:  { x: 35,  y: 55 },
  custAddr:  { x: 12,  y: 62, lineH: 6, maxLines: 3 },
  custTaxId: { x: 45,  y: 80 },
  docNo:     { x: 148, y: 48 },
  docDate:   { x: 148, y: 58 },
  payTerm:   { x: 25,  y: 92 },
  dueDate:   { x: 90,  y: 92 },
  salesman:  { x: 150, y: 92 },
  totalsX:   200,
  totals:    { subTotal: 232, discount: 240, goods: 248, vat: 256, grand: 264 },
  note:      { x: 12,  y: 248 },
};
const FONT = { size: 11, family: "'Sarabun', monospace" };

const esc = (s) =>
  String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// div วางตำแหน่ง mm; align right = ขอบขวาอยู่ที่ x, center = กึ่งกลางที่ x
function cell(x, y, text, align) {
  let t = "";
  if (align === "right") t = "text-align:right;transform:translateX(-100%);";
  else if (align === "center") t = "text-align:center;transform:translateX(-50%);";
  return `<div style="position:absolute;left:${x}mm;top:${y}mm;${t}white-space:nowrap;">${text}</div>`;
}

// ตัดที่อยู่เป็นหลายบรรทัด (ตาม newline + ความยาว) จำกัด maxLines
function splitAddr(addr, maxLines) {
  const raw = String(addr || "").split(/\r?\n/).filter(Boolean);
  const out = [];
  raw.forEach((line) => {
    while (line.length > 45 && out.length < maxLines) {
      let cut = line.lastIndexOf(" ", 45);
      if (cut <= 0) cut = 45;
      out.push(line.slice(0, cut));
      line = line.slice(cut).trim();
    }
    out.push(line);
  });
  return out.slice(0, maxLines);
}

function renderPage(pageRows, head, totals, isLast) {
  const c = [];
  if (head.custCode) c.push(cell(F.custCode.x, F.custCode.y, esc(head.custCode)));
  c.push(cell(F.custName.x, F.custName.y, esc(head.name)));
  splitAddr(head.address, F.custAddr.maxLines).forEach((ln, i) =>
    c.push(cell(F.custAddr.x, F.custAddr.y + i * F.custAddr.lineH, esc(ln))));
  if (head.taxId) c.push(cell(F.custTaxId.x, F.custTaxId.y, esc(head.taxId)));
  c.push(cell(F.docNo.x, F.docNo.y, esc(head.docNo)));
  c.push(cell(F.docDate.x, F.docDate.y, esc(head.docDate)));
  c.push(cell(F.payTerm.x, F.payTerm.y, esc(head.payTerm)));
  if (head.dueDate) c.push(cell(F.dueDate.x, F.dueDate.y, esc(head.dueDate)));
  if (head.salesman) c.push(cell(F.salesman.x, F.salesman.y, esc(head.salesman)));

  pageRows.forEach((r, i) => {
    const y = ROWS.top + i * ROWS.height;
    c.push(cell(COLS.no, y, String(r.no), "center"));
    c.push(cell(COLS.name, y, esc(r.name)));
    c.push(cell(COLS.qty, y, String(r.qty), "center"));
    c.push(cell(COLS.unit, y, esc(r.unit), "center"));
    c.push(cell(COLS.price, y, fmtC(r.unitPrice), "right"));
    c.push(cell(COLS.amount, y, fmtC(r.amount), "right"));
  });

  if (isLast) {
    c.push(cell(F.totalsX, F.totals.subTotal, fmtC(totals.subTotal), "right"));
    if (totals.discount > 0) c.push(cell(F.totalsX, F.totals.discount, fmtC(totals.discount), "right"));
    c.push(cell(F.totalsX, F.totals.goods, fmtC(totals.goods), "right"));
    if (totals.vat != null) c.push(cell(F.totalsX, F.totals.vat, fmtC(totals.vat), "right"));
    c.push(cell(F.totalsX, F.totals.grand, fmtC(totals.grand), "right"));
    if (head.note) c.push(cell(F.note.x, F.note.y, esc(head.note)));
  }

  return `<div class="so-page"${isLast ? "" : ' style="page-break-after:always;"'}>` +
    `<div class="so-grid"></div><div class="so-page-inner">${c.join("")}</div></div>`;
}

export function buildSOFormHtml(so, products, contacts) {
  const contact = (contacts || []).find((c) => c.id === so.customerId) || {};
  const billTo = resolveBillTo(so, contact);
  const head = {
    custCode: billTo.custCode,
    name: billTo.name,
    address: billTo.address,
    taxId: billTo.taxId,
    docNo: so.legacyNum || "",
    docDate: toBEShort(so.date),
    payTerm: so.payType === "cash" ? "เงินสด" : "เครดิต " + (so.creditDays || 0) + " วัน",
    dueDate: so.payType === "credit" && so.creditDays ? toBEShort(AddDue(so.date, so.creditDays)) : "",
    salesman: contact.salesPerson || "",
    note: so.note || "",
  };
  const totals = computeTotals(so);
  const pages = paginate(buildRows(so, products), ROWS.count);
  const body = pages.map((p, i) => renderPage(p, head, totals, i === pages.length - 1)).join("");

  return `<!DOCTYPE html>
<html lang="th"><head><meta charset="UTF-8">
<title>${esc(head.docNo || "SO")}</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:${FONT.family};font-size:${FONT.size}px;color:#000;background:#fff;}
.so-page{position:relative;width:${PAGE.w}mm;height:${PAGE.h}mm;overflow:hidden;}
.so-page-inner{position:absolute;inset:0;}
.so-grid{position:absolute;inset:0;display:none;border:0.3mm solid rgba(0,0,0,0.4);
  background-image:repeating-linear-gradient(to right,rgba(0,0,0,0.13) 0 0.2mm,transparent 0.2mm 10mm),
                   repeating-linear-gradient(to bottom,rgba(0,0,0,0.13) 0 0.2mm,transparent 0.2mm 10mm);}
@media screen{body{background:#888;padding:10px;}.so-page{background:#fff;margin:0 auto 10px;box-shadow:0 0 4px rgba(0,0,0,0.4);}}
@media print{.no-print{display:none!important;}body{background:#fff;padding:0;}.so-page{box-shadow:none;margin:0;}}
@page{size:${PAGE.w}mm ${PAGE.h}mm;margin:0;}
.tb{padding:8px 14px;border-bottom:1px solid #ddd;display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-family:system-ui,sans-serif;font-size:13px;}
.tb button{padding:6px 12px;border:1px solid #ccc;border-radius:6px;background:#f4f4f4;cursor:pointer;font-size:13px;}
.tb input{width:64px;padding:4px 6px;border:1px solid #ccc;border-radius:5px;}
</style></head>
<body>
<div class="no-print tb">
  <button onclick="window.print()" style="background:#111;color:#fff;border:none;">พิมพ์</button>
  <span>เลื่อน (mm):</span>
  X <input id="offX" type="number" step="0.5" onchange="_setOff()">
  Y <input id="offY" type="number" step="0.5" onchange="_setOff()">
  <button onclick="_nudge(-0.5,0)">◀</button><button onclick="_nudge(0.5,0)">▶</button>
  <button onclick="_nudge(0,-0.5)">▲</button><button onclick="_nudge(0,0.5)">▼</button>
  <label style="display:flex;align-items:center;gap:5px;"><input type="checkbox" style="width:auto;" onchange="_toggleGrid(this)"> แสดงกรอบช่วยจูน</label>
  <button onclick="window.close()">ปิด</button>
  <span style="color:#b00;">ตั้งเครื่องพิมพ์ Actual size / 100% (ห้าม Fit to page) · 205×279mm</span>
</div>
${body}
<script>
(function(){
  var KEY="so_form_offset";
  function load(){try{return JSON.parse(localStorage.getItem(KEY))||{x:0,y:0};}catch(e){return {x:0,y:0};}}
  function save(o){try{localStorage.setItem(KEY,JSON.stringify(o));}catch(e){}}
  var off=load();
  var xIn=document.getElementById("offX"),yIn=document.getElementById("offY");
  function apply(){
    var els=document.querySelectorAll(".so-page-inner");
    for(var i=0;i<els.length;i++)els[i].style.transform="translate("+off.x+"mm,"+off.y+"mm)";
    if(xIn)xIn.value=off.x; if(yIn)yIn.value=off.y;
  }
  window._nudge=function(dx,dy){off.x=Math.round((off.x+dx)*10)/10;off.y=Math.round((off.y+dy)*10)/10;save(off);apply();};
  window._setOff=function(){off.x=parseFloat(xIn.value)||0;off.y=parseFloat(yIn.value)||0;save(off);apply();};
  window._toggleGrid=function(cb){var g=document.querySelectorAll(".so-grid");for(var i=0;i<g.length;i++)g[i].style.display=cb.checked?"block":"none";};
  apply();
})();
</script>
</body></html>`;
}
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `npm test -- PrintSOForm`
Expected: PASS ทุก test (รวม smoke ใหม่ 3 ตัว)

- [ ] **Step 5: typecheck + build**

Run: `npm run typecheck`
Expected: ไม่มี error

Run: `npm run build`
Expected: build เขียว

- [ ] **Step 6: Commit**

```bash
git add src/components/PrintSOForm.js src/components/PrintSOForm.test.ts
git commit -m "feat(print): buildSOFormHtml overlay layout + offset calibration toolbar"
```

---

## Task 4: ต่อปุ่มใน Sales SO modal + verify ในแอป

**Files:**
- Modify: `src/components/Sales.jsx:5` (import)
- Modify: `src/components/Sales.jsx:617-618` (เพิ่มปุ่ม)

- [ ] **Step 1: เพิ่ม import**

แก้บรรทัด 5 จาก:
```js
import { printDoc } from "./PrintDocument.jsx";
```
เป็น:
```js
import { printDoc } from "./PrintDocument.jsx";
import { printSOForm } from "./PrintSOForm.js";
```

- [ ] **Step 2: เพิ่มปุ่มใน SO modal**

หลังบรรทัด 618 (ปุ่ม "เช็คของขึ้นรถ") แทรกปุ่มใหม่:
```jsx
        <button onClick={()=>printSOForm(viewSO,products,contacts)} style={{padding:"8px 18px",background:"transparent",color:"var(--blue)",border:"1px solid var(--blue)",borderRadius:7,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{"พิมพ์ฟอร์มต่อเนื่อง (LQ-2190)"}</button>
```

- [ ] **Step 3: typecheck + build + รัน test ทั้งหมด**

Run: `npm run typecheck`
Expected: ไม่มี error

Run: `npm test`
Expected: PASS ทั้งหมด (ไม่มี test เดิมพัง)

Run: `npm run build`
Expected: build เขียว

- [ ] **Step 4: Verify ในแอป (preview — read-only)**

> ระวัง ref `feedback_preview_writes_prod`: ปุ่มนี้แค่เปิดหน้าต่าง preview ไม่เขียน DB จึงปลอดภัย — แต่ **ห้ามสั่ง print จริงทับข้อมูล prod** และห้ามกด save/confirm/delete ใดๆ ใน UI ระหว่างทดสอบ

- [ ] เปิดแอป (`preview_start`), ไปหน้า Sales, เปิด SO ที่มีอยู่ (มี legacyNum)
- [ ] กดปุ่ม "พิมพ์ฟอร์มต่อเนื่อง (LQ-2190)" → หน้าต่างใหม่เปิด, เห็นข้อมูลวางเป็นช่องๆ (ตัวอักษรล้วน), toolbar ด้านบน
- [ ] ติ๊ก "แสดงกรอบช่วยจูน" → เห็นกรอบ + ตาราง 10mm; ขยับ X/Y แล้วข้อมูลเลื่อนทั้งใบ; refresh แล้วค่า offset ยังอยู่ (localStorage)
- [ ] เปิด SO ที่ `useVatRep` → กล่องลูกค้าโชว์ชื่อ/ที่อยู่/เลขบัตรตัวแทน
- [ ] (ถ้ามี) SO ที่ >12 บรรทัด → เห็น 2 หน้า, ยอดรวมเฉพาะใบสุดท้าย

- [ ] **Step 5: Commit**

```bash
git add src/components/Sales.jsx
git commit -m "feat(sales): add 'print continuous form (LQ-2190)' button to SO modal"
```

---

## Self-Review Notes (ผู้เขียนแผนตรวจแล้ว)

- **Spec coverage:** custCode (Task 1) · pure helpers+ก่อนVAT+totals+parts (Task 2) · LAYOUT+offset+grid+pagination+vatRep override (Task 3) · ปุ่ม trigger (Task 4) — ครบทุกหัวข้อ spec
- **ค่าพิกัด LAYOUT เป็นค่าประมาณ** ตามที่ตกลงไว้ (ยังไม่ทดสอบเครื่องจริง) — ผู้ใช้จูนผ่าน offset + แก้ค่าใน `F`/`COLS`/`ROWS` ภายหลัง
- **ไม่แตะ:** `PrintDocument.jsx`, logic SO, การพิมพ์ QT/PO, การ์ด/โปรไฟล์ลูกค้า
- **ชื่อ function สอดคล้องทุก task:** `toBEShort/fmtC/resolveBillTo/buildRows/computeTotals/paginate/buildSOFormHtml/printSOForm`
