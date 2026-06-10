# Customers Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the customers view of `Contacts.jsx` to match the Products page's "premium dashboard" feel, with health-led stat strip, dense business-signal cards, sortable table view, and a hybrid SlideOver/Modal detail panel.

**Architecture:** Customer-tailored mirror of the Products page (spec approach B). Render-layer rewrite of the `isC` branch of `Contacts.jsx`; supplier path untouched. Reuses `StatCard / Sparkline / SlideOver / useCountUp / BrandChipRow`; adds three new files (`customerStats.js`, `useMediaQuery.ts`, `CustomersTable.jsx`); reflows `CustomerProfile.jsx` for 520px width and adds a hybrid wrapper.

**Tech Stack:** React 19, Vite 8, TypeScript (incremental, allowJs), Vitest + React Testing Library, Supabase + localStorage cache (untouched here).

**Spec:** [docs/superpowers/specs/2026-06-10-customers-redesign-design.md](../specs/2026-06-10-customers-redesign-design.md) (commit `0e6c836`).

---

## File map (decomposition lock-in)

**Create:**
- `src/utils/customerStats.js` — 8 pure helpers + `salesByCustomerId` memo helper
- `src/utils/customerStats.test.js` — Vitest unit tests with injected `today`
- `src/utils/useMediaQuery.ts` — `matchMedia.change` hook, SSR-safe
- `src/utils/useMediaQuery.test.tsx` — RTL test exercising matchMedia mock
- `src/components/CustomersTable.jsx` — sortable sticky-header table (mirrors `ProductsTable`)
- `src/components/CustomersTable.test.jsx`

**Modify:**
- `src/components/Contacts.jsx` — render-layer rewrite of `isC` branch only. Lines 105–157 are the rewrite zone. Supplier branch (`!isC`) byte-for-byte unchanged.
- `src/components/CustomerProfile.jsx` — wrap in hybrid `<SlideOver>` / `<Modal>` shell, reflow header to 2×2 stat grid, collapse VAT reps, trim SO/AR tables to 4 cols, narrow Summary tab.

**Not touched:**
`SupplierProfile.jsx`, `Contacts.jsx` form modal (lines 164–282), `ContactExcelImport.jsx`, `App.jsx`, `StatCard.tsx`, `Sparkline.tsx`, `SlideOver.tsx`, `useCountUp.ts`, `BrandChipRow.tsx`, `brandColors.ts`.

---

## Task 1: `customerStats.js` helpers (TDD)

**Files:**
- Create: `src/utils/customerStats.js`
- Create: `src/utils/customerStats.test.js`

- [ ] **Step 1: Write the failing test file**

```js
// src/utils/customerStats.test.js
import { describe, test, expect } from "vitest";
import {
  salesByCustomerId,
  lifetimeValue,
  revenueTrend,
  lastPurchaseDays,
  outstandingDetail,
  arStatus,
  topProduct,
  avgPerSO,
  daysAgo,
} from "./customerStats";

const TODAY = new Date("2026-06-10T00:00:00Z");
const iso = (n) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

// soNet matches CustomerProfile.jsx logic: items.qty*price - discountAmt
const so = (overrides) => ({
  id: 1,
  customerId: 1,
  soNum: "SO-001",
  date: iso(5),
  status: "completed",
  items: [{ productId: 10, qty: 1, price: 1000 }],
  discountAmt: 0,
  payType: "cash",
  creditDays: 0,
  ...overrides,
});

describe("salesByCustomerId", () => {
  test("groups SOs by customerId", () => {
    const sales = [so({ customerId: 1 }), so({ customerId: 2 }), so({ customerId: 1 })];
    const map = salesByCustomerId(sales);
    expect(map[1]).toHaveLength(2);
    expect(map[2]).toHaveLength(1);
  });
  test("empty input returns empty object", () => {
    expect(salesByCustomerId([])).toEqual({});
  });
});

describe("lifetimeValue", () => {
  test("sums soNet across all SOs regardless of status", () => {
    const sales = [
      so({ items: [{ qty: 2, price: 100 }] }),
      so({ items: [{ qty: 1, price: 50 }], status: "cancelled" }),
      so({ items: [{ qty: 3, price: 100 }], discountAmt: 50 }),
    ];
    expect(lifetimeValue({ id: 1 }, sales)).toBe(200 + 50 + 250);
  });
  test("no sales returns 0", () => {
    expect(lifetimeValue({ id: 1 }, [])).toBe(0);
  });
});

describe("revenueTrend", () => {
  test("computes last30 and prev30 deltaPct", () => {
    const sales = [
      so({ date: iso(5), items: [{ qty: 1, price: 1000 }] }),
      so({ date: iso(25), items: [{ qty: 1, price: 500 }] }),
      so({ date: iso(40), items: [{ qty: 1, price: 500 }] }),
    ];
    const t = revenueTrend({ id: 1 }, sales, TODAY);
    expect(t.last30).toBe(1500);
    expect(t.prev30).toBe(500);
    expect(t.deltaPct).toBe(200);
  });
  test("prev30 = 0 → deltaPct = 0 (avoid /0)", () => {
    const sales = [so({ date: iso(5), items: [{ qty: 1, price: 1000 }] })];
    expect(revenueTrend({ id: 1 }, sales, TODAY).deltaPct).toBe(0);
  });
  test("no sales returns zeroes", () => {
    expect(revenueTrend({ id: 1 }, [], TODAY)).toEqual({ last30: 0, prev30: 0, deltaPct: 0 });
  });
});

describe("lastPurchaseDays", () => {
  test("days between today and most recent sale date", () => {
    const sales = [so({ date: iso(12) }), so({ date: iso(30) })];
    expect(lastPurchaseDays({ id: 1 }, sales, TODAY)).toBe(12);
  });
  test("no sales returns null", () => {
    expect(lastPurchaseDays({ id: 1 }, [], TODAY)).toBeNull();
  });
});

describe("outstandingDetail", () => {
  test("sums remaining and counts overdue", () => {
    const sales = [
      so({ soNum: "S1", date: iso(60), status: "completed", payType: "credit", creditDays: 45, items: [{ qty: 1, price: 1000 }] }),
      so({ soNum: "S2", date: iso(10), status: "completed", payType: "credit", creditDays: 45, items: [{ qty: 1, price: 500 }] }),
    ];
    const payments = [{ refId: "S1", type: "ar", amount: 200 }];
    const r = outstandingDetail({ id: 1 }, sales, payments);
    expect(r.total).toBe(800 + 500);
    expect(r.count).toBe(2);
    expect(r.overdueCount).toBe(1); // S1 is 60d old, 45d credit → 15d overdue
  });
  test("ignores non-completed SOs", () => {
    const sales = [so({ status: "pending_delivery", items: [{ qty: 1, price: 100 }] })];
    expect(outstandingDetail({ id: 1 }, sales, [])).toEqual({ total: 0, count: 0, overdueCount: 0 });
  });
});

describe("arStatus", () => {
  test("overdue when any overdue SO", () => {
    const sales = [so({ soNum: "S1", date: iso(60), status: "completed", payType: "credit", creditDays: 45, items: [{ qty: 1, price: 1000 }] })];
    expect(arStatus({ id: 1 }, sales, [], TODAY)).toBe("overdue");
  });
  test("ar when outstanding > 0 but no overdue", () => {
    const sales = [so({ soNum: "S1", date: iso(10), status: "completed", payType: "credit", creditDays: 45, items: [{ qty: 1, price: 1000 }] })];
    expect(arStatus({ id: 1 }, sales, [], TODAY)).toBe("ar");
  });
  test("dormant when last purchase > 60d ago and outstanding = 0", () => {
    const sales = [so({ date: iso(90), status: "completed", items: [{ qty: 1, price: 100 }] })];
    const payments = [{ refId: "SO-001", type: "ar", amount: 100 }];
    expect(arStatus({ id: 1 }, sales, payments, TODAY)).toBe("dormant");
  });
  test("normal when recent + no outstanding", () => {
    const sales = [so({ date: iso(5), status: "completed", items: [{ qty: 1, price: 100 }] })];
    const payments = [{ refId: "SO-001", type: "ar", amount: 100 }];
    expect(arStatus({ id: 1 }, sales, payments, TODAY)).toBe("normal");
  });
  test("normal when no sales ever (do not flag empty as dormant)", () => {
    expect(arStatus({ id: 1 }, [], [], TODAY)).toBe("normal");
  });
});

describe("topProduct", () => {
  test("returns highest-qty product across history", () => {
    const sales = [
      so({ items: [{ productId: 10, qty: 5, price: 100 }, { productId: 20, qty: 1, price: 100 }] }),
      so({ items: [{ productId: 20, qty: 3, price: 100 }] }),
    ];
    const products = [{ id: 10, name: "A" }, { id: 20, name: "B" }];
    expect(topProduct({ id: 1 }, sales, products)).toEqual({ name: "A", qty: 5 });
  });
  test("returns null when no sales", () => {
    expect(topProduct({ id: 1 }, [], [])).toBeNull();
  });
});

describe("avgPerSO", () => {
  test("lifetime / count", () => {
    const sales = [
      so({ items: [{ qty: 1, price: 100 }] }),
      so({ items: [{ qty: 1, price: 300 }] }),
    ];
    expect(avgPerSO({ id: 1 }, sales)).toBe(200);
  });
  test("no sales returns 0", () => {
    expect(avgPerSO({ id: 1 }, [])).toBe(0);
  });
});

describe("daysAgo", () => {
  test("returns whole days between today and dateISO", () => {
    expect(daysAgo(iso(5), TODAY)).toBe(5);
    expect(daysAgo(iso(0), TODAY)).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails (module not found)**

Run: `npm test -- customerStats`
Expected: FAIL — `Cannot find module './customerStats'`.

- [ ] **Step 3: Implement the helpers**

```js
// src/utils/customerStats.js

const soNet = (so) =>
  (so.items || []).reduce((s, i) => s + (i.qty || 0) * (i.price || 0), 0) -
  (so.discountAmt || 0);

const paidFor = (soNum, payments) =>
  (payments || [])
    .filter((p) => p.refId === soNum && p.type === "ar")
    .reduce((s, p) => s + (+p.amount || 0), 0);

const MS_PER_DAY = 86_400_000;

export const daysAgo = (dateISO, today = new Date()) => {
  if (!dateISO) return null;
  const d = new Date(dateISO + "T00:00:00Z");
  const t = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );
  return Math.floor((t.getTime() - d.getTime()) / MS_PER_DAY);
};

export function salesByCustomerId(sales) {
  const map = {};
  for (const s of sales || []) {
    if (s == null || s.customerId == null) continue;
    (map[s.customerId] ||= []).push(s);
  }
  return map;
}

export function lifetimeValue(customer, sales) {
  return (sales || [])
    .filter((s) => s.customerId === customer.id)
    .reduce((s, so) => s + soNet(so), 0);
}

export function revenueTrend(customer, sales, today = new Date()) {
  let last30 = 0;
  let prev30 = 0;
  const cutoff30 = new Date(today.getTime() - 30 * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
  const cutoff60 = new Date(today.getTime() - 60 * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
  for (const so of sales || []) {
    if (so.customerId !== customer.id || !so.date) continue;
    if (so.date >= cutoff30) last30 += soNet(so);
    else if (so.date >= cutoff60) prev30 += soNet(so);
  }
  const deltaPct = prev30 > 0 ? Math.round(((last30 - prev30) / prev30) * 100) : 0;
  return { last30, prev30, deltaPct };
}

export function lastPurchaseDays(customer, sales, today = new Date()) {
  let latest = null;
  for (const so of sales || []) {
    if (so.customerId !== customer.id || !so.date) continue;
    if (!latest || so.date > latest) latest = so.date;
  }
  return latest ? daysAgo(latest, today) : null;
}

export function outstandingDetail(customer, sales, payments, today = new Date()) {
  let total = 0;
  let count = 0;
  let overdueCount = 0;
  for (const so of sales || []) {
    if (so.customerId !== customer.id || so.status !== "completed") continue;
    const rem = soNet(so) - paidFor(so.soNum, payments);
    if (rem <= 0) continue;
    total += rem;
    count += 1;
    if (so.payType === "credit" && so.creditDays && so.date) {
      const due = new Date(so.date + "T00:00:00Z");
      due.setUTCDate(due.getUTCDate() + so.creditDays);
      if (today.getTime() > due.getTime()) overdueCount += 1;
    }
  }
  return { total, count, overdueCount };
}

export function arStatus(customer, sales, payments, today = new Date()) {
  const od = outstandingDetail(customer, sales, payments, today);
  if (od.overdueCount > 0) return "overdue";
  if (od.total > 0) return "ar";
  const lpd = lastPurchaseDays(customer, sales, today);
  if (lpd !== null && lpd > 60) return "dormant";
  return "normal";
}

export function topProduct(customer, sales, products) {
  const qtyByProd = {};
  for (const so of sales || []) {
    if (so.customerId !== customer.id) continue;
    for (const i of so.items || []) {
      qtyByProd[i.productId] = (qtyByProd[i.productId] || 0) + (i.qty || 0);
    }
  }
  const entries = Object.entries(qtyByProd);
  if (entries.length === 0) return null;
  const [pid, qty] = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  const prod = (products || []).find((p) => p.id === +pid);
  return { name: prod ? prod.name : "—", qty };
}

export function avgPerSO(customer, sales) {
  const mine = (sales || []).filter((s) => s.customerId === customer.id);
  if (mine.length === 0) return 0;
  return Math.round(mine.reduce((s, so) => s + soNet(so), 0) / mine.length);
}
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `npm test -- customerStats`
Expected: PASS — all ~16 tests green.

- [ ] **Step 5: Commit**

```
git add src/utils/customerStats.js src/utils/customerStats.test.js
git commit -m "feat(utils): customerStats — arStatus, lifetime, trend, outstanding, top product"
```

---

## Task 2: `useMediaQuery` hook (TDD)

**Files:**
- Create: `src/utils/useMediaQuery.ts`
- Create: `src/utils/useMediaQuery.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// src/utils/useMediaQuery.test.tsx
import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMediaQuery } from "./useMediaQuery";

let listeners: Array<(e: { matches: boolean }) => void> = [];
let currentMatches = false;

beforeEach(() => {
  listeners = [];
  currentMatches = false;
  (window as any).matchMedia = (q: string) => ({
    matches: currentMatches,
    media: q,
    addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
      listeners.push(cb);
    },
    removeEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
      listeners = listeners.filter((l) => l !== cb);
    },
  });
});

describe("useMediaQuery", () => {
  test("returns initial matches value", () => {
    currentMatches = true;
    const { result } = renderHook(() => useMediaQuery("(min-width: 900px)"));
    expect(result.current).toBe(true);
  });

  test("updates when matchMedia fires change", () => {
    currentMatches = false;
    const { result } = renderHook(() => useMediaQuery("(min-width: 900px)"));
    expect(result.current).toBe(false);
    act(() => listeners.forEach((l) => l({ matches: true })));
    expect(result.current).toBe(true);
  });

  test("returns false when matchMedia is undefined (SSR-safe)", () => {
    (window as any).matchMedia = undefined;
    const { result } = renderHook(() => useMediaQuery("(min-width: 900px)"));
    expect(result.current).toBe(false);
  });
});
```

- [ ] **Step 2: Run, confirm it fails**

Run: `npm test -- useMediaQuery`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/utils/useMediaQuery.ts
import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const get = () =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false;

  const [matches, setMatches] = useState<boolean>(get);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent | { matches: boolean }) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", handler as (e: MediaQueryListEvent) => void);
    return () =>
      mql.removeEventListener("change", handler as (e: MediaQueryListEvent) => void);
  }, [query]);

  return matches;
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `npm test -- useMediaQuery`
Expected: PASS — 3 tests green.

- [ ] **Step 5: Commit**

```
git add src/utils/useMediaQuery.ts src/utils/useMediaQuery.test.tsx
git commit -m "feat(utils): useMediaQuery — matchMedia.change hook, SSR-safe"
```

---

## Task 3: Stat strip (4 health-led cards)

**Files:**
- Modify: `src/components/Contacts.jsx` — add a stat strip block in the `isC` branch above the existing group filter row.

This task adds **only the new strip** — it does not yet remove or change the existing group chips, toolbar, or cards.

- [ ] **Step 1: Add imports at top of `Contacts.jsx`**

After the existing import block (after `import ContactExcelImport from "./ContactExcelImport.jsx";`), add:

```js
import {
  salesByCustomerId,
  lifetimeValue,
  outstandingDetail,
  arStatus,
  daysAgo,
} from "../utils/customerStats.js";
```

- [ ] **Step 2: Add the stat-strip useMemo block inside `ContactPage`**

Insert immediately above the `supStats` useMemo block (around line 87 in the current file). All three customer aggregates compute off a single pass to keep cost down.

```jsx
const todayDate = useMemo(() => new Date(), []);
const todayISO = todayDate.toISOString().slice(0, 10);
const salesByCust = useMemo(() => salesByCustomerId(sales || []), [sales]);

const custStats = useMemo(() => {
  if (!isC) return null;
  const custs = (contacts || []).filter(
    (c) => c && c.type === "customer" && (!sf || c.salesPerson === cu.salesName)
  );

  const cutoff30 = new Date(todayDate.getTime() - 30 * 86_400_000).toISOString().slice(0, 10);
  const cutoff60 = new Date(todayDate.getTime() - 60 * 86_400_000).toISOString().slice(0, 10);

  // New-customer count from id timestamp (id is Date.now() at create).
  let newCount = 0;
  let newCountPrev = 0;
  const thirtyDaysMs = 30 * 86_400_000;
  for (const c of custs) {
    if (typeof c.id !== "number") continue;
    const ageMs = todayDate.getTime() - c.id;
    if (ageMs < thirtyDaysMs) newCount++;
    else if (ageMs < 2 * thirtyDaysMs) newCountPrev++;
  }
  const countDelta =
    newCountPrev > 0
      ? Math.round(((newCount - newCountPrev) / newCountPrev) * 100)
      : 0;

  // 30-day revenue (across all customers in scope).
  let revLast30 = 0;
  let revPrev30 = 0;
  let orderCount = 0;
  for (const so of sales || []) {
    if (so == null || !so.date) continue;
    const cust = custs.find((c) => c.id === so.customerId);
    if (!cust) continue;
    const net =
      (so.items || []).reduce((s, i) => s + (i.qty || 0) * (i.price || 0), 0) -
      (so.discountAmt || 0);
    if (so.date >= cutoff30) {
      revLast30 += net;
      orderCount++;
    } else if (so.date >= cutoff60) {
      revPrev30 += net;
    }
  }
  const revDelta =
    revPrev30 > 0 ? Math.round(((revLast30 - revPrev30) / revPrev30) * 100) : 0;

  // AR + dormant counts.
  let arTotal = 0;
  let arCount = 0;
  let overdueCount = 0;
  let dormantCount = 0;
  let dormantCountPrior = 0;
  for (const c of custs) {
    const od = outstandingDetail(c, salesByCust[c.id] || [], payments || [], todayDate);
    arTotal += od.total;
    arCount += od.count;
    overdueCount += od.overdueCount;
    const status = arStatus(c, salesByCust[c.id] || [], payments || [], todayDate);
    if (status === "dormant") dormantCount++;
    // 7-day-prior count: same status but using a today shifted -7d.
    const sevenAgo = new Date(todayDate.getTime() - 7 * 86_400_000);
    const statusPrior = arStatus(c, salesByCust[c.id] || [], payments || [], sevenAgo);
    if (statusPrior === "dormant") dormantCountPrior++;
  }
  const dormantDelta = dormantCount - dormantCountPrior;

  // 30-point daily series.
  const revSeries = new Array(30).fill(0);
  const cumCustSeries = new Array(30).fill(0);
  for (let i = 0; i < 30; i++) {
    const day = new Date(todayDate.getTime() - (29 - i) * 86_400_000)
      .toISOString()
      .slice(0, 10);
    for (const so of sales || []) {
      if (!so || so.date !== day) continue;
      if (!custs.find((c) => c.id === so.customerId)) continue;
      const net =
        (so.items || []).reduce((s, i) => s + (i.qty || 0) * (i.price || 0), 0) -
        (so.discountAmt || 0);
      revSeries[i] += net;
    }
    const dayMs = new Date(day + "T23:59:59Z").getTime();
    cumCustSeries[i] = custs.filter(
      (c) => typeof c.id === "number" && c.id <= dayMs
    ).length;
  }

  return {
    total: custs.length,
    newCount,
    countDelta,
    revLast30,
    orderCount,
    revDelta,
    arTotal,
    arCount,
    overdueCount,
    dormantCount,
    dormantDelta,
    revSeries,
    cumCustSeries,
  };
}, [isC, contacts, sales, payments, salesByCust, sf, cu, todayDate]);
```

- [ ] **Step 3: Render the stat strip in the JSX**

Find the line `{isC&&<div style={{display:"flex",gap:6,marginBottom:12}}>` (around line 111). Insert **above** it:

```jsx
{isC && custStats && (
  <div
    className="stat-grid"
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(4,1fr)",
      gap: 10,
      marginBottom: 16,
    }}
  >
    <StatCard
      label="ลูกค้าทั้งหมด"
      value={null}
      animatedValue={custStats.total}
      format={(n) => Math.round(n).toLocaleString()}
      sub={"+" + custStats.newCount + " ใหม่ 30 วัน"}
      delta={
        custStats.countDelta !== 0
          ? {
              text: (custStats.countDelta > 0 ? "+" : "") + custStats.countDelta + "%",
              positive: custStats.countDelta >= 0,
            }
          : undefined
      }
      sparkline={custStats.cumCustSeries}
      color="var(--blue)"
      accentBg="rgba(0,122,255,0.12)"
    />
    <StatCard
      label="ยอดขาย 30 วัน"
      value={null}
      animatedValue={custStats.revLast30}
      format={(n) => "฿" + fmt(Math.round(n))}
      sub={"จาก " + custStats.orderCount + " orders"}
      delta={
        custStats.revDelta !== 0
          ? {
              text: (custStats.revDelta > 0 ? "+" : "") + custStats.revDelta + "%",
              positive: custStats.revDelta >= 0,
            }
          : undefined
      }
      sparkline={custStats.revSeries}
      color="var(--green)"
      accentBg="rgba(52,199,89,0.12)"
    />
    <StatCard
      label="AR ค้าง"
      value={"฿" + fmt(Math.round(custStats.arTotal))}
      sub={custStats.arCount + " ใบ · " + custStats.overdueCount + " เกินกำหนด"}
      color={custStats.overdueCount > 0 ? "var(--red)" : "var(--orange)"}
      accentBg={
        custStats.overdueCount > 0
          ? "rgba(255,59,48,0.12)"
          : "rgba(255,149,0,0.14)"
      }
    />
    <StatCard
      label="เสี่ยงหาย"
      value={custStats.dormantCount}
      sub="ไม่ซื้อเกิน 60 วัน"
      delta={
        custStats.dormantDelta !== 0
          ? {
              text:
                (custStats.dormantDelta > 0 ? "+" : "") +
                custStats.dormantDelta +
                " สัปดาห์นี้",
              positive: custStats.dormantDelta <= 0,
            }
          : undefined
      }
      color={custStats.dormantCount > 0 ? "var(--red)" : "var(--green)"}
      accentBg={
        custStats.dormantCount > 0
          ? "rgba(255,59,48,0.12)"
          : "rgba(52,199,89,0.12)"
      }
    />
  </div>
)}
```

- [ ] **Step 4: Verify supplier path still renders unchanged**

Run: `npm run typecheck && npm test`
Expected: green (no test asserts customer mode yet; supplier snapshot tests still pass).

Then manually open the running app, switch to suppliers — should look identical to before.

- [ ] **Step 5: Commit**

```
git add src/components/Contacts.jsx
git commit -m "feat(customers): health-led stat strip (count/30d revenue/AR/at-risk)"
```

---

## Task 4: Sticky toolbar — sort + view toggle

**Files:**
- Modify: `src/components/Contacts.jsx`

- [ ] **Step 1: Add state and sort comparator at top of `ContactPage`**

Below the existing `useState` declarations (after `const [groupFilter, setGroupFilter] = useState("all");`), add:

```jsx
const [sortMode, setSortMode] = useState("name"); // name | revenue | recent | outstanding
const [viewMode, setViewMode] = useState("grid"); // grid | table
```

- [ ] **Step 2: Add `lastPurchaseDays`, `revenueTrend`, `topProduct`, `avgPerSO` to the import line**

Update the import added in Task 3:

```js
import {
  salesByCustomerId,
  lifetimeValue,
  outstandingDetail,
  arStatus,
  daysAgo,
  lastPurchaseDays,
  revenueTrend,
  topProduct,
  avgPerSO,
} from "../utils/customerStats.js";
```

- [ ] **Step 3: Wrap the existing `filtered` computation in a `useMemo` that also sorts**

Replace the existing `const filtered = (contacts || []).filter(...)` block (around line 53) with:

```jsx
const filtered = useMemo(() => {
  const arr = (contacts || []).filter((c) => {
    if (!c || c.type !== ft) return false;
    if (sf && c.salesPerson !== cu.salesName) return false;
    if (isC && groupFilter !== "all") {
      if (groupFilter === "regular" && c.customerGroup !== "regular") return false;
      if (groupFilter === "walkin" && c.customerGroup !== "walkin") return false;
    }
    if (search) {
      const s = search.toLowerCase();
      if (
        !((cN(c) || "").toLowerCase().includes(s) ||
          (c.email || "").toLowerCase().includes(s))
      )
        return false;
    }
    return true;
  });
  if (!isC) return arr;
  const cmp = {
    name: (a, b) => (cN(a) || "").localeCompare(cN(b) || "", "th"),
    revenue: (a, b) =>
      lifetimeValue(b, salesByCust[b.id] || []) -
      lifetimeValue(a, salesByCust[a.id] || []),
    recent: (a, b) => {
      const da = lastPurchaseDays(a, salesByCust[a.id] || [], todayDate);
      const db = lastPurchaseDays(b, salesByCust[b.id] || [], todayDate);
      if (da === null && db === null) return 0;
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    },
    outstanding: (a, b) =>
      outstandingDetail(b, salesByCust[b.id] || [], payments || [], todayDate).total -
      outstandingDetail(a, salesByCust[a.id] || [], payments || [], todayDate).total,
  };
  return arr.slice().sort(cmp[sortMode] || cmp.name);
}, [contacts, ft, sf, cu, isC, groupFilter, search, cN, sortMode, salesByCust, payments, todayDate]);
```

- [ ] **Step 4: Add sticky toolbar UI**

Find the existing toolbar block (around line 114, `<div style={{display:"flex",justifyContent:"space-between",...`). Replace its entire `<div>...</div>` with:

```jsx
<div
  style={{
    position: "sticky",
    top: 0,
    zIndex: 10,
    background: "var(--bg)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    paddingTop: 4,
    paddingBottom: 8,
    marginBottom: 12,
  }}
>
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
    }}
  >
    <SB value={search} onChange={setSearch} placeholder={"ค้นหา" + title + "..."} />
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      {isC && (
        <>
          <CustomSelect
            value={sortMode}
            onChange={setSortMode}
            options={[
              { value: "name", label: "ชื่อ ก-ฮ" },
              { value: "revenue", label: "ขายดี (ยอดรวม)" },
              { value: "recent", label: "ซื้อล่าสุด" },
              { value: "outstanding", label: "ค้างเก็บ" },
            ]}
          />
          <div
            style={{
              display: "inline-flex",
              border: "1px solid var(--line)",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            {["grid", "table"].map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                style={{
                  padding: "6px 12px",
                  background: viewMode === m ? "var(--blue-bg)" : "transparent",
                  color: viewMode === m ? "var(--blue)" : "var(--dim)",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: viewMode === m ? 600 : 400,
                  fontFamily: "inherit",
                }}
              >
                {m === "grid" ? "⊞ Grid" : "☰ Table"}
              </button>
            ))}
          </div>
        </>
      )}
      {ed && (
        <>
          <Btn onClick={() => oM("contactImport")}>{"นำเข้า Excel"}</Btn>
          <Btn
            onClick={() => {
              setFormErrors([]);
              setForm({ ...ef, customerGroup: isC ? "walkin" : undefined });
              oM(mk);
            }}
          >
            {"+ เพิ่ม" + title}
          </Btn>
        </>
      )}
    </div>
  </div>
</div>
```

- [ ] **Step 5: typecheck + test**

Run: `npm run typecheck && npm test`
Expected: green.

- [ ] **Step 6: Commit**

```
git add src/components/Contacts.jsx
git commit -m "feat(customers): sticky toolbar + sort modes + grid/table view toggle"
```

---

## Task 5: Filter chip merge + salesPerson chip row

**Files:**
- Modify: `src/components/Contacts.jsx`

- [ ] **Step 1: Add state for sales-person filter and helper imports**

Below the new `viewMode` state, add:

```jsx
const [salesFilter, setSalesFilter] = useState(""); // "" = all
```

At the top, add a `BrandChipRow` import:

```js
import BrandChipRow from "./ui/BrandChipRow.jsx";
import { brandColor } from "../utils/brandColors.ts";
```

- [ ] **Step 2: Extend the `filtered` `useMemo` with attention + sales-person filter**

Add a new state for the attention chip:

```jsx
const [attentionFilter, setAttentionFilter] = useState(""); // "" | "overdue" | "dormant"
```

In the `filtered` useMemo, after the `search` check, insert before the trailing `return true;`:

```jsx
if (isC && salesFilter && c.salesPerson !== salesFilter) return false;
if (isC && attentionFilter) {
  const status = arStatus(c, salesByCust[c.id] || [], payments || [], todayDate);
  if (attentionFilter === "overdue" && status !== "overdue") return false;
  if (attentionFilter === "dormant" && status !== "dormant") return false;
}
```

And include `salesFilter`, `attentionFilter`, `arStatus` in the deps array.

- [ ] **Step 3: Compute chip counts**

Below `custStats`, add:

```jsx
const chipCounts = useMemo(() => {
  if (!isC) return { overdue: 0, dormant: 0, perSales: {} };
  const custs = (contacts || []).filter(
    (c) => c && c.type === "customer" && (!sf || c.salesPerson === cu.salesName)
  );
  let overdue = 0;
  let dormant = 0;
  const perSales = {};
  for (const c of custs) {
    const status = arStatus(c, salesByCust[c.id] || [], payments || [], todayDate);
    if (status === "overdue") overdue++;
    if (status === "dormant") dormant++;
    if (c.salesPerson) perSales[c.salesPerson] = (perSales[c.salesPerson] || 0) + 1;
  }
  return { overdue, dormant, perSales };
}, [isC, contacts, salesByCust, payments, sf, cu, todayDate]);
```

- [ ] **Step 4: Replace the existing group-chip row with merged group + attention chip row**

Find the existing block:
```jsx
{isC&&<div style={{display:"flex",gap:6,marginBottom:12}}>
  {[{k:"all",...
```

Replace it with:

```jsx
{isC && (
  <div
    style={{
      display: "flex",
      gap: 6,
      marginBottom: 10,
      flexWrap: "wrap",
      alignItems: "center",
    }}
  >
    {[
      { k: "all", label: "ทั้งหมด", count: groupCounts.all, color: "var(--blue)" },
      { k: "regular", label: "ประจำ", count: groupCounts.regular, color: "var(--green)" },
      { k: "walkin", label: "หน้าร้าน", count: groupCounts.walkin, color: "var(--faint)" },
    ].map((g) => {
      const active = groupFilter === g.k;
      return (
        <button
          key={g.k}
          onClick={() => setGroupFilter(g.k)}
          style={{
            padding: "6px 14px",
            borderRadius: 20,
            border: active ? `2px solid ${g.color}` : "1px solid var(--line)",
            background: active ? "rgba(0,122,255,0.08)" : "var(--bg)",
            color: active ? g.color : "var(--dim)",
            fontSize: 12,
            fontWeight: active ? 600 : 400,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {g.label}{" "}
          <span style={{ opacity: 0.7, marginLeft: 2 }}>({g.count || 0})</span>
        </button>
      );
    })}
    <span
      style={{
        width: 1,
        height: 18,
        background: "var(--line)",
        margin: "0 4px",
      }}
    />
    {[
      {
        k: "overdue",
        label: "⚠ ต้องตามหนี้",
        count: chipCounts.overdue,
        color: "var(--orange)",
        bg: "rgba(255,149,0,0.14)",
      },
      {
        k: "dormant",
        label: "⚠ เริ่มหาย",
        count: chipCounts.dormant,
        color: "var(--red)",
        bg: "rgba(255,59,48,0.12)",
      },
    ].map((g) => {
      const active = attentionFilter === g.k;
      const hasItems = g.count > 0;
      return (
        <button
          key={g.k}
          onClick={() => setAttentionFilter(active ? "" : g.k)}
          style={{
            padding: "6px 14px",
            borderRadius: 20,
            border: active ? `2px solid ${g.color}` : "1px solid var(--line)",
            background: active ? g.bg : "var(--bg)",
            color: hasItems ? g.color : "var(--faint)",
            fontSize: 12,
            fontWeight: active ? 600 : 400,
            cursor: "pointer",
            fontFamily: "inherit",
            animation: hasItems && !active ? "chip-breathe 2.6s ease-in-out infinite" : "none",
          }}
        >
          {g.label}{" "}
          <span style={{ opacity: 0.7, marginLeft: 2 }}>({g.count})</span>
        </button>
      );
    })}
    <style>{`@keyframes chip-breathe{0%,100%{opacity:1}50%{opacity:.55}}`}</style>
  </div>
)}
```

- [ ] **Step 5: Add SalesPerson chip row below**

After the chip row above, insert:

```jsx
{isC && (cu.role === "SalesManager" || !cu.salesName) && (
  <BrandChipRow
    brands={Object.keys(chipCounts.perSales)
      .filter((s) => chipCounts.perSales[s] > 0)
      .sort()}
    value={salesFilter}
    onChange={setSalesFilter}
    countFn={(s) => chipCounts.perSales[s] || 0}
    colorFn={(s) => brandColor(s).base}
    allLabel="ทั้งเซลส์"
  />
)}
```

(If `BrandChipRow` signature differs from this prop shape, read `src/components/ui/BrandChipRow.tsx` and adapt the prop names — the four pieces of data required are: list, selected value, change handler, count getter, color getter. Keep the wrapper logic the same.)

- [ ] **Step 6: typecheck + test + visual sanity**

Run: `npm run typecheck && npm test`
Expected: green.

Open the app at `npm run dev`, switch to customers tab. Verify:
- Group chips work as before.
- Attention chips appear, breathe when count > 0.
- Sales chips only appear under SalesManager / non-Sales role.

- [ ] **Step 7: Commit**

```
git add src/components/Contacts.jsx
git commit -m "feat(customers): merged group+attention chips, sales-person chip row"
```

---

## Task 6: Card anatomy — render rewrite (text-only first)

**Files:**
- Modify: `src/components/Contacts.jsx`

This task rewrites **only the card body** (the `filtered.map(c => ...)` block, currently lines 125–156). Status stripe, hover effects, and watermark are added in Task 7.

- [ ] **Step 1: Replace the card grid block**

Find:
```jsx
<div className="contact-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:12}}>
  {filtered.map(c=>{...
```

Replace the **entire** `<div className="contact-grid">...</div>` block (including the supplier branch inside the map — keep it) with:

```jsx
{(!isC || viewMode === "grid") && (
  <div
    className="contact-grid"
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
      gap: 12,
    }}
  >
    {filtered.map((c) => {
      // SUPPLIER PATH — unchanged from previous implementation
      if (!isC) {
        const poInfo = poCountMap[c.id];
        return (
          <div
            key={c.id}
            style={{
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              padding: "1rem 1.25rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <div
                onClick={() => setViewSupplier(c)}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                style={{ fontWeight: 600, fontSize: 14, cursor: "pointer", color: "var(--blue)" }}
              >
                {cN(c)}
              </div>
              <Badge status={c.type} />
            </div>
            <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 2 }}>{c.phone || "-"}</div>
            <div style={{ fontSize: 12, color: "var(--blue)", marginBottom: 4 }}>{c.email || "-"}</div>
            {c.taxId && <div style={{ fontSize: 11, color: "var(--faint)", marginBottom: 2 }}>{"Tax ID: " + c.taxId}</div>}
            {c.address && (
              <div style={{ fontSize: 11, color: "var(--faint)", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.address}
              </div>
            )}
            {poInfo && (
              <div style={{ display: "flex", gap: 8, marginBottom: 8, marginTop: 6 }}>
                <span style={{ fontSize: 11, background: "rgba(0,122,255,0.1)", color: "var(--blue)", borderRadius: 99, padding: "3px 10px", fontWeight: 500 }}>
                  {poInfo.count + " PO"}
                </span>
                <span style={{ fontSize: 11, background: "rgba(52,199,89,0.1)", color: "var(--green)", borderRadius: 99, padding: "3px 10px", fontWeight: 500 }}>
                  {"฿" + fmt(poInfo.val)}
                </span>
              </div>
            )}
            {(c.staff || []).length > 0 && (
              <div style={{ background: "rgba(52,199,89,0.08)", border: "1px solid var(--green)", borderRadius: 6, padding: "6px 10px", marginBottom: 8, fontSize: 12 }}>
                <div style={{ color: "var(--green)", fontWeight: 500, marginBottom: 4 }}>{"Staff (" + c.staff.length + " คน)"}</div>
                {c.staff.map((s) => (
                  <div key={s.id} style={{ marginBottom: 3, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 500 }}>{s.name}</span>
                    <span style={{ background: "rgba(52,199,89,0.12)", color: "var(--green)", borderRadius: 99, padding: "1px 7px", fontSize: 10 }}>
                      {s.roleTitle}
                    </span>
                    <span style={{ color: "var(--faint)", fontSize: 11 }}>{"@" + s.username}</span>
                  </div>
                ))}
              </div>
            )}
            {ed && (
              <div style={{ display: "flex", gap: 8, marginTop: 8, borderTop: "1px solid var(--line)", paddingTop: 8 }}>
                <button
                  onClick={() => {
                    setFormErrors([]);
                    setForm({ vatReps: [], address: "", taxId: "", salesPerson: "", staff: [], ...c });
                    oM(mk);
                  }}
                  style={{ flex: 1, padding: "6px 0", borderRadius: 6, border: "1px solid var(--blue)", background: "rgba(0,122,255,0.08)", color: "var(--blue)", cursor: "pointer", fontSize: 12, fontWeight: 500 }}
                >
                  แก้ไข
                </button>
                {cd && (
                  <button
                    onClick={() => del(c.id)}
                    style={{ flex: 1, padding: "6px 0", borderRadius: 6, border: "1px solid var(--red)", background: "rgba(255,59,48,0.08)", color: "var(--red)", cursor: "pointer", fontSize: 12, fontWeight: 500 }}
                  >
                    ลบ
                  </button>
                )}
              </div>
            )}
          </div>
        );
      }

      // CUSTOMER PATH — new card anatomy
      const mine = salesByCust[c.id] || [];
      const ltv = lifetimeValue(c, mine);
      const trend = revenueTrend(c, mine, todayDate);
      const lpd = lastPurchaseDays(c, mine, todayDate);
      const od = outstandingDetail(c, mine, payments || [], todayDate);
      const status = arStatus(c, mine, payments || [], todayDate);
      const top = topProduct(c, mine, products || []);
      const avg = avgPerSO(c, mine);
      const bc = c.salesPerson ? brandColor(c.salesPerson) : null;
      const accent = bc ? bc.base : "var(--blue)";
      const accentText = bc ? bc.text : "var(--blue)";

      const STATUS_COLOR = {
        overdue: "var(--red)",
        ar: "var(--orange)",
        dormant: "var(--faint)",
        normal: "var(--green)",
      };
      const dotColor = STATUS_COLOR[status];

      const velocityColor =
        lpd === null
          ? "var(--faint)"
          : lpd < 30
          ? "var(--green)"
          : lpd <= 60
          ? "var(--orange)"
          : "var(--red)";
      const velocityText =
        lpd === null ? "ยังไม่มีคำสั่งซื้อ" : `⏱ ซื้อล่าสุด ${lpd} วันก่อน`;

      return (
        <div
          key={c.id}
          className="cust-card"
          style={{
            position: "relative",
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: "1rem 1.25rem 0.9rem 1.5rem",
            overflow: "hidden",
          }}
        >
          {/* Status stripe (left, 6px) */}
          <span
            className="cust-stripe"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 6,
              background: dotColor,
              transition: "width 200ms var(--ease-out, ease-out)",
            }}
          />

          {/* Header row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--faint)" }}>
                {"CUST-" + String(c.id).slice(-4)}
              </span>
              {c.customerGroup && (
                <span
                  style={{
                    fontSize: 10,
                    borderRadius: 99,
                    padding: "1px 8px",
                    fontWeight: 500,
                    ...(c.customerGroup === "regular"
                      ? { background: "rgba(52,199,89,0.12)", color: "var(--green)" }
                      : { background: "rgba(142,142,147,0.12)", color: "var(--faint)" }),
                  }}
                >
                  {c.customerGroup === "regular" ? "ประจำ" : "หน้าร้าน"}
                </span>
              )}
              {c.salesPerson && (
                <span
                  style={{
                    fontSize: 10,
                    borderRadius: 99,
                    padding: "1px 8px",
                    fontWeight: 500,
                    background: bc ? bc.alpha(0.12) : "rgba(0,122,255,0.12)",
                    color: accentText,
                  }}
                >
                  ● {c.salesPerson}
                </span>
              )}
            </div>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 99,
                background: dotColor,
                boxShadow: `0 0 8px ${dotColor}`,
              }}
            />
          </div>

          {/* Hero name */}
          <div
            onClick={() => setViewProfile(c)}
            style={{
              fontSize: 17,
              fontWeight: 800,
              lineHeight: 1.15,
              cursor: "pointer",
              color: accentText,
              marginBottom: 1,
            }}
          >
            {c.nameT || c.name}
          </div>
          <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 8 }}>
            {[c.nameT && c.name, c.phone].filter(Boolean).join(" · ") || "—"}
          </div>

          {/* VAT count chip */}
          {(c.vatReps || []).length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <span
                style={{
                  fontSize: 10,
                  borderRadius: 99,
                  padding: "1px 8px",
                  background: "var(--blue-bg)",
                  color: "var(--blue)",
                  fontWeight: 500,
                }}
              >
                VAT {c.vatReps.length}
              </span>
            </div>
          )}

          {/* Hero — lifetime value */}
          <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 4 }}>ซื้อรวม</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text)" }}>
              ฿ {fmt(Math.round(ltv))}
            </span>
            {trend.deltaPct >= 10 && (
              <span style={{ fontSize: 12, color: "var(--green)", fontWeight: 600 }}>
                ↑ {trend.deltaPct}%
              </span>
            )}
            {trend.deltaPct <= -10 && (
              <span style={{ fontSize: 12, color: "var(--orange)", fontWeight: 600 }}>
                ↓ {Math.abs(trend.deltaPct)}%
              </span>
            )}
          </div>

          {/* Velocity */}
          <div style={{ fontSize: 12, color: velocityColor, marginBottom: 8 }}>
            {velocityText}
          </div>

          {/* AR row */}
          {od.total > 0 && (
            <>
              <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>รอเก็บ</div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
                  ฿ {fmt(Math.round(od.total))}
                </span>
                <div style={{ display: "flex", gap: 4 }}>
                  <span style={{ fontSize: 10, background: "rgba(0,122,255,0.1)", color: "var(--blue)", borderRadius: 99, padding: "2px 8px", fontWeight: 500 }}>
                    {od.count} ใบ
                  </span>
                  {od.overdueCount > 0 && (
                    <span style={{ fontSize: 10, background: "rgba(255,59,48,0.12)", color: "var(--red)", borderRadius: 99, padding: "2px 8px", fontWeight: 600 }}>
                      {od.overdueCount} เกินกำหนด
                    </span>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Hover reveal (top product + avg) — kept always-visible for now; Task 7 wraps it in hover-only */}
          {top && (
            <div className="cust-reveal" style={{ fontSize: 11, color: "var(--dim)", marginTop: 4, paddingTop: 6, borderTop: "1px solid var(--line)" }}>
              <div>สินค้าหลัก: {top.name}</div>
              {avg > 0 && <div>เฉลี่ย ฿{fmt(avg)}/ใบ</div>}
            </div>
          )}

          {/* Bottom row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, fontSize: 11, color: "var(--faint)" }}>
            <span>
              ขายไป{" "}
              {trend.deltaPct >= 10 ? "↑" : trend.deltaPct <= -10 ? "↓" : ""}{" "}
              ฿{fmt(Math.round(trend.last30))}/30วัน
            </span>
            {c.salesPerson && (
              <span style={{ fontWeight: 700, opacity: 0.5, color: accentText }}>{c.salesPerson}</span>
            )}
          </div>

          {/* Actions */}
          {ed && (
            <div
              className="cust-actions"
              style={{
                display: "flex",
                gap: 8,
                marginTop: 8,
                borderTop: "1px solid var(--line)",
                paddingTop: 8,
              }}
            >
              <button
                onClick={() => {
                  setFormErrors([]);
                  setForm({ vatReps: [], address: "", taxId: "", salesPerson: "", staff: [], ...c });
                  oM(mk);
                }}
                style={{ flex: 1, padding: "6px 0", borderRadius: 6, border: "1px solid var(--blue)", background: "rgba(0,122,255,0.08)", color: "var(--blue)", cursor: "pointer", fontSize: 12, fontWeight: 500 }}
              >
                แก้ไข
              </button>
              {cd && (
                <button
                  onClick={() => del(c.id)}
                  style={{ flex: 1, padding: "6px 0", borderRadius: 6, border: "1px solid var(--red)", background: "rgba(255,59,48,0.08)", color: "var(--red)", cursor: "pointer", fontSize: 12, fontWeight: 500 }}
                >
                  ลบ
                </button>
              )}
            </div>
          )}
        </div>
      );
    })}
  </div>
)}
```

- [ ] **Step 2: typecheck + manual visual**

Run: `npm run typecheck && npm test`
Expected: green.

Open the app, switch to customers — every card should now show: code/group/sales chips, big hero name, lifetime value hero, velocity tag, AR row (if any), top product line, bottom 30-day revenue, salesPerson watermark. Supplier cards unchanged.

- [ ] **Step 3: Commit**

```
git add src/components/Contacts.jsx
git commit -m "feat(customers): card anatomy — hero LTV + velocity + AR + sales identity"
```

---

## Task 7: Status stripe hover, 3D tilt, spotlight, reveal

**Files:**
- Modify: `src/components/Contacts.jsx`

- [ ] **Step 1: Wrap reveal block in hover-only behavior + add hover handlers**

Find the card return `<div key={c.id} className="cust-card" ...>` and add a `ref` + cursor-tracking handler. Replace the wrapper div opening with:

```jsx
<div
  key={c.id}
  className="cust-card"
  onMouseMove={(e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * 100;
    const my = ((e.clientY - r.top) / r.height) * 100;
    e.currentTarget.style.setProperty("--mx", mx + "%");
    e.currentTarget.style.setProperty("--my", my + "%");
    const tiltX = (my - 50) / 10;
    const tiltY = (50 - mx) / 10;
    e.currentTarget.style.transform = `perspective(900px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(-4px) scale(1.012)`;
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = "";
    e.currentTarget.style.setProperty("--mx", "50%");
    e.currentTarget.style.setProperty("--my", "50%");
  }}
  style={{
    position: "relative",
    background: `radial-gradient(420px circle at var(--mx,50%) var(--my,50%), ${
      bc ? bc.alpha(0.08) : "rgba(0,122,255,0.05)"
    } 0%, transparent 60%), var(--panel)`,
    border: "1px solid var(--line)",
    borderRadius: 12,
    padding: "1rem 1.25rem 0.9rem 1.5rem",
    overflow: "hidden",
    transition: "transform 220ms var(--ease-out, ease-out), box-shadow 220ms var(--ease-out, ease-out), border-color 220ms",
    transformStyle: "preserve-3d",
    willChange: "transform",
  }}
>
```

Then add CSS to the file (one `<style>` block) so hover-only elements behave:

```jsx
<style>{`
  .cust-card:hover {
    border-color: var(--line);
    box-shadow: 0 24px 48px ${bc ? bc.alpha(0.45) : "rgba(0,122,255,0.35)"};
  }
  .cust-card:hover .cust-stripe { width: 9px; box-shadow: 0 0 14px ${dotColor}; }
  .cust-card .cust-actions { opacity: 0; transition: opacity 220ms; }
  .cust-card:hover .cust-actions { opacity: 1; }
  .cust-card .cust-reveal { max-height: 0; opacity: 0; padding-top: 0; border-top: none; transition: max-height 260ms, opacity 260ms, padding-top 260ms, border-top 260ms; overflow: hidden; }
  .cust-card:hover .cust-reveal { max-height: 80px; opacity: 1; padding-top: 6px; border-top: 1px solid var(--line); }
`}</style>
```

*Note:* Inline `<style>` per card causes duplicates. Move the static keyframes and `.cust-card` rules into a single global `<style>` block at the **top** of the rendered output (after the toolbar, before the grid). The dynamic per-card glow color goes into the inline `style` prop on the card itself via `box-shadow` set on `:hover` is harder — instead, set a CSS variable on the card root:

```jsx
style={{
  ...
  "--accent-rgba": bc ? bc.alpha(0.45) : "rgba(0,122,255,0.35)",
  "--accent-soft": bc ? bc.alpha(0.08) : "rgba(0,122,255,0.05)",
  "--stripe-glow": dotColor,
}}
```

And in the global stylesheet:

```css
.cust-card { background: radial-gradient(420px circle at var(--mx,50%) var(--my,50%), var(--accent-soft) 0%, transparent 60%), var(--panel); }
.cust-card:hover { box-shadow: 0 24px 48px var(--accent-rgba); }
.cust-card:hover .cust-stripe { width: 9px; box-shadow: 0 0 14px var(--stripe-glow); }
```

- [ ] **Step 2: typecheck + visual sanity**

Run: `npm run typecheck && npm test`
Expected: green.

Open the app, hover over a customer card — card should tilt, spotlight should follow the cursor, status stripe should glow, action buttons should fade in, and the reveal section should slide in.

- [ ] **Step 3: Commit**

```
git add src/components/Contacts.jsx
git commit -m "feat(customers): card hover — 3D tilt, spotlight, status-stripe glow, reveal info"
```

---

## Task 8: `CustomersTable.jsx` view

**Files:**
- Create: `src/components/CustomersTable.jsx`
- Create: `src/components/CustomersTable.test.jsx`
- Modify: `src/components/Contacts.jsx`

- [ ] **Step 1: Write failing test**

```jsx
// src/components/CustomersTable.test.jsx
import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CustomersTable from "./CustomersTable";

const customers = [
  { id: 1, name: "Alpha", salesPerson: "A", customerGroup: "regular" },
  { id: 2, name: "Beta", salesPerson: "B", customerGroup: "walkin" },
];
const sales = [
  { customerId: 1, date: "2026-06-05", status: "completed", items: [{ qty: 1, price: 1000 }], discountAmt: 0, payType: "cash", creditDays: 0, soNum: "S1" },
];

describe("CustomersTable", () => {
  test("renders rows for each customer", () => {
    render(<CustomersTable customers={customers} sales={sales} payments={[]} today={new Date("2026-06-10")} cN={(c) => c.name} onRowClick={() => {}} />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });
  test("row click fires onRowClick with customer", () => {
    const onClick = vi.fn();
    render(<CustomersTable customers={customers} sales={sales} payments={[]} today={new Date("2026-06-10")} cN={(c) => c.name} onRowClick={onClick} />);
    fireEvent.click(screen.getByText("Alpha"));
    expect(onClick).toHaveBeenCalledWith(customers[0]);
  });
  test("clicking a column header toggles sort", () => {
    render(<CustomersTable customers={customers} sales={sales} payments={[]} today={new Date("2026-06-10")} cN={(c) => c.name} onRowClick={() => {}} />);
    fireEvent.click(screen.getByText(/ชื่อ/));
    // Alpha (A) should appear before Beta (B) — confirm sort applied
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Alpha");
  });
});
```

- [ ] **Step 2: Run, confirm fails**

Run: `npm test -- CustomersTable`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```jsx
// src/components/CustomersTable.jsx
import { useMemo, useState } from "react";
import {
  salesByCustomerId,
  lifetimeValue,
  outstandingDetail,
  arStatus,
  lastPurchaseDays,
} from "../utils/customerStats.js";
import { fmt } from "../utils/helpers.js";
import { brandColor } from "../utils/brandColors.ts";

const STATUS_COLOR = {
  overdue: "var(--red)",
  ar: "var(--orange)",
  dormant: "var(--faint)",
  normal: "var(--green)",
};

export default function CustomersTable({ customers, sales, payments, today, cN, onRowClick }) {
  const [sortCol, setSortCol] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const salesByCust = useMemo(() => salesByCustomerId(sales || []), [sales]);

  const enriched = useMemo(
    () =>
      customers.map((c) => {
        const mine = salesByCust[c.id] || [];
        return {
          c,
          name: cN(c) || "",
          ltv: lifetimeValue(c, mine),
          lpd: lastPurchaseDays(c, mine, today),
          out: outstandingDetail(c, mine, payments || [], today),
          status: arStatus(c, mine, payments || [], today),
        };
      }),
    [customers, salesByCust, payments, today, cN]
  );

  const sorted = useMemo(() => {
    const arr = enriched.slice();
    const sign = sortDir === "asc" ? 1 : -1;
    const cmp = {
      name: (a, b) => a.name.localeCompare(b.name, "th") * sign,
      group: (a, b) => (a.c.customerGroup || "").localeCompare(b.c.customerGroup || "") * sign,
      sales: (a, b) => (a.c.salesPerson || "").localeCompare(b.c.salesPerson || "") * sign,
      ltv: (a, b) => (a.ltv - b.ltv) * sign,
      lpd: (a, b) => ((a.lpd ?? 9999) - (b.lpd ?? 9999)) * sign,
      out: (a, b) => (a.out.total - b.out.total) * sign,
    };
    arr.sort(cmp[sortCol] || cmp.name);
    return arr;
  }, [enriched, sortCol, sortDir]);

  const head = (label, col) => (
    <th
      onClick={() => {
        if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else {
          setSortCol(col);
          setSortDir("asc");
        }
      }}
      style={{
        padding: "10px 12px",
        textAlign: "left",
        fontWeight: 600,
        fontSize: 12,
        color: "var(--dim)",
        cursor: "pointer",
        userSelect: "none",
        position: "sticky",
        top: 0,
        background: "var(--bg)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      {label} {sortCol === col ? (sortDir === "asc" ? "↑" : "↓") : ""}
    </th>
  );

  return (
    <div style={{ overflowX: "auto", border: "1px solid var(--line)", borderRadius: 12 }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ width: 16, padding: "10px 0 10px 12px", background: "var(--bg)", borderBottom: "1px solid var(--line)", position: "sticky", top: 0 }} />
            {head("ชื่อ", "name")}
            {head("กลุ่ม", "group")}
            {head("เซลส์", "sales")}
            {head("ซื้อรวม", "ltv")}
            {head("ซื้อล่าสุด", "lpd")}
            {head("รอเก็บ", "out")}
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ c, name, ltv, lpd, out, status }) => {
            const bc = c.salesPerson ? brandColor(c.salesPerson) : null;
            return (
              <tr
                key={c.id}
                onClick={() => onRowClick(c)}
                style={{ cursor: "pointer", borderBottom: "1px solid var(--line)" }}
              >
                <td style={{ padding: "8px 0 8px 12px" }}>
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 99, background: STATUS_COLOR[status] }} />
                </td>
                <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 500 }}>{name}</td>
                <td style={{ padding: "8px 12px", fontSize: 12, color: "var(--dim)" }}>
                  {c.customerGroup === "regular" ? "ประจำ" : c.customerGroup === "walkin" ? "หน้าร้าน" : "-"}
                </td>
                <td style={{ padding: "8px 12px", fontSize: 12, color: bc ? bc.text : "var(--dim)" }}>
                  {c.salesPerson || "-"}
                </td>
                <td style={{ padding: "8px 12px", fontSize: 13, textAlign: "right" }}>{ltv > 0 ? "฿" + fmt(Math.round(ltv)) : "-"}</td>
                <td style={{ padding: "8px 12px", fontSize: 12, color: lpd === null ? "var(--faint)" : lpd > 60 ? "var(--red)" : lpd > 30 ? "var(--orange)" : "var(--dim)" }}>
                  {lpd === null ? "—" : lpd + " วันก่อน"}
                </td>
                <td style={{ padding: "8px 12px", fontSize: 13, textAlign: "right" }}>
                  {out.total > 0 ? (
                    <>
                      ฿{fmt(Math.round(out.total))}
                      {out.overdueCount > 0 && (
                        <span style={{ marginLeft: 6, fontSize: 10, background: "rgba(255,59,48,0.12)", color: "var(--red)", borderRadius: 99, padding: "1px 6px", fontWeight: 600 }}>
                          {out.overdueCount} เกิน
                        </span>
                      )}
                    </>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `npm test -- CustomersTable`
Expected: PASS.

- [ ] **Step 5: Wire into Contacts.jsx**

Add import at top:

```js
import CustomersTable from "./CustomersTable.jsx";
```

Find the closing `</div>` of the grid block introduced in Task 6 (the one opened by `{(!isC || viewMode === "grid") && (`). After it, insert:

```jsx
{isC && viewMode === "table" && (
  <CustomersTable
    customers={filtered}
    sales={sales}
    payments={payments}
    today={todayDate}
    cN={cN}
    onRowClick={(c) => setViewProfile(c)}
  />
)}
```

- [ ] **Step 6: Commit**

```
git add src/components/CustomersTable.jsx src/components/CustomersTable.test.jsx src/components/Contacts.jsx
git commit -m "feat(customers): CustomersTable view — sortable sticky-header alternative to grid"
```

---

## Task 9: Hybrid SlideOver / Modal wrapper for CustomerProfile

**Files:**
- Modify: `src/components/CustomerProfile.jsx`

This task only switches the **outer wrapper** — content untouched, so all tab behavior is preserved.

- [ ] **Step 1: Add imports at top**

```jsx
import { useEffect } from "react";  // append to the existing react import
import SlideOver from "./ui/SlideOver.jsx";
import { useMediaQuery } from "../utils/useMediaQuery";
```

- [ ] **Step 2: Register window.__slideoverClose for the Modal path too**

Right after `const [tab, setTab] = useState("so");` add:

```jsx
const isDesktop = useMediaQuery("(min-width: 900px)");

// Mobile back-button: SlideOver path registers internally; Modal path needs
// the same hook so mobile back closes the panel instead of falling through
// to setTab("dashboard"). Stack pattern: SlideOver, if mounted, will push
// over us and restore on unmount.
useEffect(() => {
  const prev = window.__slideoverClose;
  window.__slideoverClose = onClose;
  return () => {
    window.__slideoverClose = prev;
  };
}, [onClose]);
```

- [ ] **Step 3: Replace the `return <Modal ...>` shell**

Find the `return (` block (around line 94). `isDesktop` is already declared in Step 2 — do **not** redeclare. Replace the outer `<Modal title={...} onClose={onClose} wide>...</Modal>` with:

```jsx
const titleNode = `${customer.nameT || customer.name} — ประวัติลูกค้า`;
const body = (
  <>
    {/* ...existing JSX from header through tabs and content goes here verbatim... */}
  </>
);
return isDesktop ? (
  <SlideOver title={titleNode} onClose={onClose}>
    {body}
  </SlideOver>
) : (
  <Modal title={titleNode} onClose={onClose} wide>
    {body}
  </Modal>
);
```

Move all current children of `<Modal>` into the `body` fragment. Do **not** change inner JSX yet — Task 10 handles the reflow.

- [ ] **Step 4: typecheck + manual at 2 widths**

Run: `npm run typecheck && npm test`
Expected: green.

Open app, click a customer at desktop width (≥900) → SlideOver. Resize below 900 → Modal. Tab state should survive resize. Press mobile back inside Modal — panel should close (does **not** navigate to dashboard).

- [ ] **Step 5: Commit**

```
git add src/components/CustomerProfile.jsx
git commit -m "feat(customer-profile): hybrid SlideOver (desktop) / Modal (mobile) shell + mobile back-button"
```

---

## Task 10: CustomerProfile internal reflow

**Files:**
- Modify: `src/components/CustomerProfile.jsx`

- [ ] **Step 1: Collapse VAT reps list**

Find the existing `(customer.vatReps||[]).length>0` block inside the header (around line 115). Replace it with:

```jsx
{(customer.vatReps || []).length > 0 && (
  <details style={{ marginTop: 10 }}>
    <summary
      style={{
        cursor: "pointer",
        color: "var(--blue)",
        fontWeight: 600,
        fontSize: 12,
        background: "var(--blue-bg)",
        border: "1px solid var(--blue)",
        borderRadius: 6,
        padding: "6px 10px",
        listStyle: "none",
      }}
    >
      VAT {customer.vatReps.length} คน — ดูรายชื่อ ▾
    </summary>
    <div
      style={{
        marginTop: 6,
        background: "var(--blue-bg)",
        border: "1px solid var(--blue)",
        borderRadius: 6,
        padding: "8px 10px",
        fontSize: 12,
      }}
    >
      {customer.vatReps.map((r) => (
        <div key={r.id} style={{ marginBottom: 4 }}>
          <span style={{ fontWeight: 500 }}>{r.name}</span>{" "}
          <span style={{ color: "var(--faint)" }}>{r.idCard}</span>
          {r.address && <div style={{ color: "var(--dim)", fontSize: 11 }}>{r.address}</div>}
        </div>
      ))}
    </div>
  </details>
)}
```

- [ ] **Step 2: Replace 4-up stat row with 2×2 grid**

Find the StatCard rendering block in the header (search for `StatCard` usage). Replace the existing 4-up `<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>` block with:

```jsx
<div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 10,
    marginBottom: 16,
  }}
>
  <StatCard label="ซื้อรวม" value={"฿" + fmt(Math.round(totalRevenue))} color="var(--text)" />
  <StatCard
    label="รอเก็บ"
    value={"฿" + fmt(Math.round(outstanding))}
    color={outstanding > 0 ? "var(--orange)" : "var(--green)"}
    accentBg={outstanding > 0 ? "rgba(255,149,0,0.14)" : "rgba(52,199,89,0.12)"}
  />
  <StatCard label="เฉลี่ย/ใบ" value={"฿" + fmt(Math.round(avgPerSO))} sub={custSales.length + " orders"} />
  <StatCard
    label="ซื้อล่าสุด"
    value={lastPurchase ? toBE(lastPurchase) : "—"}
    sub={lastPurchase ? "" : "ยังไม่มีคำสั่งซื้อ"}
  />
</div>
```

- [ ] **Step 3: Trim SO table to 4 columns**

Find the SO tab's table (`<table>` inside the SO tab content). Replace the `<thead>` `<tr>` with:

```jsx
<tr>
  {thTd("เลขที่", 0)}
  {thTd("วันที่", 1)}
  {thTd("ยอดสุทธิ", 2)}
  {thTd("สถานะ", 3)}
</tr>
```

Remove the corresponding `<td>` for `creditDays` and `payType` in the body rows. Keep `onClick` row behavior if any.

- [ ] **Step 4: Trim AR table to 4 columns**

Find the AR tab's table. Replace its `<thead>` `<tr>` with:

```jsx
<tr>
  {thTd("เลขที่", 0)}
  {thTd("ครบกำหนด", 1)}
  {thTd("ยอดคงเหลือ", 2)}
  {thTd("สถานะ", 3)}
</tr>
```

Adjust the body rows to drop `creditDays` and `paid` columns, but keep the existing overdue-day badge in the "สถานะ" cell.

- [ ] **Step 5: typecheck + visual sanity at 520px**

Run: `npm run typecheck && npm test`
Expected: green.

Open the app at desktop width, open a customer detail — should see 2×2 stat grid, collapsed VAT reps, trimmed tables. No horizontal scroll.

- [ ] **Step 6: Commit**

```
git add src/components/CustomerProfile.jsx
git commit -m "refactor(customer-profile): 2x2 stat grid, collapse VAT, trim SO/AR tables for 520px"
```

---

## Task 11: SlideOver footer actions

**Files:**
- Modify: `src/components/CustomerProfile.jsx`

- [ ] **Step 1: Pass new optional callbacks from Contacts.jsx**

In `src/components/Contacts.jsx`, find the `<CustomerProfile ...>` rendering line and add:

```jsx
<CustomerProfile
  customer={contacts.find((c) => c.id === viewProfile.id) || viewProfile}
  sales={sales}
  quotes={quotes}
  payments={payments}
  products={products}
  pN={pN}
  promos={sh.promos || []}
  setContacts={setContacts}
  canEdit={canE("contacts")}
  onClose={() => setViewProfile(null)}
  onEdit={() => {
    setFormErrors([]);
    setForm({
      vatReps: [],
      address: "",
      taxId: "",
      salesPerson: "",
      staff: [],
      ...viewProfile,
    });
    setViewProfile(null);
    oM(mk);
  }}
/>
```

- [ ] **Step 2: Add footer node in CustomerProfile**

Add `onEdit` to the destructured props:

```jsx
export default function CustomerProfile({ customer, sales, quotes, payments, products, pN, promos = [], setContacts, canEdit = true, onClose, onEdit })
```

Just above the `return isDesktop ? (` from Task 9, add:

```jsx
const footer = (
  <>
    <button
      onClick={onClose}
      style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid var(--line)", cursor: "pointer", background: "transparent", color: "var(--dim)" }}
    >
      ปิด
    </button>
    {canEdit && (
      <button
        onClick={onEdit}
        style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid var(--blue)", cursor: "pointer", background: "rgba(0,122,255,0.08)", color: "var(--blue)", fontWeight: 500 }}
      >
        แก้ไขข้อมูล
      </button>
    )}
  </>
);
```

Update the SlideOver call to pass `footer={footer}`:

```jsx
return isDesktop ? (
  <SlideOver title={titleNode} onClose={onClose} footer={footer}>
    {body}
  </SlideOver>
) : (
  <Modal title={titleNode} onClose={onClose} wide>
    {body}
  </Modal>
);
```

- [ ] **Step 3: typecheck + manual click "แก้ไขข้อมูล"**

Run: `npm run typecheck && npm test`
Expected: green.

Open a customer detail at desktop width, click "แก้ไขข้อมูล" — should close the panel and open the customer-edit Modal.

- [ ] **Step 4: Commit**

```
git add src/components/CustomerProfile.jsx src/components/Contacts.jsx
git commit -m "feat(customer-profile): SlideOver footer — ปิด / แก้ไขข้อมูล"
```

---

## Task 12: Polish pass

**Files:**
- Modify: `src/components/Contacts.jsx`

- [ ] **Step 1: Add salesPerson watermark visual intensity on hover**

In the global `<style>` block from Task 7 add:

```css
.cust-card .salesPerson-mark { opacity: 0.08; transition: opacity 240ms; }
.cust-card:hover .salesPerson-mark { opacity: 0.16; }
```

In the card JSX, change the bottom-row salesPerson `<span>` to use `className="salesPerson-mark"`.

- [ ] **Step 2: Tighten count-up format and add `accentBg` brand-tinting to stat-strip cards 1 & 2**

Already in StatCard via Task 3 — verify the `accentBg` prop is set on cards 1 (`rgba(0,122,255,0.12)`) and 2 (`rgba(52,199,89,0.12)`).

- [ ] **Step 3: Add hero name gradient (salesPerson color) on hover**

In the global `<style>` block:

```css
.cust-card .hero-name { background: none; -webkit-background-clip: initial; color: var(--text); transition: color 220ms, background 220ms, -webkit-background-clip 220ms; }
.cust-card:hover .hero-name { background: linear-gradient(135deg, var(--accent-rgba), var(--accent-rgba)); -webkit-background-clip: text; color: transparent; }
```

Add `className="hero-name"` to the hero name `<div>` and remove the inline `color: accentText`.

- [ ] **Step 4: Run full verify**

```
npm run typecheck && npm run build && npm test
```

Expected: typecheck clean, build green (PWA precache count rises slightly), tests still green (180 + ~25 new = ~205 total).

- [ ] **Step 5: Commit**

```
git add src/components/Contacts.jsx
git commit -m "feat(customers): polish — watermark on hover, hero name gradient, stat tint"
```

---

## After all tasks

- Update `MEMORY.md` if new patterns emerge worth recording (e.g., "hybrid SlideOver/Modal pattern used in customers — reuse for other detail panels").
- Re-run `git log --oneline b2d9a66~1..HEAD` and confirm commit count (should be Products' 31 + Customers' ~12 = ~43 since the redesign run began).
- Hand off to a fresh session for the next major feature.

---

## Acceptance verification

Before marking the branch complete:

```
npm run typecheck
npm run build
npm test
```

All three must be green. Then open the app:

1. Switch to suppliers — visual diff vs `master` (pre-redesign) should be **zero**.
2. Switch to customers — stat strip, sticky toolbar, sort, view toggle, chip filters, salesPerson chips (under SalesManager), card hover effects all functional.
3. Click a customer at desktop width → SlideOver. Resize to <900px and click — Modal.
4. Press mobile back inside SlideOver → panel closes (does not navigate to dashboard).
5. Login as a Sales role, verify only their own customers appear in card grid, table view, and chip counts.

---

## Out of scope (do not implement in this plan)

- Per-customer color identity beyond salesPerson hash.
- "สร้าง Quote ใหม่" button in SlideOver footer (defer until Quote route prefill is ready).
- Supplier mode visual changes.
- Any change to customer schema, Excel import, add/edit form, รางวัล tab logic, or wallet/claim flow.
