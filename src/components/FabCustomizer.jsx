import { useMemo } from "react";

export const FAB_DEFAULTS = {
  label: "+",
  fontSize: 24,
  color: "rgba(255,255,255,0.7)",
  size: 44,
  items: [],
};

const COLOR_PRESETS = [
  { name: "ขาว", value: "rgba(255,255,255,0.85)" },
  { name: "ฟ้า", value: "#0A84FF" },
  { name: "เขียว", value: "#34C759" },
  { name: "ส้ม", value: "#FF9500" },
  { name: "แดง", value: "#FF3B30" },
  { name: "ม่วง", value: "#AF52DE" },
  { name: "เหลือง", value: "#FFD60A" },
];

export default function FabCustomizer({ value, onChange, onClose, baseActs }) {
  const v = { ...FAB_DEFAULTS, ...(value || {}) };
  // Merge customization with baseActs (permission-filtered actions)
  // — drops items the user no longer has permission for
  // — appends NEW available actions that weren't in the customization yet
  const items = useMemo(() => {
    const fromCustom = (v.items || [])
      .map(c => {
        const base = baseActs.find(b => b.key === c.key);
        if (!base) return null;
        return { key: c.key, label: c.label ?? base.label, icon: c.icon ?? base.icon, visible: c.visible !== false, color: c.color || "", fontSize: c.fontSize || 0 };
      })
      .filter(Boolean);
    const missing = baseActs
      .filter(b => !fromCustom.some(c => c.key === b.key))
      .map(b => ({ key: b.key, label: b.label, icon: b.icon, visible: true, color: "", fontSize: 0 }));
    return [...fromCustom, ...missing];
  }, [v.items, baseActs]);

  const update = (patch) => onChange({ ...v, ...patch });
  const updateItem = (idx, patch) => {
    const next = items.slice();
    next[idx] = { ...next[idx], ...patch };
    update({ items: next });
  };
  const moveItem = (idx, dir) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= items.length) return;
    const next = items.slice();
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    update({ items: next });
  };

  return <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
    <div onClick={e => e.stopPropagation()} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 14, padding: 18, width: "min(94vw, 540px)", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 12px 40px rgba(0,0,0,0.4)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>ปรับแต่งปุ่มของฉัน</div>
        <button onClick={onClose} aria-label="ปิด" style={{ background: "none", border: "none", color: "var(--dim)", fontSize: 22, cursor: "pointer", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6 }}>X</button>
      </div>

      {/* Preview */}
      <div style={{ display: "flex", justifyContent: "center", padding: "14px 0", borderBottom: "1px solid var(--line)", marginBottom: 14 }}>
        <div style={{ width: v.size, height: v.size, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(40,40,40,0.85)", color: v.color, fontSize: v.fontSize, fontWeight: 300, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.3)", lineHeight: 1 }}>{v.label || "+"}</div>
      </div>

      {/* Label */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--dim)", display: "block", marginBottom: 4 }}>ตัวอักษรบนปุ่ม (สูงสุด 3 ตัว)</label>
        <input value={v.label} onChange={e => update({ label: e.target.value.slice(0, 3) })} maxLength={3} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--bg2)", color: "var(--text)", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }} />
      </div>

      {/* Font size */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--dim)", display: "block", marginBottom: 4 }}>ขนาดอักษร: {v.fontSize}px</label>
        <input type="range" min={12} max={36} value={v.fontSize} onChange={e => update({ fontSize: +e.target.value })} style={{ width: "100%", accentColor: "var(--blue)" }} />
      </div>

      {/* Button size */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--dim)", display: "block", marginBottom: 4 }}>ขนาดปุ่ม: {v.size}px</label>
        <input type="range" min={36} max={68} value={v.size} onChange={e => update({ size: +e.target.value })} style={{ width: "100%", accentColor: "var(--blue)" }} />
      </div>

      {/* Color */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 11, color: "var(--dim)", display: "block", marginBottom: 6 }}>สีอักษร</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {COLOR_PRESETS.map(c => (
            <button key={c.value} onClick={() => update({ color: c.value })} title={c.name} style={{ width: 30, height: 30, borderRadius: "50%", border: v.color === c.value ? "2px solid var(--blue)" : "1px solid var(--line)", background: c.value, cursor: "pointer", padding: 0 }} />
          ))}
          <input type="color" value={v.color.startsWith("#") ? v.color : "#ffffff"} onChange={e => update({ color: e.target.value })} title="เลือกสีเอง" style={{ width: 34, height: 30, padding: 0, border: "1px solid var(--line)", borderRadius: 6, cursor: "pointer", background: "none" }} />
        </div>
      </div>

      {/* Menu items */}
      {baseActs.length > 0 && <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>ตัวเลือกในเมนู (ซ่อน/เรียง/เปลี่ยนชื่อ)</div>
        {items.map((it, i) => {
          const effColor = it.color || "rgba(255,255,255,0.85)";
          const effFs = it.fontSize || 13;
          const colorInputVal = it.color && it.color.startsWith("#") ? it.color : "#ffffff";
          return <div key={it.key} style={{ marginBottom: 6, padding: "6px 8px", background: "var(--bg)", borderRadius: 6, opacity: it.visible === false ? 0.5 : 1 }}>
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              <button onClick={() => updateItem(i, { visible: it.visible === false })} title={it.visible === false ? "แสดง" : "ซ่อน"} style={{ background: "none", border: "1px solid var(--line)", cursor: "pointer", fontSize: 11, padding: 0, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", color: it.visible === false ? "var(--dim)" : "var(--green)", borderRadius: 6, flexShrink: 0 }}>{it.visible === false ? "✕" : "✓"}</button>
              <input value={it.icon} onChange={e => updateItem(i, { icon: e.target.value.slice(0, 3) })} maxLength={3} placeholder="icon" style={{ width: 44, padding: "4px 6px", borderRadius: 4, border: "1px solid var(--line)", background: "var(--bg2)", color: effColor, fontSize: effFs, fontFamily: "inherit", textAlign: "center", flexShrink: 0, boxSizing: "border-box" }} />
              <input value={it.label} onChange={e => updateItem(i, { label: e.target.value })} placeholder="ชื่อ" style={{ flex: 1, minWidth: 0, padding: "4px 6px", borderRadius: 4, border: "1px solid var(--line)", background: "var(--bg2)", color: effColor, fontSize: effFs, fontFamily: "inherit", boxSizing: "border-box" }} />
              <button onClick={() => moveItem(i, -1)} disabled={i === 0} title="ขึ้น" style={{ background: "none", border: "1px solid var(--line)", borderRadius: 6, padding: 0, width: 26, height: 26, cursor: i === 0 ? "not-allowed" : "pointer", color: i === 0 ? "var(--faint)" : "var(--text)", fontSize: 11, flexShrink: 0 }}>↑</button>
              <button onClick={() => moveItem(i, 1)} disabled={i === items.length - 1} title="ลง" style={{ background: "none", border: "1px solid var(--line)", borderRadius: 6, padding: 0, width: 26, height: 26, cursor: i === items.length - 1 ? "not-allowed" : "pointer", color: i === items.length - 1 ? "var(--faint)" : "var(--text)", fontSize: 11, flexShrink: 0 }}>↓</button>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 5, paddingLeft: 33 }}>
              <span style={{ fontSize: 10, color: "var(--dim)" }}>สี:</span>
              {COLOR_PRESETS.map(c => (
                <button key={c.value} onClick={() => updateItem(i, { color: c.value })} title={c.name} style={{ width: 18, height: 18, borderRadius: "50%", border: it.color === c.value ? "2px solid var(--blue)" : "1px solid var(--line)", background: c.value, cursor: "pointer", padding: 0, flexShrink: 0 }} />
              ))}
              <input type="color" value={colorInputVal} onChange={e => updateItem(i, { color: e.target.value })} title="เลือกสีเอง" style={{ width: 22, height: 18, padding: 0, border: "1px solid var(--line)", borderRadius: 4, cursor: "pointer", background: "none", flexShrink: 0 }} />
              <button onClick={() => updateItem(i, { color: "" })} title="รีเซ็ตสี" style={{ background: "none", border: "1px solid var(--line)", borderRadius: 4, padding: "0 5px", height: 18, color: "var(--dim)", fontSize: 9, cursor: "pointer", flexShrink: 0 }}>↺</button>
              <span style={{ fontSize: 10, color: "var(--dim)", marginLeft: 6 }}>ขนาด:</span>
              <input type="number" min={10} max={20} value={it.fontSize || ""} onChange={e => updateItem(i, { fontSize: +e.target.value || 0 })} placeholder="13" style={{ width: 38, padding: "2px 5px", borderRadius: 4, border: "1px solid var(--line)", background: "var(--bg2)", color: "var(--text)", fontSize: 10, fontFamily: "inherit", boxSizing: "border-box", textAlign: "center" }} />
            </div>
          </div>;
        })}
      </div>}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => onChange({ ...FAB_DEFAULTS, items: [] })} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid var(--line)", background: "none", color: "var(--text)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>รีเซ็ตค่าเริ่มต้น</button>
        <button onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: "var(--blue)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>เสร็จ</button>
      </div>
    </div>
  </div>;
}
