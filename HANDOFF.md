# TS Electronic Stock App — Engineering Handoff

**Document version:** 2.1
**Last updated:** 2026-06-02
**Audience:** Incoming developer / maintainer

---

## 1. Project Overview

**Name:** TS Electronic — Stock Management System (`stock-app`)
**Purpose:** Internal inventory, sales, and financial management for TS Electronic (Thai home-appliance distributor).
**Live URL:** Vercel deployment (`stock-app-gray-seven.vercel.app`)
**Primary language:** Thai UI, with a `lang` toggle supporting English labels.
**Users:** Small team (~10 staff). Roles: Admin, SalesManager, Sales, Supplier-staff.

### Key Capabilities
- Product catalog with categories, brands, subcategories
- Purchase Orders (PO) → inventory in
- Sales Orders (SO) → inventory out, with discounts, VAT, rep, promo, event
- Quotes (QT)
- Finance: AR/AP, billings, cheques, bank accounts, transactions, credit notes
- Defective product tracking
- Promotions (per-SO and accumulate modes)
- Lucky-draw event system with packs/rewards/awards
- Customer profile with wallet (saved rewards)
- Reports & dashboard with charts
- PWA installable on mobile

---

## 2. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React 19 + Vite 6 | JSX, no TypeScript |
| Styling | Inline styles + CSS variables | Apple-style light/dark theme via `theme.js` |
| State | `useState` + lift via `sh` prop | No Redux/Zustand |
| Backend | Supabase (`@supabase/supabase-js`) | Single table `app_data` (key/jsonb) |
| Auth | Supabase Auth | Username/password; profile stored in users array |
| Storage | localStorage + Supabase sync | JSON array per "key" (e.g. `v3_products`); per-key optimistic locking via `version` column |
| Charts | Custom SVG (no chart library deps) | Donut, AreaChart |
| Build | Vite | `npm run build` → `dist/` |
| Hosting | Vercel | Auto-deploy on git push to `main` |
| AI features | Anthropic API via Vercel function (`/api/ai-chat`) | OCR via Akson, TTS endpoint |

### Dependencies of note
- `recharts` — currently unused (legacy, can be removed)
- `xlsx` — for Excel import/export
- `sharp` — used in build chain
- `marked`, `dompurify` — for AI chat output rendering

---

## 3. Repository Structure

```
stock-app/
├── public/                  # PWA icons, bank logos
│   └── icons/banks/         # SVG + PNG bank logos
├── src/
│   ├── App.jsx              # Root component + state hub + sidebar + topbar
│   ├── components/
│   │   ├── Dashboard.jsx
│   │   ├── Products.jsx
│   │   ├── Sales.jsx        # SO modal (largest file)
│   │   ├── PurchaseOrders.jsx
│   │   ├── Quotes.jsx
│   │   ├── Finance.jsx      # AR/AP, cheques, banks, billings, CN
│   │   ├── Promotions.jsx
│   │   ├── Events.jsx       # Lucky-draw event list
│   │   ├── EventDetail.jsx  # Event tabs (setup, packs, rewards, customers)
│   │   ├── Contacts.jsx     # Customers + suppliers list
│   │   ├── CustomerProfile.jsx
│   │   ├── SupplierProfile.jsx
│   │   ├── DefectiveProducts.jsx
│   │   ├── BackupManager.jsx
│   │   ├── StockLog.jsx
│   │   ├── Reports/         # ReportsPage, sub-tabs
│   │   ├── ui/              # Shared primitives
│   │   │   ├── Modal.jsx, MBtns
│   │   │   ├── Field.jsx
│   │   │   ├── Btn.jsx
│   │   │   ├── CustomSelect.jsx
│   │   │   ├── ProductPicker.jsx
│   │   │   ├── ThaiDateInput.jsx
│   │   │   ├── SalesAreaChart.jsx
│   │   │   ├── StockValueDonut.jsx
│   │   │   ├── StatCard.jsx
│   │   │   └── ...
│   │   └── AISOBot.jsx      # AI assistant chat
│   ├── utils/
│   │   ├── helpers.js       # fmt, todayStr, mkLog, calcAccumulatedTotal, ...
│   │   ├── storage.js       # localStorage + Supabase sync layer
│   │   ├── supabase.js      # Supabase client init
│   │   ├── auth.js          # signIn, getSession, getProfile, ...
│   │   ├── constants.js     # ALL_TABS, TAB_LABELS, IB, DISC_OPTS, ...
│   │   └── csv.js           # CSV export helpers
│   ├── data/
│   │   └── initData.js      # Seed/demo data
│   └── styles/
│       ├── theme.js         # CSS variables for light/dark
│       └── responsive.css   # Mobile breakpoints
├── api/                     # Vercel serverless functions
│   ├── ai-chat.js
│   ├── akson-ocr.js
│   └── tts.js
├── index.html
├── vite.config.js           # Vite + PWA + dev API proxies + version define
└── package.json
```

---

## 4. State Architecture

### State Hub Pattern (`App.jsx`)
`App.jsx` owns all primary application state. It builds an object `sh` (shared) containing every getter and setter, then passes `sh` to each page component:

```jsx
const sh = {
  pN, cN, lang, theme,
  products, setProducts,
  contacts, setContacts,
  pos, setPOs, sales, setSales,
  // ... 30+ properties
  canE, canC, canA, canApv, canD,    // permission checkers
  modal, oM, cM,                      // modal control
  handleTab, quickCreate, clearQuickCreate,
};

<DashPage sh={sh} />
<ProdPage sh={sh} />
...
```

Each page destructures what it needs:
```jsx
function ProdPage({sh}) {
  const { products, setProducts, cats, brands, ... } = sh;
}
```

**Trade-off:** Simple to understand, no extra deps. Downsides: re-renders cascade, harder to memoize, prop drilling at scale.

### Permission System
Per-user `perms` object structure:
```js
perms: {
  dashboard: {access:true, read:true, create:false, edit:false, delete:false, approve:false},
  products:  {access:true, ...},
  sales:     {...},
  finance:   {...},
  ...
}
```

Helpers in `App.jsx`:
- `canA(key)` → has any access
- `canE(key)` → can edit
- `canC(key)` → can create
- `canApv(key)` → can approve
- `canD(key)` → can delete

Admin role gets full access automatically.

### Modal Control
- `modal` is a string ID (`"product"`, `"addSO"`, `"editSO"`, etc.)
- `oM(name)` opens modal, `cM()` closes all modals
- Each page renders `{modal === "x" && <Modal>...}` blocks

---

## 5. Data Schema (Primary Entities)

### Product
```js
{
  id: number,
  code: string,                  // SKU
  name: string,                  // English
  nameT: string,                 // Thai
  brand: string,
  categoryId: number,
  subcategoryId: number,
  size: string,
  price: number,                 // selling price (used for stock value)
  cost: number,
  stock: number,
  minStock: number,
  unit: string,
  distributor: string,           // supplier name
  defectiveStock: number,        // optional, written by Defective workflow
  discontinued: boolean,         // hides from PO/SO/Quotes
}
```

### Contact (Customer or Supplier)
```js
{
  id: number,
  type: "customer" | "supplier",
  name: string, nameT: string,
  phone, email, address, taxId,
  vatReps: [{id, name, address, idCard}],  // customer only
  salesPerson: string,                      // customer only
  defaultCreditDays, defaultDiscount, defaultPayType, defaultVat,
  linkedBrands: string[],                   // supplier only, filters PO products
  staff: [{id, name, role, username, password, perms, ...}],  // supplier staff
  // Event/Promo wallet (added 2026-05):
  promoClaims: { [promoId]: { claimedTierIds: [], lastClaimedAt, lastClaimedSO } },
  savedRewards: [
    { id, promoId, promoName, tier: {id, threshold, rewardType, rewardValue, rewardProductId}, savedAt, savedFromSO }
  ],
}
```

### Sales Order (SO)
```js
{
  id, soNum,                     // "SO-2026-001"
  legacyNum: "IV2026/05003",     // optional cross-ref to legacy system
  customerId, date,
  status: "pending_delivery" | "pending_special_approval" | "completed" | "cancelled",
  items: [{productId, qty, price}],
  origPrices: [number],          // for change detection
  includeVat: bool, vatAmount,
  payType: "cash" | "credit",
  discountAmt, discPct, extraDiscPct,
  rewardDiscPct, rewardDiscAmt,  // from promo/event wallet
  appliedRewards: [{promoId, tierId, source: "claim"|"wallet", walletId?}],
  creditDays,
  useVatRep, vatRepName, vatRepAddress, vatRepIdCard,
  note,
  fromQuote: string,             // QT number if converted
  linkedPO: string,              // for drop-ship orders
  dropShip: bool,
  eventId, eventPackPurchases: [{packId, qty}],   // legacy pre-condition-based events
}
```

### Purchase Order (PO)
```js
{
  id, poNum, supplierId, date,
  status: "pending" | "pending_approval" | "approved" | "received" | "cancelled",
  items: [{productId, qty, cost}],
  linkedSO: string,              // drop-ship
  note,
}
```

### Promotion
```js
{
  id, name, startDate, endDate,
  active: bool,
  measureBy: "amount" | "qty",
  mode: "per_so" | "accumulate",   // accumulate = per-customer wallet
  brands: string[],                 // filter
  categoryIds: number[],
  tiers: [
    { id, threshold, rewardType: "percent"|"fixed"|"product", rewardValue, rewardProductId }
  ],
}
```

### Event (Lucky-Draw)
```js
{
  id, name, description, startDate, endDate,
  status: "draft" | "active" | "closed",
  packs: [
    { id, packCode, name, couponsPerPack,
      measureBy: "amount"|"qty", threshold,
      brands: string[], categoryIds: number[], productIds: number[] }
  ],
  rewards: [{id, productId, totalQty}],
  customerTargets: [{customerId, targetPacks, note}],
  awards: [{id, customerId, rewardId, qty, awardedAt, note}],
}
```

### Cheque
```js
{
  id, chequeNo, bank, amount,
  receiveDate, dueDate, from, refId, note,
  status: "pending" | "deposited" | "cleared" | "bounced",
  depositAccId, depositDate,
  bounceResolve: "none" | "new_cheque" | "transfer",
  bounceNewChqNo, bounceTxnAccId, bounceTxnDate, bounceDate,
}
```

Other entities (Quote, Billing, Payment, CreditNote, BankAccount, BankTxn, Defective, ActivityLog, AuditLog, PriceHistory) — see `initData.js` and `applyData()` in `App.jsx` for full list.

---

## 6. Persistence Layer (`utils/storage.js`)

### Single-table Supabase pattern
All data lives in one table:

```sql
table app_data:
  key text PRIMARY KEY,     -- e.g. "products", "sales", "events"
  data jsonb,                -- entire array as one JSON blob
  updated_at timestamptz,
  updated_by text,            -- user id
  version integer NOT NULL DEFAULT 0   -- optimistic-lock counter (added 2026-06-02)
```

> ⚠ **Prerequisite for the optimistic-sync code:** the `version` column must exist. If it is missing, `loadAllFromSupabase()` (which selects `version`) errors and the app falls back to **localStorage only** — no Supabase load or save. Run once in the Supabase SQL editor:
> ```sql
> ALTER TABLE app_data ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0;
> ```
> This is additive and safe to run before deploying the new client.

`KEY_MAP` translates localStorage keys to Supabase keys:
```js
const KEY_MAP = {
  v3_products: "products",
  v3_contacts: "contacts",
  v3_events: "events",
  // ... 22 mappings
};
```

> ⚠ **Critical:** When adding a new state array in `App.jsx`, you MUST add its mapping to `KEY_MAP`. Missing entries silently skip sync to Supabase. (Encountered this bug with `v3_events` — see Section 9.)

### Save flow — diff-only + per-key optimistic locking (rewritten 2026-06-02)
The autosave `useEffect` in `App.jsx` no longer pushes all 22 arrays. Per debounce (800ms):
1. Compute **dirty keys** — `JSON.stringify(current[key]) !== lastSyncedJsonRef[key]`. Only changed arrays proceed.
2. Each dirty key is written to localStorage, then saved independently via `saveKeyWithMerge(sbKey, value)`.
3. `saveKeyWithMerge` calls `saveKeyOptimistic(sbKey, value, expectedVersion, userId)` which does a **conditional UPDATE** (`where key=? AND version=?`, `version → version+1`). This is an atomic compare-and-set at the DB.
4. On success → bump `versionsRef[key]` and reset the baseline (`lastSyncedValRef`/`lastSyncedJsonRef`).
5. On **conflict** (no row matched the expected version) → `getRow()` refetches the remote row, then `mergeForKey(sbKey, base, mine, remote)` 3-way merges by record id, the merged result is pushed to state, the baseline is adopted from remote, and the save **retries** (up to 5 attempts).

Key refs: `versionsRef` (per-key version), `lastSyncedValRef` (per-key base = last value in sync with server), `lastSyncedJsonRef` (per-key serialized base for diffing).

### Merge layer (`utils/merge.js` — new 2026-06-02)
Pure, unit-tested (`node src/utils/merge.test.mjs`, 13 cases). `mergeByKey(base, mine, remote, keyOf)` rules:
- in **mine & remote**: if I didn't change it but remote did → take remote; else local wins.
- in **mine only**: honor a remote delete only if I never touched it; else keep mine (insert/edit).
- in **remote only**: honor my delete only if remote never touched it; else keep remote.

`eq` is an **order-insensitive deepEqual** (jsonb round-trips reorder object keys, so plain `JSON.stringify` would mis-flag edits). `MERGE_CFG` sets `keyOf` per table (`activity` → `userId|loginTime`, `logs` → id-or-composite) and caps (`audit`/`pricehist` 500, `activity` 200).

### Load flow
1. On mount, `loadAllFromSupabase()` → `{ values:{sbKey:data}, versions:{sbKey:version} }` (selects `key, data, version`).
2. `applyData(values, fallbackLS)` populates state **and returns** the applied (deduped/normalized) values.
3. `seedSync(applied, versions)` seeds `lastSyncedVal/Json` + `versionsRef` so the first autosave sees nothing dirty.
4. If a Supabase row is missing for a key, falls back to localStorage (when `fallbackLS=true`). If the whole load throws (e.g. missing `version` column), falls back to localStorage and seeds versions at 0.

### Realtime subscription
```js
subscribeRealtime(userId, (sbKey, data, version) => ...)
```
Listens to **all** events (`*`, catches INSERT for first-time keys) on `app_data`. Skips own updates (`updated_by === userId`). The handler updates `versionsRef`/`lastSyncedVal`/`lastSyncedJson` for that key (prevents a false conflict on the next save) and calls the per-key setter via `RT_SETTERS.current`.

### Reload path (`reloadFromServer`)
Manual reload button, pull-to-refresh, the stale-warning **Reload now** button, and the >5-min visibility reload all route through `reloadFromServer()`: `loadAllFromSupabase` → `applyData` → `seedSync`. Guarded by `reloadingRef` so concurrent reloads can't stack.

### Visibility-based reload
When the tab becomes visible after being hidden > 5 minutes, `reloadFromServer()` runs (merge-safe baseline reset) and resets `openedAtRef`.

### Stale-tab warning
A `setInterval` fires every minute. If `Date.now() - openedAtRef > 1 hour`, shows an orange banner at top with **Reload now** / **Snooze 30 min** buttons. Kept as a secondary safety net.

### `beforeunload` / hidden flush
On unload or tab-hide, the in-flight save batch (`pendingSaveRef`) is best-effort flushed: written to localStorage (sync) + fire-and-forget `saveKeyOptimistic` (version-guarded, so a stale write fails the version check instead of clobbering). Not awaited; the load-time merge is the real safety net.

---

## 7. Routing / Navigation

There is **no router**. `App.jsx` holds `tab` state and switches via `handleTab(tab)`:

```jsx
{tab === "dashboard" && <DashPage sh={sh} />}
{tab === "products" && <ProdPage sh={sh} />}
{tab === "sales"    && <SalesPage sh={sh} />}
// ...
```

Tab list lives in `utils/constants.js`:
```js
ALL_TABS = ["dashboard","products","stock_log","purchase","sales","promos","events","finance",...];
TAB_LABELS = { dashboard: {en:"Dashboard", th:"แดชบอร์ด"}, ... };
```

Sidebar groups are defined in `App.jsx`:
```js
NAV_SECTIONS = [
  { label:{th:"พื้นที่ทำงาน",en:"Workspace"}, tabs: ["dashboard","products",...] },
  { label:{th:"การจัดการ",en:"Manage"}, tabs: ["finance","reports",...] },
  ...
];
```

Hidden tabs (no permission) are filtered out via `visTabs`.

---

## 8. Theming

CSS variables defined on `<html data-theme="...">` via a `<style>` tag injected from `styles/theme.js`. User toggles persist in `localStorage.v3_theme`. Tokens cover:
- Backgrounds (`--bg`, `--bg2`, `--panel`)
- Borders (`--line`, `--line2`)
- Text (`--text`, `--dim`, `--faint`)
- Brand (`--blue`, `--green`, `--orange`, `--red`, `--purple`, `--yellow`, `--teal`)
- Special (`--blue-bg`, `--rowhover`, `--topbar-bg`)

> 🔒 **Print:** `PrintDocument.jsx` overrides to light/black regardless of theme. Do not change.

---

## 9. Known Issues & Watch-outs

### A. Bulk-save concurrency — FIXED 2026-06-02
**Previously:** the autosave pushed **all 22 arrays** in one upsert, so a stale tab could wipe newer data (last-writer-wins at the array level), and a reload-on-conflict path could silently drop unsaved edits.

**Now:** diff-only writes (only changed arrays save) + per-key optimistic locking on the `version` column (atomic compare-and-set) + 3-way merge-by-id on conflict (`utils/merge.js`). Concurrent insert/insert and stale-edit-vs-newer-data no longer silently overwrite. See Section 6 "Save flow".

**Remaining accepted edge case:** if one device **deletes** a record while another **edits the same record** concurrently, the merge keeps the remote version (to avoid data loss) — i.e. the delete is effectively reverted. Rare in practice because the app mostly uses status flags, not hard deletes.

> Requires the `version` column (Section 6 prerequisite). Deploy the new client to all devices together (single Vercel deploy) so no old/new client mix.

### B. `KEY_MAP` discipline
Every new synced state array must be added to:
1. `useState` in `App.jsx`
2. `applyData` — `out.<sbKey>=g(...);set...(out.<sbKey>)` (must set on `out` so `seedSync` baselines it)
3. autosave `current={...}` map (key = sbKey, e.g. `pricehist:priceHist`)
4. autosave `useEffect` dep array
5. `KEY_MAP` in `storage.js`
6. `RT_SETTERS`/`getSetters` for realtime
7. `MERGE_CFG` in `utils/merge.js` (default `keyOf=r=>r.id`; add a custom `keyOf`/`cap` if records have no `id` or the list is capped)

Missing #2/#3 → the key never diffs or never baselines (silent no-sync or false-conflict loops). Missing #5/#6/#7 → silent data loss / merge by wrong key.

### C. `Set` and `Map` in state
Components like `Products.jsx` use `Set` for bulk selection (`sel = useState(new Set())`). When toggling, you must create a new `Set` (not mutate).

### D. ProductPicker filter for discontinued
The Sales/PO/Quotes modals filter `products.filter(p => !p.discontinued || +item.productId === p.id)` — keeps already-selected products visible for editing old SOs. Defective workflow intentionally passes the unfiltered list.

### E. customer.id type coercion
Some SOs may have `customerId` as a string (legacy data). Use `+s.customerId` when comparing.

### F. Realtime can miss
If the tab loses network or is suspended, realtime updates are dropped. The 5-minute visibility reload covers reasonable cases.

### G. Big SO list size
Sales list can grow large. List is filtered+sorted in memo, but renders all rows. Add pagination (`showCount` pattern from `Products.jsx`) if needed.

### H. Excel import doesn't validate
`ExcelImport.jsx` matches by SKU code; rows without matching code are added as new. Be careful with column shifts.

### I. No CSRF / proper API auth
Vercel serverless functions check env keys but don't authenticate users. Anyone hitting `/api/ai-chat` with the right shape gets responses. Acceptable for internal tool; revisit before public exposure.

---

## 10. Recent Feature Additions (May–June 2026)

| Date | Feature | Key files |
|---|---|---|
| 2026-05 | Apple-themed light/dark UI | `styles/theme.js` |
| 2026-05 | Stock value donut on dashboard | `ui/StockValueDonut.jsx` |
| 2026-05 | PWA icon refresh + manifest fix | `vite.config.js`, `public/icons/` |
| 2026-05 | Stock value formula: cost → price | `Dashboard.jsx`, `Products.jsx` |
| 2026-05 | Brand × Subcategory breakdown table | `Products.jsx` |
| 2026-05 | Cheque bounce flow + resolutions | `Finance.jsx` |
| 2026-05 | Payment method dropdown w/ bank logos | `Finance.jsx`, `ui/CustomSelect.jsx`, `public/icons/banks/` |
| 2026-05 | AR table "payment details" column | `Finance.jsx` |
| 2026-05 | Promo accumulate mode + customer wallet | `Promotions.jsx`, `Sales.jsx`, `CustomerProfile.jsx`, `utils/helpers.js` |
| 2026-05 | Wallet tab in customer profile | `CustomerProfile.jsx` |
| 2026-05 | Legacy SO number (IVYYYY/MMXXX) | `Sales.jsx`, `Finance.jsx`, `utils/helpers.js` |
| 2026-05 | SO Review modal before save | `Sales.jsx` |
| 2026-05 | Event / Lucky Draw system | `Events.jsx`, `EventDetail.jsx`, `App.jsx`, `Sales.jsx` |
| 2026-05 | Event Tab 3 slot-based rewards | `EventDetail.jsx` |
| 2026-05 | Pack as condition (refactor) | `EventDetail.jsx` |
| 2026-06 | SalesAreaChart on dashboard | `ui/SalesAreaChart.jsx`, `Dashboard.jsx` |
| 2026-06 | Sync protection (KEY_MAP, conflict detection, visibility reload, stale warning) | `utils/storage.js`, `App.jsx` |
| 2026-06 | Discontinued product flag | `Products.jsx`, `Sales.jsx`, `PurchaseOrders.jsx`, `Quotes.jsx` |
| 2026-06 | Version indicator in sidebar + login | `vite.config.js`, `App.jsx` |
| 2026-06-02 | Per-key optimistic sync: diff-only writes + `version` column + 3-way merge-on-conflict (fixes §9.A data loss) | `utils/storage.js`, `utils/merge.js` (+`merge.test.mjs`), `App.jsx`; **requires `version` column** |

---

## 11. Setup & Deployment

### Local dev
```bash
git clone https://github.com/sikkharins/stock-app.git
cd stock-app
npm install
npm run dev               # → http://localhost:5173
```

### Required env
Create `.env`:
```
VITE_SUPABASE_URL=https://lqgvwxyjzpsoflczyzik.supabase.co
VITE_SUPABASE_ANON_KEY=...
ANTHROPIC_API_KEY=...      # for /api/ai-chat dev proxy
AKSONOCR_API_KEY=...       # for OCR
```

### Build
```bash
npm run build
```
Output: `dist/`

### Deploy
Push to `main` branch on GitHub → Vercel auto-deploys (preset project).

### Supabase setup
1. Project `ts-electronics-stock` in Singapore region (Pro plan)
2. Table `app_data` (key text PK, data jsonb, updated_at timestamptz, updated_by text, **version integer NOT NULL DEFAULT 0**)
   - If migrating an existing project, run once: `ALTER TABLE app_data ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0;` (see Section 6 — required by the optimistic-sync client).
3. Realtime enabled on `app_data` for all events (INSERT + UPDATE)
4. RLS: should be locked to authenticated users. **Verify before further deploy.** Note: the optimistic save relies on `update(...).eq("version",...).select("version")` returning the affected row — confirm RLS allows the authenticated `UPDATE ... RETURNING`.

### Daily backup recommendations
1. **Supabase**: Pro plan includes 7-day daily backups. Optionally enable PITR (extra cost ~$30/mo) for granular recovery.
2. **In-app**: User can run BackupManager → Export JSON. Encourage daily export to external storage.
3. **Critical**: Multi-device users must Ctrl+Shift+R after every deploy (see Section 9.A).

---

## 12. Recommended Next Work

### Stability / data integrity
1. ~~**Per-row sync** + **version stamps** + **optimistic locking**~~ — **DONE 2026-06-02** at the *array* level: diff-only writes, per-key `version` compare-and-set, 3-way merge-on-conflict (§6, §9.A). Remaining: push down to **per-record** rows (Level 3) — a real per-record table + `version`/`updated_at` per row would also fix the concurrent delete-vs-edit edge case and remove whole-array reads/writes.
2. **Conflict UI** — Current merge is silent (and safe). Optionally surface a non-blocking toast/diff when a merge-retry happens, so users know remote changes were folded in.
3. **Soft delete** — Add `deletedAt` instead of array filter; preserve audit (also makes delete-vs-edit deterministic in the merge).
4. **Backups on schedule** — Add a button that auto-exports JSON to the user's `Downloads/` daily.

### Performance
1. **Pagination / virtualization** — Sales list, Stock log, Activity log get heavy. Use `react-virtual` or similar.
2. **Memo discipline** — Wrap heavy `useMemo` computations (e.g. `arList` in Finance.jsx) with stable references.
3. **Lazy load images** — Bank logos in PNG load lazily.

### UX / features
1. **Conflict resolution UI** — When detected, show a diff before reloading.
2. **Sync status indicator** — Topbar "✓ Synced 5s ago" with last-sync time and pending count.
3. **Granular sync log** — Show which keys saved when.
4. **Audit search** — Search activity log by user/action/date range.
5. **PWA offline queue** — Queue saves when offline, push when reconnected.
6. **Print preview** — `PrintDocument.jsx` could use a preview modal instead of `window.print()` directly.

### Code quality
1. **TypeScript migration** — Currently full JS. Schema types would catch many entity-shape bugs.
2. **Split `App.jsx`** — Now ~500 lines with all state. Extract: SessionProvider, SyncProvider, ThemeProvider.
3. **Split `Sales.jsx`** — Largest single file. Extract: SO modal, SO list, view modal, review modal.
4. **Remove `recharts` dep** — Unused, ~150 KB.
5. **Eslint clean-up** — Many `react-hooks/exhaustive-deps` warnings are intentionally suppressed via destructuring tricks; some are real.

---

## 13. People & Domain Notes

- **Primary user/owner:** sikkharins@gmail.com (Supabase project owner)
- **Currency:** THB (฿). Format helpers in `utils/helpers.js` (`fmt`).
- **Date format:** Thai Buddhist Era (BE) for display; storage uses ISO YYYY-MM-DD. `toBE()` converts.
- **Print docs:** Tax invoices follow Thai VAT receipt format. VAT rate fixed at 7%. Optional VAT representative (`useVatRep`).
- **Bank list:** Hard-coded 10 Thai banks in `Finance.jsx` (`THAI_BANKS`). Logos in `public/icons/banks/`.
- **Cheque flow:** pending → deposited → cleared / bounced. Bounce has resolution (`new_cheque` / `transfer` / `none`).
- **Drop-ship SO:** SO linked to a PO; receiving the PO closes the SO automatically.

---

## 14. Quick Reference Commands

```bash
# Build & verify
npm run build

# Inspect commit log
git log --oneline -20

# Check current deployed version (after deploy)
# → look at sidebar bottom or login page footer

# Force-redeploy
git commit --allow-empty -m "force redeploy" && git push

# Roll back a feature
git revert <commit-sha>
git push
```

### Vercel commands (if installed)
```bash
vercel ls
vercel logs <deployment-url>
vercel env ls
```

### Supabase quick checks
- Dashboard → Table Editor → `app_data` → look at `updated_at` column for each key
- Dashboard → Database → Backups → PITR or daily snapshots
- Dashboard → Logs → Realtime events

---

## 15. Contact & Continuity

- **Repo:** `github.com/sikkharins/stock-app` (private)
- **Supabase project:** `lqgvwxyjzpsoflczyzik` (ts-electronics-stock, ap-southeast-1)
- **Vercel project:** stock-app-* (auto-deploy from main)
- **Owner email:** sikkharins@gmail.com

### Onboarding checklist (new dev)
- [ ] Get added to GitHub repo + Vercel project + Supabase org
- [ ] Clone repo, set `.env`, `npm install`, `npm run dev` works
- [ ] Login with seeded admin credentials, verify CRUD on Products/SO
- [ ] Read Sections 4, 5, 6 of this document carefully
- [ ] Walk through `App.jsx` state hub, `storage.js` sync flow, `Sales.jsx` saveSO
- [ ] Make one trivial UI change, push, verify Vercel deploy, verify version updates in sidebar
- [ ] Open Supabase Table Editor; understand `app_data` structure

---

*Document maintained by ongoing developer. Update Section 10 with each feature addition, and Section 9 when new bugs/edge-cases surface.*
