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
