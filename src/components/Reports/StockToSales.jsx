import { useState, useMemo } from "react";
import { fmt } from "../../utils/helpers.js";
import { computeStockToSales, listPeriods, periodBounds } from "../../utils/stockToSalesRatio.ts";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell } from "recharts";

const COLORS = ["#34c759", "#007aff", "#ff9500", "#af52de", "#ff3b30", "#5ac8fa", "#ffcc00", "#ff2d55", "#64d2ff", "#30d158", "#bf5af2", "#ff6482"];
const TIP_STYLE = { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12, padding: "8px 12px" };
const UNIT = { month: "เดือน", quarter: "ไตรมาส", year: "ปี" };
const GRAN = [["month", "เดือน"], ["quarter", "ไตรมาส"], ["year", "ปี"]];
const r2 = (v) => (v == null || isNaN(v) ? "—" : v.toFixed(2));

const cardStyle = { background: "var(--panel)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "1rem", marginBottom: 16 };
const emptyBox = <div style={{ textAlign: "center", color: "var(--faint)", padding: "2rem", fontSize: 12 }}>ยังไม่มีข้อมูล</div>;

function RatioTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const items = payload.filter((p) => p.value != null);
  if (!items.length) return null;
  const single = items.length === 1 ? items[0].payload : null;
  return (
    <div style={TIP_STYLE}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {items.map((p) => (
        <div key={p.dataKey} style={{ color: p.color }}>{p.name + ": " + r2(p.value) + "x"}</div>
      ))}
      {single && single.avgStock != null && (
        <div style={{ borderTop: "1px solid var(--line)", marginTop: 4, paddingTop: 4, color: "var(--dim)" }}>
          {"สต็อกเฉลี่ย ฿" + fmt(single.avgStock) + " · ยอดขาย ฿" + fmt(single.sales)}
        </div>
      )}
    </div>
  );
}

export default function StockToSales({ products, sales, logs, cats }) {
  const [gran, setGran] = useState("month");
  const periods = useMemo(() => listPeriods(gran), [gran]);
  const defaultKey = periods[1] || periods[0];
  const [periodKey, setPeriodKey] = useState(defaultKey);
  const activeKey = periods.includes(periodKey) ? periodKey : defaultKey;

  const res = useMemo(
    () => computeStockToSales(products || [], logs || [], sales || [], cats || [], { granularity: gran, periodKey: activeKey }),
    [products, logs, sales, cats, gran, activeKey]
  );

  const changeGran = (g) => {
    setGran(g);
    const ps = listPeriods(g);
    setPeriodKey(ps[1] || ps[0]);
  };

  const singleChart = (title, data) => (
    <div style={cardStyle}>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>{title}</div>
      {data.length === 0 ? emptyBox : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--dim)" }} interval={0} angle={-25} textAnchor="end" height={64} />
            <YAxis tick={{ fontSize: 11, fill: "var(--dim)" }} tickFormatter={(v) => v.toFixed(1)} />
            <Tooltip content={<RatioTip />} cursor={{ fill: "var(--line)", opacity: 0.3 }} />
            {res.total.ratio != null && (
              <ReferenceLine y={res.total.ratio} stroke="var(--dim)" strokeDasharray="4 4"
                label={{ value: "รวม " + r2(res.total.ratio), fontSize: 10, fill: "var(--dim)", position: "right" }} />
            )}
            <Bar dataKey="ratio" name="อัตราส่วน" radius={[4, 4, 0, 0]}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );

  const cb = res.byCatBrand;
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
          {GRAN.map(([g, lbl]) => (
            <button key={g} onClick={() => changeGran(g)}
              style={{ padding: "7px 16px", fontSize: 13, border: "none", cursor: "pointer", fontFamily: "inherit",
                background: gran === g ? "var(--text)" : "transparent", color: gran === g ? "var(--panel)" : "var(--dim)", fontWeight: gran === g ? 600 : 400 }}>
              {lbl}
            </button>
          ))}
        </div>
        <select value={activeKey} onChange={(e) => setPeriodKey(e.target.value)}
          style={{ padding: "7px 12px", fontSize: 13, borderRadius: 8, border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text)", fontFamily: "inherit" }}>
          {periods.map((pk, i) => (
            <option key={pk} value={pk}>{periodBounds(gran, pk).label + (i === 0 ? " (ยังไม่จบ)" : "")}</option>
          ))}
        </select>
      </div>

      <div style={{ ...cardStyle, display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--dim)" }}>{"สต็อกเฉลี่ย ÷ ยอดขาย — รวมทั้งร้าน (" + res.period.label + ")"}</div>
          <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.1 }}>{r2(res.total.ratio) + (res.total.ratio != null ? "x" : "")}</div>
          {res.total.ratio != null && (
            <div style={{ fontSize: 12, color: "var(--dim)" }}>{"≈ ถือสต็อกพอขาย " + r2(res.total.ratio) + " " + UNIT[gran]}</div>
          )}
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right", fontSize: 13 }}>
          <div>{"สต็อกเฉลี่ย: ฿" + fmt(res.total.avgStock)}</div>
          <div style={{ color: "var(--dim)" }}>{"ยอดขาย: ฿" + fmt(res.total.sales)}</div>
        </div>
      </div>

      {singleChart("ตามยี่ห้อ", res.byBrand)}
      {singleChart("ตามหมวดสินค้า", res.byCat)}

      <div style={cardStyle}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>ตามหมวดสินค้า × ยี่ห้อ</div>
        {cb.rows.length === 0 ? emptyBox : (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={cb.rows} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
              <XAxis dataKey="category" tick={{ fontSize: 11, fill: "var(--dim)" }} interval={0} angle={-25} textAnchor="end" height={64} />
              <YAxis tick={{ fontSize: 11, fill: "var(--dim)" }} tickFormatter={(v) => v.toFixed(1)} />
              <Tooltip content={<RatioTip />} cursor={{ fill: "var(--line)", opacity: 0.3 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {cb.brands.map((b, i) => <Bar key={b} dataKey={b} name={b} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />)}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
