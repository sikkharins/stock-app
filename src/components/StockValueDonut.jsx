import { useMemo, useState, useEffect } from "react";
import { fmt } from "../utils/helpers.js";

const PALETTE = ["#0A84FF", "#34C759", "#FF9500", "#FF3B30", "#AF52DE", "#FFD60A", "#FF2D55", "#5AC8FA"];
const OTHER_COLOR = "#8E8E93";
const TOP_N = 7;

const STYLES = [
  { id: "donut", name: "Donut", icon: "◍" },
  { id: "bars", name: "Bars", icon: "▦" },
  { id: "treemap", name: "Treemap", icon: "▣" },
  { id: "stacked", name: "Stacked", icon: "▬" },
];

// ─────────────────────── Polished Donut ───────────────────────
function PolishedDonut({ data }) {
  const size = 180;
  const thickness = 28;
  const gap = 3;
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const [hover, setHover] = useState(null);
  let offset = 0;
  if (total === 0) return null;
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
    <defs>
      {data.map((d, i) => (
        <linearGradient key={i} id={`svDg-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={d.color} stopOpacity={1}/>
          <stop offset="100%" stopColor={d.color} stopOpacity={0.7}/>
        </linearGradient>
      ))}
    </defs>
    <circle cx={c} cy={c} r={r} fill="none" stroke="var(--hover)" strokeWidth={thickness} />
    <g transform={`rotate(-90 ${c} ${c})`}>
      {data.map((d, i) => {
        const portion = d.value / total;
        const fullLen = portion * circumference;
        const dashLen = Math.max(2, fullLen - gap);
        const isHover = hover === i;
        const el = <circle
          key={i}
          cx={c} cy={c} r={r}
          fill="none"
          stroke={`url(#svDg-${i})`}
          strokeWidth={isHover ? thickness + 5 : thickness}
          strokeLinecap="butt"
          strokeDasharray={`${dashLen} ${circumference - dashLen}`}
          strokeDashoffset={-offset}
          style={{ transition: "stroke-width 0.2s, opacity 0.2s", opacity: hover !== null && !isHover ? 0.55 : 1, cursor: "pointer" }}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
        />;
        offset += fullLen;
        return el;
      })}
    </g>
  </svg>;
}

// ─────────────────────── Horizontal Bars ───────────────────────
function HorizontalBars({ data, total }) {
  const max = Math.max(...data.map(d => d.value));
  return <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
    {data.map(it => {
      const pct = total > 0 ? (it.value / total * 100) : 0;
      const barPct = max > 0 ? (it.value / max * 100) : 0;
      return <div key={it.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: it.color, flexShrink: 0 }} />
        <span style={{ width: 100, fontSize: 12, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }}>{it.label}</span>
        <div style={{ flex: 1, height: 22, background: "var(--bg)", borderRadius: 6, overflow: "hidden", position: "relative", minWidth: 60 }}>
          <div style={{ width: barPct + "%", height: "100%", background: `linear-gradient(90deg, ${it.color}aa, ${it.color})`, borderRadius: 6, transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)" }} />
        </div>
        <span style={{ fontSize: 11, color: "var(--dim)", width: 42, textAlign: "right", flexShrink: 0 }}>{pct.toFixed(1) + "%"}</span>
        <span style={{ fontSize: 12, fontWeight: 600, width: 92, textAlign: "right", flexShrink: 0 }}>{"฿" + fmt(it.value)}</span>
      </div>;
    })}
  </div>;
}

// ─────────────────────── Treemap (squarified) ───────────────────────
function aspectRatio(row, side) {
  const rowArea = row.reduce((s, it) => s + it.area, 0);
  if (rowArea === 0 || side === 0) return Infinity;
  const rowSize = rowArea / side;
  let worst = 0;
  for (const it of row) {
    const itemSize = side * (it.area / rowArea);
    if (itemSize === 0 || rowSize === 0) return Infinity;
    const ar = Math.max(rowSize / itemSize, itemSize / rowSize);
    if (ar > worst) worst = ar;
  }
  return worst;
}

function squarify(items, x, y, w, h) {
  if (!items.length || w <= 0 || h <= 0) return [];
  const totalArea = w * h;
  const totalValue = items.reduce((s, i) => s + i.value, 0);
  if (totalValue === 0) return [];
  const sorted = [...items].sort((a, b) => b.value - a.value).map(it => ({ ...it, area: it.value / totalValue * totalArea }));
  const result = [];
  let remaining = sorted.slice();
  let cx = x, cy = y, cw = w, ch = h;
  while (remaining.length > 0) {
    const isHorizontal = cw >= ch;
    const side = isHorizontal ? ch : cw;
    let row = [remaining[0]];
    let bestAR = aspectRatio(row, side);
    let i = 1;
    while (i < remaining.length) {
      const test = [...row, remaining[i]];
      const ar = aspectRatio(test, side);
      if (ar <= bestAR) { row = test; bestAR = ar; i++; } else break;
    }
    const rowArea = row.reduce((s, it) => s + it.area, 0);
    const rowSize = rowArea / side;
    let pos = isHorizontal ? cy : cx;
    for (const it of row) {
      const itemSize = side * (it.area / rowArea);
      if (isHorizontal) result.push({ ...it, x: cx, y: pos, w: rowSize, h: itemSize });
      else result.push({ ...it, x: pos, y: cy, w: itemSize, h: rowSize });
      pos += itemSize;
    }
    if (isHorizontal) { cx += rowSize; cw -= rowSize; } else { cy += rowSize; ch -= rowSize; }
    remaining = remaining.slice(row.length);
  }
  return result;
}

function Treemap({ data }) {
  const w = 460, h = 240;
  const rects = useMemo(() => squarify(data, 0, 0, w, h), [data]);
  return <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block", borderRadius: 8 }}>
    <defs>
      {data.map((d, i) => (
        <linearGradient key={i} id={`svTm-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={d.color} stopOpacity={1}/>
          <stop offset="100%" stopColor={d.color} stopOpacity={0.75}/>
        </linearGradient>
      ))}
    </defs>
    {rects.map((r, i) => {
      const showLabel = r.w > 50 && r.h > 28;
      const showValue = r.w > 70 && r.h > 50;
      const idx = data.findIndex(d => d.key === r.key);
      return <g key={r.key}>
        <rect x={r.x + 1.5} y={r.y + 1.5} width={r.w - 3} height={r.h - 3} fill={`url(#svTm-${idx >= 0 ? idx : i})`} rx={5} ry={5}/>
        {showLabel && <text x={r.x + 8} y={r.y + 18} fontSize="12" fill="#fff" style={{ fontWeight: 600, pointerEvents: "none" }}>{r.label.length > 14 ? r.label.slice(0,12)+"…" : r.label}</text>}
        {showValue && <text x={r.x + 8} y={r.y + 34} fontSize="11" fill="rgba(255,255,255,0.85)" style={{ pointerEvents: "none" }}>{"฿" + fmt(r.value)}</text>}
      </g>;
    })}
  </svg>;
}

// ─────────────────────── Stacked Bar ───────────────────────
function StackedBar({ data, total }) {
  const [hover, setHover] = useState(null);
  return <div>
    <div style={{ height: 38, display: "flex", borderRadius: 10, overflow: "hidden", background: "var(--bg)", border: "1px solid var(--line)" }}>
      {data.map((d, i) => {
        const pct = total > 0 ? (d.value / total * 100) : 0;
        const isHover = hover === i;
        return <div key={d.key}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
          title={`${d.label}: ${pct.toFixed(1)}% (฿${fmt(d.value)})`}
          style={{ flex: d.value, background: `linear-gradient(180deg, ${d.color}, ${d.color}cc)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 600, minWidth: 0, overflow: "hidden", borderRight: i < data.length - 1 ? "2px solid var(--panel)" : "none", cursor: "pointer", opacity: hover !== null && !isHover ? 0.55 : 1, transition: "opacity 0.2s" }}
        >
          {pct >= 8 && pct.toFixed(0) + "%"}
        </div>;
      })}
    </div>
    {hover !== null && <div style={{ marginTop: 8, padding: "8px 12px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--line)", fontSize: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 12, height: 12, borderRadius: 3, background: data[hover].color }} />
        <span style={{ fontWeight: 600 }}>{data[hover].label}</span>
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        <span style={{ color: "var(--dim)" }}>{(data[hover].value / total * 100).toFixed(1) + "%"}</span>
        <span style={{ fontWeight: 700, color: "var(--green)" }}>{"฿" + fmt(data[hover].value)}</span>
      </div>
    </div>}
  </div>;
}

// ─────────────────────── Compact Legend (shared) ───────────────────────
function Legend({ data, total, compact }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
    {data.map(it => {
      const pct = total > 0 ? (it.value / total * 100) : 0;
      return <div key={it.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: compact ? 11 : 12 }}>
        <span style={{ width: 10, height: 10, borderRadius: 2, background: it.color, flexShrink: 0 }} />
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text)" }}>{it.label}</span>
        <span style={{ color: "var(--dim)", fontSize: 11, minWidth: 38, textAlign: "right" }}>{pct.toFixed(1) + "%"}</span>
        <span style={{ fontWeight: 600, minWidth: 86, textAlign: "right" }}>{"฿" + fmt(it.value)}</span>
      </div>;
    })}
  </div>;
}

// ─────────────────────── Main ───────────────────────
export default function StockValueChart({ products, cats, cu }) {
  const [mode, setMode] = useState("category");
  const styleKey = cu?.id ? `dash_stock_chart_${cu.id}` : "dash_stock_chart";
  const [style, setStyle] = useState(() => {
    try { return localStorage.getItem(styleKey) || "donut"; } catch { return "donut"; }
  });
  useEffect(() => {
    try { localStorage.setItem(styleKey, style); } catch {}
  }, [style, styleKey]);

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
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", background: "var(--bg)", borderRadius: 8, padding: 2, gap: 2 }}>
          {STYLES.map(s => (
            <button key={s.id} onClick={() => setStyle(s.id)} title={s.name} style={{ padding: "5px 9px", borderRadius: 6, border: "none", background: style === s.id ? "var(--blue-bg)" : "transparent", color: style === s.id ? "var(--blue)" : "var(--dim)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 13 }}>{s.icon}</span>
              <span className="hide-sm">{s.name}</span>
            </button>
          ))}
        </div>
        <div style={{ display: "flex", background: "var(--bg)", borderRadius: 8, padding: 2, gap: 2 }}>
          <button onClick={() => setMode("category")} style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: mode === "category" ? "var(--blue-bg)" : "transparent", color: mode === "category" ? "var(--blue)" : "var(--dim)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>หมวด</button>
          <button onClick={() => setMode("brand")} style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: mode === "brand" ? "var(--blue-bg)" : "transparent", color: mode === "brand" ? "var(--blue)" : "var(--dim)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>ยี่ห้อ</button>
        </div>
      </div>
    </div>

    {style === "donut" && <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ position: "relative", flexShrink: 0, width: 180, height: 180 }}>
        <PolishedDonut data={withColor} />
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ fontSize: 11, color: "var(--dim)" }}>รวม</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--green)" }}>{"฿" + fmt(total)}</div>
          <div style={{ fontSize: 10, color: "var(--faint)", marginTop: 2 }}>{withColor.length + (mode === "category" ? " หมวด" : " ยี่ห้อ")}</div>
        </div>
      </div>
      <div style={{ flex: "1 1 240px", minWidth: 240 }}><Legend data={withColor} total={total} /></div>
    </div>}

    {style === "bars" && <HorizontalBars data={withColor} total={total} />}

    {style === "treemap" && <div>
      <Treemap data={withColor} />
      <div style={{ marginTop: 10, padding: "10px 12px", background: "var(--bg)", borderRadius: 8, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
        <span style={{ color: "var(--dim)" }}>รวม{mode === "category" ? "ทุกหมวด" : "ทุกยี่ห้อ"} ({withColor.length} รายการ)</span>
        <span style={{ fontWeight: 700, color: "var(--green)" }}>{"฿" + fmt(total)}</span>
      </div>
    </div>}

    {style === "stacked" && <div>
      <StackedBar data={withColor} total={total} />
      <div style={{ marginTop: 12 }}><Legend data={withColor} total={total} compact /></div>
    </div>}
  </div>;
}
