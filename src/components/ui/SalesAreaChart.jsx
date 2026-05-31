// SalesAreaChart.jsx — interactive sales / purchase chart (daily, weekly or monthly)
// Drop into: src/components/ui/SalesAreaChart.jsx
// Usage in Dashboard.jsx:
//   import SalesAreaChart from "./ui/SalesAreaChart.jsx";
//   <SalesAreaChart sales={sales} pos={pos} theme={theme} />

import { useState, useEffect, useRef, useMemo } from "react";

const TH_MONTH = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
const fmtFull = (n) => "฿" + Math.round(n).toLocaleString("en-US");
const fmtK = (n) => { n = Math.round(n); const a = Math.abs(n); if (a >= 1e6) return (n/1e6).toFixed(a>=1e7?1:2)+"M"; if (a >= 1e3) return Math.round(n/1e3)+"K"; return ""+n; };

const soTotal = (so) => (so.items || []).reduce((b, i) => b + (+i.qty||0) * (+i.price||0), 0);
const poTotal = (po) => (po.items || []).reduce((b, i) => b + (+i.qty||0) * (+i.cost||0), 0);
const dayKey = (d) => d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
const parseDate = (s) => { const [y,m,d] = (s||"").slice(0,10).split("-").map(Number); return (y&&m&&d) ? new Date(y, m-1, d) : null; };

function buildDays(sales, pos, n) {
  const out = [];
  const now = new Date(); now.setHours(0,0,0,0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i);
    const key = dayKey(d);
    const s = (sales || []).filter(x => (x.date||"").slice(0,10) === key).reduce((a, so) => a + soTotal(so), 0);
    const p = (pos || []).filter(x => (x.date||"").slice(0,10) === key && x.status !== "cancelled").reduce((a, po) => a + poTotal(po), 0);
    out.push({ label: d.getDate() + " " + TH_MONTH[d.getMonth()], sales: s, purchase: p });
  }
  return out;
}

function buildWeeks(sales, pos, n) {
  const out = [];
  const now = new Date(); now.setHours(0,0,0,0);
  const mondayOf = (d) => { const x = new Date(d); const wd = (x.getDay()+6)%7; x.setDate(x.getDate()-wd); return x; };
  const thisMon = mondayOf(now);
  for (let i = n - 1; i >= 0; i--) {
    const start = new Date(thisMon); start.setDate(thisMon.getDate() - i*7);
    const end = new Date(start); end.setDate(start.getDate() + 7);
    const inW = (s) => { const dt = parseDate(s); return dt && dt >= start && dt < end; };
    const sv = (sales || []).filter(x => inW(x.date)).reduce((a, so) => a + soTotal(so), 0);
    const pv = (pos || []).filter(x => inW(x.date) && x.status !== "cancelled").reduce((a, po) => a + poTotal(po), 0);
    out.push({ label: start.getDate() + " " + TH_MONTH[start.getMonth()], sales: sv, purchase: pv });
  }
  return out;
}

function buildMonths(sales, pos, n) {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    const s = (sales || []).filter(x => (x.date||"").slice(0,7) === key).reduce((a, so) => a + soTotal(so), 0);
    const p = (pos || []).filter(x => (x.date||"").slice(0,7) === key && x.status !== "cancelled").reduce((a, po) => a + poTotal(po), 0);
    out.push({ label: TH_MONTH[d.getMonth()] + " " + String(d.getFullYear() + 543).slice(2), sales: s, purchase: p });
  }
  return out;
}

function smoothPath(pts, yMin, yMax) {
  if (pts.length < 2) return pts.length ? `M ${pts[0][0]} ${pts[0][1]}` : "";
  const cl = (v) => (yMin == null ? v : Math.max(yMin, Math.min(yMax, v)));
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = cl(p1[1] + (p2[1] - p0[1]) / 6);
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = cl(p2[1] - (p3[1] - p1[1]) / 6);
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

const SERIES = [
  { key: "sales",    name: "ยอดขาย", light: "#0071e3", dark: "#0a84ff" },
  { key: "purchase", name: "ยอดซื้อ", light: "#86868b", dark: "#8a93a6" },
];

export default function SalesAreaChart({ sales, pos, days = 30, weeks = 12, months = 6, theme = "dark" }) {
  const [gran, setGran] = useState("month");
  const data = useMemo(
    () => gran === "day" ? buildDays(sales, pos, days)
        : gran === "week" ? buildWeeks(sales, pos, weeks)
        : buildMonths(sales, pos, months),
    [sales, pos, days, weeks, months, gran]
  );

  const [on, setOn] = useState({ sales: true, purchase: true });
  const [hover, setHover] = useState(null);
  const [prog, setProg] = useState(1);
  const wrapRef = useRef(null);
  const [w, setW] = useState(720);

  const H = 340, PAD = { l: 52, r: 18, t: 20, b: 34 };
  const innerW = w - PAD.l - PAD.r, innerH = H - PAD.t - PAD.b;

  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver((ents) => { for (const e of ents) setW(Math.max(300, e.contentRect.width)); });
    ro.observe(el); setW(Math.max(300, el.clientWidth));
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let raf, t0, done = false; const ease = t => 1 - Math.pow(1 - t, 3); setProg(0);
    const step = ts => { if (!t0) t0 = ts; const p = Math.min(1, (ts - t0) / 1000); setProg(ease(p)); if (p < 1) raf = requestAnimationFrame(step); else done = true; };
    raf = requestAnimationFrame(step);
    const fb = setTimeout(() => { if (!done) setProg(1); }, 1400);
    return () => { cancelAnimationFrame(raf); clearTimeout(fb); };
  }, [w, JSON.stringify(on), gran, data]);

  const C = theme === "light"
    ? { panel:"#ffffff", grad:"#f7f8fa", line:"#e5e7eb", line2:"#eef0f3", text:"#1d1d1f", dim:"#6e6e73", faint:"#9aa0a8", grid:"rgba(0,0,0,0.06)", tipBg:"rgba(255,255,255,0.92)", chip:"#f2f4f7", accent:"#0071e3", onAccent:"#ffffff", shadow:"0 1px 3px rgba(0,0,0,0.06),0 0 0 0.5px rgba(0,0,0,0.04)" }
    : { panel:"#141821", grad:"#0f1218", line:"#222835", line2:"#1a1f2a", text:"#eef1f6", dim:"#9aa3b2", faint:"#5e6677", grid:"rgba(255,255,255,0.05)", tipBg:"rgba(20,24,33,0.92)", chip:"#1a1f2a", accent:"#0a84ff", onAccent:"#04141c", shadow:"none" };
  const col = (s) => theme === "light" ? s.light : s.dark;

  const activeKeys = SERIES.filter(s => on[s.key]).map(s => s.key);
  const maxV = Math.max(1, ...data.flatMap(d => activeKeys.map(k => d[k])));
  const niceMax = Math.ceil(maxV / 1e5) * 1e5 || maxV;
  const x = (i) => PAD.l + (data.length === 1 ? innerW/2 : (i / (data.length - 1)) * innerW);
  const y = (v) => PAD.t + innerH - (v / niceMax) * innerH;

  const yTicks = 4;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => (niceMax / yTicks) * i);

  const seriesPaths = SERIES.filter(s => on[s.key]).map(s => {
    const pts = data.map((d, i) => [x(i), y(d[s.key])]);
    const line = smoothPath(pts, PAD.t, y(0));
    const area = line + ` L ${x(data.length-1)} ${y(0)} L ${x(0)} ${y(0)} Z`;
    return { ...s, line, area, pts };
  });

  const hv = hover != null ? data[hover] : null;
  const unitLabel = gran === "day" ? "วัน" : gran === "week" ? "สัปดาห์" : "เดือน";
  const labelEvery = data.length > 16 ? Math.ceil(data.length / 8) : data.length > 9 ? 2 : 1;

  return (
    <div ref={wrapRef} style={{ background:`linear-gradient(180deg,${C.panel},${C.grad})`, border:`1px solid ${C.line}`, borderRadius:18, padding:"20px 22px 16px", color:C.text, fontFamily:"'Inter','Noto Sans Thai',system-ui,sans-serif", boxShadow:C.shadow, position:"relative", overflow:"hidden" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:6, flexWrap:"wrap", rowGap:10 }}>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:15, fontWeight:700, letterSpacing:"-0.01em", whiteSpace:"nowrap" }}>ยอดขาย vs ยอดซื้อ</div>
          <div style={{ fontSize:12, color:C.dim, marginTop:2 }}>{data.length} {unitLabel}ล่าสุด · บาท</div>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:8, flexWrap:"wrap", justifyContent:"flex-end", alignItems:"center" }}>
          <div style={{ display:"flex", background:C.chip, border:`1px solid ${C.line}`, borderRadius:9, padding:3, position:"relative" }}>
            {[["day","รายวัน"],["week","รายอาทิตย์"],["month","รายเดือน"]].map(([k,lbl]) => {
              const active = gran === k;
              return (
              <button key={k+"-"+gran} onClick={() => setGran(k)}
                style={{ position:"relative", zIndex:1, padding:"5px 12px", border:0, borderRadius:7, cursor:"pointer", font:"inherit", fontSize:12, fontWeight:600, whiteSpace:"nowrap",
                  background: active ? C.accent : "transparent", color: active ? C.onAccent : C.dim }}>{lbl}</button>
              );
            })}
          </div>
          {SERIES.map(s => {
            const isOn = on[s.key];
            return (
              <button key={s.key} onClick={() => setOn(o => ({ ...o, [s.key]: !o[s.key] }))}
                style={{ display:"flex", alignItems:"center", gap:7, padding:"5px 11px", borderRadius:99, cursor:"pointer", font:"inherit", fontSize:12, fontWeight:600, whiteSpace:"nowrap",
                  border:`1px solid ${isOn ? col(s)+"55" : C.line}`, background:isOn ? col(s)+"1f" : "transparent", color:isOn ? col(s) : C.dim, transition:"all .18s" }}>
                <span style={{ width:9, height:9, borderRadius:3, background:isOn ? col(s) : C.faint, boxShadow:isOn ? `0 0 8px ${col(s)}` : "none" }}></span>
                {s.name}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ position:"relative", width:"100%" }}>
        <svg viewBox={`0 0 ${w} ${H}`} width="100%" height={H} style={{ display:"block", overflow:"visible" }}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const px = (e.clientX - r.left) / r.width * w;
            let best = 0, bd = Infinity;
            data.forEach((_, i) => { const d = Math.abs(x(i) - px); if (d < bd) { bd = d; best = i; } });
            setHover(best);
          }}>
          <defs>
            {SERIES.map(s => (
              <linearGradient key={s.key} id={"sac-"+s.key+"-"+theme} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={col(s)} stopOpacity={theme==="light"?0.28:0.42} />
                <stop offset="100%" stopColor={col(s)} stopOpacity="0" />
              </linearGradient>
            ))}
            <clipPath id={"sac-reveal-"+theme}>
              <rect x={PAD.l} y={0} width={innerW * prog} height={H} />
            </clipPath>
          </defs>

          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={PAD.l} y1={y(t)} x2={w - PAD.r} y2={y(t)} stroke={C.grid} strokeWidth="1" />
              <text x={PAD.l - 10} y={y(t) + 4} textAnchor="end" fontSize="11" fill={C.faint} style={{ fontVariantNumeric:"tabular-nums" }}>{t === 0 ? "0" : fmtK(t)}</text>
            </g>
          ))}

          <g clipPath={`url(#sac-reveal-${theme})`}>
            {seriesPaths.map(s => <path key={"a"+s.key} d={s.area} fill={`url(#sac-${s.key}-${theme})`} />)}
            {seriesPaths.map(s => <path key={"l"+s.key} d={s.line} fill="none" stroke={col(s)} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />)}
          </g>

          {data.map((d, i) => ((i % labelEvery === 0) || i === data.length-1) && (
            <text key={i} x={x(i)} y={H - 10} textAnchor="middle" fontSize="11" fontWeight={hover===i?700:500}
              fill={hover===i ? C.text : C.dim}>{d.label}</text>
          ))}

          {hv && prog >= 0.99 && (
            <g>
              <line x1={x(hover)} y1={PAD.t} x2={x(hover)} y2={PAD.t+innerH} stroke={C.dim} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
              {seriesPaths.map(s => (
                <g key={"d"+s.key}>
                  <circle cx={x(hover)} cy={y(hv[s.key])} r="6" fill={C.panel} stroke={col(s)} strokeWidth="2.5" />
                  <circle cx={x(hover)} cy={y(hv[s.key])} r="11" fill={col(s)} opacity="0.14" />
                </g>
              ))}
            </g>
          )}
        </svg>

        {hv && (
          <div style={{ position:"absolute", top:8,
            left: Math.min(Math.max(0, (x(hover)/w*100)), 100) + "%",
            transform:`translateX(${hover > data.length/2 ? "-110%" : "10%"})`,
            background:C.tipBg, border:`1px solid ${C.line}`, borderRadius:11, padding:"10px 13px", pointerEvents:"none",
            backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", boxShadow:"0 8px 28px rgba(0,0,0,0.18)", minWidth:150, zIndex:2 }}>
            <div style={{ fontSize:11.5, color:C.dim, fontWeight:600, marginBottom:7 }}>{hv.label}</div>
            {SERIES.filter(s => on[s.key]).map(s => (
              <div key={s.key} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12.5, padding:"2px 0" }}>
                <span style={{ width:8, height:8, borderRadius:2, background:col(s) }}></span>
                <span style={{ color:C.dim, flex:1 }}>{s.name}</span>
                <span style={{ fontWeight:700, fontVariantNumeric:"tabular-nums" }}>{fmtFull(hv[s.key])}</span>
              </div>
            ))}
            {on.sales && on.purchase && (
              <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, padding:"6px 0 0", marginTop:5, borderTop:`1px solid ${C.line}` }}>
                <span style={{ color:C.dim, flex:1 }}>ส่วนต่าง</span>
                <span style={{ fontWeight:700, color:theme==="light"?"#34c759":"#30d158" }}>{fmtFull(hv.sales - hv.purchase)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginTop:8, paddingTop:14, borderTop:`1px solid ${C.line}` }}>
        {(() => {
          const tot = data.reduce((a,d)=>({ s:a.s+d.sales, p:a.p+d.purchase }), {s:0,p:0});
          const diff = tot.s - tot.p;
          const last = data[data.length-1]?.sales||0, prev = data[data.length-2]?.sales||0;
          const chg = prev>0 ? ((last-prev)/prev*100) : 0;
          const chgLabel = gran === "day" ? "วันล่าสุด DoD" : gran === "week" ? "สัปดาห์ล่าสุด WoW" : "เดือนล่าสุด MoM";
          const cells = [
            { k:"ยอดขายรวม", v:fmtFull(tot.s), c:theme==="light"?"#0071e3":"#0a84ff" },
            { k:"ยอดซื้อรวม", v:fmtFull(tot.p) },
            { k:"ส่วนต่างรวม", v:fmtFull(diff), c:theme==="light"?"#34c759":"#30d158" },
            { k:chgLabel, v:(chg>=0?"↗ +":"↘ ")+chg.toFixed(1)+"%", c: chg>=0 ? (theme==="light"?"#34c759":"#30d158") : (theme==="light"?"#ff3b30":"#ff453a") },
          ];
          return cells.map(c => (
            <div key={c.k} style={{ flex:1, minWidth:130 }}>
              <div style={{ fontSize:11.5, color:C.dim }}>{c.k}</div>
              <div style={{ fontSize:18, fontWeight:700, letterSpacing:"-0.02em", marginTop:3, color:c.c||C.text, fontVariantNumeric:"tabular-nums" }}>{c.v}</div>
            </div>
          ));
        })()}
      </div>
    </div>
  );
}
