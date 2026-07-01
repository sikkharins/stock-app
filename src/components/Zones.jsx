import { useState, useMemo } from "react";
import { IB } from "../utils/constants.js";
import Btn from "./ui/Btn.jsx";
import ProductPicker from "./ui/ProductPicker.jsx";
import { getRelayUrl } from "../utils/cameraCapture.ts";
import { isGapId, normArrangeRot } from "../lib/warehouse3d/boxPlan.js";
import { expandProductsForWarehouse } from "../utils/warehouse3d.js";

const blank = () => ({ id: Date.now(), name: "", note: "", productIds: [] });

const numIB = { width: 46, boxSizing: "border-box", background: "var(--bg)", border: "1px solid var(--line2)", borderRadius: 6, padding: "4px 6px", fontSize: 12, color: "var(--text)", fontFamily: "inherit" };
const arrowBtn = (disabled) => ({ width: 22, height: 22, borderRadius: 6, border: "1px solid var(--line2)", background: "var(--bg)", color: disabled ? "var(--line2)" : "var(--blue)", cursor: disabled ? "default" : "pointer", fontFamily: "inherit", fontSize: 14, lineHeight: "18px", padding: 0 });
const orientBtn = { minWidth: 40, height: 22, padding: "0 6px", borderRadius: 6, border: "1px solid var(--line2)", background: "var(--bg)", color: "var(--blue)", cursor: "pointer", fontFamily: "inherit", fontSize: 11, lineHeight: "20px" };
const nameBtn = { flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 0, color: "var(--text)", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

export function replaceProductId(zone, oldId, newId) {
  if (newId == null) return zone;
  if (String(newId) === String(oldId)) return zone;
  if ((zone.productIds || []).some((x) => String(x) === String(newId))) return zone;
  const productIds = (zone.productIds || []).map((x) => (String(x) === String(oldId) ? newId : x));
  const boxConfig = { ...(zone.boxConfig || {}) };
  if (boxConfig[String(oldId)]) {
    boxConfig[String(newId)] = boxConfig[String(oldId)];
    delete boxConfig[String(oldId)];
  }
  return { ...zone, productIds, boxConfig };
}

export default function ZonePage({ sh }) {
  const { zones, setZones, products, pN, canE } = sh;
  const ed = canE("zones");
  // Split products แตกเป็นส่วน (id "<id>:<part>") เพื่อผูก zone แยกได้เหมือนสินค้าแยก
  const pickUnits = useMemo(() => expandProductsForWarehouse(products), [products]);
  const [editing, setEditing] = useState(null); // draft zone หรือ null
  const [pick, setPick] = useState(null);
  const [replacing, setReplacing] = useState(null);
  const [camPresets, setCamPresets] = useState([]);
  const [presetErr, setPresetErr] = useState("");

  const loadPresets = async () => {
    setPresetErr("");
    try {
      const res = await fetch(getRelayUrl() + "/presets");
      const data = await res.json();
      setCamPresets(data.presets || []);
    } catch {
      setPresetErr("ดึง preset ไม่ได้ — เปิดโปรแกรม relay บนเครื่องที่ต่อ LAN เดียวกับกล้องหรือยัง");
    }
  };
  const togglePreset = (p) => setEditing((z) => {
    const has = (z.presets || []).some((x) => String(x.token) === String(p.token));
    return { ...z, presets: has ? (z.presets || []).filter((x) => String(x.token) !== String(p.token)) : [...(z.presets || []), { token: p.token, name: p.name }] };
  });

  const startAdd = () => { setEditing(blank()); setPick(null); setReplacing(null); };
  const startEdit = (z) => { setEditing({ ...z, productIds: [...(z.productIds || [])] }); setPick(null); setReplacing(null); };
  const cancel = () => { setEditing(null); setPick(null); setReplacing(null); };

  const addProduct = (id) => {
    if (id == null) return;
    setEditing((z) => (z.productIds.some((x) => String(x) === String(id)) ? z : { ...z, productIds: [...z.productIds, id] }));
    setPick(null);
  };
  const addGap = () => setEditing((z) => {
    const gid = "gap-" + Date.now() + "-" + Math.floor(Math.random() * 1e6);
    return { ...z, productIds: [...z.productIds, gid], boxConfig: { ...(z.boxConfig || {}), [gid]: { cols: 1 } } };
  });
  const cycleArrangeRot = () => setEditing((z) => ({ ...z, arrangeRot: normArrangeRot((z.arrangeRot || 0) + 90) }));
  const removeProduct = (id) => setEditing((z) => {
    const boxConfig = { ...(z.boxConfig || {}) };
    delete boxConfig[String(id)];
    return { ...z, productIds: z.productIds.filter((x) => String(x) !== String(id)), boxConfig };
  });
  const moveProduct = (idx, dir) => setEditing((z) => {
    const arr = [...z.productIds];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return z;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    return { ...z, productIds: arr };
  });
  const setBoxCfg = (id, key, raw) => setEditing((z) => {
    const n = parseInt(raw, 10);
    const cur = { ...(z.boxConfig || {}) };
    const entry = { ...(cur[String(id)] || {}) };
    if (raw === "" || !Number.isFinite(n) || n < 1) delete entry[key];
    else entry[key] = n;
    if (Object.keys(entry).length) cur[String(id)] = entry;
    else delete cur[String(id)];
    return { ...z, boxConfig: cur };
  });
  const toggleOrient = (id) => setEditing((z) => {
    const cur = { ...(z.boxConfig || {}) };
    const entry = { ...(cur[String(id)] || {}) };
    if (entry.orient === "wide") delete entry.orient; // back to default "long"
    else entry.orient = "wide";
    if (Object.keys(entry).length) cur[String(id)] = entry;
    else delete cur[String(id)];
    return { ...z, boxConfig: cur };
  });
  const replaceProduct = (oldId, newId) => {
    if (newId != null && String(newId) !== String(oldId)
        && editing.productIds.some((x) => String(x) === String(newId))) {
      window.alert("สินค้านี้อยู่ในโซนนี้แล้ว");
      return; // keep the picker open so they can choose another
    }
    setEditing((z) => replaceProductId(z, oldId, newId));
    setReplacing(null);
  };

  const save = () => {
    const z = { ...editing, name: (editing.name || "").trim() || "โซนใหม่" };
    setZones((prev) => (prev.some((x) => x.id === z.id) ? prev.map((x) => (x.id === z.id ? z : x)) : [...prev, z]));
    setEditing(null); setPick(null); setReplacing(null);
  };
  const del = (id) => { if (window.confirm("ลบโซนนี้?")) setZones((prev) => prev.filter((z) => z.id !== id)); };

  const nameOf = (id) => { const p = pickUnits.find((x) => String(x.id) === String(id)); return p ? `${p.brand || ""} ${pN(p)}`.trim() : `#${id} (ถูกลบ)`; };

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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>สินค้าที่ควรอยู่ในโซนนี้ ({editing.productIds.filter((id) => !isGapId(id)).length})</span>
            <button onClick={cycleArrangeRot} title="หมุนการจัดเรียงทั้งโซน (ตามเข็ม)" style={orientBtn}>หมุนเรียง {normArrangeRot(editing.arrangeRot || 0)}°</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
            {editing.productIds.length === 0 && <span style={{ fontSize: 12.5, color: "var(--dim)" }}>ยังไม่ได้ผูกสินค้า</span>}
            {editing.productIds.map((id, idx) => {
              const cfg = (editing.boxConfig || {})[String(id)] || {};
              return (
                <div key={String(id)} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg2)", border: "1px solid var(--line)", borderRadius: 8, padding: "6px 8px" }}>
                  <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                    <button onClick={() => moveProduct(idx, -1)} disabled={idx === 0} title="เลื่อนซ้าย" style={arrowBtn(idx === 0)}>‹</button>
                    <button onClick={() => moveProduct(idx, 1)} disabled={idx === editing.productIds.length - 1} title="เลื่อนขวา" style={arrowBtn(idx === editing.productIds.length - 1)}>›</button>
                  </div>
                  <span style={{ fontSize: 12, color: "var(--dim)", width: 24, textAlign: "center", flexShrink: 0 }}>#{idx + 1}</span>
                  {isGapId(id) ? (
                    <>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--dim)" }}>ช่องว่าง</span>
                      <label style={{ fontSize: 11, color: "var(--dim)", display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                        แถว
                        <input type="number" min="1" value={cfg.cols ?? ""} placeholder="1" onChange={(e) => setBoxCfg(id, "cols", e.target.value)} style={numIB} />
                      </label>
                      <span style={{ fontSize: 11, color: "var(--dim)", flexShrink: 0 }}>= {(cfg.cols || 1) * 10} ซม.</span>
                      <button onClick={() => removeProduct(id)} title="ลบ" style={{ width: 20, height: 20, borderRadius: 10, border: "none", background: "var(--line2)", color: "var(--text)", cursor: "pointer", fontSize: 13, lineHeight: "20px", padding: 0, flexShrink: 0 }}>×</button>
                    </>
                  ) : replacing === id ? (
                    <>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <ProductPicker value={id} onChange={(nid) => replaceProduct(id, nid)} products={pickUnits} pName={pN} getAvail={(pid) => { const p = pickUnits.find((x) => String(x.id) === String(pid)); return p ? p.stock : 0; }} unit="" avail={0} />
                      </div>
                      <button onClick={() => setReplacing(null)} title="ยกเลิก" style={orientBtn}>ยกเลิก</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setReplacing(id)} title="คลิกเพื่อเปลี่ยนสินค้า" style={nameBtn}>{nameOf(id)}</button>
                      <label style={{ fontSize: 11, color: "var(--dim)", display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                        แถว
                        <input type="number" min="1" value={cfg.cols ?? ""} placeholder="auto" onChange={(e) => setBoxCfg(id, "cols", e.target.value)} style={numIB} />
                      </label>
                      <label style={{ fontSize: 11, color: "var(--dim)", display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                        ชั้น
                        <input type="number" min="1" value={cfg.layers ?? ""} placeholder="auto" onChange={(e) => setBoxCfg(id, "layers", e.target.value)} style={numIB} />
                      </label>
                      <button onClick={() => toggleOrient(id)} title="ด้านที่ขนานกำแพง" style={orientBtn}>{cfg.orient === "wide" ? "กว้าง" : "ยาว"}</button>
                      <button onClick={() => removeProduct(id)} title="ลบ" style={{ width: 20, height: 20, borderRadius: 10, border: "none", background: "var(--line2)", color: "var(--text)", cursor: "pointer", fontSize: 13, lineHeight: "20px", padding: 0, flexShrink: 0 }}>×</button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <ProductPicker value={pick} onChange={addProduct} products={pickUnits} pName={pN} getAvail={(pid) => { const p = pickUnits.find((x) => String(x.id) === String(pid)); return p ? p.stock : 0; }} unit="" avail={0} />
          <button onClick={addGap} style={{ marginTop: 8, fontSize: 12, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--line2)", background: "var(--bg)", color: "var(--blue)", cursor: "pointer", fontFamily: "inherit" }}>+ ช่องว่าง</button>
          <div style={{ fontSize: 13, fontWeight: 600, margin: "14px 0 6px" }}>preset กล้อง (โซนนี้) ({(editing.presets || []).length})</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {(editing.presets || []).length === 0 && <span style={{ fontSize: 12.5, color: "var(--dim)" }}>ยังไม่ผูก preset กล้อง</span>}
            {(editing.presets || []).map((p) => (
              <span key={String(p.token)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--bg2)", border: "1px solid var(--line)", borderRadius: 14, padding: "4px 6px 4px 10px", fontSize: 12.5 }}>
                {p.name}
                <button onClick={() => togglePreset(p)} style={{ width: 18, height: 18, borderRadius: 9, border: "none", background: "var(--line2)", color: "var(--text)", cursor: "pointer", fontSize: 12, lineHeight: "18px", padding: 0 }}>×</button>
              </span>
            ))}
          </div>
          <button onClick={loadPresets} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--line2)", background: "var(--bg)", color: "var(--blue)", cursor: "pointer", fontFamily: "inherit", marginBottom: 8 }}>ดึง preset จากกล้อง</button>
          {presetErr && <div style={{ fontSize: 12, color: "var(--red)", marginBottom: 8 }}>{presetErr}</div>}
          {camPresets.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {camPresets.map((p) => {
                const on = (editing.presets || []).some((x) => String(x.token) === String(p.token));
                return <button key={String(p.token)} onClick={() => togglePreset(p)} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 14, border: "1px solid " + (on ? "var(--blue)" : "var(--line2)"), background: on ? "rgba(0,113,227,0.12)" : "var(--bg)", color: on ? "var(--blue)" : "var(--text)", cursor: "pointer", fontFamily: "inherit" }}>{on ? "✓ " : ""}{p.name}</button>;
              })}
            </div>
          )}
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
