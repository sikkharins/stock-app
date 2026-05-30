import { useMemo, useState } from "react";
import { fmt } from "../utils/helpers.js";

const PALETTE = ["#0A84FF", "#34C759", "#FF9500", "#FF3B30", "#AF52DE", "#FFD60A", "#FF2D55", "#5AC8FA"];
const OTHER_COLOR = "#8E8E93";
const TOP_N = 7;

function Donut({ data, size = 170, thickness = 26 }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
    <circle cx={c} cy={c} r={r} fill="none" stroke="var(--hover)" strokeWidth={thickness} />
    <g transform={`rotate(-90 ${c} ${c})`}>
      {data.map((d, i) => {
        const portion = d.value / total;
        const dashLen = portion * circumference;
        const seg = <circle key={i} cx={c} cy={c} r={r} fill="none" stroke={d.color} strokeWidth={thickness} strokeDasharray={`${dashLen} ${circumference - dashLen}`} strokeDashoffset={-offset} />;
        offset += dashLen;
        return seg;
      })}
    </g>
  </svg>;
}

export default function StockValueDonut({ products, cats }) {
  const [mode, setMode] = useState("category"); // "category" | "brand"

  const { items, total } = useMemo(() => {
    const map = {};
    (products || []).forEach(p => {
      const val = (p.stock || 0) * (p.cost || 0);
      if (val <= 0) return;
      let key, label;
      if (mode === "category") {
        const cat = (cats || []).find(c => c.id === p.categoryId);
        key = cat ? "c_" + cat.id : "_none";
        label = cat ? cat.name : "ไม่ระบุหมวด";
      } else {
        const brand = (p.brand || "").trim();
        key = brand || "_none";
        label = brand || "ไม่ระบุยี่ห้อ";
      }
      if (!map[key]) map[key] = { key, label, value: 0 };
      map[key].value += val;
    });
    const sorted = Object.values(map).sort((a, b) => b.value - a.value);
    const t = sorted.reduce((s, x) => s + x.value, 0);
    if (sorted.length <= TOP_N + 1) return { items: sorted, total: t };
    const top = sorted.slice(0, TOP_N);
    const otherVal = sorted.slice(TOP_N).reduce((s, x) => s + x.value, 0);
    const otherCount = sorted.length - TOP_N;
    return { items: [...top, { key: "_other", label: `อื่นๆ (${otherCount} รายการ)`, value: otherVal }], total: t };
  }, [products, cats, mode]);

  const withColor = items.map((it, i) => ({
    ...it,
    color: it.key === "_other" ? OTHER_COLOR : PALETTE[i % PALETTE.length],
  }));

  if (total === 0) return null;

  return <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: "1rem", marginBottom: "1.5rem", boxShadow: "var(--shadow)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
      <div style={{ fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(52,199,89,0.12)", color: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>$</span>
        <span>สัดส่วนมูลค่าสต็อกตาม{mode === "category" ? "หมวด" : "ยี่ห้อ"}</span>
      </div>
      <div style={{ display: "flex", background: "var(--bg)", borderRadius: 8, padding: 2, gap: 2 }}>
        <button onClick={() => setMode("category")} style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: mode === "category" ? "var(--blue-bg)" : "transparent", color: mode === "category" ? "var(--blue)" : "var(--dim)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>หมวด</button>
        <button onClick={() => setMode("brand")} style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: mode === "brand" ? "var(--blue-bg)" : "transparent", color: mode === "brand" ? "var(--blue)" : "var(--dim)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>ยี่ห้อ</button>
      </div>
    </div>

    <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ position: "relative", flexShrink: 0, width: 170, height: 170 }}>
        <Donut data={withColor} size={170} thickness={26} />
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ fontSize: 11, color: "var(--dim)" }}>รวม</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--green)" }}>{"฿" + fmt(total)}</div>
          <div style={{ fontSize: 10, color: "var(--faint)", marginTop: 2 }}>{withColor.length + (mode === "category" ? " หมวด" : " ยี่ห้อ")}</div>
        </div>
      </div>

      <div style={{ flex: "1 1 220px", minWidth: 220, display: "flex", flexDirection: "column", gap: 6 }}>
        {withColor.map(it => {
          const pct = total > 0 ? (it.value / total * 100) : 0;
          return <div key={it.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: it.color, flexShrink: 0 }} />
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text)" }}>{it.label}</span>
            <span style={{ color: "var(--dim)", fontSize: 11, flexShrink: 0, minWidth: 38, textAlign: "right" }}>{pct.toFixed(1) + "%"}</span>
            <span style={{ fontWeight: 600, minWidth: 88, textAlign: "right", flexShrink: 0 }}>{"฿" + fmt(it.value)}</span>
          </div>;
        })}
      </div>
    </div>
  </div>;
}
