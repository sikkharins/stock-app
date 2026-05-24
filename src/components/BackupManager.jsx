import { useState, useRef } from "react";
import { Modal } from "./ui/Modal.jsx";
import { saveData } from "../utils/storage.js";

// ── helpers ─────────────────────────────────────────────────────────────────
const escCell = v => {
  const s = String(v ?? "");
  return (s.includes(",") || s.includes('"') || s.includes("\n"))
    ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCSV  = rows => "﻿" + rows.map(r => r.map(escCell).join(",")).join("\r\n");
const dlBlob = (name, blob) => {
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
  a.click(); URL.revokeObjectURL(a.href);
};
const dlCSV  = (name, rows) => dlBlob(name, new Blob([toCSV(rows)], { type: "text/csv;charset=utf-8;" }));
const dlJSON = (name, obj)  => dlBlob(name, new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" }));
const dateTag = () => {
  const n = new Date();
  return n.toISOString().slice(0, 10) + "-" + n.toTimeString().slice(0, 8).replace(/:/g, "");
};
const todayStr = () => new Date().toISOString().slice(0, 10);

// ── section wrapper ──────────────────────────────────────────────────────────
function Section({ title, borderColor, headBg, children }) {
  return (
    <div style={{ border: `1.5px solid ${borderColor}40`, borderRadius: 8, marginBottom: 16, overflow: "hidden" }}>
      <div style={{ background: headBg, borderBottom: `1px solid ${borderColor}25`, padding: "9px 14px", fontWeight: 600, fontSize: 13, color: borderColor }}>{title}</div>
      <div style={{ padding: "14px" }}>{children}</div>
    </div>
  );
}

// ── main component ───────────────────────────────────────────────────────────
export default function BackupManager({
  onClose, cu,
  products, contacts, pos, sales, quotes, cats, brands, users, logs, payments, actLogs, targets, audit, priceHist,
  setProducts, setContacts, setPOs, setSales, setQuotes, setCats, setBrands, setUsers, setLogs, setPayments, setActLogs, setTargets, setAudit, setPriceHist,
}) {
  const [backupDone, setBackupDone]     = useState(null);
  const [restoreFile, setRestoreFile]   = useState("");
  const [restoreData, setRestoreData]   = useState(null);
  const [restoreErr,  setRestoreErr]    = useState("");
  const [confirmStep, setConfirmStep]   = useState(false);
  const [restoreOk,   setRestoreOk]     = useState(false);
  const fileRef = useRef(null);

  const custs = contacts.filter(c => c.type === "customer");
  const sups  = contacts.filter(c => c.type === "supplier");

  // ── Backup ────────────────────────────────────────────────────────────────
  const handleBackup = () => {
    const payload = {
      version: "3.0",
      exportDate: new Date().toISOString(),
      exportBy: cu.username,
      data: {
        products, contacts, pos, sales, quotes,
        categories: cats, brands, users,
        stockLogs: logs, payments,
        salesTargets: targets, auditLog: audit,
        priceHistory: priceHist, activityLogs: actLogs,
      },
    };
    const kb = Math.round(JSON.stringify(payload).length / 1024);
    dlJSON(`stock-backup-${dateTag()}.json`, payload);
    setBackupDone(kb);
  };

  // ── Restore ───────────────────────────────────────────────────────────────
  const handleFile = e => {
    const file = e.target.files[0];
    if (!file) return;
    setRestoreFile(file.name); setRestoreErr(""); setRestoreData(null); setConfirmStep(false);
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!parsed.version || !parsed.data) { setRestoreErr("ไฟล์ไม่ถูกรูปแบบ (ไม่พบ version หรือ data)"); return; }
        setRestoreData(parsed);
      } catch { setRestoreErr("ไม่สามารถอ่านไฟล์ได้ (JSON ไม่ถูกต้อง)"); }
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  };

  const doRestore = () => {
    const d = restoreData.data;
    const apply = (setter, key, lsKey) => { if (d[key]) { setter(d[key]); saveData(lsKey, d[key]); } };
    apply(setProducts,  "products",     "v3_products");
    apply(setContacts,  "contacts",     "v3_contacts");
    apply(setPOs,       "pos",          "v3_pos");
    apply(setSales,     "sales",        "v3_sales");
    apply(setQuotes,    "quotes",       "v3_quotes");
    apply(setCats,      "categories",   "v3_cats");
    apply(setBrands,    "brands",       "v3_brands");
    apply(setUsers,     "users",        "v3_users");
    apply(setLogs,      "stockLogs",    "v3_logs");
    apply(setPayments,  "payments",     "v3_payments");
    apply(setTargets,   "salesTargets", "v3_targets");
    apply(setAudit,     "auditLog",     "v3_audit");
    apply(setPriceHist, "priceHistory", "v3_pricehist");
    apply(setActLogs,   "activityLogs", "v3_activity");
    setRestoreOk(true); setConfirmStep(false);
    setTimeout(() => window.location.reload(), 1500);
  };

  // ── CSV exports ───────────────────────────────────────────────────────────
  const getCatName = id => { const c = cats.find(x => x.id === +id); return c ? c.name : "-"; };
  const contactName = c => c ? (c.nameT || c.name) : "-";

  const expProducts = () => {
    dlCSV(`stock-products-${todayStr()}.csv`, [
      ["รหัส","ชื่อ EN","ชื่อ TH","ยี่ห้อ","หมวดหมู่","ขนาด","ราคาขาย","ต้นทุน","สต็อก","ขั้นต่ำ","หน่วย","ผู้จัดจำหน่าย"],
      ...products.map(p => [p.code, p.name, p.nameT||"", p.brand, getCatName(p.categoryId), p.size||"", p.price, p.cost, p.stock, p.minStock, p.unit, p.distributor||""]),
    ]);
  };

  const expSales = () => {
    dlCSV(`stock-sales-${todayStr()}.csv`, [
      ["เลขที่","ลูกค้า","วันที่","สถานะ","การชำระ","ยอดรวม","ส่วนลด","VAT","ยอดสุทธิ","ตัวแทน VAT"],
      ...sales.map(so => {
        const sub = (so.items||[]).reduce((s,i) => s + i.qty*i.price, 0);
        return [so.soNum, contactName(contacts.find(c => c.id===so.customerId)), so.date, so.status, so.payType, sub, so.discountAmt||0, so.vatAmount||0, sub-(so.discountAmt||0), so.vatRepName||""];
      }),
    ]);
  };

  const expPOs = () => {
    dlCSV(`stock-po-${todayStr()}.csv`, [
      ["เลขที่","ซัพพลายเออร์","วันที่","สถานะ","ยอดรวม"],
      ...pos.map(po => {
        const tot = (po.items||[]).reduce((s,i) => s + i.qty*i.cost, 0);
        return [po.poNum, contactName(contacts.find(c => c.id===po.supplierId)), po.date, po.status, tot];
      }),
    ]);
  };

  const expCustomers = () => {
    dlCSV(`stock-customers-${todayStr()}.csv`, [
      ["ชื่อ EN","ชื่อ TH","โทร","Email","ที่อยู่","Tax ID","เซลส์","จำนวนตัวแทน VAT"],
      ...custs.map(c => [c.name, c.nameT||"", c.phone||"", c.email||"", c.address||"", c.taxId||"", c.salesPerson||"", (c.vatReps||[]).length]),
    ]);
  };

  const expSuppliers = () => {
    dlCSV(`stock-suppliers-${todayStr()}.csv`, [
      ["ชื่อ EN","ชื่อ TH","โทร","Email"],
      ...sups.map(c => [c.name, c.nameT||"", c.phone||"", c.email||""]),
    ]);
  };

  const MOVE_LABEL = { in:"รับเข้า", out:"จ่ายออก", adjust_in:"ปรับเพิ่ม", adjust_out:"ปรับลด" };
  const expLogs = () => {
    const pMap = Object.fromEntries(products.map(p => [p.id, p.nameT||p.name]));
    dlCSV(`stock-logs-${todayStr()}.csv`, [
      ["วันที่","ประเภท","สินค้า","ก่อน","เคลื่อนไหว","หลัง","อ้างอิง","หมายเหตุ","ผู้บันทึก"],
      ...logs.map(l => [l.date, MOVE_LABEL[l.type]||l.type, pMap[l.productId]||"-", l.qtyBefore, l.qty, l.qtyAfter, l.ref||"", l.note||"", l.user||""]),
    ]);
  };

  const csvBtns = [
    { label:"สินค้า",          count:products.length, fn:expProducts, color:"var(--blue)" },
    { label:"ใบขาย",           count:sales.length,    fn:expSales,    color:"var(--green)" },
    { label:"ใบสั่งซื้อ",       count:pos.length,      fn:expPOs,      color:"var(--orange)" },
    { label:"ลูกค้า",           count:custs.length,    fn:expCustomers,color:"var(--purple)" },
    { label:"ซัพพลายเออร์",    count:sups.length,     fn:expSuppliers,color:"var(--dim)" },
    { label:"ประวัติสต็อก",    count:logs.length,     fn:expLogs,     color:"var(--blue)" },
  ];

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <Modal title="Backup / Export ข้อมูล" onClose={onClose} wide>

      {/* Backup */}
      <Section title="Backup — สำรองข้อมูลทั้งหมด" borderColor="var(--green)" headBg="rgba(52,199,89,0.08)">
        <div style={{fontSize:12,color:"var(--dim)",marginBottom:10}}>
          สินค้า <strong>{products.length}</strong> &nbsp;·&nbsp;
          ใบขาย <strong>{sales.length}</strong> &nbsp;·&nbsp;
          ลูกค้า <strong>{custs.length}</strong> &nbsp;·&nbsp;
          ซัพพลายเออร์ <strong>{sups.length}</strong> &nbsp;·&nbsp;
          PO <strong>{pos.length}</strong>
          <div style={{marginTop:4,color:"var(--faint)"}}>รวมข้อมูลทั้งหมดในระบบเป็นไฟล์ JSON เดียว</div>
        </div>
        <button onClick={handleBackup} style={{padding:"9px 20px",background:"var(--green)",color:"#fff",border:"none",borderRadius:7,fontSize:13,fontWeight:600,cursor:"pointer"}}>
          สำรองข้อมูล (Backup)
        </button>
        {backupDone !== null && (
          <div style={{marginTop:10,fontSize:12,color:"var(--green)",background:"rgba(52,199,89,0.12)",borderRadius:6,padding:"7px 12px"}}>
            {"ดาวน์โหลดสำเร็จ (~"+backupDone+" KB)"}
          </div>
        )}
      </Section>

      {/* Restore */}
      <Section title="Restore — กู้คืนข้อมูล" borderColor="var(--orange)" headBg="rgba(255,149,0,0.08)">
        <div style={{fontSize:12,color:"var(--orange)",background:"rgba(255,149,0,0.14)",borderRadius:6,padding:"7px 12px",marginBottom:12}}>
          การ Restore จะแทนที่ข้อมูลทั้งหมดในระบบด้วยข้อมูลจากไฟล์ backup
        </div>
        <input ref={fileRef} type="file" accept=".json" onChange={handleFile} style={{display:"none"}}/>
        <button onClick={() => fileRef.current?.click()} style={{padding:"9px 20px",background:"var(--orange)",color:"#fff",border:"none",borderRadius:7,fontSize:13,fontWeight:600,cursor:"pointer"}}>
          เลือกไฟล์ Backup (.json)
        </button>
        {restoreFile && <span style={{marginLeft:10,fontSize:12,color:"var(--dim)"}}>{restoreFile}</span>}
        {restoreErr  && <div style={{marginTop:8,fontSize:12,color:"var(--red)"}}>{restoreErr}</div>}

        {restoreData && !restoreOk && (
          <div style={{marginTop:12,background:"var(--bg)",borderRadius:8,padding:"12px 14px",fontSize:13}}>
            <div style={{fontWeight:600,marginBottom:8}}>ข้อมูลในไฟล์ backup:</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 12px",fontSize:12,color:"var(--dim)",marginBottom:12}}>
              <span>สินค้า: <strong>{restoreData.data.products?.length ?? 0}</strong></span>
              <span>ใบขาย: <strong>{restoreData.data.sales?.length ?? 0}</strong></span>
              <span>ลูกค้า: <strong>{restoreData.data.contacts?.filter(c=>c.type==="customer").length ?? 0}</strong></span>
              <span>ซัพพลายเออร์: <strong>{restoreData.data.contacts?.filter(c=>c.type==="supplier").length ?? 0}</strong></span>
              <span>ใบสั่งซื้อ: <strong>{restoreData.data.pos?.length ?? 0}</strong></span>
              <span>ใบเสนอราคา: <strong>{restoreData.data.quotes?.length ?? 0}</strong></span>
              <span>Version: <strong>{restoreData.version}</strong></span>
              <span>วันที่ backup: <strong>{restoreData.exportDate?.slice(0,10) ?? "-"}</strong></span>
            </div>
            {!confirmStep
              ? <button onClick={() => setConfirmStep(true)} style={{padding:"8px 18px",background:"var(--orange)",color:"#fff",border:"none",borderRadius:7,fontSize:13,fontWeight:600,cursor:"pointer"}}>
                  แทนที่ทั้งหมด →
                </button>
              : <div style={{background:"rgba(255,59,48,0.12)",border:"1px solid var(--red)",borderRadius:7,padding:"10px 14px"}}>
                  <div style={{fontWeight:600,color:"var(--red)",marginBottom:8,fontSize:13}}>ข้อมูลปัจจุบันจะถูกแทนที่ทั้งหมด คุณแน่ใจหรือไม่?</div>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={doRestore} style={{padding:"7px 18px",background:"var(--red)",color:"#fff",border:"none",borderRadius:7,fontSize:13,fontWeight:600,cursor:"pointer"}}>ยืนยัน Restore</button>
                    <button onClick={() => setConfirmStep(false)} style={{padding:"7px 14px",background:"transparent",color:"var(--dim)",border:"1px solid var(--line)",borderRadius:7,fontSize:13,cursor:"pointer"}}>ยกเลิก</button>
                  </div>
                </div>
            }
          </div>
        )}
        {restoreOk && (
          <div style={{marginTop:10,fontSize:13,color:"var(--green)",background:"rgba(52,199,89,0.12)",borderRadius:6,padding:"9px 14px",fontWeight:500}}>
            กู้คืนข้อมูลสำเร็จ — กำลังโหลดใหม่...
          </div>
        )}
      </Section>

      {/* Export CSV */}
      <Section title="Export CSV — ดาวน์โหลดข้อมูลแยกประเภท" borderColor="var(--blue)" headBg="var(--blue-bg)">
        <div style={{fontSize:12,color:"var(--dim)",marginBottom:12}}>รองรับภาษาไทยใน Excel (UTF-8 BOM)</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10}}>
          {csvBtns.map(b => {
            return (
              <button key={b.label} onClick={b.fn} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"12px 8px",background:"var(--bg)",border:"1.5px solid var(--line)",borderRadius:8,cursor:"pointer",fontFamily:"inherit",transition:"border-color 0.15s"}}>
                <span style={{fontSize:12,fontWeight:600,color:b.color}}>{b.label}</span>
                <span style={{fontSize:11,color:"var(--faint)"}}>{b.count} รายการ</span>
              </button>
            );
          })}
        </div>
      </Section>

    </Modal>
  );
}
