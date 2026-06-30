# PO Search by Product / Ref No Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the PO search bar find an order by the supplier's reference number or by a delivered product's code/name, and show which product line matched (plus its remaining qty) in the row.

**Architecture:** A new pure helper `poMatchedItems` resolves a PO's line items against a search term using each product's `code`/`name`/`nameT`. The PO page's `filtered` memo gains two extra match clauses (`refNo` + product), and each row renders a small "ตรง: … · คงเหลือ N" badge for product matches, with remaining qty from the existing `shipmentTotals`.

**Tech Stack:** React (JSX), TypeScript helpers, Vitest.

---

### Task 1: `poMatchedItems` helper (TDD)

**Files:**
- Modify: `src/utils/helpers.ts` (add export near `shipmentTotals`, ~line 1052)
- Test: `src/utils/helpers.test.ts` (add `import` to existing block + new `describe`)

- [ ] **Step 1: Write the failing tests**

Add `poMatchedItems` to the existing `import { … } from "./helpers.js";` block at the top of `src/utils/helpers.test.ts`, then append this `describe` to the file:

```ts
describe("poMatchedItems", () => {
  const products = [
    { id: 1, code: "SKU-1", name: "Cable", nameT: "สายไฟ" },
    { id: 2, code: "SKU-2", name: "Switch", nameT: "สวิตช์" },
  ];
  const po = { poNum: "PO-1", items: [{ productId: 1, qty: 5 }, { productId: 2, qty: 3 }] };

  test("empty / whitespace term returns []", () => {
    expect(poMatchedItems(po, "", products)).toEqual([]);
    expect(poMatchedItems(po, "   ", products)).toEqual([]);
  });
  test("matches by code", () => {
    expect(poMatchedItems(po, "sku-1", products).map((i) => i.productId)).toEqual([1]);
  });
  test("matches by name (case-insensitive)", () => {
    expect(poMatchedItems(po, "switch", products).map((i) => i.productId)).toEqual([2]);
  });
  test("matches by Thai name nameT", () => {
    expect(poMatchedItems(po, "สายไฟ", products).map((i) => i.productId)).toEqual([1]);
  });
  test("term with no matching field returns []", () => {
    expect(poMatchedItems(po, "zzz", products)).toEqual([]);
  });
  test("item whose product is missing from products is excluded", () => {
    const po2 = { poNum: "PO-2", items: [{ productId: 99, qty: 1 }] };
    expect(poMatchedItems(po2, "sku", products)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- helpers`
Expected: FAIL — `poMatchedItems is not a function` / not exported.

- [ ] **Step 3: Write the helper**

Add to `src/utils/helpers.ts` immediately after the `shipmentTotals` export (after line 1052):

```ts
// Items in a PO whose product (code / name / Thai name) matches a search term.
// Powers the PO search so a delivered product can be traced to its open order.
export const poMatchedItems = (
  po: DropshipPO,
  term: string,
  products: { id: number | string; code?: string; name?: string; nameT?: string }[]
): DropshipPOItem[] => {
  const t = (term || "").trim().toLowerCase();
  if (!t) return [];
  return (po.items || []).filter((it) => {
    const p = products.find((x) => +x.id === +it.productId);
    if (!p) return false;
    return [p.code, p.name, p.nameT].some((v) => (v || "").toLowerCase().includes(t));
  });
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- helpers`
Expected: PASS — all `poMatchedItems` tests green, no regressions in the file.

- [ ] **Step 5: Commit**

```bash
git add src/utils/helpers.ts src/utils/helpers.test.ts
git commit -m "feat(po): poMatchedItems helper — match PO line items by code/name"
```

---

### Task 2: Wire search + row badge into the PO page

**Files:**
- Modify: `src/components/PurchaseOrders.jsx` — import (line 3), `filtered` memo (~line 39-45), row block (~line 294-304)

- [ ] **Step 1: Import the helper**

In `src/components/PurchaseOrders.jsx` line 3, add `poMatchedItems` to the existing `helpers.js` import. The import already includes `shipmentTotals` — add `poMatchedItems` to the same list:

```js
import { fmt, toBE, todayStr, mkLog, nowStr, fmtD, nextDocNum, shipmentTotals, poStatusFromShipments, buildDropshipShipmentSO, poEditViolation, poMatchedItems } from "../utils/helpers.js";
```

- [ ] **Step 2: Extend the `filtered` match clauses**

Replace the `filtered` memo (lines 39-45):

```js
  const filtered=useMemo(()=>[...basePOs].reverse().filter(po=>{
    const sup=contacts.find(c=>c.id===po.supplierId);
    const s=(search||"").toLowerCase();
    const ms=po.poNum.toLowerCase().includes(s)||(sup?(cN(sup)||"").toLowerCase().includes(s):false);
    const mst=statusFilter==="all"||po.status===statusFilter;
    return ms&&mst;
  }),[basePOs,search,contacts,statusFilter,cN]);
```

with (adds `refNo` + product clauses, and `products` to deps):

```js
  const filtered=useMemo(()=>[...basePOs].reverse().filter(po=>{
    const sup=contacts.find(c=>c.id===po.supplierId);
    const s=(search||"").toLowerCase();
    const ms=po.poNum.toLowerCase().includes(s)||(sup?(cN(sup)||"").toLowerCase().includes(s):false)||(po.refNo||"").toLowerCase().includes(s)||poMatchedItems(po,s,products).length>0;
    const mst=statusFilter==="all"||po.status===statusFilter;
    return ms&&mst;
  }),[basePOs,search,contacts,statusFilter,cN,products]);
```

Note: when `search` is empty, `s===""` so `poNum.includes("")` is `true` and every PO still matches — existing behavior preserved.

- [ ] **Step 3: Compute matched items per row**

In the `filtered.map(po=>{ … })` block (lines 294-297), add two lines after the `wasRejected` declaration:

```js
        {filtered.map(po=>{
          const sup=contacts.find(c=>c.id===po.supplierId);
          const wasRejected=(po.approvalHistory||[]).some(h=>h.action==="rejected")&&po.status==="draft";
          const matched=search?poMatchedItems(po,search.toLowerCase(),products):[];
          const roll=matched.length?shipmentTotals(po):[];
          return <tr key={po.id} style={{borderBottom:"0.5px solid var(--line)",background:wasRejected?"rgba(255,149,0,0.14)":""}}>
```

- [ ] **Step 4: Render the match badges**

In the PO-number `<td>`, immediately after the existing `refNo` line (line 303), insert the badge rows. The block becomes:

```jsx
              {po.refNo&&<div style={{fontSize:11,color:"var(--dim)",marginTop:2,fontWeight:400}}>{"อ้างอิง: "+po.refNo}</div>}
              {matched.map(it=>{const pr=products.find(x=>+x.id===+it.productId);const r=roll.find(x=>x.productId===+it.productId);return <div key={"m"+it.productId} style={{fontSize:11,color:"var(--green)",marginTop:2,fontWeight:500}}>{"ตรง: "+(pr?pN(pr):it.productId)+" · คงเหลือ "+(r?r.remaining:0)}</div>;})}
```

- [ ] **Step 5: Verify the build/tests still pass**

Run: `npm test`
Expected: PASS — full suite green (no test exercises the JSX directly; this confirms no import/type break).

- [ ] **Step 6: Commit**

```bash
git add src/components/PurchaseOrders.jsx
git commit -m "feat(po): search PO by ref no & product, show matched-line badge"
```

---

## Manual verification (optional, read-only)

On the PO page: type a product code, a product name (Thai or English), and a supplier ref number into the search bar. Confirm the list narrows and that product searches show a green "ตรง: <สินค้า> · คงเหลือ N" line under the PO number. Searching a PO number or supplier name must behave exactly as before (no green badge). This is read-only — do not click รับของ / รับบางส่วน during verification (localhost shares prod data).
