const CO = {
  nameTH:  "หจก ที เอส อีเลคโทรนิค (1992)",
  nameEN:  "TS Electronics (1992) Limited Partnership",
  branch:  "สำนักงานใหญ่",
  address: "99/29 ม.15 ต.หนองกระโดน อ.เมือง จ.นครสวรรค์ 60240",
  taxId:   "0603535000224",
};

const toBE = d => { if(!d) return "-"; const p=(d||"").split("-"); if(p.length!==3) return d; return p[2]+"/"+p[1]+"/"+(+p[0]+543); };
const fmtC = n => Number(n||0).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2});
const round2 = n => Math.round((+n + Number.EPSILON) * 100) / 100;
const addDays = (d,n) => { const x=new Date(d); x.setDate(x.getDate()+n); return x.toISOString().split("T")[0]; };

export function printDoc(type, data, products, contacts, opts = {}) {
  const vatMode = opts.vatMode || "inclusive"; // "inclusive" | "exclusive"
  const isExclusive = vatMode === "exclusive" && type === "so" && data.includeVat === true;
  const logoUrl = window.location.origin + "/logo.jpg";
  const apiOrigin = window.location.origin;
  const contact = contacts.find(c => c.id === (type==="po" ? data.supplierId : data.customerId)) || {};

  const titles = {
    so: { th:"ใบขาย",         en:"Sales Order",     num:data.soNum },
    qt: { th:"ใบเสนอราคา",   en:"Quotation",       num:data.qtNum },
    po: { th:"ใบสั่งซื้อ",    en:"Purchase Order",  num:data.poNum },
  };
  const t = titles[type];
  const priceKey = type === "po" ? "cost" : "price";

  // Items rows
  const itemsHtml = (data.items||[]).map((it,i) => {
    const pr = products.find(x => x.id === it.productId) || {};
    const rawPrice = it[priceKey] || 0;
    const unitPrice = isExclusive ? round2(rawPrice * 100/107) : rawPrice;
    const lineAmt = isExclusive ? round2(it.qty * rawPrice * 100/107) : it.qty * rawPrice;
    const pad = isExclusive ? "9px 10px" : "6px 8px";
    return `<tr>
      <td style="border:1px solid #bbb;padding:${pad};text-align:center;">${i+1}</td>
      <td style="border:1px solid #bbb;padding:${pad};">${pr.code||"-"}</td>
      <td style="border:1px solid #bbb;padding:${pad};">${pr.nameT||pr.name||"-"}</td>
      <td style="border:1px solid #bbb;padding:${pad};text-align:center;">${it.qty}</td>
      <td style="border:1px solid #bbb;padding:${pad};text-align:center;">${pr.unit||"-"}</td>
      <td style="border:1px solid #bbb;padding:${pad};text-align:right;">${fmtC(unitPrice)}</td>
      <td style="border:1px solid #bbb;padding:${pad};text-align:right;font-weight:600;">${fmtC(lineAmt)}</td>
    </tr>`;
  }).join("");

  // Totals
  const sub = (data.items||[]).reduce((s,i) => s + i.qty*(i[priceKey]||0), 0);
  let totalsHtml = "";
  if (type === "po") {
    totalsHtml = `<tr><td style="padding:5px 8px;border:none;color:#555;">ยอดรวมทั้งสิ้น</td><td style="padding:5px 8px;border:none;text-align:right;font-weight:700;font-size:15px;">฿${fmtC(sub)}</td></tr>`;
  } else {
    const disc = type==="so" ? (data.discountAmt||0) : (data.payType==="cash" ? round2(sub*(data.discPct||0)/100) : 0);
    const after = sub - disc;
    const discPctLabel = type==="so" ? (data.discPct||0) : (data.discPct||0);
    if (isExclusive) {
      // Recompute ex-VAT totals
      const subEx = (data.items||[]).reduce((s,it) => s + round2(it.qty * (it[priceKey]||0) * 100/107), 0);
      const discEx = disc > 0 ? round2(disc * 100/107) : 0;
      const vatEx = round2(after - (subEx - discEx));
      totalsHtml = `
        <tr><td style="padding:4px 8px;border:none;color:#555;">ยอดสินค้า (ก่อน VAT)</td><td style="padding:4px 8px;border:none;text-align:right;">฿${fmtC(subEx)}</td></tr>
        ${disc>0 ? `<tr><td style="padding:4px 8px;border:none;color:#1D9E75;">ส่วนลด ${discPctLabel}%</td><td style="padding:4px 8px;border:none;text-align:right;color:#1D9E75;">-฿${fmtC(discEx)}</td></tr>` : ""}
        <tr><td style="padding:4px 8px;border:none;color:#b06000;">VAT 7%</td><td style="padding:4px 8px;border:none;text-align:right;color:#b06000;">฿${fmtC(vatEx)}</td></tr>
        <tr style="border-top:2px solid #111;"><td style="padding:6px 8px;border:none;font-weight:700;font-size:15px;">ยอดสุทธิ</td><td style="padding:6px 8px;border:none;text-align:right;font-weight:700;font-size:15px;color:#1D9E75;">฿${fmtC(after)}</td></tr>
      `;
    } else {
      const vat = data.includeVat ? (type==="so" ? (data.vatAmount||0) : round2(after*7/107)) : 0;
      totalsHtml = `
        <tr><td style="padding:4px 8px;border:none;color:#555;">ยอดรวม</td><td style="padding:4px 8px;border:none;text-align:right;">฿${fmtC(sub)}</td></tr>
        ${disc>0 ? `<tr><td style="padding:4px 8px;border:none;color:#1D9E75;">ส่วนลด ${discPctLabel}%</td><td style="padding:4px 8px;border:none;text-align:right;color:#1D9E75;">-฿${fmtC(disc)}</td></tr>` : ""}
        ${data.includeVat ? `<tr><td style="padding:4px 8px;border:none;color:#b06000;">VAT 7% (รวมในราคา)</td><td style="padding:4px 8px;border:none;text-align:right;color:#b06000;">฿${fmtC(vat)}</td></tr>` : ""}
        <tr style="border-top:2px solid #111;"><td style="padding:6px 8px;border:none;font-weight:700;font-size:15px;">ยอดสุทธิ</td><td style="padding:6px 8px;border:none;text-align:right;font-weight:700;font-size:15px;color:#1D9E75;">฿${fmtC(after)}</td></tr>
      `;
    }
  }

  // Extra doc-info rows
  const expiryRow = type==="qt"&&data.validUntil
    ? `<tr><td style="color:#888;padding:3px 0;border:none;width:90px;">หมดอายุ:</td><td style="padding:3px 0;border:none;color:#b06000;">${toBE(data.validUntil)}</td></tr>` : "";
  const payRow = (type==="so"||type==="qt")
    ? `<tr><td style="color:#888;padding:3px 0;border:none;">การชำระ:</td><td style="padding:3px 0;border:none;">${data.payType==="cash"?"เงินสด":`เครดิต ${data.creditDays||0} วัน`}</td></tr>` : "";
  const dueRow = type==="so"&&data.payType==="credit"&&data.creditDays
    ? `<tr><td style="color:#888;padding:3px 0;border:none;">ครบกำหนด:</td><td style="padding:3px 0;border:none;color:#b06000;">${toBE(addDays(data.date,data.creditDays))}</td></tr>` : "";
  const salesRow = type==="so"&&contact.salesPerson
    ? `<tr><td style="color:#888;padding:3px 0;border:none;">พนักงานขาย:</td><td style="padding:3px 0;border:none;">${contact.salesPerson}</td></tr>` : "";

  // VAT rep block (SO only)
  const vatRepHtml = type==="so"&&data.useVatRep&&data.vatRepName
    ? `<div style="background:#f0f4ff;border:1px solid #c5d0f5;border-radius:6px;padding:10px 14px;margin-bottom:16px;font-size:12px;">
        <div style="font-weight:700;color:#1565c0;margin-bottom:5px;">ออก VAT ให้ตัวแทน</div>
        <div style="font-weight:600;">${data.vatRepName}</div>
        ${data.vatRepAddress?`<div style="color:#555;margin-top:3px;">${data.vatRepAddress}</div>`:""}
        ${data.vatRepIdCard?`<div style="color:#888;margin-top:2px;">บัตรประชาชน: ${data.vatRepIdCard}</div>`:""}
      </div>` : "";

  // QT note
  const noteHtml = type==="qt"&&data.note
    ? `<div style="border:1px solid #ddd;border-radius:6px;padding:9px 12px;margin-bottom:16px;font-size:12px;color:#555;">
        <strong>หมายเหตุ / Note:</strong> ${data.note}
      </div>` : "";

  const contactLabel = type==="po" ? "ผู้จัดจำหน่าย / Vendor" : "ลูกค้า / Bill To";

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>${t.th} — ${t.num}</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Sarabun',system-ui,sans-serif;font-size:14px;color:#111;background:#fff;}
@media screen{body{padding:24px;max-width:860px;margin:0 auto;}}
@media print{
  .no-print{display:none!important;}
  body{padding:0;font-size:12px;}
  @page{size:A4;margin:15mm;}
}
</style>
</head>
<body>

<div class="no-print" style="margin-bottom:20px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
  <button onclick="window.print()" style="padding:9px 22px;background:#111;color:#fff;border:none;border-radius:7px;font-size:14px;cursor:pointer;font-family:inherit;">พิมพ์ / Save as PDF</button>
  <button onclick="saveAsImage()" style="padding:9px 18px;background:#1D9E75;color:#fff;border:none;border-radius:7px;font-size:14px;cursor:pointer;font-family:inherit;">💾 บันทึกเป็นรูปภาพ</button>
  <button onclick="sendToLine()" style="padding:9px 18px;background:#06C755;color:#fff;border:none;border-radius:7px;font-size:14px;cursor:pointer;font-family:inherit;">📤 ส่งเข้า LINE</button>
  <button onclick="window.close()" style="padding:9px 16px;background:transparent;color:#666;border:1px solid #ccc;border-radius:7px;font-size:14px;cursor:pointer;font-family:inherit;">ปิด</button>
  <span style="font-size:12px;color:#aaa;">เลือก "Save as PDF" ใน dialog ของ browser เพื่อบันทึก PDF</span>
</div>

${isExclusive ? "" : `<!-- Company header -->
<div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:14px;border-bottom:2.5px solid #111;margin-bottom:18px;gap:16px;">
  <div style="flex-shrink:0;">
    <img src="${logoUrl}" style="height:80px;width:auto;object-fit:contain;" onerror="this.style.display='none'">
  </div>
  <div style="text-align:right;">
    <div style="font-size:18px;font-weight:700;">${CO.nameTH}</div>
    <div style="font-size:13px;color:#444;margin-top:2px;">${CO.nameEN}</div>
    <div style="font-size:12px;color:#555;margin-top:6px;">${CO.address}</div>
    <div style="font-size:12px;color:#555;margin-top:2px;">เลขประจำตัวผู้เสียภาษี: ${CO.taxId} | ${CO.branch}</div>
  </div>
</div>`}

<!-- Document title -->
<div style="text-align:center;margin-bottom:18px;">
  <div style="font-size:22px;font-weight:700;letter-spacing:0.5px;">${t.th}</div>
  <div style="font-size:13px;color:#777;margin-top:3px;">${t.en}</div>
</div>

<!-- Info row -->
<div style="display:flex;gap:14px;margin-bottom:16px;">
  <div style="flex:1;border:1px solid #ccc;border-radius:6px;padding:12px 14px;min-height:90px;">
    <div style="font-size:11px;color:#888;font-weight:600;margin-bottom:7px;letter-spacing:0.5px;">${contactLabel}</div>
    <div style="font-weight:700;font-size:15px;">${contact.nameT||contact.name||"-"}</div>
    ${contact.address?`<div style="font-size:12px;color:#555;margin-top:5px;">${contact.address}</div>`:""}
    ${contact.taxId?`<div style="font-size:12px;color:#555;margin-top:3px;">เลขประจำตัวผู้เสียภาษี: ${contact.taxId}</div>`:""}
    ${contact.phone?`<div style="font-size:12px;color:#555;margin-top:3px;">โทร: ${contact.phone}</div>`:""}
  </div>
  <div style="width:235px;border:1px solid #ccc;border-radius:6px;padding:12px 14px;">
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr><td style="color:#888;padding:3px 0;border:none;width:88px;">เลขที่:</td><td style="font-weight:700;padding:3px 0;border:none;">${t.num}</td></tr>
      <tr><td style="color:#888;padding:3px 0;border:none;">วันที่:</td><td style="padding:3px 0;border:none;">${toBE(data.date)}</td></tr>
      ${expiryRow}${payRow}${dueRow}${salesRow}
    </table>
  </div>
</div>

${vatRepHtml}

<!-- Items table -->
<table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:${isExclusive ? "17px" : "13px"};">
  <thead>
    <tr style="background:#f5f5f0;">
      <th style="border:1px solid #bbb;padding:${isExclusive ? "10px" : "7px 8px"};text-align:center;font-weight:600;width:36px;">#</th>
      <th style="border:1px solid #bbb;padding:${isExclusive ? "10px" : "7px 8px"};font-weight:600;width:${isExclusive ? "100px" : "80px"};">รหัส</th>
      <th style="border:1px solid #bbb;padding:${isExclusive ? "10px" : "7px 8px"};font-weight:600;">ชื่อสินค้า / Description</th>
      <th style="border:1px solid #bbb;padding:${isExclusive ? "10px" : "7px 8px"};text-align:center;font-weight:600;width:${isExclusive ? "75px" : "60px"};">จำนวน</th>
      <th style="border:1px solid #bbb;padding:${isExclusive ? "10px" : "7px 8px"};text-align:center;font-weight:600;width:${isExclusive ? "70px" : "55px"};">หน่วย</th>
      <th style="border:1px solid #bbb;padding:${isExclusive ? "10px" : "7px 8px"};text-align:right;font-weight:600;width:${isExclusive ? "120px" : "100px"};">ราคา/หน่วย</th>
      <th style="border:1px solid #bbb;padding:${isExclusive ? "10px" : "7px 8px"};text-align:right;font-weight:600;width:${isExclusive ? "130px" : "110px"};">จำนวนเงิน</th>
    </tr>
  </thead>
  <tbody>${itemsHtml}</tbody>
</table>

<!-- Totals (with optional note on left for เช็คของขึ้นรถ mode) -->
<div style="display:flex;justify-content:${isExclusive&&data.note?"space-between":"flex-end"};align-items:flex-start;margin-bottom:20px;gap:20px;">
  ${isExclusive&&data.note?`<div style="flex:1;font-size:13px;color:#333;padding-top:4px;line-height:1.55;"><strong style="color:#555;">หมายเหตุ:</strong> ${data.note}</div>`:""}
  <table style="width:300px;border-collapse:collapse;font-size:13px;flex-shrink:0;">${totalsHtml}</table>
</div>

${noteHtml}

<!-- Signatures -->
${isExclusive ? "" : type==="po" ? `
<div style="display:flex;gap:40px;margin-top:36px;">
  <div style="flex:1;text-align:center;">
    <div style="height:60px;display:flex;align-items:center;justify-content:center;">
      ${data.approval?.signature ? `<img src="${data.approval.signature}" style="max-height:55px;max-width:150px;object-fit:contain;">` : ""}
    </div>
    <div style="border-top:1px dashed #888;padding-top:8px;">
      <div style="font-size:12px;color:#333;">ผู้อนุมัติ / Approved by</div>
      <div style="font-size:11px;color:#555;margin-top:3px;">${data.approval?.approverName||"................................"}</div>
      <div style="font-size:11px;color:#999;margin-top:3px;">วันที่: ${data.approval?.date||"................................"}</div>
    </div>
  </div>
  <div style="flex:1;text-align:center;">
    <div style="height:60px;"></div>
    <div style="border-top:1px dashed #888;padding-top:8px;">
      <div style="font-size:12px;color:#333;">ผู้รับของ / Received by</div>
      <div style="font-size:11px;color:#999;margin-top:5px;">วันที่ / Date: ................................</div>
    </div>
  </div>
</div>
` : `
<div style="display:flex;gap:40px;margin-top:36px;padding-top:0;">
  <div style="flex:1;text-align:center;">
    <div style="height:70px;"></div>
    <div style="border-top:1px dashed #888;padding-top:8px;">
      <div style="font-size:12px;color:#333;">ผู้ออกเอกสาร / Authorized Signature</div>
      <div style="font-size:11px;color:#999;margin-top:5px;">วันที่ / Date: ................................</div>
    </div>
  </div>
  <div style="flex:1;text-align:center;">
    <div style="height:70px;"></div>
    <div style="border-top:1px dashed #888;padding-top:8px;">
      <div style="font-size:12px;color:#333;">ผู้รับ / Received by</div>
      <div style="font-size:11px;color:#999;margin-top:5px;">วันที่ / Date: ................................</div>
    </div>
  </div>
</div>
`}

<script>
function saveAsImage() {
  var toolbar = document.querySelector('.no-print');
  if (toolbar) toolbar.style.display = 'none';
  if (typeof html2canvas !== 'function') {
    alert('ยังโหลด html2canvas ไม่เสร็จ ลองอีกครั้งใน 1-2 วินาที');
    if (toolbar) toolbar.style.display = '';
    return;
  }
  html2canvas(document.body, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
    .then(function(canvas) {
      if (toolbar) toolbar.style.display = '';
      var finalCanvas = canvas;
      if (${JSON.stringify(vatMode)} === 'exclusive') {
        // เช็คของขึ้นรถ: crop to half height for LINE-friendly aspect ratio
        var cropped = document.createElement('canvas');
        cropped.width = canvas.width;
        cropped.height = Math.floor(canvas.height / 2);
        var ctx = cropped.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cropped.width, cropped.height);
        ctx.drawImage(canvas, 0, 0);
        finalCanvas = cropped;
      }
      var a = document.createElement('a');
      a.download = ${JSON.stringify(t.num)} + (${JSON.stringify(vatMode)} === 'exclusive' ? '-vat-ex.png' : '.png');
      a.href = finalCanvas.toDataURL('image/png');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    })
    .catch(function(err) {
      if (toolbar) toolbar.style.display = '';
      console.error('Image save failed:', err);
      alert('บันทึกรูปไม่สำเร็จ: ' + (err.message || err));
    });
}

async function sendToLine() {
  if (typeof html2canvas !== 'function') {
    alert('ยังโหลด html2canvas ไม่เสร็จ ลองอีกครั้งใน 1-2 วินาที');
    return;
  }
  if (!confirm('ส่งรูปนี้เข้ากลุ่ม LINE?')) return;

  var toolbar = document.querySelector('.no-print');
  if (toolbar) toolbar.style.display = 'none';
  try {
    var canvas = await html2canvas(document.body, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    if (toolbar) toolbar.style.display = '';

    var finalCanvas = canvas;
    if (${JSON.stringify(vatMode)} === 'exclusive') {
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
    var resp = await fetch(${JSON.stringify(apiOrigin)} + '/api/line-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageDataUrl: dataUrl,
        docNum: ${JSON.stringify(t.num)},
        message: ${JSON.stringify(t.th + ' ' + t.num)},
      }),
    });

    var result = await resp.json().catch(function() { return { error: 'Invalid JSON response' }; });
    if (resp.ok && result.success) {
      alert('✅ ส่งเข้า LINE สำเร็จ');
    } else {
      alert('❌ ส่งไม่สำเร็จ: ' + (result.error || ('HTTP ' + resp.status)));
    }
  } catch (err) {
    if (toolbar) toolbar.style.display = '';
    alert('❌ เกิดข้อผิดพลาด: ' + (err.message || err));
  }
}
</script>

</body>
</html>`;

  const w = window.open("", "_blank", "width=920,height=720");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
