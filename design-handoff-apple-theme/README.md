# Handoff: Apple Light + Dark theme for TS Stock OS

> **For Claude Code**  
> โฟลเดอร์นี้คือ design reference ของ TS Stock OS ในธีม Apple-style (light + dark)  
> งานของคุณคือ **นำดีไซน์มาใส่ใน codebase ที่มีอยู่แล้ว** (`stock-app/`) โดยใช้ React + inline styles + responsive.css เดิม — ไม่ใช่ copy HTML ลงตรง ๆ

---

## 1. Scope

ปรับ aesthetic ของ `stock-app` ทั้งระบบให้เป็นธีม **Apple Light + Dark** โดย:

- คงโครงสร้าง React component เดิมทั้งหมด (Dashboard, Products, Sales, Quotes, Finance, Reports ฯลฯ)
- คงพฤติกรรม / state / permissions / localStorage / VAT rep / printDoc / Activity tracking ทั้งหมด
- เปลี่ยน **เฉพาะ visual layer**: สี, typography, spacing, borders, shadows
- เพิ่ม **theme toggle** (Light / Dark) เก็บใน localStorage key `v3_theme`

---

## 2. Design tokens

ทำ `src/styles/theme.js` หรือ inject `<style>` ใน `App.jsx` ที่ตั้ง CSS variables บน `<html>` ตาม theme:

### Light

```css
:root[data-theme="light"]{
  --bg:#f5f5f7;        /* page bg, sidebar */
  --bg2:#ffffff;       /* inputs, secondary surfaces */
  --panel:#ffffff;     /* cards, modals */
  --hover:#f5f5f7;
  --hover2:#ebebed;
  --line:#e5e5ea;      /* borders */
  --line2:#d2d2d7;     /* stronger borders */
  --shadow:0 1px 0 rgba(0,0,0,0.04),0 0 0 0.5px rgba(0,0,0,0.06);
  --text:#1d1d1f;
  --dim:#6e6e73;
  --faint:#86868b;
  --blue:#0071e3;      /* primary action */
  --blue-bg:rgba(0,113,227,0.08);
  --blue-hover:#0077ed;
  --green:#34c759;
  --orange:#ff9500;
  --red:#ff3b30;
  --yellow:#ffcc00;
  --teal:#5ac8fa;
  --purple:#af52de;
  --pink:#ff2d55;
  --topbar-bg:rgba(245,245,247,0.78);
  --sidebar-bg:#f5f5f7;
  --rowhover:rgba(0,0,0,0.03);
}
```

### Dark

```css
:root[data-theme="dark"]{
  --bg:#1c1c1e;
  --bg2:#2c2c2e;
  --panel:#2c2c2e;
  --hover:#3a3a3c;
  --hover2:#48484a;
  --line:#38383a;
  --line2:#48484a;
  --shadow:0 0 0 0.5px rgba(255,255,255,0.06);
  --text:#f5f5f7;
  --dim:#98989d;
  --faint:#6c6c70;
  --blue:#0a84ff;
  --blue-bg:rgba(10,132,255,0.16);
  --blue-hover:#409cff;
  --green:#30d158;
  --orange:#ff9f0a;
  --red:#ff453a;
  --yellow:#ffd60a;
  --teal:#64d2ff;
  --purple:#bf5af2;
  --pink:#ff375f;
  --topbar-bg:rgba(28,28,30,0.78);
  --sidebar-bg:#1c1c1e;
  --rowhover:rgba(255,255,255,0.05);
}
```

### Typography

```css
body{
  font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','SF Pro Display',
              'Inter','Noto Sans Thai',system-ui,sans-serif;
  font-size:13px;
  line-height:1.4;
  letter-spacing:-0.005em;
  -webkit-font-smoothing:antialiased;
  color:var(--text);
  background:var(--bg);
}
/* Numbers use tabular nums */
.num{ font-variant-numeric:tabular-nums; font-feature-settings:'tnum'; }
```

### Radius & spacing scale

| Token | Value | Use |
|---|---|---|
| radius-sm | 6px  | small buttons, chips, kbd |
| radius-md | 8px  | buttons, inputs, segment ctl |
| radius-lg | 12px | cards, panels, modals |
| radius-pill | 99px | pills/badges/progress bar |
| gap-xs | 6px |  |
| gap-sm | 10px |  |
| gap-md | 14px | between cards |
| gap-lg | 18px | between panel sections |
| gap-xl | 24px | between page sections |
| page padding | 28px 32px | main content |

---

## 3. Component mapping (existing → restyle)

| Existing file | What to change |
|---|---|
| `src/utils/constants.js` | Replace `IB` input style, `BRAND_COLORS`, `STOCK_STATUS`, `MOVE_TYPES` colors to use CSS vars. Status icons stay (🟢🟡🔴⚫) but `color`/`bg` become CSS-var-based with theme support. |
| `src/components/ui/Btn.jsx` | New variants: `pri` (filled blue), default (outlined), `ghost`, `sm`/`lg` sizes. Border-radius 7px, padding 6×13. |
| `src/components/ui/Field.jsx` | Labels in `--dim` 11.5px. Required mark uses `--red`. Input borders 1px `--line`, focus = `--blue` + 3px `--blue-bg` ring. |
| `src/components/ui/Modal.jsx` | Backdrop `rgba(0,0,0,0.45)` + `backdrop-filter:blur(6px)`. Modal: `--panel` bg, 14px radius, 32px×80px shadow. Header/body/footer get explicit `background:var(--panel)`. |
| `src/components/ui/Badge.jsx` | Pill style: 2px 8px padding, 99px radius, 11.5px font, 500 weight, soft tinted bg (alpha 0.12 of accent). |
| `src/components/ui/StatCard.jsx` | 18px×20px padding, 12px radius, icon chip 28px×28px (accent + alpha 0.12 bg). Value 28px 600 weight tabular. Delta in `--green`. |
| `src/components/ui/SearchBar.jsx` | Use `--bg2` bg, 1px `--line` border, 7px radius, prefix `⌕` icon at 11px left. |
| `src/components/ui/Sel.jsx` | Match `Field` input styling. Inline SVG chevron in `--dim` color, mask uses currentColor so it themes. |
| `src/components/ui/ProductPicker.jsx` | Dropdown panel: `--panel` bg, `--line` border, 8px radius, item rows hover `--rowhover`. Real-time stock badge: `--green` if available, `--red` if `qty > avail`. |
| `src/components/ui/GlobalSearch.jsx` | Top bar search component. Translucent: `--topbar-bg` + `backdrop-filter:saturate(180%) blur(20px)`. |
| `src/App.jsx` | Add `<html data-theme={theme}>` toggle. Sidebar uses `--sidebar-bg`, items 7px radius, active state = `--blue-bg` + `--blue` text. Topbar 52px tall, translucent. |
| `src/components/Dashboard.jsx` | 4-col stat row with accent variations (blue/green/orange/purple). Charts use `--blue` linear gradient bars over `--line2` purchase bars. Targets show progress bar with `--green` if ≥100%, `--orange` if <75%. |
| `src/components/Products.jsx` | Keep brand-grouped layout. Replace `BRAND_COLORS` row backgrounds with neutral header (transparent + 1px `--line` divider). Cards: `--panel`, 12px radius, 16px padding, stock bar uses `--green`/`--orange`/`--red` based on level. |
| `src/components/Sales.jsx` (SO) | List uses tables with 11.5px uppercase letterspaced headers, `--bg` header bg. Customer cell shows 30px avatar + name + sub-meta. Status pills with colored dot prefix. Modal use new backdrop. |
| `src/components/Quotes.jsx` | Same table treatment. Status flow pills: draft (gray), sent (blue), approved (green), converted (purple), cancelled (red), expired (red). |
| `src/components/Finance.jsx` | AP/AR tabs. Overdue = `--red` pill. Show due date relative ("overdue 5d" or "due in 12d"). |
| `src/components/Reports/Overview.jsx` | Replace simple horizontal bars with grouped vertical bars over 7 months. Y-axis labels in `--faint`. Gridlines 1px `--line`. |
| `src/components/Reports/Compare.jsx` | Two-column delta cards. Up arrow `--green`, down `--red`. |
| `src/components/Reports/Targets.jsx` | Avatar circle (linear-gradient blue → teal), percentage in `--green` if achieved. |
| `src/components/Reports/VATRepReport.jsx` | Expandable rep rows with monthly breakdown. Use `<details>` or controlled state. |
| `src/components/Reports/AuditLog.jsx` / `PriceHistory.jsx` | Standard table style. |
| `src/components/PrintDocument.jsx` | **Do not** apply dark theme to print. Force light colors for `@media print`. |
| `src/styles/responsive.css` | Add `@media (prefers-color-scheme: dark)` fallback. Mobile breakpoints unchanged. |

---

## 4. Theme toggle

Add a Sun/Moon button in the topbar next to the bell:

```jsx
// in App.jsx
const [theme, setTheme] = useState(() => localStorage.getItem('v3_theme') || 'light');
useEffect(() => {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('v3_theme', theme);
}, [theme]);

// in topbar
<button className="icon-btn" onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
  {theme === 'light' ? '🌙' : '☀'}
</button>
```

Default to **light**. Respect `prefers-color-scheme` only on **first visit** (no key in localStorage yet).

---

## 5. Critical behaviors to preserve

| Feature | Requirement |
|---|---|
| Stock check in SO modal | Real-time validation: if `qty > avail`, set input border `--orange`, show `⚠ เกินสต็อก (ขาด N)` in `--red`, disable save button. |
| VAT representative | Checkbox + dropdown of customer's `vatReps[]`. When checked but customer has 0 reps, show inline link "+ เพิ่มในข้อมูลลูกค้า". |
| Discount chips | Cash: 0/1/2/3/5%. Credit: 7/15/30/45/60/90 days. Active chip = `--blue-bg` + `--blue` border. |
| Stock status (Active/Slow/Dead/Fossil) | Days thresholds in `STOCK_STATUS` unchanged (7/30/90/180). Map colors: active→`--green`, slow→`--orange`, dead→`--red`, fossil→`--faint`. |
| Print | `PrintDocument.jsx` must override to light theme (white bg, black text, system font) regardless of app theme. Add `@media print { :root { --bg:#fff; --text:#000; ... } }`. |
| Auto-save | Unchanged. 800ms debounce. |
| Permissions | Sidebar nav items hidden by `perms.<menu>.access === false`. Active item = `--blue-bg` + `--blue`. |

---

## 6. Visual reference

Open `Apple Preview.html` in this folder to see all 5 Apple-themed pages running:

- Dashboard (Light + Dark)
- Products (Light + Dark)
- Sales (Light + Dark) — including Create-SO modal with backdrop
- Reports (Light + Dark) — Overview tab active

Each variant shows full rendering with real sample data drawn from `initData.js`.

---

## 7. Implementation order (suggested)

1. **Tokens first** — create `theme.js` + inject CSS vars on `<html>`. Toggle button in topbar.
2. **UI primitives** — refactor `ui/Btn`, `ui/Field`, `ui/Modal`, `ui/Badge`, `ui/StatCard`, `ui/SearchBar`, `ui/Sel`, `ui/ProductPicker` to use vars. Replace inline-style hex codes with `var(--*)`.
3. **App shell** — `App.jsx` sidebar + topbar to match `Apple Preview.html`.
4. **Pages**, in priority order:
   - Dashboard (highest visibility)
   - Products (most-used page)
   - Sales (most complex; preserve all SO logic)
   - Reports
   - Finance / Contacts / Users (lowest priority)
5. **Print override** + responsive verification.
6. **Theme toggle persistence** + first-visit `prefers-color-scheme` detection.

---

## 8. Out of scope

Do **not**:
- Change data structures or localStorage shape (`v3_*` keys stay)
- Rename or split existing component files (preserve App.jsx routing/state shape)
- Add new dependencies (no Tailwind / Radix / shadcn) — inline styles + responsive.css only, same as today
- Touch `BackupManager.jsx` JSON shape or CSV export columns
- Modify business logic in helpers/storage/constants beyond visual constants (colors)

---

## 9. Sanity checks before declaring done

- [ ] Switch theme → all pages re-color without reload, no flicker
- [ ] Refresh browser → theme persists
- [ ] Print preview an SO → white bg, black text, readable (theme-agnostic)
- [ ] Login as `somchai` → still only sees own customers
- [ ] Create SO with `qty > avail` → save button disabled, warning shown
- [ ] Mobile (≤ 768px) → sidebar collapses, tables horizontal-scroll, touch targets ≥ 44px
- [ ] VAT rep toggle works on customers with 0/1/2+ reps
- [ ] `localStorage v3_*` keys unchanged after migration
