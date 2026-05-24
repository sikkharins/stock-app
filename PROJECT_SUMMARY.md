# Stock \& Order Management System — Complete Project Summary

## Company Info

* **Thai:** หจก ที เอส อีเลคโทรนิค (1992) สำนักงานใหญ่
* **English:** TS Electronics (1992) Limited Partnership
* **Address:** 99/29 Moo 15, Nong Kradon, Muang, Nakhon Sawan 60240, Thailand
* **Tax ID:** 0603535000224
* **Logo:** `/public/logo.jpg` (already in project)

## Tech Stack

* **Framework:** React (Vite)
* **Language:** JavaScript (JSX)
* **Storage:** localStorage (planned migration to Supabase later)
* **Styling:** Inline styles + responsive.css
* **Location:** `C:\\Users\\sikkh\\OneDrive\\Desktop\\stock-app`
* **Dev server:** `npm run dev` → http://localhost:5174/

## Project Structure

```
stock-app/
├── public/
│   └── logo.png
├── src/
│   ├── main.jsx
│   ├── App.jsx                     ← Main app, login, state, routing
│   ├── styles/
│   │   └── responsive.css          ← Mobile/tablet responsive styles
│   ├── data/
│   │   └── initData.js             ← Default sample data
│   ├── utils/
│   │   ├── constants.js            ← ALL\_TABS, STOCK\_STATUS, MOVE\_TYPES, etc.
│   │   ├── helpers.js              ← fmt, toBE, mkLog, getSS, getNotifs, etc.
│   │   └── storage.js              ← localStorage load/save functions
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Field.jsx
│   │   │   ├── Badge.jsx
│   │   │   ├── StatCard.jsx
│   │   │   ├── Modal.jsx
│   │   │   ├── SearchBar.jsx
│   │   │   ├── Btn.jsx
│   │   │   ├── Sel.jsx
│   │   │   ├── ProductPicker.jsx   ← Searchable product dropdown
│   │   │   └── GlobalSearch.jsx    ← Header search across all data
│   │   ├── Dashboard.jsx
│   │   ├── Products.jsx
│   │   ├── CategoryManager.jsx     ← CRUD categories \& subcategories
│   │   ├── StockLog.jsx
│   │   ├── PurchaseOrders.jsx
│   │   ├── Sales.jsx               ← Sales orders (SO) with sub-tabs
│   │   ├── Quotes.jsx              ← Quotations (QT)
│   │   ├── Finance.jsx             ← AP/AR
│   │   ├── Contacts.jsx            ← Customers \& Suppliers
│   │   ├── CustomerProfile.jsx     ← Customer detail modal
│   │   ├── Users.jsx
│   │   ├── ActivityModal.jsx       ← User activity tracking viewer
│   │   ├── BackupManager.jsx       ← Backup/Restore/Export CSV
│   │   ├── PrintDocument.jsx       ← Print SO/QT/PO to PDF
│   │   └── Reports/
│   │       ├── ReportsPage.jsx     ← Report tab container (6 sub-tabs)
│   │       ├── Overview.jsx        ← Monthly bar chart + Top 5 products
│   │       ├── Compare.jsx         ← This month vs last month
│   │       ├── Targets.jsx         ← Sales targets per salesperson
│   │       ├── VATRepReport.jsx    ← VAT representative annual report
│   │       ├── AuditLog.jsx
│   │       └── PriceHistory.jsx
```

## Login \& Permissions System

* 5 permission levels per menu: Access, Read, Create, Edit, Delete (checkbox grid)
* 6 user types:

|Username|Password|Role|Notes|
|-|-|-|-|
|admin|admin123|Admin|Full access|
|manager|manager123|Manager|View only|
|warehouse|warehouse123|Warehouse|Products + PO|
|accountant|accountant123|Accountant|Finance + Reports|
|somchai|1234|Sales|Sees only own customers (สมชาย)|
|somying|1234|Sales|Sees only own customers (สมหญิง)|
|wichai|1234|Sales|(วิชัย)|
|pimjai|1234|Sales|(พิมพ์ใจ)|
|bkksupply|supplier1|Supplier|Sees only own products/POs|
|siamind|supplier2|Supplier|Sees only own products/POs|

* Dashboard Widgets configurable per user (7 widgets: products, stock\_value, sales\_total, profit, low\_stock, recent\_po, recent\_log)
* Activity Tracking: login/logout time, pages visited, duration per page

## 9 Main Menus

### 1\. Dashboard

* StatCards: products count, stock value, total sales, gross profit
* Low stock alerts
* Recent POs (last 4)
* Recent stock movements (last 5)
* Sales target progress (Sales users only)
* Supplier banner (Supplier users only)
* Sales user banner showing customers managed
* All widgets controlled by per-user dashboardWidgets setting

### 2\. Products

* Grouped by brand with colored cards
* Filter by brand, category, stock status
* Stock Status 4 levels: Active (≤7d), Slow (≤30d), Dead (≤90d), Fossil (>90d) based on last sale date
* Edit product inline (click ✏ on card)
* Adjust stock (click 🔧 on card) with audit trail
* Delete with confirmation
* Price history auto-tracked when price/cost changes
* Category Manager: CRUD categories \& subcategories (⚙ button)
* Searchable Product Picker for forms
* Reserved quantity shown (from pending\_delivery SOs)

### 3\. Stock Log

* Records every movement: IN/OUT/Adjust Up/Adjust Down
* Shows: date, type (colored badge), product, before qty, movement, after qty, reference, note, user
* Filter by type and product

### 4\. Purchase Orders (PO)

* Create PO: select supplier, add products with qty and cost
* View PO details
* Receive goods: confirmation modal → auto-increases stock + creates stock log
* Cancel PO
* Supplier users see only their own POs

### 5\. Sales (2 sub-tabs)

#### Sales Orders (SO):

* Create SO: Searchable ProductPicker shows real-time stock levels
* **Block if qty exceeds available stock** (shows red banner, save button disabled)
* Payment type: Cash (discounts: 0%,1%,2%,3%,5%) or Credit (7,15,30,45,60,90 days)
* VAT 7% toggle
* **VAT Representative**: checkbox "ออก VAT ให้ตัวแทน" → dropdown to select from customer's vatReps list
* Edit SO (only pending\_delivery status)
* Delete SO with confirmation
* Confirm delivery → auto-deducts stock + creates stock log
* SO from QT shows badge "📋 QT-xxxx"
* Sales users see only their own customers' SOs
* **Print to PDF** (🖨 button in view modal)

#### Quotations (QT):

* Create QT: customer, products, validity date, payment type, notes
* Status flow: Draft → Sent → Approved → Converted to SO (or Cancelled)
* Expired QTs shown with red status
* Convert approved QT to SO (creates SO automatically)
* Filter by status

### 6\. Finance

* 2 sub-tabs: AP (pay suppliers) / AR (collect from customers)
* Filter by status: all/unpaid/partial/paid
* Record payments: amount, date, method, note
* Credit terms: shows due date based on creditDays
* Overdue items highlighted

### 7\. Reports (6 sub-tabs)

1. **Overview**: Monthly bar chart (Sales vs Purchase), Top 5 products
2. **Compare**: This month vs last month (sales + profit, +/- %)
3. **Targets**: Sales targets per salesperson per month, progress bars, 🎉 if achieved
4. **VAT Rep**: Annual summary by VAT representative (Jan 1 – Dec 31), expandable per rep showing monthly breakdown + SO list
5. **Audit Log**: Every create/edit/delete action, filter by user
6. **Price History**: Every price/cost change, filter by product

### 8\. Suppliers

* CRUD: name (TH/EN), phone, email

### 9\. Customers

* CRUD: name (TH/EN), phone, email, address, Tax ID
* Assign salesperson
* **Multiple VAT Representatives per customer**: each with name, address, ID card number
* **Customer Profile Modal**: click customer name from any page to see:

  * Customer info + VAT reps
  * StatCards: total purchases, SO count, outstanding balance, QT count
  * 4 sub-tabs: Sales orders, Quotations, Payments, Summary (monthly chart + top products)

### User Management

* CRUD users with 5-level permission checkbox grid
* Dashboard Widgets toggle per user
* Activity history button (📊) → shows all login sessions with page-by-page breakdown

## Additional Features

### 🔔 Notifications

* Low stock alerts
* Pending POs (>14 days)
* Expiring quotations
* Bell icon with badge count in header

### 🔍 Global Search

* Search bar in header, searches across: products, SO, QT, PO, customers, suppliers
* Results grouped by type with icons
* Click result → navigates to relevant page with search pre-filled
* Respects user permissions (Sales/Supplier see only own data)

### 🖨 Print Documents (PDF)

* Print SO, QT, PO from view modal
* Layout: Company logo + info header, document title, customer/supplier info, product table, totals, signature lines
* VAT representative info shown on SO if applicable
* Uses window.print() → browser Save as PDF
* A4 format, Thai font support

### 💾 Backup / Export

* Admin only (💾 button in header)
* **Backup**: Export all data as JSON file (stock-backup-YYYY-MM-DD.json)
* **Restore**: Import JSON file with preview + confirmation
* **Export CSV**: Individual exports for products, sales, POs, customers, suppliers, stock logs
* CSV files include BOM for Thai language Excel compatibility

### 📊 Activity Tracking

* Records: login time, logout time, total duration
* Tab history: which pages visited, enter time, duration per page
* Current session shown as "online" with green dot
* Viewable from User Management → 📊 button

### 📱 Mobile Responsive

* 3 breakpoints: Desktop (>1024px), Tablet (768-1024px), Mobile (<768px)
* Mobile: single column layouts, full-screen modals, scrollable tables, touch-friendly buttons (min 44px)
* Tab navigation: horizontal scroll on mobile
* responsive.css with @media queries

### 🗑 Confirm Before Delete

* Every delete action requires confirmation modal (products, users, sales orders)

### 💾 Auto-save

* All data auto-saved to localStorage (debounced 800ms)
* localStorage key prefix: "v3\_"

### 🌐 Language

* Toggle Thai/English button in header
* Product names: name (EN) + nameT (TH)
* Contact names: name (EN) + nameT (TH)
* Dates displayed as DD/MM/พ.ศ. (Buddhist Era)

## Data Structures

### Product

```js
{ id, code, name, nameT, brand, categoryId, subcategoryId, size, price, cost, stock, minStock, unit, distributor }
```

### Contact (Customer/Supplier)

```js
{ id, type:"customer"|"supplier", name, nameT, phone, email, address, taxId, salesPerson,
  vatReps: \[{ id, name, address, idCard }]  // multiple per customer
}
```

### Sales Order (SO)

```js
{ id, soNum, customerId, date, status:"pending\_delivery"|"completed",
  items:\[{productId, qty, price}], includeVat, vatAmount, payType:"cash"|"credit",
  discountAmt, discPct, creditDays, fromQuote,
  useVatRep:boolean, vatRepName, vatRepAddress, vatRepIdCard }
```

### Purchase Order (PO)

```js
{ id, poNum, supplierId, date, status:"pending"|"received"|"cancelled",
  items:\[{productId, qty, cost}] }
```

### Quote (QT)

```js
{ id, qtNum, customerId, date, validUntil,
  status:"draft"|"sent"|"approved"|"converted"|"cancelled",
  items:\[{productId, qty, price}], includeVat, payType, note, discPct, creditDays, convertedTo }
```

### Stock Log

```js
{ id, date, productId, type:"in"|"out"|"adjust\_in"|"adjust\_out",
  qty, qtyBefore, qtyAfter, ref, note, user }
```

### Payment

```js
{ id, refId:"PO-xxx"|"SO-xxx", type:"ap"|"ar", amount, method, date, note }
```

### User

```js
{ id, username, password, role, salesName, supplierName,
  dashboardWidgets:\["products","stock\_value",...],
  perms:{ dashboard:{access,read,create,edit,delete}, products:{...}, ... } }
```

### Sales Target

```js
{ id, salesName, month:"2025-01", target:100000 }
```

### Category

```js
{ id, name, subs:\[{id, name}] }
```

### Audit Log

```js
{ id, date, action, detail, user }
```

### Price History

```js
{ id, date, productId, field:"price"|"cost", oldVal, newVal, user }
```

### Activity Log (Session)

```js
{ userId, username, role, salesName, supplierName,
  loginTime, loginTimeStr, logoutTime, logoutTimeStr, totalDuration,
  tabHistory:\[{tab, enterTime, endTime, duration}] }
```

## Planned But Not Yet Done

* ❌ Barcode / QR Code for products
* ❌ Additional reports: P\&L monthly, slow/fast products by period, purchases by supplier
* ❌ Line Notify integration
* ❌ Multi-user database (Supabase migration planned)
* ❌ Full notification system: Dead/Fossil stock, credit near/overdue alerts

## How to Run

```bash
cd C:\\Users\\sikkh\\OneDrive\\Desktop\\stock-app
npm run dev
```

Open http://localhost:5174/ in browser.

## How to Add Features

Open a new terminal in the stock-app folder, run `claude`, then describe what you want in Thai or English. Claude Code will read the codebase and make changes directly.

