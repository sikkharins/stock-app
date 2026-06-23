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

// ===== เลข -> ตัวอักษรภาษาไทย (บาท) =====
const TH_DIGIT = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const TH_POS = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];
function readNumber(num) {
  num = Math.floor(num);
  if (num === 0) return "";
  if (num > 999999) {
    const m = Math.floor(num / 1000000);
    const rest = num % 1000000;
    return readNumber(m) + "ล้าน" + (rest > 0 ? readNumber(rest) : "");
  }
  const s = String(num);
  const len = s.length;
  let out = "";
  for (let i = 0; i < len; i++) {
    const d = +s[i];
    const p = len - i - 1; // หลักจากขวา
    if (d === 0) continue;
    if (p === 1 && d === 1) out += "สิบ";
    else if (p === 1 && d === 2) out += "ยี่สิบ";
    else if (p === 0 && d === 1 && len > 1) out += "เอ็ด";
    else out += TH_DIGIT[d] + TH_POS[p];
  }
  return out;
}
export function bahtText(amount) {
  amount = Number(amount || 0);
  const neg = amount < 0;
  amount = Math.abs(amount);
  const baht = Math.floor(amount);
  const satang = Math.round((amount - baht) * 100);
  if (baht === 0 && satang === 0) return "ศูนย์บาทถ้วน";
  let t = "";
  if (baht > 0) t += readNumber(baht) + "บาท";
  t += satang > 0 ? readNumber(satang) + "สตางค์" : "ถ้วน";
  return (neg ? "ลบ" : "") + t;
}

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

// แถวสินค้า — ชื่อ = หมวด(จาก categoryId) + ยี่ห้อ(brand) + nameT
// ราคาก่อน VAT เมื่อ includeVat, แตก parts เป็นหลายบรรทัด นับ no ต่อบรรทัด
export function buildRows(so, products, cats) {
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
    const cat = (cats || []).find((c) => c.id === pr.categoryId);
    const catName = cat ? cat.name : "";
    const baseName = [catName, pr.brand || "", pr.nameT || pr.name || "-"].filter(Boolean).join(" ");
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

// ===== LAYOUT (mm) — ทุกฟิลด์มีพิกัด {x,y} อิสระต่อกัน แก้ได้ทีละช่อง =====
const PAGE = { w: 205, h: 279 };
// ตารางสินค้า: ROWS = จุดเริ่ม/ระยะห่างต่อบรรทัด, COLS = x ของแต่ละคอลัมน์ (อิสระ)
const ROWS = { count: 12, top: 115, height: 11 };
const COLS = {
  no:     { x: 8 },
  name:   { x: 16 },
  qty:    { x: 116 },
  unit:   { x: 130 },
  price:  { x: 150 },
  amount: { x: 182 },
};
// ฟิลด์หัวเอกสาร — แต่ละช่องพิกัดของตัวเอง
const F = {
  custCode:  { x: 30,  y: 46 },
  custName:  { x: 22,  y: 54 },
  custAddr:  { x: 22,  y: 61, lineH: 6, maxLines: 3 },
  custTaxId: { x: 40,  y: 80 },
  docNo:     { x: 150, y: 47 },
  docDate:   { x: 150, y: 58 },
  payTerm:   { x: 18,  y: 92 },
  dueDate:   { x: 78,  y: 92 },
  salesman:  { x: 140, y: 92 },
  note:      { x: 14,  y: 236 },
};
// ยอดรวม — แต่ละบรรทัดพิกัดของตัวเอง + ยอดเป็นตัวอักษร (ซ้าย)
const TOTALS = {
  bahtText: { x: 14,  y: 255 },
  subTotal: { x: 182, y: 232 },
  discount: { x: 182, y: 240 },
  goods:    { x: 182, y: 248 },
  vat:      { x: 182, y: 256 },
  grand:    { x: 182, y: 264 },
};
const FONT = { size: 14, family: "'Cordia New','CordiaUPC',sans-serif" };

const esc = (s) =>
  String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// div วางตำแหน่ง mm — ชิดซ้ายทุกช่อง (x = ขอบซ้ายของข้อความ)
// fid = id ฟิลด์ (คลิกเลือกในหน้าพิมพ์เพื่อปรับ), isRow = true ถ้าเป็นเซลล์ตาราง (เลื่อนแนวตั้ง = ทั้งตาราง)
function cell(x, y, text, fid, isRow, ri) {
  return `<div class="so-f" data-fid="${fid}"${isRow ? ' data-row="1"' : ""}${ri != null ? ` data-ri="${ri}"` : ""} style="position:absolute;left:${x}mm;top:${y}mm;white-space:nowrap;cursor:pointer;">${text}</div>`;
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
  if (head.custCode) c.push(cell(F.custCode.x, F.custCode.y, esc(head.custCode), "custCode"));
  c.push(cell(F.custName.x, F.custName.y, esc(head.name), "custName"));
  splitAddr(head.address, F.custAddr.maxLines).forEach((ln, i) =>
    c.push(cell(F.custAddr.x, F.custAddr.y + i * F.custAddr.lineH, esc(ln), "custAddr")));
  if (head.taxId) c.push(cell(F.custTaxId.x, F.custTaxId.y, esc(head.taxId), "custTaxId"));
  c.push(cell(F.docNo.x, F.docNo.y, esc(head.docNo), "docNo"));
  c.push(cell(F.docDate.x, F.docDate.y, esc(head.docDate), "docDate"));
  c.push(cell(F.payTerm.x, F.payTerm.y, esc(head.payTerm), "payTerm"));
  if (head.dueDate) c.push(cell(F.dueDate.x, F.dueDate.y, esc(head.dueDate), "dueDate"));
  if (head.salesman) c.push(cell(F.salesman.x, F.salesman.y, esc(head.salesman), "salesman"));

  pageRows.forEach((r, i) => {
    const y = ROWS.top + i * ROWS.height;
    c.push(cell(COLS.no.x, y, String(r.no), "col:no", true, i));
    c.push(cell(COLS.name.x, y, esc(r.name), "col:name", true, i));
    c.push(cell(COLS.qty.x, y, String(r.qty), "col:qty", true, i));
    c.push(cell(COLS.unit.x, y, esc(r.unit), "col:unit", true, i));
    c.push(cell(COLS.price.x, y, fmtC(r.unitPrice), "col:price", true, i));
    c.push(cell(COLS.amount.x, y, fmtC(r.amount), "col:amount", true, i));
  });

  if (isLast) {
    c.push(cell(TOTALS.subTotal.x, TOTALS.subTotal.y, fmtC(totals.subTotal), "subTotal"));
    if (totals.discount > 0) c.push(cell(TOTALS.discount.x, TOTALS.discount.y, fmtC(totals.discount), "discount"));
    c.push(cell(TOTALS.goods.x, TOTALS.goods.y, fmtC(totals.goods), "goods"));
    if (totals.vat != null) c.push(cell(TOTALS.vat.x, TOTALS.vat.y, fmtC(totals.vat), "vat"));
    c.push(cell(TOTALS.grand.x, TOTALS.grand.y, fmtC(totals.grand), "grand"));
    c.push(cell(TOTALS.bahtText.x, TOTALS.bahtText.y, "(" + esc(bahtText(totals.grand)) + ")", "bahtText"));
    if (head.note) c.push(cell(F.note.x, F.note.y, esc(head.note), "note"));
  }

  return `<div class="so-page"${isLast ? "" : ' style="page-break-after:always;"'}>` +
    `<div class="so-grid"></div><div class="so-cal"></div><div class="so-page-inner">${c.join("")}</div></div>`;
}

export function buildSOFormHtml(so, products, contacts, cats, layout) {
  // SAVED = ค่ากลางที่บันทึกไว้ (จาก Supabase ผ่านแอป) ใช้เป็นจุดเริ่มและเกณฑ์เทียบ "บันทึกแล้ว/ยังไม่บันทึก"
  const SAVED = { g: (layout && layout.g) || { x: 0, y: 0 }, fo: (layout && layout.fo) || {} };
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
  const pages = paginate(buildRows(so, products, cats), ROWS.count);
  const body = pages.map((p, i) => renderPage(p, head, totals, i === pages.length - 1)).join("");

  return `<!DOCTYPE html>
<html lang="th"><head><meta charset="UTF-8">
<title>${esc(head.docNo || "SO")}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:${FONT.family};font-size:${FONT.size}px;color:#000;background:#fff;}
.so-page{position:relative;width:${PAGE.w}mm;height:${PAGE.h}mm;overflow:hidden;}
.so-page-inner{position:absolute;inset:0;}
.so-grid{position:absolute;inset:0;display:none;border:0.3mm solid rgba(0,0,0,0.4);
  background-image:repeating-linear-gradient(to right,rgba(0,0,0,0.13) 0 0.2mm,transparent 0.2mm 10mm),
                   repeating-linear-gradient(to bottom,rgba(0,0,0,0.13) 0 0.2mm,transparent 0.2mm 10mm);}
.so-cal{position:absolute;top:2mm;left:2mm;display:none;font-size:8px;line-height:1.3;color:#b00;max-width:170mm;white-space:pre-wrap;font-family:monospace;z-index:2;}
@media screen{body{background:#888;padding:10px;}.so-page{background:#fff;margin:0 auto 10px;box-shadow:0 0 4px rgba(0,0,0,0.4);}.so-f:hover{outline:1px dashed rgba(0,100,255,0.55);}}
@media print{.no-print{display:none!important;}body{background:#fff;padding:0;}.so-page{box-shadow:none;margin:0;}}
@page{size:${PAGE.w}mm ${PAGE.h}mm;margin:0;}
.tb{padding:8px 14px;border-bottom:1px solid #ddd;display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-family:system-ui,sans-serif;font-size:13px;}
.tb button{padding:6px 12px;border:1px solid #ccc;border-radius:6px;background:#f4f4f4;cursor:pointer;font-size:13px;}
.tb input{width:64px;padding:4px 6px;border:1px solid #ccc;border-radius:5px;}
</style></head>
<body>
<div class="no-print tb">
  <button onclick="window.print()" style="background:#111;color:#fff;border:none;">พิมพ์</button>
  <span id="selLabel" style="font-weight:600;color:#06f;min-width:120px;">ปรับทั้งใบ</span>
  <button onclick="_nudge(-0.5,0)" title="ซ้าย">◀</button><button onclick="_nudge(0.5,0)" title="ขวา">▶</button>
  <button onclick="_nudge(0,-0.5)" title="ขึ้น">▲</button><button onclick="_nudge(0,0.5)" title="ลง">▼</button>
  <span style="margin-left:4px;">ขนาด</span><button onclick="_fontSize(-1)">−</button><span id="sizeVal" style="min-width:20px;display:inline-block;text-align:center;">14</span><button onclick="_fontSize(1)">+</button>
  <label style="display:flex;align-items:center;gap:4px;"><input id="boldChk" type="checkbox" style="width:auto;" onchange="_bold(this.checked)"> ตัวหนา</label>
  <span style="margin-left:4px;">ระยะบรรทัด</span><button onclick="_rowHeight(-0.5)">−</button><span id="rhVal" style="min-width:26px;display:inline-block;text-align:center;">${ROWS.height}</span><button onclick="_rowHeight(0.5)">+</button>
  <button onclick="_deselect()">ปรับทั้งใบ</button>
  <button onclick="_resetField()">รีเซ็ตช่องนี้</button>
  <button onclick="_resetAll()">รีเซ็ตทั้งหมด</button>
  <button onclick="_save()" style="background:#0a7;color:#fff;border:none;font-weight:600;">บันทึกเป็นค่ากลาง</button>
  <span id="saveStat" style="font-size:12px;"></span>
  <label style="display:flex;align-items:center;gap:5px;"><input type="checkbox" style="width:auto;" onchange="_toggleGrid(this)"> กรอบช่วยจูน</label>
  <button onclick="window.close()">ปิด</button>
  <span style="color:#b00;">คลิกช่องในตัวอย่างเพื่อเลือก → กด ◀▶▲▼ หรือลูกศร (Shift=0.1mm) · บันทึกเป็นค่ากลาง = ใช้ได้ทุกเครื่อง · พิมพ์ Actual size 100% · 205×279mm</span>
</div>
${body}
<script>
(function(){
  var SAVED=${JSON.stringify(SAVED)};
  var DEF_SIZE=${FONT.size};
  var ROWS_TOP=${ROWS.top}, DEF_RH=${ROWS.height};
  var DKEY="so_form_draft";
  function jget(k){try{return JSON.parse(localStorage.getItem(k));}catch(e){return null;}}
  function jset(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
  function clone(o){return JSON.parse(JSON.stringify(o));}
  function eq(a,b){return JSON.stringify(a)===JSON.stringify(b);}
  // baseline = ค่ากลางที่บันทึกไว้ ; working = draft ในเครื่องถ้ามี ไม่งั้น = baseline
  var baseG=SAVED.g||{x:0,y:0}, baseFo=SAVED.fo||{};
  var draft=jget(DKEY);
  var g=draft&&draft.g?draft.g:clone(baseG), fo=draft&&draft.fo?draft.fo:clone(baseFo);
  var sel=null, selIsRow=false;
  var els=document.querySelectorAll(".so-f");
  var LABELS={custCode:"รหัสลูกค้า",custName:"ชื่อลูกค้า",custAddr:"ที่อยู่",custTaxId:"เลขผู้เสียภาษี",docNo:"เลขที่",docDate:"วันที่",payTerm:"เงื่อนไขชำระ",dueDate:"ครบกำหนด",salesman:"พนักงานขาย",note:"หมายเหตุ",bahtText:"ยอดเงินตัวอักษร",subTotal:"รวมก่อน VAT",discount:"ส่วนลด",goods:"มูลค่าสินค้า",vat:"VAT",grand:"รวมทั้งสิ้น",rows:"ตาราง(แนวตั้ง)","col:no":"คอลัมน์ลำดับ","col:name":"คอลัมน์รายการ","col:qty":"คอลัมน์จำนวน","col:unit":"คอลัมน์หน่วย","col:price":"คอลัมน์ราคา/หน่วย","col:amount":"คอลัมน์จำนวนเงิน"};
  function offFor(el){
    var fid=el.getAttribute("data-fid");
    var dx=(fo[fid]&&fo[fid].dx)||0;
    var dy=el.getAttribute("data-row")?((fo.rows&&fo.rows.dy)||0):((fo[fid]&&fo[fid].dy)||0);
    return {x:g.x+dx, y:g.y+dy};
  }
  function readout(){
    var parts=[];
    if(g.x||g.y)parts.push("ทั้งใบ X"+g.x+" Y"+g.y);
    for(var k in fo){var o=fo[k];if(!o)continue;var seg=[];if(o.dx)seg.push("X"+o.dx);if(o.dy)seg.push("Y"+o.dy);if(o.size)seg.push("ขนาด"+o.size);if(o.bold)seg.push("หนา");if(o.h)seg.push("ระยะ"+o.h);if(seg.length)parts.push((LABELS[k]||k)+" "+seg.join(" "));}
    var txt="ค่าปรับ "+new Date().toLocaleString("th-TH")+" : "+(parts.length?parts.join("  |  "):"— ยังไม่ปรับ —");
    var cs=document.querySelectorAll(".so-cal");for(var i=0;i<cs.length;i++)cs[i].textContent=txt;
  }
  function status(){var el=document.getElementById("saveStat");if(!el)return;var same=eq(g,baseG)&&eq(fo,baseFo);el.textContent=same?"● บันทึกแล้ว":"○ ยังไม่บันทึก";el.style.color=same?"#0a7":"#b00";}
  function styleFor(fid){var f=fo[fid]||{};return {size:f.size||DEF_SIZE,bold:!!f.bold};}
  function syncControls(){var sv=document.getElementById("sizeVal"),bc=document.getElementById("boldChk"),rh=document.getElementById("rhVal");var f=sel?(fo[sel]||{}):{};if(sv)sv.textContent=f.size||DEF_SIZE;if(bc)bc.checked=!!f.bold;if(rh)rh.textContent=(fo.rows&&fo.rows.h)||DEF_RH;}
  function apply(){var rowsH=(fo.rows&&fo.rows.h)||DEF_RH;for(var i=0;i<els.length;i++){var el=els[i];if(el.hasAttribute("data-ri"))el.style.top=(ROWS_TOP+(+el.getAttribute("data-ri"))*rowsH)+"mm";var o=offFor(el);el.style.transform="translate("+o.x+"mm,"+o.y+"mm)";var s=styleFor(el.getAttribute("data-fid"));el.style.fontSize=s.size+"px";el.style.fontWeight=s.bold?"700":"400";}readout();status();syncControls();}
  function hl(){for(var i=0;i<els.length;i++){els[i].style.outline=(sel&&els[i].getAttribute("data-fid")===sel)?"1.5px solid #06f":"";}}
  function label(){var el=document.getElementById("selLabel");if(!el)return;el.textContent=sel?("กำลังปรับ: "+(LABELS[sel]||sel)+(selIsRow?" (ขึ้น/ลง=ทั้งตาราง)":"")):"ปรับทั้งใบ";}
  for(var i=0;i<els.length;i++){els[i].addEventListener("click",function(e){sel=this.getAttribute("data-fid");selIsRow=!!this.getAttribute("data-row");hl();label();syncControls();e.stopPropagation();});}
  function r1(v){return Math.round(v*10)/10;}
  function saveDraft(){jset(DKEY,{g:g,fo:fo});}
  function needSel(){if(!sel){alert("เลือกช่องก่อน (คลิกช่องในตัวอย่าง)");return false;}return true;}
  window._fontSize=function(d){if(!needSel())return;fo[sel]=fo[sel]||{};var ns=(fo[sel].size||DEF_SIZE)+d;if(ns<6)ns=6;if(ns>48)ns=48;fo[sel].size=ns;saveDraft();apply();};
  window._bold=function(on){if(!needSel()){syncControls();return;}fo[sel]=fo[sel]||{};fo[sel].bold=!!on;saveDraft();apply();};
  window._rowHeight=function(d){fo.rows=fo.rows||{};var h=((fo.rows.h||DEF_RH)+d);if(h<4)h=4;if(h>30)h=30;fo.rows.h=Math.round(h*10)/10;saveDraft();apply();};
  window._nudge=function(dx,dy){
    if(!sel){g.x=r1(g.x+dx);g.y=r1(g.y+dy);saveDraft();apply();return;}
    if(dx){fo[sel]=fo[sel]||{};fo[sel].dx=r1((fo[sel].dx||0)+dx);}
    if(dy){if(selIsRow){fo.rows=fo.rows||{};fo.rows.dy=r1((fo.rows.dy||0)+dy);}else{fo[sel]=fo[sel]||{};fo[sel].dy=r1((fo[sel].dy||0)+dy);}}
    saveDraft();apply();
  };
  window._deselect=function(){sel=null;selIsRow=false;hl();label();};
  window._resetField=function(){if(!sel)return;delete fo[sel];if(selIsRow&&fo.rows)delete fo.rows;saveDraft();apply();};
  window._resetAll=function(){fo={};g={x:0,y:0};saveDraft();_deselect();apply();};
  window._save=function(){
    if(window.opener&&!window.opener.closed){
      window.opener.postMessage({type:"so_form_layout_save",payload:{g:g,fo:fo}},"*");
      baseG=clone(g);baseFo=clone(fo);try{localStorage.removeItem(DKEY);}catch(e){}
      status();alert("บันทึกเป็นค่ากลางแล้ว (ใช้ได้ทุกเครื่อง)");
    }else{alert("กรุณาเปิดหน้านี้จากปุ่มในแอป เพื่อบันทึกเป็นค่ากลาง");}
  };
  window._toggleGrid=function(cb){var gr=document.querySelectorAll(".so-grid"),ca=document.querySelectorAll(".so-cal");for(var i=0;i<gr.length;i++)gr[i].style.display=cb.checked?"block":"none";for(var j=0;j<ca.length;j++)ca[j].style.display=cb.checked?"block":"none";};
  document.addEventListener("keydown",function(e){
    var s=e.shiftKey?0.1:0.5;
    if(e.key==="ArrowLeft"){_nudge(-s,0);e.preventDefault();}
    else if(e.key==="ArrowRight"){_nudge(s,0);e.preventDefault();}
    else if(e.key==="ArrowUp"){_nudge(0,-s);e.preventDefault();}
    else if(e.key==="ArrowDown"){_nudge(0,s);e.preventDefault();}
  });
  apply();label();
})();
</script>
</body></html>`;
}

export function printSOForm(so, products, contacts, cats, layout) {
  const html = buildSOFormHtml(so, products, contacts, cats, layout);
  const w = window.open("", "_blank", "width=920,height=720");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
