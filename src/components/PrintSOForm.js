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

export function printSOForm(so, products, contacts) {
  const html = buildSOFormHtml(so, products, contacts);
  const w = window.open("", "_blank", "width=920,height=720");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
