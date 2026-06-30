# PO Search by Product / Ref No — Design

**Date:** 2026-06-30
**Scope:** Purchase Orders page only (`src/components/PurchaseOrders.jsx`)

## Problem

Goods arrive but the user doesn't know which PO they belong to. The PO search bar
currently matches only `poNum` and supplier name, so the user can't find a PO by
the product that was delivered or by the supplier's bill/delivery-note number.

## Goal

Extend the PO search to also match:
- **Reference number** (`po.refNo` — the supplier's bill / delivery-note number)
- **Product code** (`product.code`)
- **Product name** (`product.name` and Thai `product.nameT`)

When a PO matches *because of a product*, show a small badge in the table row that
names the matched product and its remaining (un-received) qty — so the user can
decide which PO the delivery belongs to without opening each one.

## Design

### 1. Pure helper — `poMatchedItems` (in `src/utils/helpers.ts`)

```
poMatchedItems(po, term, products) → DropshipPOItem[]
```

- Returns the items in `po.items` whose product matches `term`.
- A product matches when `term` (trimmed, lower-cased) is a substring of any of:
  `product.code`, `product.name`, `product.nameT` (each lower-cased; missing/blank
  fields are skipped).
- Empty/whitespace `term` → returns `[]`.
- Product not found in `products` → that item does not match.

Pure and side-effect free; matched by `productId` against the `products` array.

### 2. Filter change — `src/components/PurchaseOrders.jsx` (`filtered` useMemo, ~line 39)

Current match:
```
poNum.includes(s) || supplierName.includes(s)
```
New match (add two clauses):
```
poNum.includes(s)
  || supplierName.includes(s)
  || (po.refNo || "").toLowerCase().includes(s)
  || poMatchedItems(po, s, products).length > 0
```

`products` must be added to the useMemo dependency array. `poMatchedItems` is an
imported (module-level) function, so it is not a TDZ/deps concern.

### 3. Row badge — under the PO number (same spot as the existing "อ้างอิง:" line)

When the search term is non-empty, compute `poMatchedItems(po, search, products)`
for the row. For each matched item render a small badge:

```
ตรง: <pN(product)> · คงเหลือ <remaining>
```

- `pN(product)` is the existing display-name helper (Thai-aware).
- `remaining` comes from `shipmentTotals(po)` looked up by `productId`
  (`Math.max(0, ordered − committed)`). An approved-but-unreceived PO yields
  `remaining = ordered`.
- Badges appear **only** when the match was via product. Searching by PO number,
  supplier name, or refNo shows no product badge (keeps the row uncluttered).

## Out of scope (YAGNI)

- No changes to search on other pages (Sales/SO, Products).
- No character highlighting of the matched substring.
- No new status filtering — the existing status tabs (อนุมัติแล้ว / ส่งบางส่วน)
  already let the user narrow to open POs.

## Testing

Unit tests for `poMatchedItems` in `src/utils/helpers.test.ts`:
- empty / whitespace term → `[]`
- match by `code`
- match by `name`
- match by `nameT`
- term present but no field matches → `[]`
- item whose `productId` is missing from `products` → excluded

## UI/behavior preservation

- Existing matches (poNum, supplier name) keep working unchanged.
- The badge reuses the existing small-pill style already used for "อ้างอิง:" /
  "→ SO" badges in the row; no layout restructure.
