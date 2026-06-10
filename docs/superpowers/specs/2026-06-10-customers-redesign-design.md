# Customers page premium-dashboard redesign — Design

**Date:** 2026-06-10
**Status:** Draft → User review
**Scope:** `src/components/Contacts.jsx` (customer mode only) + `src/components/CustomerProfile.jsx`
**Out of scope:** Supplier mode of Contacts.jsx, SupplierProfile.jsx
**Related prior work:** [2026-06-10-products-redesign-design.md](./2026-06-10-products-redesign-design.md)

---

## Why

The customer page currently shows only contact info (phone, email, salesPerson, VAT reps). It carries no business signal — a user opening it cannot tell which customer is a VIP, which owes money, which is about to churn. All that data exists in `CustomerProfile.jsx`, but it is hidden behind a click and a full-screen Modal.

This redesign mirrors the proven pattern from the Products page so customers feel like a peer surface — same primitives, same hover language, same scan-ability — while every signal is mapped to a customer-relevant question:

| Products card asks | Customer card asks |
|--------------------|--------------------|
| Will I run out of stock? | Is this customer a VIP? |
| Is this selling? | Is this customer paying? |
| Did the price just change? | Is this customer about to churn? |

## Approach (recommended: B — Customer-Tailored)

Considered three options:
- **A. Full Products Parity** — pure copy. Rejected: customer data has fewer dimensions than products; some signals would be empty pixels.
- **B. Customer-Tailored** ✅ — keep Products' structure (stat strip + sticky toolbar + dense card + slide-over) but every signal is mapped to a customer concept.
- **C. Minimal Refresh** — stat strip + a couple extra fields on the existing card. Rejected: user explicitly wants parity with the Products page.

Approach B reuses every primitive built during the Products run (`StatCard`, `Sparkline`, `SlideOver`, `useCountUp`, `BrandChipRow`) and adds three new utilities.

---

## Architecture

### New files

| File | Purpose |
|------|---------|
| `src/utils/customerStats.js` (+ `.test.js`) | 8 pure helpers for AR status, lifetime value, revenue trend, last-purchase, outstanding, top product, avg/SO |
| `src/utils/useMediaQuery.ts` (+ `.test.tsx`) | Hook that listens to `matchMedia.change`; SSR-safe |
| `src/components/CustomersTable.jsx` (+ `.test.jsx`) | Sortable sticky-header table view (mirrors `ProductsTable.jsx`) |

### Modified files

| File | Change |
|------|--------|
| `src/components/Contacts.jsx` | Render-layer rewrite **only within the `isC` branch**. Supplier path (`!isC`) stays byte-for-byte identical. |
| `src/components/CustomerProfile.jsx` | Wrap content in a hybrid `<SlideOver>` (desktop, ≥900px) / `<Modal>` (mobile) shell. Internal reflow: 2×2 stat grid, VAT reps collapse, fewer table columns. Tab logic untouched. |

### Reused, unchanged

`StatCard`, `Sparkline`, `SlideOver`, `useCountUp`, `BrandChipRow`, `brandColors` (the existing hash-based HSL fallback handles salesPerson colors with no new config).

---

## Helpers — `customerStats.js`

All pure, all unit-testable, all O(N) over the customer's own sales.

```ts
arStatus(customer, sales, payments)
  → "overdue" | "ar" | "dormant" | "normal"
  // Priority: overdue (any AR past credit days) > ar (has outstanding, not late)
  //         > dormant (last sale >60d ago + lifetime>0) > normal

lifetimeValue(customer, sales) → number
  // sum(soNet) of all SOs where customerId matches, regardless of status
  // (matches CustomerProfile's existing totalRevenue calc)

revenueTrend(customer, sales) → { last30: number, prev30: number, deltaPct: number }
  // last30 = sum SO net dated within [today-30d, today]
  // prev30 = sum SO net dated within [today-60d, today-30d]
  // deltaPct = (last30 - prev30) / max(prev30, 1) * 100

lastPurchaseDays(customer, sales) → number | null
  // days since most recent SO date (any status)
  // null if no sales ever

outstandingDetail(customer, sales, payments)
  → { total: number, count: number, overdueCount: number }
  // total = sum(soNet - paid) over completed SOs only
  // count = SOs where remaining > 0
  // overdueCount = SOs where remaining > 0 AND payType==="credit"
  //                AND today > date + creditDays

topProduct(customer, sales, products) → { name: string, qty: number } | null
  // Highest qty product in this customer's history
  // null if no sales

avgPerSO(customer, sales) → number
  // lifetimeValue / count(sales)
  // 0 if no sales

salesByCustomerId(sales) → Record<id, SO[]>
  // Single-pass groupBy. Memoized at Contacts.jsx render scope so card
  // AND stat-strip calculations are O(SOs_for_this_customer),
  // not O(all_SOs) per card. Same memo serves stat strip aggregates too.
```

Tests cover empty cases (no sales, no payments, no credit days), boundary cases (exactly 60 days, exactly at credit days), and standard cases.

---

## Component: Stat strip — Health-led

Four `StatCard` instances in a `repeat(4, 1fr)` grid, rendered above the toolbar **only when `isC`**.

| # | label | value | sub | delta | sparkline | color |
|---|-------|-------|-----|-------|-----------|-------|
| 1 | ลูกค้าทั้งหมด | `count(c.type==="customer")` (after `sf` scope) | `+N ใหม่ 30 วัน` (customers with `id` timestamp within last 30 days — `id` is `Date.now()` at create) | `+X% vs prev-30d` (count delta) | cumulative count, 30 daily points | `--blue` |
| 2 | ยอดขาย 30 วัน | `฿ sum(soNet) for SOs dated last 30d` | `จาก N orders` (count completed+pending) | `+X% vs prev-30d` | daily revenue, 30 points | `--green` |
| 3 | AR ค้าง | `฿ outstanding (sum over all customers)` | `N ใบ · M เกินกำหนด` | — | — | `--orange` → `--red` if M>0 |
| 4 | เสี่ยงหาย | `count(arStatus==="dormant")` | `ไม่ซื้อเกิน 60 วัน` | `+N` (rolling 7d vs prior 7d) | — | `--red` if >0, else `--green` |

Cards 3 & 4 skip sparkline by design — outstanding requires historical recompute and adds noise without insight; "at risk" is a weekly count and a 7-point sparkline reads poorly.

Animated count-up via `useCountUp` (first mount only, snaps on subsequent target changes — same behavior as Products).

---

## Component: Sticky toolbar

Three rows, all inside one sticky container with `backdrop-blur` (same pattern as Products commit `372ed76`).

```
Row 1: [🔍 ค้นหา]  [Sort ▾]  [⊞ Grid / ☰ Table]  [Import Excel]  [+ เพิ่มลูกค้า]
Row 2: [ทั้งหมด N] [ประจำ N] [หน้าร้าน N]  │  [⚠ ต้องตามหนี้ N] [⚠ เริ่มหาย N]
Row 3 (conditional): [ทั้งเซลส์] [● สมชาย N] [● สมหญิง N] ...
```

**Row 1 — Sort dropdown** (4 modes via `CustomSelect`):

| value | label | comparator |
|-------|-------|-----------|
| `name` (default) | ชื่อ ก-ฮ | localeCompare on `cN(c)` |
| `revenue` | ขายดี (ยอดรวมสูงสุด) | `lifetimeValue` desc |
| `recent` | ซื้อล่าสุด | `lastPurchaseDays` asc (null sinks) |
| `outstanding` | ค้างเก็บ (สูงสุด) | `outstandingDetail.total` desc |

**Row 1 — View toggle**: `grid` ↔ `table`. Grid = current cards (see Card anatomy). Table = `CustomersTable` (mirrors `ProductsTable`).

**Row 2 — Filter chips** (merged into one bar with a thin `│` divider):
- Group chips reuse the existing `customerGroup` filter logic. Counts derived from existing `groupCounts` memo.
- Attention chips are new:
  - `ต้องตามหนี้` — true when `arStatus === "overdue"`
  - `เริ่มหาย` — true when `arStatus === "dormant"`
- Any chip with count > 0 gets the **breathing animation** (CSS keyframe from Products commit `cb11696`).

**Row 3 — SalesPerson chip row** (conditional):
- Shows only when `cu.role === "SalesManager"` or `!cu.salesName` (user can see multiple salespeople).
- Uses `BrandChipRow` directly. Chip colors via `brandColor(salesName)` — the hash-based HSL path already in `brandColors.js`.
- Chips with 0 customers auto-hide (same logic as Products brand chips).
- Selecting a salesPerson chip filters the grid; clears with `[ทั้งเซลส์]`.

---

## Component: Card anatomy

```
┌──────────────────────────────────────────────┐
│║ ◀ status stripe 6px → 9px on hover         │
│║                                             │
│║ CUST-042   [ประจำ]  [● สมชาย]        ●R    │
│║                                             │
│║ บริษัท ABC จำกัด          ← 17px/800        │
│║ ABC Co., Ltd. · 02-xxx-xxxx                 │
│║                                             │
│║ [VAT 2] (chip with count only)              │
│║                                             │
│║ ซื้อรวม                                     │
│║ ฿ 1.25M ↑ 8%      ● 24px-bold + glow       │
│║                                             │
│║ ⏱ ซื้อล่าสุด 12 วันก่อน                    │
│║                                             │
│║ รอเก็บ                                      │
│║ ฿ 85,000        [12 ใบ] [3 เกินกำหนด]      │
│║                                             │
│║ [แก้ไข] [ลบ]   ← hover only                 │
│║                                             │
│║ ▼ HOVER REVEAL:                             │
│║   สินค้าหลัก: ตู้เย็น LG 18Q                │
│║   เฉลี่ย ฿26,500/ใบ                         │
│║                                             │
│║ ─────────────────                           │
│║ ขายไป ↑   ฿340K/30วัน                      │
│║                                  สมชาย     │ ← faint watermark
└──────────────────────────────────────────────┘
```

### Status stripe — priority cascade

```
overdue (red)  >  ar (orange)  >  dormant (gray)  >  normal (green)
```

Derived from `arStatus()`. The hero number's glowing dot uses the same color.

### Hero — Lifetime value

- Label: `ซื้อรวม`
- Value: `฿ 1.25M` at 24px/800, animated count-up via `useCountUp`
- Trend arrow ↑↓ next to value:
  - `↑` green when `revenueTrend.deltaPct ≥ 10`
  - `↓` orange when `≤ -10`
  - hidden in between

### Velocity tag

`⏱ ซื้อล่าสุด {N} วันก่อน`, color by threshold:

| days | color |
|------|-------|
| < 30 | `--green` |
| 30–60 | `--orange` |
| > 60 | `--red` (matches "เริ่มหาย" filter) |
| no sales ever | `--faint` `ยังไม่มีคำสั่งซื้อ` |

### AR row

- `รอเก็บ` label + `฿ outstanding` (secondary size, not hero)
- Right-side: chip `{N} ใบ` + chip `{M} เกินกำหนด` (red, hidden when M=0)
- Whole row hidden when `outstandingDetail.total === 0`

### Hover reveal

`max-height` transitions from 0 → 80px on hover:
- `สินค้าหลัก: {topProduct.name}`
- `เฉลี่ย ฿{avgPerSO}/ใบ`

### Watermark + bottom row

- `ขายไป ↑   ฿{revenueTrend.last30}/30วัน` (one number, not two — Products had 7d+30d because stock turnover is fast)
- SalesPerson name as faint watermark, opacity 8% → 16% on hover

### Color identity — salesPerson palette

- All brand-color uses (stripe, chip, watermark, hover glow, name gradient) source from `brandColor(c.salesPerson)`.
- `brandColors.js` already returns hash-based HSL for unmapped names — no new mapping config needed.
- Fallback to `--blue` when `c.salesPerson` is empty.

### Hover (mirrors Products exactly)

- 3D tilt ±5° via `perspective(900px)`, cursor-tracked
- Lift -4px + scale 1.012
- Radial-gradient spotlight in salesPerson color, position via CSS vars `--mx/--my`
- Glow: box-shadow 24×48px salesPerson @ 45% alpha
- Status stripe widens 6→9px, glow brightens
- Watermark opacity 8%→16%
- Action buttons fade in
- Reveal section slides in

---

## Component: CustomersTable

Mirrors `ProductsTable.jsx`. Sortable sticky-header table, density toggle (44px comfortable / 32px compact).

Columns (in order):
1. Status dot (color from `arStatus`)
2. ชื่อ (TH preferred, EN below in `--dim`)
3. กลุ่ม (chip)
4. เซลส์ (chip)
5. ซื้อรวม (`฿ lifetimeValue`)
6. ซื้อล่าสุด (`N วันก่อน`)
7. รอเก็บ (`฿ outstanding` + overdue indicator)
8. (actions: edit/delete — hover row)

All columns sortable. Row click opens the same detail panel as grid view.

---

## Detail view — Hybrid SlideOver/Modal

### Wrapper logic

```jsx
const isDesktop = useMediaQuery("(min-width: 900px)");
return isDesktop
  ? <SlideOver title={...} onClose={onClose} footer={...}>{content}</SlideOver>
  : <Modal title={...} onClose={onClose} wide>{content}</Modal>;
```

The breakpoint is 900px. `useMediaQuery` listens to `matchMedia('(min-width: 900px)').change` so resize across the breakpoint re-renders without re-mounting tabs (preserves tab state).

### Content reflow

The 411-LOC body of `CustomerProfile.jsx` is restructured to fit 520px width without horizontal scroll:

| Section | Before (Modal wide) | After (520px / mobile full) |
|---------|---------------------|------------------------------|
| Header info | `auto-fit, minmax(200px, 1fr)` | unchanged (auto-fit handles narrow) |
| VAT reps list | Inline expanded | **Collapsed** to `[VAT N — ดูรายชื่อ ▾]` toggle |
| Top stats | 4-up `StatCard` row | **2×2 grid**: ซื้อรวม / รอเก็บ / เฉลี่ย / ซื้อล่าสุด |
| Tab bar | Standard | Sticky below header, horizontal-scroll fallback |
| SO table | 6 columns | 4 cols: เลขที่ · วันที่ · ยอด · สถานะ. Drop `creditDays` and `payType` from main view; row click expands. |
| AR table | 7 columns | 4 cols: เลขที่ · ครบกำหนด · ยอดคงเหลือ · สถานะ. Drop `creditDays` and `paid` columns. |
| 6-month bar chart | Full width | Same component, narrower container |
| Top 5 products | Grid | Vertical list |

### Footer (SlideOver only)

```
[ปิด]  [แก้ไขข้อมูล]  [สร้าง Quote ใหม่]
```

Mobile Modal keeps existing `MBtns`. The "สร้าง Quote ใหม่" button is disabled when no Quote pre-fill route exists yet — wired in a follow-up if not already.

### Tab logic — untouched

`custSales`, `custQuotes`, `arList`, `monthTotals`, `top5`, `lastPurchase`, `avgPerSO`, the `confirmAct` dialog for wallet/claim deletion, and the รางวัล tab all stay byte-for-byte. Only the render layer changes.

---

## Behavior preservation (the contract)

| Preserved | How verified |
|-----------|--------------|
| Customer schema unchanged | No DB or localStorage write paths touched |
| Sales rep scope (`sf`) filter applies to everything | Tests force `cu.role === "Sales"` and assert filtered list + chip counts |
| `customerGroup` (regular/walkin) field works as today | Existing group filter logic preserved; counts derive from same memo |
| Excel import flow | `ContactExcelImport` import path untouched |
| Add/edit form (the big Modal at the bottom of Contacts.jsx) | Form Modal code unchanged |
| Supplier mode (`!isC`) | Zero visual or behavioral diff — code path forks above any new rendering |
| Mobile back button closes detail | SlideOver path uses `window.__slideoverClose` (already tested in `SlideOver.test.tsx`); Modal path uses `s.modal` in `App.jsx` (existing) |
| CustomerProfile tab state & confirm dialog | Snapshot tests captured **before** rewrite at both 520px and 1024px widths |

---

## Risk register

| Risk | Severity | Mitigation |
|------|----------|------------|
| Supplier flow breaks because Contacts.jsx is a shared page | High | All changes gated behind `if (isC)` branches. Snapshot test supplier mode before edits. |
| Sales rep scope leaks — a rep sees another rep's customers | High | Filter chips, sort comparators, and salesPerson chip row all respect `sf`. Test under Sales role and assert filter holds. |
| 411-LOC CustomerProfile rewrite breaks tab state / confirm dialog / wallet flow | Medium | Snapshot tests of SO / AR / Summary / รางวัล tabs at both widths captured before any rewrite. Real data, no mocks. |
| `useMediaQuery` re-renders churn on resize | Low | Listen to `matchMedia.change` only (boolean), not the `resize` event. |
| 120 customers × lifetime calculation × 1000 sales = O(n×m) per render | Low–Med | `salesByCustomerId` precomputed via `useMemo` at Contacts.jsx top level; per-card calls are O(SOs for that customer). |
| localStorage cache shape mismatch | None | No schema change; new fields are derived, never persisted. |

---

## Acceptance criteria

1. ✅ Customer mode of Contacts shows stat strip, new toolbar, new card grid (or table view), and slide-over / modal hybrid detail.
2. ✅ Supplier mode renders identically to current `master`.
3. ✅ Sales rep login sees only their own customers in every list, sort, and chip count.
4. ✅ Sort works for all 4 modes; filter chips work for all 5 (group × 3 + attention × 2).
5. ✅ SalesPerson chip row appears for SalesManager / unscoped users and hides for Sales-role users.
6. ✅ Card click opens SlideOver at viewport ≥900px; Modal below 900px.
7. ✅ All 4 (or 5, including รางวัล) tabs in CustomerProfile work at both widths.
8. ✅ Mobile back button closes the detail panel (SlideOver path and Modal path).
9. ✅ `npm run typecheck && npm run build && npm test` all green.
10. ✅ No regressions in supplier path snapshot.

---

## Phase plan (commits)

| Phase | ~Commits | Scope |
|-------|----------|-------|
| 1. Helpers | 2 | `customerStats.js` + `useMediaQuery.ts` (TDD, unit tests first) |
| 2. Stat strip + Toolbar | 3 | 4-card stat strip · sticky bar + sort + view toggle · filter chip merge · salesPerson chip row |
| 3. Card rewrite | 2 | Layout + signals (text only) · status stripe + hover effects + watermark |
| 4. Table view | 1 | `CustomersTable.jsx` + tests |
| 5. Detail hybrid | 3 | Wrapper · CustomerProfile reflow · footer actions |
| 6. Polish | 1–2 | Breathing chips · salesPerson gradient name · glow tuning · count-up tuning |

Total ≈ 12 commits, comparable to the 31-commit Products run (which built more primitives from scratch).

---

## Out of scope (explicit non-goals)

- No change to the supplier page rendering, schema, or detail view (`SupplierProfile.jsx`).
- No change to add/edit customer form, Excel import, or wallet/claim/รางวัล logic — render-layer only.
- No new persistent fields on customer. All new signals are derived from sales+payments.
- No replacement of the existing `Modal` component. SlideOver coexists.
- No mapping table for salesPerson → brand color. Hash-based HSL is sufficient.
- Per-customer color identity beyond salesPerson (e.g., per-customer brand) — not in scope.
