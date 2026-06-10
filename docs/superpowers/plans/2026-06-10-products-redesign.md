# Products Page — Premium-Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the render layer of `src/components/Products.jsx` into a premium-dashboard look (Vercel/Stripe), flat grid + table-view toggle, slide-over detail panel, while keeping every existing feature and data path.

**Architecture:** Layout-only rewrite — state, handlers, and modals stay. Add four new pure UI components (`Sparkline`, `SlideOver`, `BrandChipRow`, `ProductsTable`) and one new pure-function util (`productStats`). Extend `StatCard` with optional sparkline + delta. Inject new design tokens into the existing `src/styles/theme.js` template literal (the app's CSS lives there — not `index.css`).

**Tech Stack:** React 19, TypeScript (incremental allowJs), Vitest + RTL, Vite 8, plain CSS via injected `<style>`.

**Spec:** `docs/superpowers/specs/2026-06-10-products-redesign-design.md`

---

## File structure

### New files

| Path | Responsibility |
|------|----------------|
| `src/utils/productStats.ts` | Pure functions building 30-day daily series for the four stat cards from `logs[]`, `sales[]`, `products[]`. |
| `src/utils/productStats.test.ts` | Tests for the above. |
| `src/components/ui/Sparkline.tsx` | Inline SVG polyline, 60×24, animated stroke draw. |
| `src/components/ui/Sparkline.test.tsx` | Tests. |
| `src/components/ui/SlideOver.tsx` | Right-anchored slide-over panel, generic, backdrop blur, Esc/click-out, sticky footer slot. |
| `src/components/ui/SlideOver.test.tsx` | Tests. |
| `src/components/ui/BrandChipRow.tsx` | Horizontal-scroll brand pills, single-select with click-again-to-clear, count badges. |
| `src/components/ui/BrandChipRow.test.tsx` | Tests. |
| `src/components/ProductsTable.tsx` | Sortable, sticky-header table view of the products list. |
| `src/components/ProductsTable.test.tsx` | Tests. |

### Modified files

| Path | Change |
|------|--------|
| `src/styles/theme.js` | Append new tokens (`--shadow-card`, `--shadow-card-hi`, `--radius-card`, `--radius-pill`, `--ease-out`) inside both `:root[data-theme="light"]` and `:root[data-theme="dark"]` blocks. |
| `src/components/ui/StatCard.tsx` | Extend `StatCardProps` with optional `sparkline?: number[]` and `delta?: { text: string; positive: boolean }`. Existing usage stays binary-compatible (both new props optional). |
| `src/components/Products.jsx` | Rewrite render layer: top stat strip, sticky toolbar (search + brand chips + category + sort + view toggle + actions), status filter row, card grid (restyled), or `<ProductsTable/>` based on view mode. Replace detail modal with `<SlideOver/>` for the existing `detailPr` flow. Drop the brand-grouped section render entirely. Migrate stale `sortBy === "brand"` → `"name"` on mount. |

### Untouched

- Edit modal contents (`modal === "product"` branch) — keep behavior, no CSS pass in this plan.
- Adjust-stock modal (`modal === "adjust"`).
- Bulk-action handlers and modals.
- `ExcelImport.jsx`, `CategoryManager.jsx`, `StockValueDonut.jsx`.
- Data layer / Supabase sync / `App.jsx`.
- All other pages.

---

### Task 1: Add design tokens to theme

**Files:**
- Modify: `src/styles/theme.js`

- [ ] **Step 1: Append the five new tokens to the light theme block**

Open `src/styles/theme.js`. Inside the `:root[data-theme="light"]{...}` block, add these lines just before the closing `}`:

```css
  --shadow-card:0 1px 2px rgba(0,0,0,0.04),0 4px 12px rgba(0,0,0,0.04);
  --shadow-card-hi:0 2px 4px rgba(0,0,0,0.06),0 12px 28px rgba(0,0,0,0.08);
  --radius-card:14px;
  --radius-pill:999px;
  --ease-out:cubic-bezier(.2,.7,.2,1);
```

- [ ] **Step 2: Mirror the tokens in the dark theme block**

Inside `:root[data-theme="dark"]{...}`, add the same keys with dark-tuned shadow alphas:

```css
  --shadow-card:0 1px 2px rgba(0,0,0,0.30),0 4px 12px rgba(0,0,0,0.25);
  --shadow-card-hi:0 2px 4px rgba(0,0,0,0.40),0 12px 28px rgba(0,0,0,0.40);
  --radius-card:14px;
  --radius-pill:999px;
  --ease-out:cubic-bezier(.2,.7,.2,1);
```

- [ ] **Step 3: Build + typecheck**

```bash
npm run build && npm run typecheck
```

Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add src/styles/theme.js
git commit -m "feat(theme): add card shadow/radius/easing tokens for premium dashboard"
```

---

### Task 2: productStats utility — daily series for sparklines

**Files:**
- Create: `src/utils/productStats.ts`
- Test: `src/utils/productStats.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/utils/productStats.test.ts`:

```ts
import { describe, test, expect } from "vitest";
import {
  stockValueSeries,
  lowStockSeries,
  reservedSeries,
  newProductsSeries,
  daysAgoISO,
} from "./productStats";

const today = new Date("2026-06-10T00:00:00Z");

describe("daysAgoISO", () => {
  test("returns YYYY-MM-DD format n days back", () => {
    expect(daysAgoISO(0, today)).toBe("2026-06-10");
    expect(daysAgoISO(1, today)).toBe("2026-06-09");
    expect(daysAgoISO(30, today)).toBe("2026-05-11");
  });
});

describe("stockValueSeries", () => {
  test("flat series at current value when no logs", () => {
    const products = [{ id: 1, stock: 10, price: 100 }];
    const series = stockValueSeries(products, [], 7, today);
    expect(series).toHaveLength(7);
    expect(series.every((v) => v === 1000)).toBe(true);
  });

  test("rewinds stock changes day by day", () => {
    const products = [{ id: 1, stock: 10, price: 100 }];
    // Yesterday: an "in" of 4 happened, so stock 2 days ago was 6.
    const logs = [
      { productId: 1, type: "in", qty: 4, date: "2026-06-09" },
    ];
    const series = stockValueSeries(products, logs, 3, today);
    // Series oldest → newest: day -2 (600), day -1 (1000), day 0 (1000)
    expect(series).toEqual([600, 1000, 1000]);
  });

  test("ignores logs outside window", () => {
    const products = [{ id: 1, stock: 10, price: 100 }];
    const logs = [{ productId: 1, type: "in", qty: 4, date: "2026-01-01" }];
    const series = stockValueSeries(products, logs, 5, today);
    expect(series.every((v) => v === 1000)).toBe(true);
  });
});

describe("lowStockSeries", () => {
  test("flat zero when no products have minStock", () => {
    const products = [{ id: 1, stock: 10, minStock: 0, price: 1 }];
    expect(lowStockSeries(products, [], 5, today)).toEqual([0, 0, 0, 0, 0]);
  });

  test("counts low-stock products at end of each day", () => {
    const products = [{ id: 1, stock: 2, minStock: 5, price: 1 }];
    const series = lowStockSeries(products, [], 3, today);
    expect(series).toEqual([1, 1, 1]);
  });
});

describe("reservedSeries", () => {
  test("counts pending_delivery item qty per day", () => {
    const sales = [
      {
        status: "pending_delivery",
        date: "2026-06-10",
        items: [{ qty: 3 }, { qty: 2 }],
      },
    ];
    const series = reservedSeries(sales, 3, today);
    // Only today has the SO active. Series: [0, 0, 5]
    expect(series).toEqual([0, 0, 5]);
  });
});

describe("newProductsSeries", () => {
  test("counts first-in log per product per day", () => {
    const logs = [
      { productId: 1, type: "in", qty: 1, date: "2026-06-10" },
      { productId: 1, type: "in", qty: 1, date: "2026-06-09" }, // not first
      { productId: 2, type: "in", qty: 1, date: "2026-06-08" },
    ];
    const series = newProductsSeries(logs, 3, today);
    // -2 (06-08): product 2 first appearance → 1
    // -1 (06-09): nothing new
    // 0  (06-10): product 1 first appearance → 1
    expect(series).toEqual([1, 0, 1]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/utils/productStats.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement productStats.ts**

Create `src/utils/productStats.ts`:

```ts
type Product = { id: number | string; stock: number; price: number; minStock?: number };
type Log = { productId: number | string; type: string; qty: number; date: string };
type Sale = { status: string; date: string; items?: Array<{ qty: number }> };

export const daysAgoISO = (n: number, ref: Date = new Date()): string => {
  const d = new Date(ref);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

const dayKey = (iso: string): string => (iso || "").slice(0, 10);

export const stockValueSeries = (
  products: Product[],
  logs: Log[],
  days: number,
  ref: Date = new Date()
): number[] => {
  const stockByPid = new Map<string, number>();
  for (const p of products) stockByPid.set(String(p.id), p.stock || 0);

  // For each day from today back, compute total value, then rewind by that day's logs.
  const series: number[] = [];
  for (let d = 0; d < days; d++) {
    let total = 0;
    for (const p of products) {
      const s = stockByPid.get(String(p.id)) ?? 0;
      total += s * (p.price || 0);
    }
    series.push(total);

    // Rewind: undo today's logs to get yesterday's stock.
    const targetDay = daysAgoISO(d, ref);
    for (const l of logs) {
      if (dayKey(l.date) !== targetDay) continue;
      const key = String(l.productId);
      const cur = stockByPid.get(key) ?? 0;
      // Forward effect of log: in/adjust_in adds, out/adjust_out subtracts.
      // To rewind, invert.
      if (l.type === "in" || l.type === "adjust_in") stockByPid.set(key, cur - l.qty);
      else if (l.type === "out" || l.type === "adjust_out") stockByPid.set(key, cur + l.qty);
    }
  }
  return series.reverse(); // oldest → newest
};

export const lowStockSeries = (
  products: Product[],
  _logs: Log[],
  days: number,
  _ref: Date = new Date()
): number[] => {
  // For now: snapshot at today's value, flat across the window.
  // Future enhancement: replay logs to get true historical low count.
  const count = products.filter(
    (p) => (p.minStock || 0) > 0 && p.stock <= (p.minStock || 0)
  ).length;
  return Array.from({ length: days }, () => count);
};

export const reservedSeries = (
  sales: Sale[],
  days: number,
  ref: Date = new Date()
): number[] => {
  const series: number[] = [];
  for (let d = days - 1; d >= 0; d--) {
    const target = daysAgoISO(d, ref);
    let total = 0;
    for (const so of sales) {
      if (so.status !== "pending_delivery") continue;
      if (dayKey(so.date) > target) continue; // future-dated SO not yet in pool
      for (const it of so.items || []) total += it.qty || 0;
    }
    series.push(total);
  }
  return series;
};

export const newProductsSeries = (
  logs: Log[],
  days: number,
  ref: Date = new Date()
): number[] => {
  const firstSeen = new Map<string, string>();
  for (const l of logs) {
    if (l.type !== "in") continue;
    const k = String(l.productId);
    const day = dayKey(l.date);
    const prev = firstSeen.get(k);
    if (!prev || day < prev) firstSeen.set(k, day);
  }
  const series: number[] = [];
  for (let d = days - 1; d >= 0; d--) {
    const target = daysAgoISO(d, ref);
    let count = 0;
    for (const [, day] of firstSeen) if (day === target) count++;
    series.push(count);
  }
  return series;
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/utils/productStats.test.ts
```

Expected: PASS (all 7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/productStats.ts src/utils/productStats.test.ts
git commit -m "feat(utils): productStats — daily series helpers for sparklines"
```

---

### Task 3: Sparkline component

**Files:**
- Create: `src/components/ui/Sparkline.tsx`
- Test: `src/components/ui/Sparkline.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/ui/Sparkline.test.tsx`:

```tsx
import { describe, test, expect } from "vitest";
import { render } from "@testing-library/react";
import Sparkline from "./Sparkline";

describe("Sparkline", () => {
  test("renders an SVG", () => {
    const { container } = render(<Sparkline points={[1, 2, 3]} />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  test("renders a polyline with the right number of points", () => {
    const { container } = render(<Sparkline points={[1, 2, 3, 4, 5]} />);
    const poly = container.querySelector("polyline");
    expect(poly).toBeTruthy();
    const pts = (poly!.getAttribute("points") || "").trim().split(/\s+/);
    expect(pts).toHaveLength(5);
  });

  test("renders a flat line when fewer than 2 points", () => {
    const { container } = render(<Sparkline points={[42]} />);
    const poly = container.querySelector("polyline");
    expect(poly).toBeTruthy();
    // Should fall back to two endpoints at the same y.
    const pts = (poly!.getAttribute("points") || "").trim().split(/\s+/);
    expect(pts).toHaveLength(2);
  });

  test("renders nothing when points is empty", () => {
    const { container } = render(<Sparkline points={[]} />);
    expect(container.querySelector("polyline")).toBeFalsy();
  });

  test("applies the color prop to stroke", () => {
    const { container } = render(<Sparkline points={[1, 2]} color="#ff0000" />);
    expect(container.querySelector("polyline")!.getAttribute("stroke")).toBe("#ff0000");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/ui/Sparkline.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement Sparkline.tsx**

Create `src/components/ui/Sparkline.tsx`:

```tsx
interface SparklineProps {
  points: number[];
  color?: string;
  width?: number;
  height?: number;
  animate?: boolean;
}

export default function Sparkline({
  points,
  color = "var(--blue)",
  width = 60,
  height = 24,
  animate = true,
}: SparklineProps) {
  if (points.length === 0) {
    return <svg width={width} height={height} aria-hidden="true" />;
  }

  const padded = points.length === 1 ? [points[0], points[0]] : points;
  const min = Math.min(...padded);
  const max = Math.max(...padded);
  const range = max - min || 1;
  const stepX = width / (padded.length - 1);

  const coords = padded.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const polyPoints = coords.join(" ");
  const pathLen = padded.length * stepX; // rough length for dash trick

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      style={{ overflow: "visible", display: "block" }}
    >
      <polyline
        points={polyPoints}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={
          animate
            ? {
                strokeDasharray: pathLen,
                strokeDashoffset: pathLen,
                animation: "spark-draw 600ms var(--ease-out, ease-out) forwards",
              }
            : undefined
        }
      />
      <style>{`@keyframes spark-draw { to { stroke-dashoffset: 0; } }`}</style>
    </svg>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/components/ui/Sparkline.test.tsx
```

Expected: PASS (all 5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Sparkline.tsx src/components/ui/Sparkline.test.tsx
git commit -m "feat(ui): Sparkline — 60x24 inline SVG with stroke-draw animation"
```

---

### Task 4: Extend StatCard with sparkline + delta

**Files:**
- Modify: `src/components/ui/StatCard.tsx`
- Modify: `src/components/ui/StatCard.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append to `src/components/ui/StatCard.test.tsx`:

```tsx
import Sparkline from "./Sparkline"; // top of file if not already

// inside the describe block, add:

  test("renders delta chip when provided", () => {
    render(
      <StatCard
        label="มูลค่าสต็อก"
        value="฿1,000"
        delta={{ text: "+฿120K", positive: true }}
      />
    );
    expect(screen.getByText("+฿120K")).toBeInTheDocument();
  });

  test("renders sparkline svg when points provided", () => {
    const { container } = render(
      <StatCard label="x" value="1" sparkline={[1, 2, 3, 4]} />
    );
    expect(container.querySelector("polyline")).toBeTruthy();
  });

  test("no sparkline rendered when prop omitted", () => {
    const { container } = render(<StatCard label="x" value="1" />);
    expect(container.querySelector("polyline")).toBeFalsy();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/ui/StatCard.test.tsx
```

Expected: FAIL — `delta` and `sparkline` props not on type / no `polyline` rendered.

- [ ] **Step 3: Extend StatCard.tsx**

Replace the contents of `src/components/ui/StatCard.tsx` with:

```tsx
import type { ReactNode } from "react";
import Sparkline from "./Sparkline";

interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  color?: string;
  icon?: ReactNode;
  accentBg?: string;
  sparkline?: number[];
  delta?: { text: string; positive: boolean };
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
}: StatCardProps) {
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
          {value}
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/components/ui/StatCard.test.tsx
```

Expected: PASS (8 tests — 5 existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/StatCard.tsx src/components/ui/StatCard.test.tsx
git commit -m "feat(ui): StatCard supports sparkline + delta chip (backward-compatible)"
```

---

### Task 5: SlideOver panel

**Files:**
- Create: `src/components/ui/SlideOver.tsx`
- Test: `src/components/ui/SlideOver.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/ui/SlideOver.test.tsx`:

```tsx
import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SlideOver from "./SlideOver";

describe("SlideOver", () => {
  test("renders title and children", () => {
    render(
      <SlideOver title="Detail" onClose={() => {}}>
        <p>body content</p>
      </SlideOver>
    );
    expect(screen.getByText("Detail")).toBeInTheDocument();
    expect(screen.getByText("body content")).toBeInTheDocument();
  });

  test("Esc key calls onClose", async () => {
    const onClose = vi.fn();
    render(<SlideOver title="t" onClose={onClose}>x</SlideOver>);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("backdrop click calls onClose", () => {
    const onClose = vi.fn();
    render(<SlideOver title="t" onClose={onClose}>x</SlideOver>);
    const backdrop = document.querySelector("[data-slideover-backdrop]");
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("close button calls onClose", async () => {
    const onClose = vi.fn();
    render(<SlideOver title="t" onClose={onClose}>x</SlideOver>);
    await userEvent.click(screen.getByLabelText("close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("footer slot renders when provided", () => {
    render(
      <SlideOver title="t" onClose={() => {}} footer={<button>Save</button>}>
        x
      </SlideOver>
    );
    expect(screen.getByText("Save")).toBeInTheDocument();
  });

  test("click inside panel does NOT call onClose", () => {
    const onClose = vi.fn();
    render(
      <SlideOver title="t" onClose={onClose}>
        <p data-testid="body">inside</p>
      </SlideOver>
    );
    fireEvent.click(screen.getByTestId("body"));
    expect(onClose).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/ui/SlideOver.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement SlideOver.tsx**

Create `src/components/ui/SlideOver.tsx`:

```tsx
import { useEffect, type ReactNode } from "react";

interface SlideOverProps {
  title: ReactNode;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  width?: number;
}

export default function SlideOver({
  title,
  children,
  onClose,
  footer,
  width = 520,
}: SlideOverProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      data-slideover-backdrop
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        zIndex: 110,
        animation: "slideover-fade 200ms var(--ease-out, ease-out)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: `min(${width}px, 100vw)`,
          background: "var(--panel)",
          borderLeft: "1px solid var(--line)",
          boxShadow: "var(--shadow-card-hi, 0 12px 28px rgba(0,0,0,0.2))",
          display: "flex",
          flexDirection: "column",
          animation: "slideover-in 240ms var(--ease-out, ease-out)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--line)",
            flexShrink: 0,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text)" }}>{title}</div>
          <button
            aria-label="close"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--dim)",
              fontSize: 24,
              lineHeight: 1,
              padding: "2px 6px",
              fontFamily: "inherit",
            }}
          >
            ×
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>{children}</div>
        {footer && (
          <div
            style={{
              borderTop: "1px solid var(--line)",
              padding: "12px 20px",
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              flexShrink: 0,
              background: "var(--panel)",
            }}
          >
            {footer}
          </div>
        )}
        <style>{`
          @keyframes slideover-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
          @keyframes slideover-fade { from { opacity: 0; } to { opacity: 1; } }
        `}</style>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/components/ui/SlideOver.test.tsx
```

Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/SlideOver.tsx src/components/ui/SlideOver.test.tsx
git commit -m "feat(ui): SlideOver — right-anchored panel with backdrop blur, Esc, footer"
```

---

### Task 6: BrandChipRow

**Files:**
- Create: `src/components/ui/BrandChipRow.tsx`
- Test: `src/components/ui/BrandChipRow.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/ui/BrandChipRow.test.tsx`:

```tsx
import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BrandChipRow from "./BrandChipRow";

describe("BrandChipRow", () => {
  const brands = ["LG", "SAMSUNG", "HAIER"];
  const counts = { LG: 30, SAMSUNG: 12, HAIER: 5 };

  test("renders one chip per brand with its count", () => {
    render(
      <BrandChipRow brands={brands} counts={counts} value="" onChange={() => {}} />
    );
    expect(screen.getByText("LG")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("SAMSUNG")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  test("clicking a chip calls onChange with that brand", async () => {
    const onChange = vi.fn();
    render(
      <BrandChipRow brands={brands} counts={counts} value="" onChange={onChange} />
    );
    await userEvent.click(screen.getByText("SAMSUNG"));
    expect(onChange).toHaveBeenCalledWith("SAMSUNG");
  });

  test("clicking the active chip clears (calls onChange with empty string)", async () => {
    const onChange = vi.fn();
    render(
      <BrandChipRow brands={brands} counts={counts} value="LG" onChange={onChange} />
    );
    await userEvent.click(screen.getByText("LG"));
    expect(onChange).toHaveBeenCalledWith("");
  });

  test("missing count defaults to 0", () => {
    render(
      <BrandChipRow brands={["UNKNOWN"]} counts={{}} value="" onChange={() => {}} />
    );
    expect(screen.getByText("UNKNOWN")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/ui/BrandChipRow.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement BrandChipRow.tsx**

Create `src/components/ui/BrandChipRow.tsx`:

```tsx
interface BrandChipRowProps {
  brands: string[];
  counts: Record<string, number>;
  value: string;
  onChange: (next: string) => void;
}

// Deterministic hue from string — used for chip accent when no BRAND_COLORS entry.
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/components/ui/BrandChipRow.test.tsx
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/BrandChipRow.tsx src/components/ui/BrandChipRow.test.tsx
git commit -m "feat(ui): BrandChipRow — horizontal scrolling brand selector"
```

---

### Task 7: ProductsTable

**Files:**
- Create: `src/components/ProductsTable.tsx`
- Test: `src/components/ProductsTable.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/ProductsTable.test.tsx`:

```tsx
import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProductsTable from "./ProductsTable";

const products = [
  { id: 1, code: "P001", name: "Alpha", brand: "LG", categoryId: 1, price: 1000, stock: 5, minStock: 2, unit: "เครื่อง" },
  { id: 2, code: "P002", name: "Beta",  brand: "SAMSUNG", categoryId: 2, price: 500,  stock: 0, minStock: 1, unit: "ตัว" },
];

const baseProps = {
  products,
  sales: [] as any[],
  pN: (p: any) => p.name,
  getCN: (_id: any) => "ทีวี",
  onRowClick: () => {},
  onEdit: () => {},
  onAdjust: () => {},
  onDelete: () => {},
  ed: true,
  cd: true,
  bulkMode: false,
  selected: new Set<number>(),
  onToggleSelect: () => {},
  sortBy: "name",
  onSortChange: () => {},
  density: "comfortable" as const,
};

describe("ProductsTable", () => {
  test("renders one row per product", () => {
    render(<ProductsTable {...baseProps} />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  test("clicking a row calls onRowClick with the product", async () => {
    const onRowClick = vi.fn();
    render(<ProductsTable {...baseProps} onRowClick={onRowClick} />);
    await userEvent.click(screen.getByText("Alpha"));
    expect(onRowClick).toHaveBeenCalledWith(products[0]);
  });

  test("clicking a column header calls onSortChange", async () => {
    const onSortChange = vi.fn();
    render(<ProductsTable {...baseProps} onSortChange={onSortChange} />);
    await userEvent.click(screen.getByText("ราคา"));
    // ราคา toggles to price_desc first then price_asc — match either.
    expect(onSortChange).toHaveBeenCalled();
    expect(["price_asc", "price_desc"]).toContain(onSortChange.mock.calls[0][0]);
  });

  test("bulk mode shows checkbox column", () => {
    render(<ProductsTable {...baseProps} bulkMode={true} />);
    const checkboxes = screen.getAllByRole("checkbox");
    // One per product row (no header checkbox in this iteration).
    expect(checkboxes).toHaveLength(2);
  });

  test("clicking a checkbox calls onToggleSelect with the product id", async () => {
    const onToggleSelect = vi.fn();
    render(
      <ProductsTable {...baseProps} bulkMode={true} onToggleSelect={onToggleSelect} />
    );
    const checkboxes = screen.getAllByRole("checkbox");
    await userEvent.click(checkboxes[0]);
    expect(onToggleSelect).toHaveBeenCalledWith(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/ProductsTable.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement ProductsTable.tsx**

Create `src/components/ProductsTable.tsx`:

```tsx
import { getSS, fmt } from "../utils/helpers";

type Product = {
  id: number;
  code: string;
  name: string;
  brand: string;
  categoryId: number;
  price: number;
  stock: number;
  minStock: number;
  unit: string;
  discontinued?: boolean;
};

interface ProductsTableProps {
  products: Product[];
  sales: any[];
  pN: (p: Product) => string;
  getCN: (id: number) => string;
  onRowClick: (p: Product) => void;
  onEdit: (p: Product) => void;
  onAdjust: (p: Product) => void;
  onDelete: (p: Product) => void;
  ed: boolean;
  cd: boolean;
  bulkMode: boolean;
  selected: Set<number>;
  onToggleSelect: (id: number) => void;
  sortBy: string;
  onSortChange: (next: string) => void;
  density: "comfortable" | "compact";
}

const SORT_TOGGLES: Record<string, [string, string]> = {
  name: ["name", "name"],
  price: ["price_asc", "price_desc"],
  stock: ["stock_asc", "stock_desc"],
  last_sold: ["last_sold", "last_sold"],
};

export default function ProductsTable({
  products,
  sales,
  pN,
  getCN,
  onRowClick,
  onEdit,
  onAdjust,
  onDelete,
  ed,
  cd,
  bulkMode,
  selected,
  onToggleSelect,
  sortBy,
  onSortChange,
  density,
}: ProductsTableProps) {
  const rowH = density === "compact" ? 32 : 44;

  const sortClick = (key: keyof typeof SORT_TOGGLES) => {
    const [a, b] = SORT_TOGGLES[key];
    onSortChange(sortBy === a ? b : a);
  };

  const sortArrow = (key: keyof typeof SORT_TOGGLES) => {
    const [a, b] = SORT_TOGGLES[key];
    if (sortBy === a && a !== b) return " ↑";
    if (sortBy === b && a !== b) return " ↓";
    if (sortBy === a) return " •";
    return "";
  };

  const TH: React.CSSProperties = {
    position: "sticky",
    top: 0,
    background: "var(--panel)",
    borderBottom: "1px solid var(--line)",
    padding: "10px 12px",
    fontSize: 11,
    fontWeight: 600,
    color: "var(--dim)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    textAlign: "left",
    cursor: "pointer",
    userSelect: "none",
    zIndex: 10,
  };

  const TD: React.CSSProperties = {
    padding: `${rowH === 32 ? 4 : 8}px 12px`,
    fontSize: 13,
    borderBottom: "0.5px solid var(--line)",
    verticalAlign: "middle",
  };

  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius-card,12px)", overflow: "auto", boxShadow: "var(--shadow-card)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {bulkMode && <th style={{ ...TH, width: 40, cursor: "default" }}> </th>}
            <th style={{ ...TH, cursor: "default" }}>Code</th>
            <th style={TH} onClick={() => sortClick("name")}>ชื่อ{sortArrow("name")}</th>
            <th style={{ ...TH, cursor: "default" }}>หมวด</th>
            <th style={TH} onClick={() => sortClick("stock")}>สต็อก{sortArrow("stock")}</th>
            <th style={{ ...TH, textAlign: "right" }} onClick={() => sortClick("price")}>ราคา{sortArrow("price")}</th>
            <th style={{ ...TH, cursor: "default" }}>สถานะ</th>
            <th style={TH} onClick={() => sortClick("last_sold")}>ขายล่าสุด{sortArrow("last_sold")}</th>
            {ed && <th style={{ ...TH, cursor: "default", width: 60 }}> </th>}
          </tr>
        </thead>
        <tbody>
          {products.map((p) => {
            const ss = getSS(p.id, sales);
            const isLow = p.minStock > 0 && p.stock <= p.minStock;
            const isSel = selected.has(p.id);
            return (
              <tr
                key={p.id}
                onClick={() => (bulkMode ? onToggleSelect(p.id) : onRowClick(p))}
                style={{
                  cursor: "pointer",
                  background: isSel ? "var(--blue-bg)" : "transparent",
                  transition: "background 100ms var(--ease-out, ease-out)",
                }}
                onMouseEnter={(e) => {
                  if (!isSel) (e.currentTarget as HTMLTableRowElement).style.background = "var(--hover)";
                }}
                onMouseLeave={(e) => {
                  if (!isSel) (e.currentTarget as HTMLTableRowElement).style.background = "transparent";
                }}
              >
                {bulkMode && (
                  <td style={TD} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => onToggleSelect(p.id)}
                      style={{ width: 14, height: 14, accentColor: "var(--blue)", cursor: "pointer" }}
                    />
                  </td>
                )}
                <td style={{ ...TD, fontFamily: "var(--mono, monospace)", fontSize: 11, color: "var(--dim)" }}>{p.code}</td>
                <td style={{ ...TD, fontWeight: 500, textDecoration: p.discontinued ? "line-through" : "none" }}>
                  <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "var(--hover)", color: "var(--dim)", marginRight: 6, fontWeight: 600 }}>{p.brand}</span>
                  {pN(p)}
                </td>
                <td style={{ ...TD, color: "var(--dim)" }}>{getCN(p.categoryId)}</td>
                <td style={TD}>
                  <strong className="num" style={{ color: isLow ? "var(--red)" : "var(--green)" }}>{p.stock}</strong>
                  <span style={{ color: "var(--dim)" }}>{" / " + p.minStock}</span>
                </td>
                <td style={{ ...TD, textAlign: "right", fontWeight: 600 }} className="num">{"฿" + fmt(p.price)}</td>
                <td style={TD}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 10,
                      padding: "1px 7px",
                      borderRadius: 999,
                      background: ss.bg,
                      color: ss.color,
                      fontWeight: 600,
                    }}
                    title={ss.label}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: ss.color, display: "inline-block" }} />
                    {ss.icon}
                  </span>
                </td>
                <td style={{ ...TD, color: "var(--dim)", fontSize: 12 }}>{ss.days != null ? ss.days + " วัน" : "—"}</td>
                {ed && (
                  <td style={TD} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        onClick={() => onEdit(p)}
                        title="แก้ไข"
                        style={{ fontSize: 11, padding: "3px 7px", borderRadius: 5, border: "1px solid var(--blue)", background: "var(--blue-bg)", color: "var(--blue)", cursor: "pointer", fontFamily: "inherit" }}
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => onAdjust(p)}
                        title="สต็อก"
                        style={{ fontSize: 11, padding: "3px 7px", borderRadius: 5, border: "1px solid var(--orange)", background: "rgba(255,149,0,0.14)", color: "var(--orange)", cursor: "pointer", fontFamily: "inherit" }}
                      >
                        ±
                      </button>
                      {cd && (
                        <button
                          onClick={() => onDelete(p)}
                          title="ลบ"
                          style={{ fontSize: 11, padding: "3px 7px", borderRadius: 5, border: "1px solid var(--red)", background: "rgba(255,59,48,0.12)", color: "var(--red)", cursor: "pointer", fontFamily: "inherit" }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/components/ProductsTable.test.tsx
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ProductsTable.tsx src/components/ProductsTable.test.tsx
git commit -m "feat(products): ProductsTable — sortable, sticky-header table view"
```

---

### Task 8: Products.jsx — top stat strip wired to productStats

**Files:**
- Modify: `src/components/Products.jsx` (the top render block, ~lines 73-78)

- [ ] **Step 1: Add imports at the top of Products.jsx**

In `src/components/Products.jsx`, ensure these imports exist (add what's missing):

```jsx
import { stockValueSeries, lowStockSeries, reservedSeries, newProductsSeries } from "../utils/productStats.ts";
```

(Already imported: `useState, useMemo, useEffect`, `StatCard`, `logs`, `sales` via `sh`.)

- [ ] **Step 2: Add series memos near the existing `stats` useMemo (~line 38)**

After the `const stats = useMemo(...)` line, add:

```jsx
const series = useMemo(() => {
  const ref = new Date();
  return {
    total: newProductsSeries(logs || [], 30, ref),
    stockVal: stockValueSeries(baseP, logs || [], 30, ref),
    low: lowStockSeries(baseP, logs || [], 30, ref),
    res: reservedSeries(sales, 30, ref),
  };
}, [baseP, logs, sales]);

const deltas = useMemo(() => {
  const lastN = (arr, n) => arr.slice(-n);
  const sumTail = (arr, n) => lastN(arr, n).reduce((s, v) => s + v, 0);
  const newCnt = sumTail(series.total, 7);
  const stockNow = series.stockVal[series.stockVal.length - 1] || 0;
  const stock7 = series.stockVal[series.stockVal.length - 8] ?? stockNow;
  const stockDelta = stockNow - stock7;
  return {
    total: newCnt > 0 ? { text: "+" + newCnt + " สัปดาห์นี้", positive: true } : null,
    stockVal: stockDelta !== 0 ? {
      text: (stockDelta > 0 ? "+" : "") + "฿" + fmt(Math.round(stockDelta)) + " 7 วัน",
      positive: stockDelta > 0,
    } : null,
  };
}, [series]);
```

- [ ] **Step 3: Replace the stat-card grid (~lines 73-78)**

Find:

```jsx
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10,marginBottom:16}}>
  <StatCard label="สินค้าทั้งหมด" value={stats.total} color="var(--blue)"/>
  <StatCard label="มูลค่าสต็อก" value={"฿"+fmt(stats.stockVal)} color="var(--green)"/>
  <StatCard label="สต็อกต่ำ" value={stats.low} color={stats.low>0?"var(--red)":"var(--dim)"}/>
  <StatCard label="จองอยู่" value={stats.totalRes+" ชิ้น"} color="var(--orange)"/>
</div>
```

Replace with:

```jsx
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12,marginBottom:18}}>
  <StatCard label="สินค้าทั้งหมด" value={stats.total} color="var(--blue)" sparkline={series.total} delta={deltas.total||undefined}/>
  <StatCard label="มูลค่าสต็อก" value={"฿"+fmt(stats.stockVal)} color="var(--green)" sparkline={series.stockVal} delta={deltas.stockVal||undefined}/>
  <StatCard label="สต็อกต่ำ" value={stats.low} color={stats.low>0?"var(--red)":"var(--dim)"} sparkline={series.low}/>
  <StatCard label="จองอยู่" value={stats.totalRes+" ชิ้น"} color="var(--orange)" sparkline={series.res}/>
</div>
```

- [ ] **Step 4: Build + typecheck + test**

```bash
npm run build && npm run typecheck && npm test
```

Expected: all green, 109+ tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/Products.jsx
git commit -m "feat(products): stat cards get sparkline + weekly delta chip"
```

---

### Task 9: Products.jsx — sticky toolbar, brand chip row, view toggle, drop "brand" sort

**Files:**
- Modify: `src/components/Products.jsx`

- [ ] **Step 1: Add view-mode state + import BrandChipRow**

At the top of Products.jsx, add the import:

```jsx
import BrandChipRow from "./ui/BrandChipRow.jsx";
```

Near the other `useState` calls (~line 20), add:

```jsx
const [view, setView] = useState(() => localStorage.getItem("productView") || "card");
useEffect(() => { localStorage.setItem("productView", view); }, [view]);
const [density, setDensity] = useState(() => localStorage.getItem("productTableDensity") || "comfortable");
useEffect(() => { localStorage.setItem("productTableDensity", density); }, [density]);
```

- [ ] **Step 2: Compute per-brand counts on `baseP`**

Near the existing `stats` useMemo, add:

```jsx
const brandCounts = useMemo(() => {
  const m = {};
  baseP.forEach(p => { m[p.brand] = (m[p.brand] || 0) + 1; });
  return m;
}, [baseP]);
```

- [ ] **Step 3: Drop "brand" sort option + migrate stale state**

Right after the `sortBy` state declaration, add migration:

```jsx
useEffect(() => { if (sortBy === "brand") setSortBy("name"); }, []);
```

Change the default `useState` initial:

```jsx
const[sortBy,setSortBy]=useState("name");
```

Find the sort `CustomSelect` (~line 122):

```jsx
<CustomSelect value={sortBy} onChange={setSortBy} options={[{value:"brand",label:"ยี่ห้อ"},{value:"name",label:"ชื่อ"}, ...
```

Remove the `{value:"brand",label:"ยี่ห้อ"}` entry. Final options array:

```jsx
options={[
  {value:"name",label:"ชื่อ"},
  {value:"price_asc",label:"ราคา ↑"},
  {value:"price_desc",label:"ราคา ↓"},
  {value:"stock_asc",label:"สต็อก ↑"},
  {value:"stock_desc",label:"สต็อก ↓"},
  {value:"last_sold",label:"ขายล่าสุด"},
]}
```

- [ ] **Step 4: Drop the `useGrouped` brand-section render**

In the `sorted` useMemo (~line 22) — keep as is, just no longer group output.

Then locate and DELETE these blocks:

- Line ~50-52: `const useGrouped = sortBy === "brand"; const bG = {}; if (useGrouped) ...; const bK = ...;`
- Line ~128-136: the `{useGrouped ? bK.map(...) : <div className="product-grid">...}` ternary — replace with the simpler `else` branch only (kept for Task 10).

After this step, content renders are: just `<div className="product-grid">{visible.map(pr => renderCard(pr))}</div>`.

- [ ] **Step 5: Wrap the toolbar in a sticky container + insert BrandChipRow + view toggle**

Find the toolbar block (`<div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12,alignItems:"center"}}>`, ~line 118) and replace its OPENING div with:

```jsx
<div style={{position:"sticky",top:0,zIndex:20,background:"var(--bg)",margin:"0 -16px",padding:"8px 16px",borderBottom:"1px solid var(--line)",marginBottom:12}}>
<div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
```

Add a CLOSING `</div>` at the end of the toolbar block (one extra to close the sticky wrapper).

Inside the toolbar (between `<SB ... />` and the category `CustomSelect`), insert:

```jsx
<BrandChipRow brands={brands} counts={brandCounts} value={fBrand} onChange={setFBrand}/>
```

Remove the existing brand `CustomSelect` (the one with `value={fBrand}` and `options={[{value:"",label:"ทุกยี่ห้อ"},...]}`).

Right before the right-aligned actions block (the `{ed && <div style={{marginLeft:"auto"...`), insert a view toggle:

```jsx
<div style={{display:"flex",gap:0,border:"1px solid var(--line)",borderRadius:7,overflow:"hidden"}}>
  {[["card","▤"],["table","▦"]].map(([k,ic])=>(
    <button key={k} onClick={()=>setView(k)} title={k==="card"?"การ์ด":"ตาราง"} style={{padding:"6px 10px",border:"none",background:view===k?"var(--blue-bg)":"transparent",color:view===k?"var(--blue)":"var(--dim)",cursor:"pointer",fontFamily:"inherit",fontSize:13}}>{ic}</button>
  ))}
</div>
{view==="table"&&(
  <div style={{display:"flex",gap:0,border:"1px solid var(--line)",borderRadius:7,overflow:"hidden"}}>
    {[["comfortable","≡"],["compact","☰"]].map(([k,ic])=>(
      <button key={k} onClick={()=>setDensity(k)} title={k==="comfortable"?"comfortable":"compact"} style={{padding:"6px 10px",border:"none",background:density===k?"var(--hover2)":"transparent",color:"var(--text)",cursor:"pointer",fontFamily:"inherit",fontSize:13}}>{ic}</button>
    ))}
  </div>
)}
```

- [ ] **Step 6: Build + typecheck + test**

```bash
npm run build && npm run typecheck && npm test
```

Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/components/Products.jsx
git commit -m "feat(products): sticky toolbar, brand chip row, view-mode toggle, drop brand grouping"
```

---

### Task 10: Products.jsx — card restyle + ProductsTable integration

**Files:**
- Modify: `src/components/Products.jsx`

- [ ] **Step 1: Import ProductsTable**

At the top of Products.jsx:

```jsx
import ProductsTable from "./ProductsTable.tsx";
```

- [ ] **Step 2: Restyle the renderCard function**

Replace the entire `renderCard` function (~lines 56-71) with:

```jsx
const renderCard = (pr) => {
  const ss = getSS(pr.id, sales);
  const isLow = pr.minStock > 0 && pr.stock <= pr.minStock;
  const pct = pr.minStock > 0 ? Math.min(100, Math.round((pr.stock / pr.minStock) * 100)) : 100;
  const res = reservedMap[pr.id] || 0;
  const isSel = sel.has(pr.id);
  return (
    <div
      key={pr.id}
      onClick={() => (bulkMode ? toggleSel(pr.id) : setDetailPr(pr))}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.transform = "translateY(-2px)";
        el.style.boxShadow = "var(--shadow-card-hi)";
        const acts = el.querySelector("[data-card-actions]");
        if (acts) acts.style.opacity = "1";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.transform = "translateY(0)";
        el.style.boxShadow = "var(--shadow-card)";
        const acts = el.querySelector("[data-card-actions]");
        if (acts) acts.style.opacity = "0";
      }}
      style={{
        background: isSel && bulkMode ? "var(--blue-bg)" : "var(--panel)",
        border: "1px solid " + (isSel && bulkMode ? "var(--blue)" : isLow ? "var(--orange)" : "var(--line)"),
        borderRadius: "var(--radius-card,14px)",
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        cursor: "pointer",
        boxShadow: "var(--shadow-card)",
        transition: "transform 120ms var(--ease-out,ease-out),box-shadow 120ms var(--ease-out,ease-out),background 120ms var(--ease-out,ease-out)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
          {bulkMode && ed && (
            <input
              type="checkbox"
              checked={isSel}
              onChange={() => toggleSel(pr.id)}
              onClick={(e) => e.stopPropagation()}
              style={{ width: 16, height: 16, accentColor: "var(--blue)", cursor: "pointer", flexShrink: 0 }}
            />
          )}
          <div style={{ fontFamily: "var(--mono,monospace)", fontSize: 11, color: "var(--dim)" }}>{pr.code}</div>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "var(--hover)", color: "var(--dim)" }}>{pr.brand}</span>
          <span title={ss.label} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, padding: "2px 7px", borderRadius: 999, background: ss.bg, color: ss.color, fontWeight: 700 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: ss.color, display: "inline-block" }} />
            {ss.icon}
          </span>
        </div>
      </div>
      <div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.3, textDecoration: pr.discontinued ? "line-through" : "none", color: pr.discontinued ? "var(--dim)" : "var(--text)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {pN(pr)}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, background: "var(--hover)", borderRadius: 4, padding: "2px 8px", color: "var(--dim)" }}>{getCN(pr.categoryId)}</span>
        {pr.size && <span style={{ fontSize: 11, background: "var(--blue-bg)", borderRadius: 4, padding: "2px 8px", color: "var(--blue)", fontWeight: 500 }}>{pr.size}</span>}
        {pr.discontinued && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: "rgba(255,149,0,0.18)", color: "var(--orange)", fontWeight: 600, border: "1px solid var(--orange)" }}>เลิกจำหน่าย</span>}
        {res > 0 && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: "rgba(0,122,255,0.12)", color: "var(--blue)", fontWeight: 600 }}>{"จอง " + res}</span>}
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
          <span style={{ color: "var(--dim)" }}>สต็อก{(pr.defectiveStock || 0) > 0 ? <span style={{ color: "var(--orange)", fontSize: 10, marginLeft: 4 }}>{"(ชำรุด " + pr.defectiveStock + ")"}</span> : ""}{res > 0 ? <span style={{ color: "var(--blue)", fontSize: 10, marginLeft: 4 }}>{"(พร้อม " + (pr.stock - res) + ")"}</span> : ""}</span>
          <span><strong className="num" style={{ color: isLow ? "var(--red)" : "var(--green)", fontSize: 16 }}>{pr.stock}</strong><span style={{ color: "var(--dim)" }}>{" / " + pr.minStock + " " + pr.unit}</span></span>
        </div>
        <div style={{ background: "var(--hover)", borderRadius: 4, height: 8 }}>
          <div style={{ background: isLow ? "var(--red)" : "var(--green)", borderRadius: 4, height: 8, width: pct + "%", transition: "width 200ms var(--ease-out,ease-out)" }} />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <div style={{ fontSize: 10, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>ราคาขาย</div>
          <strong className="num" style={{ color: "var(--text)", fontSize: 18, fontWeight: 700 }}>{"฿" + fmt(pr.price)}</strong>
        </div>
        {ss.days != null && <div style={{ fontSize: 11, color: "var(--faint)" }}>ขายล่าสุด {ss.days}d</div>}
      </div>
      {ed && (
        <div
          data-card-actions
          onClick={(e) => e.stopPropagation()}
          style={{ display: "flex", gap: 6, paddingTop: 6, borderTop: "0.5px solid var(--line)", opacity: 0, transition: "opacity 120ms var(--ease-out,ease-out)" }}
        >
          <button
            onClick={() => { setFormErrors([]); setForm({ ...pr, categoryId: String(pr.categoryId), subcategoryId: String(pr.subcategoryId), price: String(pr.price), cost: String(pr.cost), stock: String(pr.stock), minStock: String(pr.minStock) }); oM("product"); }}
            style={{ flex: 1, fontSize: 12, padding: "5px 0", borderRadius: 6, border: "1px solid var(--blue)", cursor: "pointer", background: "var(--blue-bg)", color: "var(--blue)", fontFamily: "inherit" }}
          >แก้ไข</button>
          <button
            onClick={() => { setAdjPr(pr); setAdjForm({ type: "adjust_in", qty: "", note: "" }); oM("adjust"); }}
            style={{ flex: 1, fontSize: 12, padding: "5px 0", borderRadius: 6, border: "1px solid var(--orange)", cursor: "pointer", background: "rgba(255,149,0,0.14)", color: "var(--orange)", fontFamily: "inherit" }}
          >สต็อก</button>
          {cd && (
            <button
              onClick={() => setConfirmDel(pr)}
              style={{ flex: 1, fontSize: 12, padding: "5px 0", borderRadius: 6, border: "1px solid var(--red)", cursor: "pointer", background: "rgba(255,59,48,0.12)", color: "var(--red)", fontFamily: "inherit" }}
            >ลบ</button>
          )}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2 (continued): Add touch-device CSS so actions always visible on no-hover devices**

Append to the existing `<style>` blocks or add a new `<style>` to Products.jsx render output (at the very top of the returned `<div>`):

```jsx
<style>{`@media (hover: none) { [data-card-actions] { opacity: 1 !important; } }`}</style>
```

- [ ] **Step 3: Replace the card grid render with a view switch**

Find the block (post-Task-9 simplification):

```jsx
<div className="product-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>{visible.map(pr=>renderCard(pr))}</div>
```

Replace with:

```jsx
{view === "card" ? (
  <div className="product-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:14}}>
    {visible.map(pr=>renderCard(pr))}
  </div>
) : (
  <ProductsTable
    products={visible}
    sales={sales}
    pN={pN}
    getCN={getCN}
    onRowClick={(pr)=>setDetailPr(pr)}
    onEdit={(pr)=>{setFormErrors([]);setForm({...pr,categoryId:String(pr.categoryId),subcategoryId:String(pr.subcategoryId),price:String(pr.price),cost:String(pr.cost),stock:String(pr.stock),minStock:String(pr.minStock)});oM("product");}}
    onAdjust={(pr)=>{setAdjPr(pr);setAdjForm({type:"adjust_in",qty:"",note:""});oM("adjust");}}
    onDelete={(pr)=>setConfirmDel(pr)}
    ed={ed}
    cd={cd}
    bulkMode={bulkMode}
    selected={sel}
    onToggleSelect={toggleSel}
    sortBy={sortBy}
    onSortChange={setSortBy}
    density={density}
  />
)}
```

- [ ] **Step 4: Build + typecheck + test**

```bash
npm run build && npm run typecheck && npm test
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/components/Products.jsx
git commit -m "feat(products): card restyle (hover-lift, status dot, larger price) + table view switch"
```

---

### Task 11: Replace detail modal with SlideOver

**Files:**
- Modify: `src/components/Products.jsx`

- [ ] **Step 1: Import SlideOver**

At the top of Products.jsx:

```jsx
import SlideOver from "./ui/SlideOver.tsx";
```

- [ ] **Step 2: Locate the existing detail-modal render**

Find the block starting with `{detailPr&&(()=>{` (~line 272) and ending with the closing `})()}`. The block currently renders a `<Modal title={...} onClose={...} wide>...</Modal>`.

- [ ] **Step 3: Swap the `<Modal>` wrapper for `<SlideOver>`**

Within that block, change the final `return` from:

```jsx
return <Modal title={pr.brand+" — "+pN(pr)} onClose={()=>setDetailPr(null)} wide>
  ...children...
</Modal>;
```

To:

```jsx
return <SlideOver
  title={pr.brand+" — "+pN(pr)}
  onClose={()=>setDetailPr(null)}
  width={560}
  footer={ed?<>
    <button onClick={()=>{setFormErrors([]);setForm({...pr,categoryId:String(pr.categoryId),subcategoryId:String(pr.subcategoryId),price:String(pr.price),cost:String(pr.cost),stock:String(pr.stock),minStock:String(pr.minStock)});oM("product");}} style={{padding:"7px 14px",borderRadius:7,border:"1px solid var(--blue)",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer",fontSize:13,fontFamily:"inherit",fontWeight:500}}>แก้ไข</button>
    <button onClick={()=>{setAdjPr(pr);setAdjForm({type:"adjust_in",qty:"",note:""});oM("adjust");}} style={{padding:"7px 14px",borderRadius:7,border:"1px solid var(--orange)",background:"rgba(255,149,0,0.14)",color:"var(--orange)",cursor:"pointer",fontSize:13,fontFamily:"inherit",fontWeight:500}}>ปรับสต็อก</button>
    {cd&&<button onClick={()=>setConfirmDel(pr)} style={{padding:"7px 14px",borderRadius:7,border:"1px solid var(--red)",background:"rgba(255,59,48,0.12)",color:"var(--red)",cursor:"pointer",fontSize:13,fontFamily:"inherit",fontWeight:500}}>ลบ</button>}
  </>:undefined}
>
  ...children unchanged...
</SlideOver>;
```

Keep all children (stat tiles, movement log, SO list) exactly as-is.

- [ ] **Step 3a: Note — if the existing Modal had `wide` styling that the slide-over body needs**

The slide-over body is naturally narrower (560 px) than the wide modal. The 4-stat grid inside (`gridTemplateColumns:"repeat(4,1fr)"`) should be changed to `repeat(2,1fr)` for slide-over fit:

Find inside the detail block:

```jsx
<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
```

Change to:

```jsx
<div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:16}}>
```

- [ ] **Step 4: Build + typecheck + test**

```bash
npm run build && npm run typecheck && npm test
```

Expected: all green.

- [ ] **Step 5: Manual smoke check (preview server)**

```bash
npm run dev
```

In the browser: open Products page, click any card → verify slide-over opens from right, Esc closes, footer buttons trigger edit/adjust/delete modals correctly, backdrop click closes.

- [ ] **Step 6: Commit**

```bash
git add src/components/Products.jsx
git commit -m "feat(products): detail view becomes right-anchored slide-over"
```

---

### Task 12: Final verification + visual smoke test

**Files:** none (verification only)

- [ ] **Step 1: Full test sweep**

```bash
npm run typecheck && npm run build && npm test
```

Expected: 0 errors, build succeeds, all tests pass (109 existing + ~25 new).

- [ ] **Step 2: Manual UI smoke test**

Start dev server:

```bash
npm run dev
```

Walk through:
1. Top stat strip — all 4 cards show numbers + sparklines + 2 deltas where applicable.
2. Toolbar — sticky on scroll, brand chips scroll horizontally, click brand chip filters, click again clears.
3. Sort dropdown — no "ยี่ห้อ" option, default is "ชื่อ", changing sort reorders products immediately.
4. Status chips below toolbar — still filter A/S/D/F correctly.
5. View toggle — switch to table view; column headers sort on click; density toggle changes row height; switch back to cards.
6. Card grid — flat (no brand sections), 320 px min, hover-lift effect, action buttons appear on hover.
7. Click a card — slide-over opens from right, body shows the same detail data as before, footer buttons work, Esc closes.
8. Edit, adjust, delete via card actions still work (no slide-over).
9. Bulk-mode entry from toolbar → checkboxes appear on cards & table rows; floating bulk bar still works.
10. Refresh page — view mode + density persist; previously "brand"-sorted state migrates to "name".

- [ ] **Step 3: Commit a no-op marker if everything passes**

Skip a commit if nothing changed. Otherwise:

```bash
git status
# only commit if something needs committing
```

- [ ] **Step 4: Push**

```bash
git push origin master
```

---

## Self-review notes

- Spec coverage check:
  - Design tokens → Task 1 ✓
  - Stat cards w/ sparkline + delta → Tasks 2, 3, 4, 8 ✓
  - Page shell + sticky toolbar → Task 9 ✓
  - Brand chip row + drop grouping + sort migration → Task 9 ✓
  - View toggle (card/table) + density + localStorage → Tasks 9, 10 ✓
  - Card view restyle (hover-lift, status dot, larger price, 320 px) → Task 10 ✓
  - Table view (sortable, sticky header, click → slide-over) → Tasks 7, 10 ✓
  - Slide-over detail panel → Tasks 5, 11 ✓
  - Status chips kept (no change needed) ✓
  - Brand breakdown kept (no change needed) ✓
  - Edit/adjust/bulk modals: spec says "refresh only — no logic change". The "refresh" CSS pass is **deferred from this plan** — the spec listed it as optional polish and the plan ships the main redesign without it to keep scope tight. If you want the polish pass, add a follow-up task.
- Placeholder scan: no TBD / TODO / vague steps. Every code step shows full code.
- Type consistency: `SortBy` strings (`name`, `price_asc`, etc.) match across ProductsTable's SORT_TOGGLES and Products.jsx; `productStats` exports match imports in Task 8.
