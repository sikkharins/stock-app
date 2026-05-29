# TS Electronics Stock Management App — Project Handoff

**Last updated**: 2026-05-29

## Overview
A full-featured inventory / sales / purchasing / finance Progressive Web App (PWA)
for **TS Electronics** (Thai electronics distributor). Built as a **single-page
React app** deployed on **Vercel**, using **Supabase** as the cloud database, auth
provider, and realtime channel. The UI is Thai-first with an EN toggle.

| | |
|---|---|
| **Production URL** | https://stock-app-gray-seven.vercel.app |
| **GitHub** | https://github.com/sikkharins/stock-app (branch `master`) |
| **Owner** | sikkharins@gmail.com |
| **Dev server** | `npm run dev` (Vite) |
| **Build** | `npx vite build` (or `npm run build`) |
| **Deploy** | `npx vercel --prod --yes` — **manual, NOT GitHub-connected** |

> ⚠️ The local dev machine does **not** have `bun` installed — use `npm`/`npx`.
> Pushing to GitHub is for version control/backup only; it does **not** trigger a
> deploy. Deploys are always manual via the Vercel CLI.

---

## 1. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React + Vite (SPA, PWA) | 19.2 / 8.0 |
| Styling | Inline styles + CSS variables (`src/styles/theme.js`) | no CSS framework |
| Backend/DB | Supabase — single `app_data` table (key→JSON blob) | 2.106 |
| Auth | Supabase Auth (email/password, `profiles` table) | |
| Realtime | Supabase Realtime (postgres_changes on `app_data`) | |
| AI | Anthropic Claude API via `api/ai-chat.js` | Haiku class |
| Serverless | Vercel functions in `api/` | |
| PWA | vite-plugin-pwa (Workbox `generateSW`, offline) | 1.3.0 |
| Charts | Recharts | 3.8 |
| Excel | SheetJS (xlsx) | 0.18 |
| Markdown | marked + DOMPurify (AI chat rendering) | |
| Images | sharp (asset/logo prep) | 0.34 |

---

## 2. Architecture

### 2.1 Single source of state
`src/App.jsx` is the root and holds **all application state** (every entity array)
via `useState`. There is **no router** and **no Redux/Context** — the active screen
is a `tab` string, and all data + setters + helpers are bundled into one shared
object **`sh`** (defined ~line 265) passed to every page. Components destructure
only what they need, e.g. `const { sales, setSales, payments } = sh;`.

Cross-component writes are normal — e.g. `Sales.jsx` calls `sh.setPOs()` for
drop-ship, and `FinancialCalendar.jsx` calls `sh.setPayments()` to delete a payment.

Pages are **lazy-loaded** (`React.lazy` + `Suspense`) and rendered conditionally on
`tab`.

### 2.2 Persistence (whole-array blobs)
Data is stored **per-entity as one JSON array**, not per-row.

- **Supabase `app_data`**: rows of `{ key, data, updated_at, updated_by }`. Each
  `key` (e.g. `"sales"`, `"payments"`) holds the entire array in `data`.
- **localStorage**: synchronous cache mirror keyed `v3_<entity>`. Cleared on logout
  (except `v3_theme`, `fab_pos`, `ai_bot_settings`).
- **Key mapping** in `src/utils/storage.js` (`KEY_MAP`): `v3_products → products`,
  etc.
- **21 synced keys**: products, contacts, pos, sales, cats, brands, logs, payments,
  activity, quotes, targets, audit, pricehist, cheques, bankaccs, banktxns, cnotes,
  billings, defectives, supcnotes, promos. (Plus `bot_config` and per-user
  `ai_chat_<userId>`, `ai_memory`, `ai_product_notes`, `ai_customer_notes`.)
- **Auto-save**: a `useEffect` in `App.jsx` (~line 231) watches all arrays and
  **debounces 800ms** → writes localStorage, then upserts changed keys to Supabase
  (`saveAllToSupabase`). A `beforeunload`/`visibilitychange` handler flushes pending
  writes. **No save button.**
- **Load**: on mount, `loadAllFromSupabase()` (5s timeout) → `applyData()`; falls
  back to localStorage, then to `initData` seeds. Empty arrays are handled with
  `v != null` (not `.length`) so a legitimately-empty entity isn't reseeded.
- **Realtime**: `subscribeRealtime` applies UPDATE events from **other** users
  (`updated_by !== me`). A `realtimeSkipRef` (2s window) prevents echoing your own
  writes back into state.
- **Refresh**: pull-to-refresh (mobile) and the top-bar `↻` button re-pull from
  Supabase.

> **Implication:** there are **no DB-level cascades**. All cascading deletes are
> performed in JS before the array is saved (see §4.3 / §4.4).

### 2.3 Service worker
`App.jsx` polls `serviceWorker` registrations every 60s, posts `SKIP_WAITING`, and
auto-reloads on `controllerchange`. After a deploy, a hard refresh shows changes
immediately.

---

## 3. Authentication & Permissions

- **Login** (`LoginScreen` in `App.jsx`): username + password. `signIn()`
  (`src/utils/auth.js`) maps username → `<username>@app.local` and calls Supabase
  Auth, then loads the `profiles` row.
- **`profiles` table**: `{ id, username, role, sales_name, supplier_name,
  supplier_staff_id, staff_name, role_title, dashboard_widgets, perms, signature }`
  (mapped via `profileToUser`/`userToProfile`).
- **First-run migration**: if no profiles exist, `migrateUsers()` seeds Supabase
  Auth + profiles from `initUsers` and supplier staff.
- **Admin RPCs** (Postgres functions): `ensure_user`, `admin_update_email`,
  `admin_update_password`, `delete_user` — used by the Users page.

### Permission model
`cu` = current user; `cu.perms` keyed by tab. A value is either a string
(`"edit"`/`"view"`/`"none"`) or `{ access, read, create, edit, delete, approve }`.
`gP(tab)` in `App.jsx` normalizes it; **Admin always gets full access + approve**.
Helpers on `sh`: `canA` (access), `canC` (create), `canE` (edit), `canApv`
(approve). Supplier accounts (`cu.supplierName`) get a restricted read-only view.

### Seed accounts (`src/data/initData.js`)
| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Admin |
| manager | manager123 | Manager |
| warehouse | warehouse123 | Warehouse |
| accountant | accountant123 | Accountant |
| somchai / somying / wichai / pimjai | 123456 | Sales (named) |
| bkksupply | supplier1 | Supplier (Bangkok Supply) |
| siamind | supplier2 | Supplier (Siam Industrial) |

> `role` is a free string on the profile; the Users page can define other role
> presets. **Change all default passwords before production.**

---

## 4. Domain Entities & Workflows

### Navigation (sidebar groups — `App.jsx NAV_SECTIONS`, `constants.js`)
| Section | Tabs |
|---------|------|
| Workspace (พื้นที่ทำงาน) | dashboard, products, stock_log, purchase, sales, promos |
| Manage (การจัดการ) | finance, reports, sales_overview, defective, suppliers, customers |
| Planning (วางแผน) | financial_calendar |
| System (ระบบ) | users |

Tabs are filtered by permission; sidebar badges show pending PO approvals and SO
deliveries/special-approvals.

### 4.1 Products / Stock
- **Product** (`Products.jsx`): `{ id, code, name, nameT, brand, categoryId,
  subcategoryId, size, price, cost, stock, minStock, unit, distributor }`.
- **Categories** (`CategoryManager.jsx`): `cats = [{id, name, subs:[{id,name}]}]`;
  brands are a string array.
- **Low stock** = `minStock > 0 && stock <= minStock` (drives dashboard + notifs).
- **Excel import**: `ExcelImport.jsx` (products), `ContactExcelImport.jsx`
  (contacts). Price/cost edits log to **price history**.
- **Stock Log** (`StockLog.jsx`): append-only movements via `mkLog` →
  `{ id, date, productId, type, qty, qtyBefore, qtyAfter, ref, note, user }`.
  Types (`MOVE_TYPES`): `in`, `out`, `adjust_in`, `adjust_out`, `cn_return`,
  `cn_cancel`, `cn_edit`, `cn_defective`. Individual entries can be deleted (removes
  the history record only; does not change current `product.stock`).

### 4.2 Purchase Orders (PO) — `PurchaseOrders.jsx`
**Statuses:** `draft → pending_approval → approved → received` (or `cancelled`;
legacy `pending`).
Shape: `{ id, poNum:"PO-YYYY-NNN", supplierId, date, deliveryDate, creditDays,
status, items:[{productId, qty, cost, sellPrice}], note, createdBy, dropShip,
dropShipCustomerId, linkedSO, approval, approvalHistory, rejectionReason }`.
- Reject at `pending_approval` → back to `draft` (+ rejection reason), resubmittable.
- **Receive** → adds qty to `product.stock` (logs `in`).
- **deletePO** (Admin) → cascade: deletes linked SO + AP payments + matching bank
  txns + cheques.

### 4.3 Sales Orders (SO) — `Sales.jsx`
**Statuses:** `pending_delivery → completed`; `pending_special_approval` triggers
when a price is overridden or `extraDiscPct > 0`.
Shape: `{ id, soNum:"SO-YYYY-NNN", customerId, date, status, fromQuote, linkedPO,
dropShip, items:[{productId, qty, price}], includeVat, vatAmount,
payType("cash"|"credit"), discountAmt, discPct, extraDiscPct, creditDays, useVatRep,
vatRepName, vatRepAddress, vatRepIdCard, origPrices, note }`.
- **confirmDelivery** → deducts stock (drop-ship: +in via PO, −out via SO, net 0;
  PO auto-becomes `received`).
- **confirmDel** → if completed, restores stock (+ `adjust_in` "ยกเลิก SO" log) and
  **cascades** deletion of AR payments + matching bank txns + cheques.

> ### ⚠️ VAT is INCLUSIVE (critical business rule)
> Entered prices already contain VAT.
> `vatAmount = round2((items − discount) × 7 / 107)` is only the **embedded** tax
> portion. **Customer net payable = `items − discount`** — never add `vatAmount` on
> top. This is the authoritative behavior in `PrintDocument.jsx`
> (ยอดสุทธิ = after-discount; VAT label = "รวมในราคา"). Every AR / AP / calendar /
> dashboard total must follow this rule.

### 4.4 Finance (AR / AP) — `Finance.jsx`
The money hub. Entities:
- **payments**: `{ id, refId(soNum|poNum), type("ar"|"ap"), amount, method, date,
  note, name, accId, chequeNo, chequeBank, chequeDue, billId }`.
- **bankTxns**: `{ id, accId, type("in"|"out"), amount, date, from, refId, note }` —
  auto-created for bank-transfer payments and **matched back to its payment by
  (refId, amount≈, date, type)**.
- **cheques**: `{ id, chequeNo, bank, amount, date, dueDate, from, refId, note,
  status("pending"|"deposited"|"cleared"|"bounced"), depositAccId, depositDate }`.
- **bankAccs**: `{ id, name, bank, accNo, perms:{receive, clearCheque, payEPP,
  transferOut} }` (3 seeded accounts: กสิกรไทย / ไทยพาณิชย์ / TTB).
- **cnotes / supCNotes** (Credit Notes, `type:"return"|"defective"|"promo"`): reduce
  billed amounts (customer / supplier).
- **billings (ใบวางบิล)**: group multiple SOs (+ apply CN credits) into one bill.
- `arList` (completed credit SOs) / `apList` (received POs) compute
  `total/paid/remaining/status2`. **AR total = `items − discountAmt`** (VAT
  inclusive).
- `delPay(p)` removes a payment **and** its matching bank txn (+ cheque) so balances
  self-correct.

### 4.5 Financial Calendar (ปฏิทินการเงิน) — `FinancialCalendar.jsx`  *(newer)*
Month grid + per-day detail panel for cash flow.
- **Actual payments** (green "รับแล้ว"/"จ่ายแล้ว") read directly from `payments[]`.
- **Pending dues** computed from credit SOs (AR), received POs (AP), and pending
  cheques, placed on due dates. AR due = `creditDays` (credit) else 7 days; AP due =
  `(deliveryDate||date) + creditDays`.
- Each **actual-payment row has a delete button** → removes payment + matching bank
  txn (+ cheque). Pending rows are computed and have no delete.

### 4.6 Quotes (QT) — `Quotes.jsx`
`draft → sent → approved → converted` (also `cancelled` / expired by `validUntil`).
`convertToSO()` creates an SO with `fromQuote=qtNum`. Same VAT-inclusive model.

### 4.7 Defective Products — `DefectiveProducts.jsx`
RMA/defect tracking with separate supplier-side status
(`pending_inspection → inspected → stored → cn_received`) and customer-side
(`cn_created → cn_used`). Linked product → customer → SO; integrates with CN
(`type:"defective"`).

### 4.8 Promotions — `Promotions.jsx`
Tiered promos by brand/category, measured by amount or qty:
`tiers:[{threshold, rewardType, rewardValue, rewardProductId}]`; computed status
Active/Scheduled/Expired/Inactive.

### 4.9 Dashboard — `Dashboard.jsx`
User-configurable widgets (`DASH_WIDGETS`): product count, stock value, sales total,
profit, low stock, recent PO, recent stock log; plus quick-action cards and (for
managers) monthly target progress.

### 4.10 Reports — `Reports/ReportsPage.jsx`
Tabs: `overview`, `compare`, `targets`, `vatreport` (VAT-rep breakdown), `audit`,
`prices` (price history).

### 4.11 Sales Overview (ภาพรวมเซลส์) — `SalesOverview.jsx`  *(newer)*
Pivot of sales by customer × brand × month, with year/quarter/salesperson/brand/
customer filters, CSV export, and a print report (window.open HTML in the
`PrintDocument` style).

### 4.12 Print Documents — `PrintDocument.jsx`
Print/PDF HTML for `so` (tax invoice), `po`, and `qt`. Company header (logo, Thai/EN
name, address, tax ID). **Authoritative source of the VAT-inclusive rule.**

### 4.13 AI Bot — `AISOBot.jsx` (+ `utils/aiChat.js`, `api/ai-chat.js`)
Floating assistant. Callbacks in `App.jsx` let it create SO/PO/QT and update
products (`onCreateSO`, `onCreatePO`, `onCreateQuote`, `onUpdateProducts`) — all
honor the VAT-inclusive model.
**Capabilities:** natural-language SO/PO/Quote creation, stock & AR/AP queries,
analytics (trends, top products/customers), vision (product ID from photos, document
reading), PDF export, and text-to-speech via `api/tts.js`. Per-user chat history
(`ai_chat_<userId>`), shared AI memory + product/customer notes injected into the
system prompt, and cancel-feedback logging.

### 4.14 Users / Backup
- **Users.jsx** — Admin CRUD over Supabase Auth profiles + per-tab permission
  presets; supplier staff scoped to a supplier.
- **BackupManager.jsx** — Admin JSON export/import of all entities.

---

## 5. Notable Features

### Drop-Ship / Off-Site Delivery (ส่งนอกสถานที่)
Supplier ships directly to customer.
`Create PO (toggle ส่งนอกสถานที่ + pick customer) → submit → approve (auto-creates
linked SO in pending_delivery) → customer confirms receipt → click จัดส่ง on SO →
SO completed + PO auto-received → stock logs +in then −out (net 0)`.
Cross-reference badges link PO↔SO. Drop-ship SO can't be deleted while linked.
Cancelling a PO deletes its linked SO (if not completed).

### Customer Group (กลุ่มลูกค้า) — `Contacts.jsx`
`customerGroup`: `"regular"` (ประจำ) or `"walkin"` (หน้าร้าน). Filter tabs + form
dropdown + card badge.

### Draggable FAB & Smart Back Button — `App.jsx`
Glass-style floating action button (drag, edge-snap, position saved to `fab_pos`)
for quick-create. Browser back is intercepted for progressive dismissal (FAB →
sidebar → notifications → backup → modal → dashboard → exit confirm).

---

## 6. Conventions & Gotchas

1. **Inline styles only** + CSS variables: `var(--blue|green|red|orange|purple|
   panel|line|dim|faint|bg|bg2|text|hover|blue-bg)`. Light/dark via
   `document.documentElement.dataset.theme`.
2. **Very compact code** — dense single-line components. Match surrounding style.
3. **Thai UI** — labels/buttons/messages in Thai; `lang` toggles EN where provided.
4. **IDs**: `Date.now()` (+`Math.random()` for logs). Doc numbers
   `SO/PO/QT-YYYY-NNN`, max-suffix +1 per year.
5. **Dates**: stored `YYYY-MM-DD`; displayed in Thai Buddhist year (`+543`) via
   `toBE`/`nowStr`. Calendars show `year + 543`.
6. **Money**: always `round2()`. **VAT inclusive** (net = items − discount).
7. **No DB cascades** — clean payments/bankTxns/cheques in JS when deleting SO/PO.
8. **Adding a field**: update empty form state → save mapping → edit populate → UI.
   No schema migration (raw JSON).
9. **Document linking**: store ref number as string, render clickable badge,
   navigate via `sh.handleTab(tab); sh.setSearch("DOC-NUMBER")`.

### Key utilities (`src/utils/helpers.js`)
`fmt`, `round2`, `todayStr`, `nowStr`, `toBE`, `fmtD`, `mkLog`, `mkAudit`, `AddDue`,
`getSS` (stock status), `getNotifs`. On `sh`: `pN`, `cN`, `oM`/`cM`, `addLog`,
`addA`, `addPH`.

---

## 7. Build & Deploy

```bash
npm install
npm run dev          # Vite dev server
npx vite build       # production build → dist/ + service worker
npx vercel --prod --yes   # deploy (manual)

# version control (does NOT deploy)
git add <files> && git commit -m "msg" && git push origin master
```

Supabase URL / anon key: `src/utils/supabase.js`. Realtime requires `app_data` to
have realtime enabled and the admin RPCs deployed.

---

## 8. Recent Changes

```
cf9925e  fix: calendar payment delete button + SO/PO delete cascade payments/bankTxns/cheques
f47a30d  fix: VAT double-counting in AR totals (Finance ×5, Calendar ×1) — net = items − discount
008e1d5  feat: drop-ship (off-site delivery)
66f1300  feat: customer group (regular/walk-in) filter
e5aab4b  feat: draggable FAB, glass style, smart back button
125f4a5  feat: per-user AI chat, product/customer notes, cancel feedback
```

- **VAT double-count fix (`f47a30d`)**: removed `+ vatAmount` from AR totals so the
  customer net follows the VAT-inclusive rule.
- **Calendar delete + cascade (`cf9925e`)**: added a delete button for actual
  payments in the Financial Calendar, and made SO/PO deletion cascade-delete their
  payments / bank txns / cheques (prevents orphaned records that previously lingered
  in the calendar and overstated bank balances).

---

## 9. Known Considerations

1. **No test suite** — verification = `npx vite build` + manual testing.
2. **Single Supabase table** — all data as JSON blobs; fine at current scale, but no
   row-level queries/cascades.
3. **No CI/CD** — manual deploy; GitHub for backup only.
4. **Walk-in sales without a customer**: intentionally not allowed — Thai VAT law
   requires name/address/ID on invoices.
5. **`App.jsx` is large** — state + routing + sidebar + FAB + back button live here.
6. **Permanent deletes are irreversible** (no trash); deletions are user-initiated.

## 10. Discussed but Not Implemented
- LINE OA integration (Flex Messages: SO/delivery/payment notifications)
- Business rules (auto reorder, credit-limit enforcement, target bonuses)
