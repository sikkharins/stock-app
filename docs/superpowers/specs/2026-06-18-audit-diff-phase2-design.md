# Audit edit-diff (phase 2) — design

**Date:** 2026-06-18
**Status:** Approved scope. Follows phase 1 (`2026-06-18-audit-redesign-design.md`).

## Goal

Record, going forward, **what changed from what to what** on edits, and surface it in
the audit page's existing hover popover. Answers "แก้ไขจากอะไรเป็นอะไร".

Scope (approved): **SO, PO, and product** edits. QT is out. Line items in SO/PO are
diffed **per line** (added / removed / qty change / price change).

## Non-goals

- Not retroactive — only edits made after this ships carry a diff; old entries stay bare.
- QT edits are not instrumented.
- No change to how non-edit audit entries are created.
- Stock changes on product edits are **not** duplicated here — they already go to the
  StockLog via `mkLog` in `saveProd`.

## Current state

Each edit site already has both the old record and the new field set in scope:

- **SO** — `src/components/Sales.jsx:135`: `oldSO = sales.find(s=>s.id===soId)`; new = `soBase`.
- **PO** — `src/components/PurchaseOrders.jsx:206-207`: old = `editPO`; new = `base`.
- **Product** — `src/components/Products.jsx:70`: old = `b = products.find(x=>x.id===form.id)`; new = `item`.

`addA(action, detail)` → `mkAudit(action, detail, user)` prepends to `audit` (capped 500).
`Audit` is `{ id, date, action, detail, user }`.

## Data model change

Add an optional, display-ready changes list to the audit entry:

```ts
export interface AuditChange { label: string; from: string; to: string; }
// Audit gains:  changes?: AuditChange[];
```

- `mkAudit(action, detail, user?, changes?)` — attaches `changes` **only when non-empty**
  (so entries without a diff are unchanged shape; old entries stay valid).
- `addA(a, d, changes?)` in `App.jsx` threads the 4th arg through. Existing 2-arg callers
  are unaffected.
- `from`/`to` are **pre-formatted strings captured at edit time** (names resolved, money
  and dates formatted). This makes each entry a faithful "value at that moment" record and
  self-contained — no re-resolution needed at display, and later renames don't rewrite history.

## Pure helper: `src/utils/auditDiff.ts` (+ tests)

Two pure functions. Name/money resolution is injected as callbacks so the helper stays
pure and unit-testable.

```ts
export interface AuditChange { label: string; from: string; to: string; }

export interface FieldDef {
  key: string;
  label: string;
  fmt?: (v: unknown) => string; // default: String(v ?? "")
}

// Compares the allowlisted scalar fields; returns one entry per changed field.
export function diffFields(
  oldObj: Record<string, unknown>,
  next: Record<string, unknown>,
  defs: FieldDef[]
): AuditChange[];

export interface LineItem { productId: number; qty: number; price?: number; cost?: number; }
export interface LineOpts {
  priceKey: "price" | "cost";
  nameOf: (productId: number) => string;
  fmtMoney: (n: number) => string;
}

// Per-line diff matched by productId. Returns added / removed / changed lines.
export function diffLineItems(
  oldItems: LineItem[],
  newItems: LineItem[],
  opts: LineOpts
): AuditChange[];
```

**`diffFields` behavior:** for each def, compare `fmt(old[key])` vs `fmt(next[key])`
(compare the *formatted* strings so e.g. `100` vs `"100"` and id→name resolve consistently);
emit `{label, from, to}` when they differ. Skip unchanged.

**`diffLineItems` behavior:** build a Map keyed by `productId` for each side (if a product
appears twice in one doc — rare — last entry wins). Iterate new items in order, then old
items absent from new:
- in both, `qty` or price differ → `{ label: nameOf(id), from: "<oldQty> × <฿oldPrice>", to: "<newQty> × <฿newPrice>" }`
- new only → `{ label: "+ " + nameOf(id), from: "—", to: "<qty> × <฿price>" }`
- old only → `{ label: "− " + nameOf(id), from: "<qty> × <฿price>", to: "—" }`
- identical → skipped

price per line = `item[opts.priceKey]` (SO/QT use `price`, PO uses `cost`).

## Field allowlists (built at each call site)

`fmt` closures resolve ids using data already in scope (`cN`, `cats`, `pN`).

**SO** (`oldSO` vs `{...soBase}`), money via `"฿"+fmt(n)`, dates via `toBE`:

| key | label | fmt |
|---|---|---|
| customerId | ลูกค้า | id → `cN(contact)` |
| date | วันที่ | `toBE` |
| payType | การชำระ | `cash→"เงินสด"`, `credit→"เครดิต"` |
| creditDays | เครดิต (วัน) | String |
| discountAmt | ส่วนลด | `฿` |
| includeVat | VAT | `true→"รวม"`, `false→"ไม่รวม"` |
| vatRepName | ตัวแทน VAT | String |
| note | หมายเหตุ | String |

plus `diffLineItems(oldSO.items, soBase.items, {priceKey:"price", ...})`.

**PO** (`editPO` vs `base`):

| key | label | fmt |
|---|---|---|
| supplierId | ผู้ขาย | id → `cN(contact)` |
| date | วันที่ | `toBE` |
| deliveryDate | วันส่ง | `toBE` |
| creditDays | เครดิต (วัน) | String |
| refNo | เลขอ้างอิง | String |
| dropShip | ส่งนอกสถานที่ | bool → `"ใช่"/"ไม่"` |
| dropShipCustomerId | ลูกค้าปลายทาง | id → `cN(contact)` |
| note | หมายเหตุ | String |

plus `diffLineItems(editPO.items, base.items, {priceKey:"cost", ...})`.

**Product** (`b` vs `item`):

| key | label | fmt |
|---|---|---|
| name | ชื่อ | String |
| brand | ยี่ห้อ | String |
| price | ราคาขาย | `฿` |
| cost | ต้นทุน | `฿` |
| minStock | ขั้นต่ำ | String |
| categoryId | หมวด | id → `cats.find(...).name` |
| distributor | ผู้จัดจำหน่าย | String |

(no line items; `stock` intentionally omitted — already in StockLog.)

## Call-site wiring

At each site, build the `defs` array + (for SO/PO) call `diffLineItems`, concat into
`changes`, and pass as the new 4th arg:

- SO: `addA("แก้ไข SO", editSO?.soNum||"", changes)`
- PO: `addA("แก้ไข PO", editPO.poNum, changes)`
- Product: `addA("แก้ไขสินค้า", item.code, changes)` (edit branch only, not create)

`nameOf` for line items = `pid => { const p = products.find(x=>x.id===pid); return p?pN(p):"#"+pid; }`.
`fmtMoney = n => "฿"+fmt(n)`.

## Display (AuditLog popover)

- Hover trigger activates when the row has a ref **or** `changes` (currently ref only).
  `setHover({ ref, changes: l.changes, x, y })`.
- In the popover: if `hover.changes?.length`, render the **changes list** as the primary
  body (header = the doc/code from `info`/detail). Each change row:
  `label` (muted, small) above a line `from` (muted/struck) `→` `to` (bold). Scrollable,
  `maxHeight` ~180, consistent with the item list.
- Rows without `changes` keep the existing doc/product preview.
- Inline hint: when `l.changes?.length`, append a subtle `(N การเปลี่ยนแปลง)` after the
  detail text so the user knows there is a diff to hover.

## Edge cases

- Save with no real change → `diff*` return `[]` → `changes` not attached → row behaves
  like a plain edit (preview fallback, no hint).
- Old audit entries (pre-phase-2) → no `changes` → unchanged behavior.
- Deleted/renamed referenced records → irrelevant; `from`/`to` were captured as text.
- Duplicate productId within one doc → matched by productId (last wins); acceptable, noted.

## Testing

`src/utils/auditDiff.test.ts` (pure, trivial formatters):
- `diffFields`: changed scalar emitted; unchanged skipped; numeric-vs-string equal skipped;
  id field resolved via `fmt`; missing key handled.
- `diffLineItems`: added line; removed line; qty change; price change; unchanged skipped;
  `priceKey:"cost"` path.

Component changes verified via `npm run typecheck && npm run build && npm test`
(no component unit tests in this repo). Full suite stays green.

## Backward compatibility

Adopting an optional field and an optional 4th param is additive. `mkAudit`/`addA`
2–3-arg callers, the persisted audit array, the 500 cap, and phase-1 filters/popover all
keep working.
