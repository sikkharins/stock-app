import { useMemo } from "react";
import { fmt } from "../../utils/helpers.js";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const TIP_STYLE = { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12 };
function BarTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const items = payload.filter(p => p.value > 0);
  if (!items.length) return null;
  const total = items.reduce((s, p) => s + p.value, 0);
  return <div style={{ ...TIP_STYLE, padding: "8px 12px" }}>
    <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
    {items.map(p => <div key={p.dataKey} style={{ color: p.color }}>
      {p.name + ": ฿" + fmt(p.value)}
    </div>)}
    {items.length > 1 && <div style={{ borderTop: "1px solid var(--line)", marginTop: 4, paddingTop: 4, fontWeight: 600 }}>{"รวม: ฿" + fmt(total)}</div>}
  </div>;
}
function PieTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return <div style={{ ...TIP_STYLE, padding: "8px 12px" }}>
    <div style={{ fontWeight: 600, marginBottom: 2 }}>{d.name}</div>
    <div>{"฿" + fmt(d.value) + " (" + d.payload.pct + "%)"}</div>
  </div>;
}

const COLORS = ["#34c759","#007aff","#ff9500","#af52de","#ff3b30","#5ac8fa","#ffcc00","#ff2d55","#64d2ff","#30d158","#bf5af2","#ff6482"];

function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, pct, name }) {
  if (pct < 5) return null;
  const RADIAN = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>{pct + "%"}</text>;
}

export default function RepOverview({ products, sales, pN, cats }) {
  const mL = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const getLast = n => { const r = []; const now = new Date(); for (let i = n - 1; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); r.push(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")); } return r; };
  const keys = getLast(6);

  const prodMap = useMemo(() => { const m = {}; products.forEach(p => m[p.id] = p); return m; }, [products]);
  const catMap = useMemo(() => { const m = {}; (cats || []).forEach(c => m[c.id] = c.name); return m; }, [cats]);

  const { barData, catKeys, byCat, byBrand } = useMemo(() => {
    const ranged = sales.filter(so => so.status !== "draft" && keys.some(k => (so.date || "").startsWith(k)));
    const catAcc = {}, brandAcc = {};
    ranged.forEach(so => so.items.forEach(i => {
      const pr = prodMap[i.productId];
      if (!pr) return;
      const amt = i.qty * i.price;
      const catName = catMap[pr.categoryId] || "ไม่ระบุ";
      catAcc[catName] = (catAcc[catName] || 0) + amt;
      const brand = pr.brand || "ไม่ระบุ";
      brandAcc[brand] = (brandAcc[brand] || 0) + amt;
    }));
    const catKeys = Object.entries(catAcc).sort((a, b) => b[1] - a[1]).map(([n]) => n);
    const barData = keys.map(k => {
      const row = { month: mL[+k.split("-")[1] - 1] + " " + k.slice(2) };
      catKeys.forEach(c => row[c] = 0);
      ranged.filter(x => (x.date || "").startsWith(k)).forEach(so => so.items.forEach(i => {
        const pr = prodMap[i.productId];
        if (!pr) return;
        const catName = catMap[pr.categoryId] || "ไม่ระบุ";
        row[catName] = (row[catName] || 0) + i.qty * i.price;
      }));
      return row;
    });
    const toArr = obj => {
      const total = Object.values(obj).reduce((s, v) => s + v, 0) || 1;
      return Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value, pct: Math.round(value / total * 100) }));
    };
    return { barData, catKeys, byCat: toArr(catAcc), byBrand: toArr(brandAcc) };
  }, [sales, prodMap, catMap, keys, mL]);

  const pieSection = (title, data) => <div style={{ flex: 1, minWidth: 280 }}>
    <div style={{ fontWeight: 500, fontSize: 13, color: "var(--dim)", marginBottom: 8, textAlign: "center" }}>{title}</div>
    {data.length === 0
      ? <div style={{ textAlign: "center", color: "var(--faint)", padding: "2rem", fontSize: 12 }}>ยังไม่มีข้อมูล</div>
      : <>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} labelLine={false} label={PieLabel}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip content={<PieTip />} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", justifyContent: "center", marginTop: 4 }}>
          {data.map((d, i) => <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
            <span style={{ color: "var(--dim)" }}>{d.name}</span>
            <span style={{ fontWeight: 600 }}>{"฿" + fmt(d.value)}</span>
          </div>)}
        </div>
      </>
    }
  </div>;

  return <div>
    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>รายงานรายเดือน</div>
    <div style={{ background: "var(--panel)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "1rem", marginBottom: 16 }}>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={barData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--dim)" }} />
          <YAxis tick={{ fontSize: 11, fill: "var(--dim)" }} tickFormatter={v => v >= 1000 ? Math.round(v / 1000) + "k" : v} />
          <Tooltip content={<BarTip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {catKeys.map((cat, i) => <Bar key={cat} dataKey={cat} stackId="cat" fill={COLORS[i % COLORS.length]} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>

    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>สัดส่วนยอดขาย</div>
    <div style={{ background: "var(--panel)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "1rem", display: "flex", flexWrap: "wrap", gap: 16 }}>
      {pieSection("แบ่งตามหมวดสินค้า", byCat)}
      {pieSection("แบ่งตามยี่ห้อ", byBrand)}
    </div>
  </div>;
}
