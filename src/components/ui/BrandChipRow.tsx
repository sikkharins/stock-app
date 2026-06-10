interface BrandChipRowProps {
  brands: string[];
  counts: Record<string, number>;
  value: string;
  onChange: (next: string) => void;
}

const hueFor = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
};

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
        const hue = hueFor(b);
        const accent = `hsl(${hue} 65% 50%)`;
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
              border: `1.5px solid ${active ? accent : "var(--line)"}`,
              background: active ? `hsl(${hue} 70% 50% / 0.12)` : "var(--panel)",
              color: active ? accent : "var(--text)",
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
                background: active ? `hsl(${hue} 70% 50% / 0.22)` : "var(--hover)",
                color: active ? accent : "var(--dim)",
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
