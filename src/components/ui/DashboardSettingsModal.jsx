import { useState, useMemo } from "react";
import { Modal, MBtns } from "./Modal.tsx";
import { DASH_SECTIONS, ALL_SECTION_KEYS, ALL_WIDGET_KEYS } from "../../utils/constants.js";

// migration: widget ที่เคยแสดงตลอด (ไม่มี gate) — บังคับให้ user เก่าเห็น
const NEW_DEFAULT_WIDGETS = ["sales_target", "top_products", "recent_so"];
function effectiveWidgets(cu) {
  const raw = cu.dashboardWidgets || ALL_WIDGET_KEYS;
  const set = new Set(raw);
  NEW_DEFAULT_WIDGETS.forEach(k => set.add(k));
  return set;
}

// resolve user's saved order → array of (allowed) section keys + array of hidden
function resolveSections(cu) {
  const whitelist = effectiveWidgets(cu);
  // section ที่ admin อนุญาตให้เห็น = section ที่มี widget ใด ๆ ที่อยู่ใน whitelist
  const allowed = DASH_SECTIONS.filter(s => s.widgetKeys.some(k => whitelist.has(k))).map(s => s.key);
  const allowedSet = new Set(allowed);
  // เริ่มจาก order ของ user (ตัดเฉพาะ section ที่ allowed)
  const saved = (cu.dashboardOrder || ALL_SECTION_KEYS).filter(k => allowedSet.has(k));
  // section ที่อยู่ใน allowed แต่ไม่อยู่ใน saved → ใส่ hidden
  const hidden = allowed.filter(k => !saved.includes(k));
  return { visible: saved, hidden };
}

const sectionLabel = key => DASH_SECTIONS.find(s => s.key === key)?.label || key;

export default function DashboardSettingsModal({ sh, onClose }) {
  const { cu, setUsers } = sh;
  const initial = useMemo(() => resolveSections(cu), [cu]);
  const [visible, setVisible] = useState(initial.visible);
  const [hidden, setHidden] = useState(initial.hidden);

  const allAllowed = useMemo(() => {
    const whitelist = effectiveWidgets(cu);
    return DASH_SECTIONS.filter(s => s.widgetKeys.some(k => whitelist.has(k))).map(s => s.key);
  }, [cu]);

  const move = (k, dir) => {
    setVisible(prev => {
      const idx = prev.indexOf(k);
      const ni = idx + dir;
      if (idx < 0 || ni < 0 || ni >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[ni]] = [next[ni], next[idx]];
      return next;
    });
  };
  const hideOne = k => {
    setVisible(p => p.filter(x => x !== k));
    setHidden(p => [...p, k]);
  };
  const showOne = k => {
    setHidden(p => p.filter(x => x !== k));
    setVisible(p => [...p, k]);
  };
  const reset = () => { setVisible(allAllowed); setHidden([]); };

  const save = () => {
    setUsers(prev => prev.map(u => u.id === cu.id ? { ...u, dashboardOrder: visible } : u));
    onClose();
  };

  const row = (k, idx, inVisible) => {
    const isFirst = idx === 0;
    const isLast = idx === visible.length - 1;
    return <div key={k} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px", background:"var(--bg)", border:"1px solid var(--line)", borderRadius:8, marginBottom:6 }}>
      <span style={{ flex:1, fontSize:13, color:"var(--text)" }}>{sectionLabel(k)}</span>
      {inVisible && <>
        <button onClick={() => move(k, -1)} disabled={isFirst} style={{ padding:"3px 8px", borderRadius:6, border:"1px solid var(--line)", background:isFirst?"transparent":"var(--hover)", color:isFirst?"var(--faint)":"var(--text)", cursor:isFirst?"not-allowed":"pointer", fontSize:13 }} title="ขึ้น">↑</button>
        <button onClick={() => move(k, 1)} disabled={isLast} style={{ padding:"3px 8px", borderRadius:6, border:"1px solid var(--line)", background:isLast?"transparent":"var(--hover)", color:isLast?"var(--faint)":"var(--text)", cursor:isLast?"not-allowed":"pointer", fontSize:13 }} title="ลง">↓</button>
        <button onClick={() => hideOne(k)} style={{ padding:"3px 10px", borderRadius:6, border:"1px solid var(--orange)", background:"transparent", color:"var(--orange)", cursor:"pointer", fontSize:11, fontFamily:"inherit" }}>ซ่อน</button>
      </>}
      {!inVisible && <button onClick={() => showOne(k)} style={{ padding:"3px 10px", borderRadius:6, border:"1px solid var(--green)", background:"rgba(52,199,89,0.08)", color:"var(--green)", cursor:"pointer", fontSize:11, fontFamily:"inherit" }}>+ เพิ่ม</button>}
    </div>;
  };

  return <Modal title="ตั้งค่า Dashboard" onClose={onClose} wide>
    <div style={{ display:"grid", gap:14 }}>
      <div style={{ fontSize:11.5, color:"var(--dim)", lineHeight:1.5 }}>เลือก widget ที่จะแสดง และจัดลำดับด้วยปุ่ม ↑ ↓ — มีให้เลือกเฉพาะ widget ที่ admin อนุญาตเท่านั้น</div>

      <div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
          <div style={{ fontWeight:500, fontSize:12.5, color:"var(--dim)" }}>{"แสดงบน Dashboard ("+visible.length+")"}</div>
          <button onClick={reset} style={{ fontSize:11, color:"var(--blue)", background:"transparent", border:"none", cursor:"pointer", padding:0 }}>รีเซ็ตเป็นค่าเริ่มต้น</button>
        </div>
        {visible.length === 0
          ? <div style={{ fontSize:12, color:"var(--faint)", textAlign:"center", padding:"16px 0", border:"1px dashed var(--line)", borderRadius:8 }}>ยังไม่มี widget ที่แสดง — กด "+ เพิ่ม" ด้านล่าง</div>
          : visible.map((k, i) => row(k, i, true))}
      </div>

      {hidden.length > 0 && <div>
        <div style={{ fontWeight:500, fontSize:12.5, color:"var(--dim)", marginBottom:6 }}>{"ซ่อนอยู่ ("+hidden.length+")"}</div>
        {hidden.map((k, i) => row(k, i, false))}
      </div>}
    </div>
    <MBtns onCancel={onClose} onSave={save} saveLabel="บันทึก" />
  </Modal>;
}
