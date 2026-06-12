// NeonSparkline — เส้นแนวโน้มสำหรับ NeonGauge: cumsum รายวัน + area gradient + glow dot ปลาย
// (แยกจาก Sparkline.tsx เดิมที่ใช้ใน StatCard — API ต่างกัน)
export default function NeonSparkline({ data, color = "#5ed0ff", height = 40, uid = "sl" }) {
  if (!data || data.length < 2) return null;
  const W = 300;
  const max = Math.max(...data, 1);
  const pad = 2;
  const innerH = height - pad * 2;
  const dx = W / (data.length - 1);
  const points = data.map((v, i) => [i * dx, height - pad - (v / max) * innerH]);
  const linePath = "M " + points.map(p => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L ");
  const fillPath = linePath + " L " + W + " " + height + " L 0 " + height + " Z";
  const id = "sparkfill-" + uid;
  const last = points[points.length - 1];
  return <svg viewBox={"0 0 " + W + " " + height} width="100%" style={{ display: "block" }}>
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity="0.42" />
        <stop offset="100%" stopColor={color} stopOpacity="0" />
      </linearGradient>
    </defs>
    <path d={fillPath} fill={"url(#" + id + ")"} />
    <path d={linePath} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx={last[0]} cy={last[1]} r="2.5" fill={color} style={{ filter: "drop-shadow(0 0 4px " + color + ")" }} />
  </svg>;
}
