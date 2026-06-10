import type { ReactNode } from "react";
import Sparkline from "./Sparkline";
import { useCountUp } from "./useCountUp";

interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  color?: string;
  icon?: ReactNode;
  accentBg?: string;
  sparkline?: number[];
  delta?: { text: string; positive: boolean };
  /** When set, animates 0 → animatedValue on first mount. Ignores `value`. */
  animatedValue?: number;
  /** Formatter for the animated tick value (e.g. n => "฿" + fmt(Math.round(n))). */
  format?: (n: number) => ReactNode;
}

export default function StatCard({
  label,
  value,
  sub,
  color,
  icon,
  accentBg,
  sparkline,
  delta,
  animatedValue,
  format,
}: StatCardProps) {
  const animated = useCountUp(
    animatedValue ?? 0,
    1200,
    animatedValue === undefined
  );
  const displayValue =
    animatedValue !== undefined
      ? (format ? format(animated) : Math.round(animated))
      : value;
  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-card,12px)",
        padding: "18px 20px",
        boxShadow: "var(--shadow-card,var(--shadow))",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9, color: "var(--dim)", fontSize: 13 }}>
        {icon && (
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: accentBg || "var(--blue-bg)",
              color: color || "var(--blue)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
            }}
          >
            {icon}
          </span>
        )}
        <span>{label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, margin: "12px 0 4px" }}>
        <div
          className="num"
          style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.025em", color: color || "var(--text)", lineHeight: 1.1 }}
        >
          {displayValue}
        </div>
        {sparkline && sparkline.length > 0 && (
          <Sparkline points={sparkline} color={color || "var(--blue)"} />
        )}
      </div>
      {delta && (
        <div
          style={{
            display: "inline-block",
            fontSize: 11,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: "var(--radius-pill,999px)",
            background: delta.positive ? "rgba(52,199,89,0.14)" : "rgba(255,59,48,0.14)",
            color: delta.positive ? "var(--green)" : "var(--red)",
            marginTop: 2,
          }}
        >
          {delta.text}
        </div>
      )}
      {sub && <div style={{ fontSize: 13, color: "var(--dim)", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}
