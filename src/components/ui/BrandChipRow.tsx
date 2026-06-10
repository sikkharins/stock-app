import { brandColor } from "../../utils/brandColors";

interface BrandChipRowProps {
  brands: string[];
  counts: Record<string, number>;
  value: string;
  onChange: (next: string) => void;
}

export default function BrandChipRow({ brands, counts, value, onChange }: BrandChipRowProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        overflowX: "auto",
        scrollbarWidth: "thin",
        padding: "2px 0",
        flex: 1,
        minWidth: 0,
      }}
    >
      {brands.map((b) => {
        const active = value === b;
        const c = brandColor(b);
        return (
          <button
            key={b}
            onClick={() => onChange(active ? "" : b)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 12px",
              borderRadius: "var(--radius-pill, 999px)",
              border: `1.5px solid ${active ? c.base : "var(--line)"}`,
              background: active ? c.alpha(0.14) : "var(--panel)",
              color: active ? c.base : "var(--text)",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              flexShrink: 0,
              fontFamily: "inherit",
              transition: "background 120ms var(--ease-out, ease-out), border-color 120ms var(--ease-out, ease-out)",
            }}
          >
            <span>{b}</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "1px 6px",
                borderRadius: 999,
                background: active ? c.alpha(0.24) : "var(--hover)",
                color: active ? c.base : "var(--dim)",
              }}
            >
              {counts[b] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}
