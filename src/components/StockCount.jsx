import { useState } from "react";
import { IB } from "../utils/constants.js";
import Btn from "./ui/Btn.jsx";
import ProductPicker from "./ui/ProductPicker.jsx";
import { buildComparison, buildZoneComparison } from "../utils/stockCompare.ts";

const ANGLES = ["", "หน้า", "ข้าง", "บน", "อื่นๆ"];
const CONF = {
  high: { t: "ชัด", c: "var(--green)", bg: "rgba(52,199,89,0.12)" },
  med: { t: "พอได้", c: "var(--orange)", bg: "rgba(255,149,0,0.14)" },
  low: { t: "ไม่ชัวร์", c: "var(--red)", bg: "rgba(255,59,48,0.12)" },
};

// resize รูปฝั่ง client (แพตเทิร์น AISOBot) → { base64, mediaType, preview }
function resizeToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const max = 1568;
        let w = img.width, h = img.height;
        if (w > max || h > max) { if (w > h) { h = Math.round(h * max / w); w = max; } else { w = Math.round(w * max / h); h = max; } }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        resolve({ base64: dataUrl.split(",")[1], mediaType: "image/jpeg", preview: dataUrl });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function ConfBadge({ c }) {
  const x = CONF[c] || CONF.low;
  return <span style={{ fontSize: 11, fontWeight: 600, color: x.c, background: x.bg, padding: "2px 8px", borderRadius: 6 }}>{x.t}</span>;
}

export default function StockCountPage({ sh }) {
  const { products, pN, handleTab, setPendingAdjust, zones = [] } = sh;
  const [shots, setShots] = useState([]);
  const [model, setModel] = useState("opus");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [piles, setPiles] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [zoneId, setZoneId] = useState("");

  const addShots = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    if (!files.length) return;
    const out = await Promise.all(files.map(resizeToBase64));
    setShots((s) => [...s, ...out.map((x) => ({ ...x, angle: "" }))]);
  };
  const setAngle = (i, a) => setShots((s) => s.map((x, k) => (k === i ? { ...x, angle: a } : x)));
  const removeShot = (i) => setShots((s) => s.filter((_, k) => k !== i));

  const run = async () => {
    setLoading(true); setError(""); setPiles(null); setOverrides({});
    try {
      const catalog = products.map((p) => ({ id: p.id, brand: p.brand, name: pN(p), unit: p.unit || "เครื่อง" }));
      const res = await fetch("/api/stock-count", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: shots.map((s) => ({ base64: s.base64, mediaType: s.mediaType, angle: s.angle || undefined })), catalog, model }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "เรียก AI ไม่สำเร็จ");
      setPiles(data.piles || []);
    } catch (e) {
      setError(e.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  const effPiles = (piles || []).map((p, i) => (overrides[i] != null ? { ...p, productId: overrides[i] } : p));
  const zone = zoneId ? zones.find((z) => String(z.id) === String(zoneId)) : null;
  const { matched, unmatched } = buildComparison(effPiles, products);
  const zres = zone ? buildZoneComparison(zone, effPiles, products) : null;
  const tableRows = zone ? zres.expectedSeen : matched;
  const unmatchedRows = zone ? zres.unmatched : unmatched;
  const totalShown = zone ? (zres.expectedSeen.length + zres.expectedMissing.length + zres.foreignSeen.length) : matched.length;
  const goAdjust = (pid) => { setPendingAdjust(pid); handleTab("products"); };

  const TD = { padding: "8px 10px", fontSize: 13, borderBottom: "0.5px solid var(--line)" };

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "0 4px 40px" }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: "4px 0 4px" }}>ตรวจนับ AI</h2>
      <div style={{ fontSize: 12.5, color: "var(--dim)", marginBottom: 14 }}>ถ่ายกองสินค้า (หลายมุมได้) → AI นับแล้วเทียบกับสต็อกในระบบ — หน้านี้ไม่แก้สต็อก ใช้ดูว่าควรไปนับซ้ำ/ปรับตรงไหน</div>

      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: shots.length ? 12 : 0 }}>
          {shots.map((s, i) => (
            <div key={i} style={{ width: 110 }}>
              <div style={{ position: "relative" }}>
                <img src={s.preview} alt="" style={{ width: 110, height: 110, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)" }} />
                <button onClick={() => removeShot(i)} style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, border: "none", background: "rgba(0,0,0,0.55)", color: "#fff", cursor: "pointer", fontSize: 13, lineHeight: "22px", padding: 0 }}>×</button>
              </div>
              <select value={s.angle} onChange={(e) => setAngle(i, e.target.value)} style={{ ...IB, marginTop: 5, padding: "4px 6px", fontSize: 12 }}>
                {ANGLES.map((a) => <option key={a} value={a}>{a || "เลือกมุม"}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <label style={{ display: "inline-flex" }}>
            <input type="file" accept="image/*" capture="environment" multiple onChange={addShots} style={{ display: "none" }} />
            <span style={{ display: "inline-block", padding: "8px 14px", borderRadius: 7, border: "1px dashed var(--line2)", color: "var(--blue)", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>+ เพิ่มรูป</span>
          </label>
          <select value={model} onChange={(e) => setModel(e.target.value)} style={{ ...IB, width: "auto", padding: "7px 10px", fontSize: 13 }}>
            <option value="opus">Opus (แม่นกว่า)</option>
            <option value="sonnet">Sonnet (ถูกกว่า)</option>
          </select>
          <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} style={{ ...IB, width: "auto", padding: "7px 10px", fontSize: 13 }}>
            <option value="">ทั้งคลัง (ไม่ระบุโซน)</option>
            {zones.map((z) => <option key={String(z.id)} value={String(z.id)}>{z.name}</option>)}
          </select>
          <Btn onClick={run} disabled={!shots.length || loading}>{loading ? "กำลังนับ..." : "ตรวจนับ"}</Btn>
        </div>
        {error && <div style={{ marginTop: 10, color: "var(--red)", fontSize: 13 }}>{error}</div>}
      </div>

      {loading && <div style={{ textAlign: "center", color: "var(--dim)", padding: 20, fontSize: 13 }}>AI กำลังนับ (อาจ 30 วินาที+)...</div>}

      {piles && !loading && (
        <>
          {totalShown === 0 && unmatchedRows.length === 0 && <div style={{ color: "var(--dim)", fontSize: 13, padding: 12 }}>ไม่พบกองสินค้าในรูป</div>}

          {zone && zres.expectedMissing.length > 0 && (
            <div style={{ background: "rgba(255,59,48,0.06)", border: "1px solid var(--red)", borderRadius: 10, padding: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--red)", marginBottom: 8 }}>ควรมีแต่ไม่เห็นในรูป ({zres.expectedMissing.length}) — อาจหาย/ถูกย้าย ควรไปนับซ้ำ</div>
              {zres.expectedMissing.map((r) => (
                <div key={String(r.product.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "6px 0", borderTop: "0.5px solid var(--line)" }}>
                  <div style={{ fontSize: 13 }}>{r.product.brand} — {pN(r.product)} <span style={{ color: "var(--dim)" }}>· ควรมี {r.systemStock}</span></div>
                  <button onClick={() => goAdjust(r.product.id)} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "1px solid var(--orange)", background: "rgba(255,149,0,0.14)", color: "var(--orange)", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>ปรับสต็อก</button>
                </div>
              ))}
            </div>
          )}

          {tableRows.length > 0 && (
            <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
              {zone && <div style={{ fontSize: 12, color: "var(--dim)", padding: "8px 12px", borderBottom: "0.5px solid var(--line)" }}>ของในโซนที่ AI เห็น — ส่วนต่างเทียบกับสต็อก "รวมทุกโซน" (อ้างอิงคร่าวๆ)</div>}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
                  <thead>
                    <tr style={{ background: "var(--bg2)" }}>
                      <th style={{ ...TD, textAlign: "left", fontWeight: 600 }}>สินค้า</th>
                      <th style={{ ...TD, textAlign: "right", fontWeight: 600 }}>AI นับ</th>
                      <th style={{ ...TD, textAlign: "right", fontWeight: 600 }}>สต็อกระบบ</th>
                      <th style={{ ...TD, textAlign: "right", fontWeight: 600 }}>ส่วนต่าง</th>
                      <th style={{ ...TD, textAlign: "center", fontWeight: 600 }}>ความชัด</th>
                      <th style={{ ...TD, textAlign: "right", fontWeight: 600 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((m) => {
                      const same = m.diff === 0;
                      return (
                        <tr key={String(m.product.id)} title={m.note}>
                          <td style={{ ...TD, fontWeight: 500 }}>{m.product.brand} — {pN(m.product)}</td>
                          <td style={{ ...TD, textAlign: "right" }}>{m.aiCount}</td>
                          <td style={{ ...TD, textAlign: "right" }}>{m.systemStock}</td>
                          <td style={{ ...TD, textAlign: "right", fontWeight: 600, color: same ? "var(--green)" : Math.abs(m.diff) >= 5 ? "var(--red)" : "var(--orange)" }}>{same ? "ตรง" : (m.diff > 0 ? "+" : "") + m.diff}</td>
                          <td style={{ ...TD, textAlign: "center" }}><ConfBadge c={m.confidence} /></td>
                          <td style={{ ...TD, textAlign: "right" }}><button onClick={() => goAdjust(m.product.id)} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "1px solid var(--orange)", background: "rgba(255,149,0,0.14)", color: "var(--orange)", cursor: "pointer", fontFamily: "inherit" }}>ปรับสต็อก</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {zone && zres.foreignSeen.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--dim)", margin: "0 0 8px" }}>เจอในรูปแต่ไม่ได้อยู่โซนนี้ ({zres.foreignSeen.length}) — อาจวางผิดที่ หรือยังไม่ได้ผูกโซน</div>
              {zres.foreignSeen.map((r) => (
                <div key={String(r.product.id)} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", marginBottom: 8, display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontSize: 13 }}>{r.product.brand} — {pN(r.product)}</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}><span style={{ fontSize: 13, fontWeight: 600 }}>AI นับ {r.aiCount}</span><ConfBadge c={r.confidence} /></div>
                </div>
              ))}
            </div>
          )}

          {unmatchedRows.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--dim)", margin: "0 0 8px" }}>จับคู่ catalog ไม่ได้ ({unmatchedRows.length}) — เลือกสินค้าเองได้</div>
              {unmatchedRows.map((u) => (
                <div key={u.idx} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: 12, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                    <div style={{ fontSize: 13 }}>{u.guess || "(ไม่มีคำอธิบาย)"}{u.note ? <span style={{ color: "var(--dim)", fontSize: 12 }}> — {u.note}</span> : null}</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}><span style={{ fontSize: 13, fontWeight: 600 }}>AI นับ {u.count}</span><ConfBadge c={u.confidence} /></div>
                  </div>
                  <ProductPicker value={overrides[u.idx]} onChange={(id) => setOverrides((o) => ({ ...o, [u.idx]: id }))} products={products} pName={pN} getAvail={(pid) => { const p = products.find((x) => x.id === pid); return p ? p.stock : 0; }} unit="" avail={0} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
