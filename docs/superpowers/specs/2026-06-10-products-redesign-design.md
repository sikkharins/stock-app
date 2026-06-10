# Products page — Premium dashboard redesign

**Date:** 2026-06-10
**Owner:** sikkharins
**Target file:** `src/components/Products.jsx` (382 LOC, the in-app stock catalog page)

## Goal

Lift the Products page from a functional grey-card grid into a premium-dashboard look that still reads as an internal ops tool. Keep every existing feature; replace layout, visual hierarchy, and the modal-based detail flow with a slide-over panel.

## Direction (decisions locked in brainstorming)

- **Scope:** full redesign — visual + UX, keep every feature.
- **Style:** Premium dashboard (Vercel / Stripe / Linear Dark) — larger statcards, brand accents, soft shadows, sparklines.
- **Grouping:** flat grid, **no brand sections**. Brand becomes a chip in the toolbar.
- **Views:** card view (default) + dense table view toggle (Stripe-style). Persist choice in `localStorage["productView"]`.

## Design tokens (added to `src/styles.css`)

```css
--shadow-card:    0 1px 2px rgba(0,0,0,.04), 0 4px 12px rgba(0,0,0,.04);
--shadow-card-hi: 0 2px 4px rgba(0,0,0,.06), 0 12px 28px rgba(0,0,0,.08);
--radius-card:    14px;
--radius-pill:    999px;
--ease-out:       cubic-bezier(.2,.7,.2,1);
```

Type scale used by the page: `11 / 12 / 13 / 14 / 16 / 20 / 28 / 36`. Weights: `400 / 500 / 600 / 700`.

Existing CSS vars (`--blue`, `--green`, `--orange`, `--red`, `--panel`, `--bg`, `--text`, `--dim`, `--line`, `--hover`, `--blue-bg`) stay. Dark mode untouched.

## Page shell

```
┌────────────────────────────────────────────────────────────┐
│  [Stat 1]  [Stat 2]  [Stat 3]  [Stat 4]    ← sparkline ใน │
│                                                             │
│  ▾ มูลค่าสต็อกแยกยี่ห้อ × หมวดย่อย   (collapsible — เดิม)    │
│                                                             │
│  ┌─ Toolbar (sticky on scroll, top: 0) ─────────────────┐ │
│  │ 🔍 Search · [LG][SAMSUNG][HAIER]→ · หมวด · sort · ▤▦│ │
│  │                          [จัดการหมวด][นำเข้า][+เพิ่ม]│ │
│  └─────────────────────────────────────────────────────┘ │
│                                                             │
│  [ A 79 · S 6 · D 0 · F 156 ]   ← status filter chips      │
│                                                             │
│  ── content area: card grid OR table ──                    │
└────────────────────────────────────────────────────────────┘
```

- Toolbar is `position: sticky; top: 0` with a subtle backdrop-blur background so it stays usable while scrolling 200+ products.
- Status-filter chips move **below** the toolbar (they belong to the result list, not to the page header).

## Stat cards (top strip)

Four cards in a `repeat(auto-fit, minmax(220px, 1fr))` grid:

| Card | Big number | Delta chip | Sparkline source |
|------|-----------|------------|-----------------|
| สินค้าทั้งหมด | `stats.total` | "+N this month" (first-`in` log per productId in last 30 d); hide chip if 0 | logs of `type: in` first-occurrence per productId |
| มูลค่าสต็อก | `฿{stockVal}` | `+/-฿X สัปดาห์นี้` (vs 7 days ago) | daily snapshot derived from `logs[]` running sum × current price |
| สต็อกต่ำ | `stats.low` | "+/- N รายการ" | count of products where stock crosses minStock per day |
| จองอยู่ | `{totalRes} ชิ้น` | "+/-N today" | count from `sales[].status === pending_delivery` over time |

**Sparkline:** inline SVG, 60×24, `<polyline>` with 30 daily data points. No library. Color = the card's accent. Path is drawn on mount with a 600 ms `stroke-dasharray` reveal.

**Glow on the "สต็อกต่ำ" card:** if value > 0, add a soft red `box-shadow` ring. Otherwise neutral.

If a sparkline data point can't be reconstructed (e.g., no logs that far back), fall back to a flat line at the current value — never empty.

## Toolbar

Single row, flex with wrap:

1. `<SB>` (existing SearchBar) — `flex: 1; min-width: 220px`.
2. **Brand chip row** — `BrandChipRow.jsx` (new): horizontal-scroll pills, one per brand, multi-select OFF (single brand at a time, click again = clear). Shows count badge per brand. Active pill uses brand color background.
3. Category `CustomSelect` (existing component).
4. Sort `CustomSelect` (existing) — remove the "ยี่ห้อ" (brand-grouped) sort option, since grouping is gone. Default sort becomes "ชื่อ". On load, if `sortBy === "brand"` (from a stale state), normalize to `"name"`.
5. View-mode toggle: two-button segment `[▤ Cards] [▦ Table]`. Persists to `localStorage["productView"]`.
6. Right-aligned actions, unchanged: `[จัดการหมวด] [นำเข้า Excel] [+ เพิ่มสินค้า] [เลือกหลายรายการ]`.

Status-filter chips (`A / S / D / F`) render in their own row directly below the toolbar.

## Card view

Card: min 320 px, padding 18 px, radius 14 px, shadow `--shadow-card`.

```
┌───────────────────────────────────────┐
│ lgtvle0002                  [LG] ● A  │ ← row 1: code (mono 11px) + brand chip + status dot
│                                       │
│ 43NANO80ASA.ATM                       │ ← row 2: name 16px semibold, 2-line clamp
│ สมาร์ท/4K                              │
│                                       │
│ [ทีวี]  [43"]                          │ ← row 3: category + size chips
│                                       │
│ สต็อก                          ████░░ │ ← row 4: stock bar 8px tall (was 6)
│ 9 / 5 เครื่อง                    9   │
│                                       │
│ ราคาขาย                  ขายล่าสุด 3d │ ← row 5: price + last-sold
│ ฿7,990                                │
│                                       │
│ [แก้ไข]  [สต็อก]  [⋯]                 │ ← row 6: actions (hover-only on desktop)
└───────────────────────────────────────┘
```

- **Brand chip:** initials in a 22px pill, colored by `BRAND_COLORS[brand]` (existing constant).
- **Status dot:** 8px circle, color from `getSS()` — replaces the wordy status pill at the top. The status letter (`A` / `S` / `D` / `F`) sits next to the dot. Full label appears in the native `title` tooltip on hover.
- **Stock bar:** 8 px tall, full width, green when above minStock, red when low. Reserved overlay shown as a stripe-pattern segment if `reserved > 0`.
- **Hover:** `transform: translateY(-2px)` + `--shadow-card-hi`. Cursor pointer. Whole card opens the slide-over.
- **Action buttons:** `opacity: 0` by default, `opacity: 1` on card hover. On touch (`(hover: none)` media query) they stay visible. Clicking an action does NOT open the detail panel.
- **Discontinued / low-stock / reserved badges:** keep current orange/blue badges, render in the top-right corner as small pill tags. Discontinued strikes through the name.

Grid: `display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px`.

## Table view (new — `ProductsTable.jsx`)

Sticky header below the toolbar (toolbar gets `z-index: 20`, table header `z-index: 10` with `top` set to the toolbar's measured height via `useRef` + `ResizeObserver`). Row hover = `var(--hover)` background. Click row → slide-over.

Columns, left to right:
1. `☐` (only when bulkMode)
2. **Product** — brand chip + code + name stacked.
3. **หมวด** — `getCN(categoryId)`.
4. **สต็อก** — `{stock} / {minStock}` with mini 60 px bar.
5. **ราคา** — `฿{price}` right-aligned, tabular-nums.
6. **สถานะ** — status pill (full label this time, since column is wide enough).
7. **ขายล่าสุด** — `{days} วัน` or `—`.
8. **⋯** — popover with `แก้ไข / สต็อก / ลบ`.

Every header except the kebab is sortable — click to toggle asc/desc, chevron indicates direction. Sort state replaces the existing `sortBy` state (table can write the same `sortBy` values).

Density toggle (above table): `comfortable` (44 px row) | `compact` (32 px row). Persist as `localStorage["productTableDensity"]`.

## Slide-over detail panel (replaces detail modal)

New component `ui/SlideOver.jsx`:

- Rendered as a portal-style fixed panel, anchored right.
- Width: 520 px on desktop, 100 vw on mobile (`max-width: 100vw`).
- Backdrop: `rgba(0,0,0,.35)` + `backdrop-filter: blur(4px)`.
- Animation: `transform: translateX(100%) → 0`, 240 ms `--ease-out`. Backdrop fades in.
- Closes on: `Esc`, backdrop click, or close button.

Inside the panel:
- **Header**: brand monogram (color), `brand — name`, close `✕`.
- **Body**: lift the entire current detail-modal content as-is — 4 stat tiles, movement log, SO list. Do not re-derive data; reuse the existing `detailPr` state path so behavior is identical.
- **Sticky footer**: `[แก้ไข]` (opens edit modal), `[ปรับสต็อก]` (opens adjust modal), `[ลบ]` (confirm-delete modal).

The current `setDetailPr(pr)` flow stays — we just render it through `SlideOver` instead of `Modal`.

## Edit modal & adjust modal & bulk-action bar (refresh only — no logic change)

- Spacing/typography pass: section headers become small uppercase tracking-wide labels; form rows align to the new type scale.
- The "ขนาดกล่อง (cm)" and "ขายแยกส่วน" sections collapse under a single `▾ Advanced` toggle (closed by default for new products, open by default if values exist on the product being edited).
- Bulk-action bar: bigger touch targets, shadow `--shadow-card-hi`, icons next to each label. Functionality untouched.

## Motion

- View switch (card ↔ table): 150 ms fade.
- Sparkline path-draw: 600 ms on mount.
- Card hover lift: 120 ms ease-out.
- Slide-over open: 240 ms ease-out (transform + opacity).
- Status chip pulse: low-stock card pulses `box-shadow` every 3 s when `stats.low > 0`.

## File-level scope

### New files

- `src/components/ui/Sparkline.jsx` — 60×24 inline SVG line. Props: `points: number[]`, `color`, `animate?: boolean`.
- `src/components/ui/SlideOver.jsx` — generic right-anchored slide-over with backdrop, `Esc`/click-out, focus trap, sticky footer slot.
- `src/components/ui/BrandChipRow.jsx` — horizontal-scroll brand chip selector. Reuses `BRAND_COLORS`.
- `src/components/ProductsTable.jsx` — table view of the same `visible[]` array. Receives the same handlers (`setDetailPr`, `setForm`, `setAdjPr`, `setConfirmDel`).
- `src/utils/productStats.js` — helpers for building daily snapshot series from `logs[]` and `sales[]` for sparklines. Pure functions, fully testable.

### Modified files

- `src/components/Products.jsx` — rewrite the render layer (top stat strip, toolbar, body switch between card/table). Logic (state, handlers, modals) stays.
- `src/components/ui/StatCard.jsx` — extend to optionally render delta chip + sparkline. Existing usage (no props) keeps working — both new props are optional.
- `src/styles.css` — append the new design tokens.

### Untouched

- Edit modal contents (only CSS pass).
- Adjust modal contents (only CSS pass).
- Bulk action handlers and modals.
- `ExcelImport.jsx`, `CategoryManager.jsx`.
- All data layer / Supabase sync.
- `StockValueDonut` / `buildBrandSubData` — used as-is inside the breakdown.
- Dark mode CSS vars.
- Behavior in the existing detail modal (it's reused inside the slide-over).

## Testing

- Existing tests must stay green (109/109). The render-layer rewrite should not break logic-level tests.
- New unit tests in `src/utils/productStats.test.js`:
  - Daily stock-value series sums correctly with multiple logs per day.
  - Empty `logs[]` returns a flat series at current value.
  - Low-stock count series respects `minStock = 0` (means "no alert").
- New component tests:
  - `Sparkline.test.jsx` — renders a polyline with the right number of points, handles `points.length < 2` gracefully.
  - `SlideOver.test.jsx` — `Esc` closes, backdrop click closes, focus returns to trigger.
  - `BrandChipRow.test.jsx` — single-select toggles correctly; counts match input.

## Out of scope (not in this redesign)

- Product images / thumbnails (not in current data model).
- Bulk-action redesign beyond visual refresh.
- Excel-import flow restyling.
- Category-manager modal restyling.
- Dark-mode token revisions (existing palette works).
- Mobile-specific layout beyond responsive grid + 100vw slide-over.

## Acceptance criteria

- `npm run typecheck` → 0 errors.
- `npm run build` → succeeds.
- `npm test` → all green, including new tests.
- Cards and table both render every product currently visible, with the same filter/sort/bulk semantics.
- Slide-over opens for every product click, shows the same data the current modal does.
- View choice persists across reload via localStorage.
- Sticky toolbar stays usable when scrolled.
- No regressions in: edit modal, adjust-stock modal, bulk operations, Excel import, category manager, brand breakdown.
