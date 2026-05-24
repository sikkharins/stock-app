# TS Electronics Stock Management App — Project Handoff

## Overview
A full-featured inventory/stock management web app for **TS Electronics** (Thai electronics retail store). Built as a **single-page React app** deployed on **Vercel**, using **Supabase** as the cloud database and auth provider. The UI is bilingual (Thai primary, English secondary).

**Production URL**: https://stock-app-gray-seven.vercel.app  
**Dev server**: `npm run dev` (Vite, usually port 5173+)  
**Deploy command**: `npx vercel --prod --yes`  
**Build command**: `npx vite build`

---

## Tech Stack
| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, pure CSS (no Tailwind/MUI) |
| Backend/API | Vercel Serverless Functions (`/api/` folder) |
| Database | Supabase (PostgreSQL) — single `app_data` table (key-value store) |
| Auth | Supabase Auth (email-based, auto-generated emails from usernames) |
| Charts | Recharts |
| AI | Claude API (Haiku 4.5) via `/api/ai-chat.js` |
| Excel | SheetJS (xlsx) for import/export |
| Markdown | `marked` library for AI bot message rendering + PDF export |

---

## Project Structure
```
stock-app/
├── api/                          # Vercel serverless functions
│   ├── ai-chat.js                # Claude AI proxy (system prompt + context builder)
│   └── tts.js                    # Text-to-speech endpoint
├── src/
│   ├── App.jsx                   # Root component — routing, state, sync, auth
│   ├── data/
│   │   └── initData.js           # Default/seed data (products, contacts, users, categories)
│   ├── utils/
│   │   ├── supabase.js           # Supabase client init (URL + anon key)
│   │   ├── storage.js            # Data sync: localStorage + Supabase load/save/realtime
│   │   ├── auth.js               # Supabase Auth: signIn, signOut, profiles, migration
│   │   ├── aiChat.js             # AI context builder (buildContext function)
│   │   ├── helpers.js            # Utility functions (dates, notifications, audit)
│   │   ├── constants.js          # Tab definitions, styles, move types
│   │   └── csv.js                # CSV/Excel utilities
│   ├── styles/
│   │   └── theme.js              # CSS variables for light/dark theme
│   ├── components/
│   │   ├── Dashboard.jsx         # Dashboard with configurable widgets
│   │   ├── Products.jsx          # Product management (CRUD, stock tracking)
│   │   ├── StockLog.jsx          # Stock movement history
│   │   ├── PurchaseOrders.jsx    # Purchase orders (PO) management
│   │   ├── Sales.jsx             # Sales orders (SO) management
│   │   ├── Quotes.jsx            # Quotation management
│   │   ├── Finance.jsx           # Finance: AR, AP, payments, cheques, bank, CN, billing
│   │   ├── Contacts.jsx          # Suppliers & Customers combined
│   │   ├── DefectiveProducts.jsx # Defective product tracking + customer CN
│   │   ├── Promotions.jsx        # Promotional campaigns
│   │   ├── Users.jsx             # User management (roles, permissions)
│   │   ├── AISOBot.jsx           # AI chatbot (SO/PO/Quote creation, analytics, vision, PDF)
│   │   ├── BackupManager.jsx     # Data backup/restore
│   │   ├── PrintDocument.jsx     # Print templates for SO/PO/Quote/Receipt
│   │   ├── ExcelImport.jsx       # Product Excel import
│   │   ├── ContactExcelImport.jsx# Contact Excel import
│   │   ├── CustomerProfile.jsx   # Customer detail view
│   │   ├── SupplierProfile.jsx   # Supplier detail view
│   │   ├── CategoryManager.jsx   # Product category/subcategory management
│   │   ├── ActivityModal.jsx     # User activity/session log
│   │   ├── ui/                   # Reusable UI components
│   │   │   ├── CustomSelect.jsx  # Dropdown with portal + optional search
│   │   │   ├── ProductPicker.jsx # Product search/select component
│   │   │   ├── Modal.jsx         # Modal dialog
│   │   │   ├── Btn.jsx           # Button component
│   │   │   ├── Field.jsx         # Form field wrapper
│   │   │   ├── Badge.jsx         # Status badge
│   │   │   ├── StatCard.jsx      # Dashboard stat card
│   │   │   ├── SearchBar.jsx     # Search input
│   │   │   ├── Sel.jsx           # Simple select
│   │   │   ├── ThaiDateInput.jsx # Thai Buddhist year date picker
│   │   │   └── GlobalSearch.jsx  # Cross-module search
│   │   └── Reports/
│   │       ├── ReportsPage.jsx   # Reports hub
│   │       ├── Overview.jsx      # Sales/purchase overview
│   │       ├── Compare.jsx       # Period comparison
│   │       ├── Targets.jsx       # Sales targets
│   │       ├── PriceHistory.jsx  # Price change history
│   │       ├── AuditLog.jsx      # Audit trail
│   │       └── VATRepReport.jsx  # VAT representative report
│   └── main.jsx                  # React entry point
├── public/
│   └── logo.jpg                  # Company logo
└── package.json
```

---

## Data Architecture

### Storage Strategy (Dual-write with Cloud Priority)
All app data lives in a **single Supabase table** `app_data` with columns: `key` (text PK), `data` (jsonb), `updated_at`, `updated_by`.

**21 data keys** are synced:
`products`, `contacts`, `pos`, `sales`, `cats`, `brands`, `logs`, `payments`, `activity`, `quotes`, `targets`, `audit`, `pricehist`, `cheques`, `bankaccs`, `banktxns`, `cnotes`, `billings`, `defectives`, `supcnotes`, `promos`

**Sync flow** (in `src/utils/storage.js` and `src/App.jsx`):
1. **On app load**: Fetch ALL keys from Supabase → if key exists (even if empty `[]`), use it; if `null`, fallback to localStorage; if localStorage empty, use `initData.js` defaults
2. **On state change** (debounced 800ms): Save to BOTH localStorage AND Supabase simultaneously
3. **Realtime**: Supabase Realtime subscription pushes other users' changes instantly (skips own updates via `updated_by` check, prevents save-loops via `realtimeSkipRef`)

**Critical fallback logic** (line ~111 in App.jsx):
```js
const g = (sbKey, lsKey, fb) => {
  const v = d?.[sbKey];
  return (v != null) ? v : fallbackLS ? loadData(lsKey, fb) : fb;
};
```
The `v != null` check is important — previously used `v.length > 0` which caused empty arrays `[]` to fall through to initData defaults (a bug that was fixed).

### Key Data Models

**Products**: `{ id, code, name, nameT, brand, categoryId, subcategoryId, size, price, cost, stock, minStock, unit, distributor }`

**Contacts** (suppliers + customers in one array): `{ id, type:"supplier"|"customer", name, nameT, phone, email, address, taxId, salesPerson, vatReps[], staff[] }`

**Sales Orders (SO)**: `{ id, soNum, customerId, customerName, date, items[], payType, discPct, discAmt, creditDays, includeVat, status, payments[] }`

**Purchase Orders (PO)**: `{ id, poNum, supplierId, supplierName, date, items[], status, note }`

**Quotes**: `{ id, qtNum, customerId, customerName, date, items[], payType, discPct, creditDays, includeVat, validDays, status }`

---

## Authentication System

Uses **Supabase Auth** with a `profiles` table linked to `auth.users`. Users log in with username/password. The system auto-generates email addresses (`username@app.local`) for Supabase Auth compatibility.

**Roles**: Admin, Manager, Warehouse, Accountant, Sales, Supplier  
**Permissions**: Granular per-module (dashboard, products, stock_log, purchase, sales, finance, reports, suppliers, customers, defective, users) with access/read/create/edit/delete levels.

Migration from legacy localStorage-based auth to Supabase Auth is handled in `src/utils/auth.js` (`migrateUsers` function).

**Default test accounts** (defined in `initData.js`):
- admin / admin123 (Admin)
- manager / manager123 (Manager)  
- warehouse / warehouse123 (Warehouse)
- accountant / accountant123 (Accountant)
- somchai, somying, wichai, pimjai / 123456 (Sales)
- bkksupply / supplier1, siamind / supplier2 (Supplier)

---

## AI Chatbot (AISOBot)

### Architecture
- **Frontend**: `src/components/AISOBot.jsx` — floating chat widget (bottom-right corner)
- **Context Builder**: `src/utils/aiChat.js` — `buildContext()` computes analytics data from current state
- **API Proxy**: `api/ai-chat.js` — Vercel serverless function that calls Claude API
- **Model**: `claude-haiku-4-5-20251001` (configurable)
- **API Key**: Stored as Vercel environment variable `ANTHROPIC_API_KEY`

### Capabilities
1. **Create SO/PO/Quote** via natural language (returns JSON with `action: "create_so"/"create_po"/"create_quote"`)
2. **Stock queries** — check stock levels, low stock alerts
3. **Financial queries** — AR/AP balances, overdue payments
4. **Analytics** — monthly sales trends, top products, top customers, profit margins, % change comparisons
5. **Image recognition** (Vision API) — product identification from photos, handwriting reading, receipt/document parsing
6. **PDF export** — generate printable reports from bot responses (uses `marked.parse()` + `window.open` print page with Google Fonts Sarabun)
7. **Text-to-Speech** — `speak` field in AI responses, via `/api/tts.js`

### Analytics Data (computed in `aiChat.js` `buildContext`):
- `monthlySales`: revenue, cost, order count per month
- `topProducts`: top 10 products by revenue
- `topCustomers`: top 10 customers by revenue

### Image Handling Flow:
1. User clicks camera button → file input triggers
2. `handleImageSelect`: FileReader → Image element → Canvas resize (max 800px) → base64 JPEG
3. Image sent as multi-content message: `[{type:"image", source:{type:"base64",...}}, {type:"text",...}]`
4. Vision API identifies product → matches against system inventory

---

## UI Components of Note

### CustomSelect (`src/components/ui/CustomSelect.jsx`)
Portal-based dropdown with optional `searchable` prop. When searchable:
- Search input pinned at top of dropdown
- Options filtered via `useMemo` (case-insensitive)
- Auto-focus on open, Escape to close
- Click-outside detection uses dual refs (`ref` + `dropRef`) because portal is outside normal DOM tree
- Shows "ไม่พบรายการ" when no matches

Used with `searchable` prop in: Sales, Quotes, PurchaseOrders, Finance (5 places), DefectiveProducts

### ProductPicker (`src/components/ui/ProductPicker.jsx`)
Dedicated product search component with built-in search/filter — used as reference pattern for CustomSelect's searchable feature.

### PrintDocument (`src/components/PrintDocument.jsx`)
Generates printable documents (SO, PO, Quote, Receipt) with Thai formatting, company header, and proper layout.

---

## Finance Module (`src/components/Finance.jsx`)
The largest and most complex component. Manages:
- **AR (Accounts Receivable)** — customer debts from credit sales
- **AP (Accounts Payable)** — supplier debts from credit purchases  
- **Payments** — record payments against AR/AP
- **Cheques** — cheque tracking and status
- **Bank Accounts & Transactions** — bank reconciliation
- **Credit Notes (CN)** — customer returns and supplier returns
- **Billing Notes** — consolidated billing for multiple SOs

---

## Defective Products (`src/components/DefectiveProducts.jsx`)
Tracks defective/damaged products through workflow:
pending_inspection → inspected → pending_return → returned_to_supplier → resolved
Also handles customer-side CN for defective returns.

---

## Deployment

### Vercel Configuration
- Framework: Vite
- Build: `vite build`
- Output: `dist/`
- Serverless functions: `api/` folder (auto-detected by Vercel)
- Environment variables: `ANTHROPIC_API_KEY` (for AI chat)
- No `vercel.json` file — uses Vercel defaults

### Deploy Process
```bash
cd stock-app
npx vite build          # Verify build succeeds
npx vercel --prod --yes # Deploy to production
```

---

## Recent Changes (Latest Session)

1. **AI Analytics** — Added monthly sales analysis, top products, top customers, trend comparison with % change to AI bot
2. **Vision API** — Image search: product identification from photos + handwriting/document reading via Claude Vision
3. **PDF Export** — Bot responses > 80 chars get "📄 Export PDF" button, generates professional printable report with Google Fonts (Sarabun for Thai text)
4. **Searchable Dropdown** — Added `searchable` prop to CustomSelect for customer/supplier selection in Sales, Quotes, PO, Finance, Defective modules
5. **Data Fallback Bug Fix** — Changed `v.length > 0` to `v != null` in `applyData`'s `g` function to prevent empty Supabase arrays from falling through to initData defaults
6. **Cleared Test Data** — Removed all test PO/SO/Quote data from both Supabase and localStorage; cleared `initPOs`, `initSales`, `initQuotes` in initData.js to `[]`

---

## Known Architecture Notes

- **No Git repo** — The project directory is NOT a git repository. Code lives directly on disk and deploys via Vercel CLI.
- **Single-file state** — All app state lives in `App.jsx` and is passed down via props (no Redux/Context). This makes `App.jsx` very large.
- **Thai-first UI** — Most labels, messages, and data are in Thai. The app supports English via `lang` toggle but Thai is the primary language.
- **No backend API routes for data** — All data CRUD happens client-side with direct Supabase reads/writes. The only serverless functions are `ai-chat.js` and `tts.js`.
- **Inline styles** — The entire app uses inline React styles (no CSS files/modules except theme variables). Style objects are defined inline in JSX.
- **Port conflicts** — Vite dev server often needs to find an available port (5173, 5188, 5189, 5190, etc.) due to multiple instances. Check terminal output for actual port.
