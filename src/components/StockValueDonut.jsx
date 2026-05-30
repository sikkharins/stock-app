import { useMemo, useState } from "react";
import { fmt } from "../utils/helpers.js";

const PALETTE = ["#0A84FF", "#34C759", "#FF9500", "#FF3B30", "#AF52DE", "#FFD60A", "#FF2D55", "#5AC8FA"];
const OTHER_COLOR = "#8E8E93";
const TOP_N = 7;

function computeBreakdown(products, getKeyLabel) {
  const map = {};
  (products || []).forEach(p => {
    const val = (p.stock || 0) * (p.cost || 0);
    if (val <= 0) return;
    const { key, label } = getKeyLabel(p);
    if (!map[key]) map[key] = { key, label, value: 0 };
    map[key].value += val;
  });
  const sorted = Object.values(map).sort((a, b) => b.value - a.value);
  const total = sorted.reduce((s, x) => s + x.value, 0);
  let baseItems;
  if (sorted.length <= TOP_N + 1) {
    baseItems = sorted;
  } else {
    const top = sorted.slice(0, TOP_N);
    const otherVal = sorted.slice(TOP_N).reduce((s, x) => s + x.value, 0);
    const otherCount = sorted.length - TOP_N;
    baseItems = [...top, { key: "_other", label: `อื่นๆ (${otherCount} รายการ)`, value: otherVal }];
  }
  const items = baseItems.map((it, i) => ({
    ...it,
    color: it.key === "_other" ? OTHER_COLOR : PALETTE[i % PALETTE.length],
  }));
  return { items, total };
}

function PolishedDonut({ data, prefix }) {
  const size = 170;
  const thickness = 26;
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
        <linearGradient key={i} id={`${prefix}-grad-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={d.color} stopOpacity={1} />
          <stop offset="100%" stopColor={d.color} stopOpacity={0.7} />
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
          stroke={`url(#${prefix}-grad-${i})`}
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

function Legend({ items, total }) {
  return <div style={{ flex: "1 1 180px", minWidth: 180, display: "flex", flexDirection: "column", gap: 5 }}>
    {items.map(it => {
      const pct = total > 0 ? (it.value / total * 100) : 0;
      return <div key={it.key} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11 }}>
        <span style={{ width: 9, height: 9, borderRadius: 2, background: it.color, flexShrink: 0 }} />
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text)" }}>{it.label}</span>
        <span style={{ color: "var(--dim)", fontSize: 10, minWidth: 34, textAlign: "right" }}>{pct.toFixed(1) + "%"}</span>
        <span style={{ fontWeight: 600, minWidth: 76, textAlign: "right", fontSize: 11 }}>{"฿" + fmt(it.value)}</span>
      </div>;
    })}
  </div>;
}

function DonutPanel({ title, unit, items, total, prefix }) {
  if (total === 0) return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", color: "var(--dim)", fontSize: 12 }}>ไม่มีข้อมูล{title}</div>;
  return <div style={{ flex: "1 1 320px", minWidth: 280 }}>
    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--dim)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</div>
    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ position: "relative", width: 170, height: 170, flexShrink: 0 }}>
        <PolishedDonut data={items} prefix={prefix} />
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ fontSize: 10, color: "var(--dim)" }}>รวม</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--green)" }}>{"฿" + fmt(total)}</div>
          <div style={{ fontSize: 10, color: "var(--faint)", marginTop: 2 }}>{items.length + " " + unit}</div>
        </div>
      </div>
      <Legend items={items} total={total} />
    </div>
  </div>;
}

export default function StockValueChart({ products, cats }) {
  const catData = useMemo(() => computeBreakdown(products, p => {
    const cat = (cats || []).find(c => c.id === p.categoryId);
    return cat ? { key: "c_" + cat.id, label: cat.name } : { key: "_none", label: "ไม่ระบุหมวด" };
  }), [products, cats]);

  const brandData = useMemo(() => computeBreakdown(products, p => {
    const brand = (p.brand || "").trim();
    return brand ? { key: brand, label: brand } : { key: "_none", label: "ไม่ระบุยี่ห้อ" };
  }), [products]);

  if (catData.total === 0 && brandData.total === 0) return null;

  return <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: "1rem", marginBottom: "1.5rem", boxShadow: "var(--shadow)" }}>
    <div style={{ fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
      <span style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(52,199,89,0.12)", color: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>$</span>
      <span>สัดส่วนมูลค่าสต็อก</span>
    </div>
    <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
      <DonutPanel title="ตามหมวด" unit="หมวด" items={catData.items} total={catData.total} prefix="cat" />
      <DonutPanel title="ตามยี่ห้อ" unit="ยี่ห้อ" items={brandData.items} total={brandData.total} prefix="brand" />
    </div>
  </div>;
}
