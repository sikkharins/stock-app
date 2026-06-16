import { useState } from "react";
import { IB } from "../utils/constants.js";
import Btn from "./ui/Btn.jsx";
import ProductPicker from "./ui/ProductPicker.jsx";

const blank = () => ({ id: Date.now(), name: "", note: "", productIds: [] });

export default function ZonePage({ sh }) {
  const { zones, setZones, products, pN, canE } = sh;
  const ed = canE("zones");
  const [editing, setEditing] = useState(null); // draft zone หรือ null
  const [pick, setPick] = useState(null);

  const startAdd = () => { setEditing(blank()); setPick(null); };
  const startEdit = (z) => { setEditing({ ...z, productIds: [...(z.productIds || [])] }); setPick(null); };
  const cancel = () => { setEditing(null); setPick(null); };

  const addProduct = (id) => {
    if (id == null) return;
    setEditing((z) => (z.productIds.some((x) => String(x) === String(id)) ? z : { ...z, productIds: [...z.productIds, id] }));
    setPick(null);
  };
  const removeProduct = (id) => setEditing((z) => ({ ...z, productIds: z.productIds.filter((x) => String(x) !== String(id)) }));

  const save = () => {
    const z = { ...editing, name: (editing.name || "").trim() || "โซนใหม่" };
    setZones((prev) => (prev.some((x) => x.id === z.id) ? prev.map((x) => (x.id === z.id ? z : x)) : [...prev, z]));
    setEditing(null); setPick(null);
  };
  const del = (id) => { if (window.confirm("ลบโซนนี้?")) setZones((prev) => prev.filter((z) => z.id !== id)); };

  const nameOf = (id) => { const p = products.find((x) => String(x.id) === String(id)); return p ? `${p.brand || ""} ${pN(p)}`.trim() : `#${id} (ถูกลบ)`; };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 4px 40px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "4px 0 4px" }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>โซน (Block)</h2>
        {ed && !editing && <Btn onClick={startAdd}>+ เพิ่มโซน</Btn>}
      </div>
      <div style={{ fontSize: 12.5, color: "var(--dim)", marginBottom: 14 }}>แบ่งโกดังเป็นบล็อกตามระยะเสา แล้วผูกสินค้าที่ควรอยู่ในแต่ละบล็อก — ใช้คู่กับ "ตรวจนับ AI" เพื่อหา "ของที่ควรมีแต่ไม่เห็น"</div>

      {editing && (
        <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: "var(--dim)" }}>ชื่อโซน</label>
            <input value={editing.name} onChange={(e) => setEditing((z) => ({ ...z, name: e.target.value }))} placeholder="เช่น A1, เสา 3-4 ฝั่งซ้าย" style={{ ...IB, marginTop: 4 }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: "var(--dim)" }}>หมายเหตุ (ไม่บังคับ)</label>
            <input value={editing.note || ""} onChange={(e) => setEditing((z) => ({ ...z, note: e.target.value }))} style={{ ...IB, marginTop: 4 }} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>สินค้าที่ควรอยู่ในโซนนี้ ({editing.productIds.length})</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {editing.productIds.length === 0 && <span style={{ fontSize: 12.5, color: "var(--dim)" }}>ยังไม่ได้ผูกสินค้า</span>}
            {editing.productIds.map((id) => (
              <span key={String(id)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--bg2)", border: "1px solid var(--line)", borderRadius: 14, padding: "4px 6px 4px 10px", fontSize: 12.5 }}>
                {nameOf(id)}
                <button onClick={() => removeProduct(id)} style={{ width: 18, height: 18, borderRadius: 9, border: "none", background: "var(--line2)", color: "var(--text)", cursor: "pointer", fontSize: 12, lineHeight: "18px", padding: 0 }}>×</button>
              </span>
            ))}
          </div>
          <ProductPicker value={pick} onChange={addProduct} products={products} pName={pN} getAvail={(pid) => { const p = products.find((x) => String(x.id) === String(pid)); return p ? p.stock : 0; }} unit="" avail={0} />
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Btn onClick={save}>บันทึก</Btn>
            <button onClick={cancel} style={{ padding: "8px 14px", borderRadius: 7, border: "1px solid var(--line2)", background: "var(--bg)", color: "var(--text)", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>ยกเลิก</button>
          </div>
        </div>
      )}

      {zones.length === 0 && !editing && <div style={{ color: "var(--dim)", fontSize: 13, padding: 12 }}>ยังไม่มีโซน — กด "เพิ่มโซน" เพื่อเริ่ม</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {zones.map((z) => (
          <div key={String(z.id)} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{z.name}</div>
              <div style={{ fontSize: 12, color: "var(--dim)", marginTop: 2 }}>{(z.productIds || []).length} สินค้า{z.note ? ` · ${z.note}` : ""}</div>
            </div>
            {ed && (
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => startEdit(z)} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "1px solid var(--line2)", background: "var(--bg)", color: "var(--blue)", cursor: "pointer", fontFamily: "inherit" }}>แก้ไข</button>
                <button onClick={() => del(z.id)} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "1px solid var(--line2)", background: "var(--bg)", color: "var(--red)", cursor: "pointer", fontFamily: "inherit" }}>ลบ</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
