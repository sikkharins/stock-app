# Audit Edit-Diff (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record from→to changes on SO/PO/product edits and show them in the audit page's hover popover.

**Architecture:** A pure tested helper `auditDiff.ts` (`diffFields` + `diffLineItems`) produces a display-ready `changes[]`. `mkAudit`/`addA` gain an optional `changes` arg; the three edit handlers build and pass it. `AuditLog.jsx` renders the change list in the existing popover. Not retroactive; additive and backward-compatible.

**Tech Stack:** React (hooks), TypeScript utils, Vitest, Vite. House style: dense inline-styled JSX, CSS theme vars.

**Spec:** `docs/superpowers/specs/2026-06-18-audit-diff-phase2-design.md`

---

## Background the engineer needs

- Edit sites already hold old + new in scope:
  - SO — `src/components/Sales.jsx:135` (`oldSO` vs `soBase`). Scope has `fmt, toBE` (imported), `pN, cN, contacts, products, addA` (from `sh`).
  - PO — `src/components/PurchaseOrders.jsx:205-207` (`editPO` vs `base`). Same helpers in scope.
  - Product — `src/components/Products.jsx:70` (`b` vs `item`). Scope has `fmt` (imported), `pN, cats, products, addA` (from `sh`).
- `.ts` utils are imported from `.jsx` with the `.ts` extension; `.js`-extension imports resolve to the `.ts` source too (e.g. components import `helpers.js` which is `helpers.ts`).
- SO/PO `date`/`deliveryDate` are ISO (`toBE` formats them). Line items: SO/QT use `price`, PO uses `cost`.
- `mkAudit` and `Audit` live in `src/utils/helpers.ts`; `addA` is `src/App.jsx:189`.
- Tests: `npm test` (`vitest run`); pure-util tests sit next to the util. Components are not unit-tested — verify with `npm run typecheck && npm run build`.

## File structure

- Create `src/utils/auditDiff.ts` — `AuditChange`, `FieldDef`, `LineItem`, `LineOpts`, `diffFields`, `diffLineItems`.
- Create `src/utils/auditDiff.test.ts`.
- Create `src/utils/mkAudit.test.ts` — asserts the `changes` attachment rule.
- Modify `src/utils/helpers.ts` — import `AuditChange` type, extend `Audit`, extend `mkAudit`.
- Modify `src/App.jsx` — `addA` 4th arg.
- Modify `src/components/Sales.jsx`, `PurchaseOrders.jsx`, `Products.jsx` — build + pass `changes`.
- Modify `src/components/Reports/AuditLog.jsx` — render changes in the popover + hint.

---

## Task 1: `auditDiff.ts` — diff helpers (pure, TDD)

**Files:**
- Create: `src/utils/auditDiff.ts`
- Test: `src/utils/auditDiff.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/utils/auditDiff.test.ts`:

```ts
import { describe, test, expect } from "vitest";
import { diffFields, diffLineItems } from "./auditDiff";

describe("diffFields", () => {
  test("emits changed fields only, formatted", () => {
    const defs = [
      { key: "customerId", label: "ลูกค้า", fmt: (v: unknown) => (v === 1 ? "A" : v === 2 ? "B" : String(v ?? "")) },
      { key: "discountAmt", label: "ส่วนลด", fmt: (v: unknown) => "฿" + v },
      { key: "note", label: "หมายเหตุ" },
    ];
    const out = diffFields({ customerId: 1, discountAmt: 100, note: "x" }, { customerId: 2, discountAmt: 100, note: "y" }, defs);
    expect(out).toEqual([
      { label: "ลูกค้า", from: "A", to: "B" },
      { label: "หมายเหตุ", from: "x", to: "y" },
    ]);
  });

  test("treats numeric and string-equal as unchanged", () => {
    expect(diffFields({ qty: 5 }, { qty: "5" }, [{ key: "qty", label: "จำนวน" }])).toEqual([]);
  });

  test("handles missing keys", () => {
    expect(diffFields({}, { note: "hi" }, [{ key: "note", label: "หมายเหตุ" }])).toEqual([{ label: "หมายเหตุ", from: "", to: "hi" }]);
  });
});

describe("diffLineItems", () => {
  const opts = { priceKey: "price" as const, nameOf: (id: number) => "P" + id, fmtMoney: (n: number) => "฿" + n };

  test("detects added line", () => {
    expect(diffLineItems([], [{ productId: 1, qty: 2, price: 50 }], opts)).toEqual([{ label: "+ P1", from: "—", to: "2 × ฿50" }]);
  });
  test("detects removed line", () => {
    expect(diffLineItems([{ productId: 1, qty: 2, price: 50 }], [], opts)).toEqual([{ label: "− P1", from: "2 × ฿50", to: "—" }]);
  });
  test("detects qty change", () => {
    expect(diffLineItems([{ productId: 1, qty: 2, price: 50 }], [{ productId: 1, qty: 3, price: 50 }], opts)).toEqual([{ label: "P1", from: "2 × ฿50", to: "3 × ฿50" }]);
  });
  test("detects price change", () => {
    expect(diffLineItems([{ productId: 1, qty: 2, price: 50 }], [{ productId: 1, qty: 2, price: 60 }], opts)).toEqual([{ label: "P1", from: "2 × ฿50", to: "2 × ฿60" }]);
  });
  test("skips unchanged", () => {
    expect(diffLineItems([{ productId: 1, qty: 2, price: 50 }], [{ productId: 1, qty: 2, price: 50 }], opts)).toEqual([]);
  });
  test("uses cost when priceKey is cost", () => {
    const o = { priceKey: "cost" as const, nameOf: (id: number) => "P" + id, fmtMoney: (n: number) => "฿" + n };
    expect(diffLineItems([], [{ productId: 1, qty: 1, cost: 30 }], o)).toEqual([{ label: "+ P1", from: "—", to: "1 × ฿30" }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/auditDiff.test.ts`
Expected: FAIL — cannot find module `./auditDiff`.

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/auditDiff.ts`:

```ts
export interface AuditChange { label: string; from: string; to: string; }

export interface FieldDef {
  key: string;
  label: string;
  fmt?: (v: unknown) => string;
}

const asStr = (fmt: ((v: unknown) => string) | undefined, v: unknown): string =>
  fmt ? fmt(v) : String(v ?? "");

export function diffFields(
  oldObj: Record<string, unknown>,
  next: Record<string, unknown>,
  defs: FieldDef[]
): AuditChange[] {
  const out: AuditChange[] = [];
  for (const d of defs) {
    const from = asStr(d.fmt, oldObj ? oldObj[d.key] : undefined);
    const to = asStr(d.fmt, next ? next[d.key] : undefined);
    if (from !== to) out.push({ label: d.label, from, to });
  }
  return out;
}

export interface LineItem { productId: number; qty: number; price?: number; cost?: number; }
export interface LineOpts {
  priceKey: "price" | "cost";
  nameOf: (productId: number) => string;
  fmtMoney: (n: number) => string;
}

export function diffLineItems(oldItems: LineItem[], newItems: LineItem[], opts: LineOpts): AuditChange[] {
  const { priceKey, nameOf, fmtMoney } = opts;
  const priceOf = (it: LineItem) => Number(it[priceKey] ?? 0);
  const desc = (it: LineItem) => `${it.qty} × ${fmtMoney(priceOf(it))}`;
  const oldMap = new Map<number, LineItem>();
  for (const it of oldItems || []) oldMap.set(it.productId, it);
  const newMap = new Map<number, LineItem>();
  for (const it of newItems || []) newMap.set(it.productId, it);
  const out: AuditChange[] = [];
  for (const it of newItems || []) {
    const prev = oldMap.get(it.productId);
    if (!prev) out.push({ label: "+ " + nameOf(it.productId), from: "—", to: desc(it) });
    else if (prev.qty !== it.qty || priceOf(prev) !== priceOf(it)) out.push({ label: nameOf(it.productId), from: desc(prev), to: desc(it) });
  }
  for (const it of oldItems || []) {
    if (!newMap.has(it.productId)) out.push({ label: "− " + nameOf(it.productId), from: desc(it), to: "—" });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/auditDiff.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/auditDiff.ts src/utils/auditDiff.test.ts
git commit -m "feat(audit): auditDiff pure helpers (diffFields + diffLineItems) + tests"
```

---

## Task 2: Thread `changes` through `mkAudit`, `Audit`, `addA` (TDD)

**Files:**
- Modify: `src/utils/helpers.ts:1` (add import), `:209-215` (Audit), `:347-353` (mkAudit)
- Modify: `src/App.jsx:189` (addA)
- Test: `src/utils/mkAudit.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/utils/mkAudit.test.ts`:

```ts
import { describe, test, expect } from "vitest";
import { mkAudit } from "./helpers";

describe("mkAudit changes", () => {
  test("omits changes when none given", () => {
    expect("changes" in mkAudit("แก้ไข SO", "SO-1", "u")).toBe(false);
  });
  test("omits changes when empty array", () => {
    expect("changes" in mkAudit("แก้ไข SO", "SO-1", "u", [])).toBe(false);
  });
  test("attaches non-empty changes", () => {
    const ch = [{ label: "ส่วนลด", from: "฿100", to: "฿200" }];
    expect(mkAudit("แก้ไข SO", "SO-1", "u", ch).changes).toEqual(ch);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/mkAudit.test.ts`
Expected: FAIL — `mkAudit` rejects the 4th arg / `changes` never set (type error or assertion fail).

- [ ] **Step 3a: Add the type import to `helpers.ts`**

In `src/utils/helpers.ts`, replace the first import line:

```ts
import { STOCK_STATUS } from "./constants.js";
```

with:

```ts
import { STOCK_STATUS } from "./constants.js";
import type { AuditChange } from "./auditDiff.js";
```

- [ ] **Step 3b: Extend the `Audit` interface**

Replace:

```ts
export interface Audit {
  id: number;
  date: string;
  action: string;
  detail: string;
  user: string;
}
```

with:

```ts
export interface Audit {
  id: number;
  date: string;
  action: string;
  detail: string;
  user: string;
  changes?: AuditChange[];
}
```

- [ ] **Step 3c: Extend `mkAudit`**

Replace:

```ts
export const mkAudit = (action: string, detail: string, user?: string): Audit => ({
  id: Date.now() + Math.random(),
  date: nowStr(),
  action,
  detail,
  user: user || "system",
});
```

with:

```ts
export const mkAudit = (action: string, detail: string, user?: string, changes?: AuditChange[]): Audit => ({
  id: Date.now() + Math.random(),
  date: nowStr(),
  action,
  detail,
  user: user || "system",
  ...(changes && changes.length ? { changes } : {}),
});
```

- [ ] **Step 3d: Extend `addA` in `App.jsx`**

In `src/App.jsx`, replace:

```jsx
  const addA=(a,d)=>setAudit(p=>[mkAudit(a,d,cu?.username),...p].slice(0,500));
```

with:

```jsx
  const addA=(a,d,changes)=>setAudit(p=>[mkAudit(a,d,cu?.username,changes),...p].slice(0,500));
```

- [ ] **Step 4: Run test + typecheck**

Run: `npx vitest run src/utils/mkAudit.test.ts && npm run typecheck`
Expected: test PASS (3); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/utils/helpers.ts src/utils/mkAudit.test.ts src/App.jsx
git commit -m "feat(audit): optional changes[] on Audit/mkAudit/addA"
```

---

## Task 3: Capture SO edit diff (`Sales.jsx`)

**Files:**
- Modify: `src/components/Sales.jsx:3` (import), `:135` (edit branch)

- [ ] **Step 1: Add the auditDiff import**

Replace the helpers import line:

```jsx
import { fmt, toBE, todayStr, mkLog, round2, calcAccumulatedTotal, calcCurrentMatchTotal, findClaimableTiers, legacyPrefix, splitLegacyNum, snapshotItemParts, productQualifiesForPromo, nextDocNum, poStatusFromShipments } from "../utils/helpers.js";
```

with:

```jsx
import { fmt, toBE, todayStr, mkLog, round2, calcAccumulatedTotal, calcCurrentMatchTotal, findClaimableTiers, legacyPrefix, splitLegacyNum, snapshotItemParts, productQualifiesForPromo, nextDocNum, poStatusFromShipments } from "../utils/helpers.js";
import { diffFields, diffLineItems } from "../utils/auditDiff.ts";
```

- [ ] **Step 2: Build + pass `changes` in the SO edit branch**

Replace:

```jsx
    if(soId){const oldSO=sales.find(s=>s.id===soId);const keepStatus=oldSO?.status==="pending_special_approval"&&needsApproval?"pending_special_approval":needsApproval?"pending_special_approval":oldSO?.status||"pending_delivery";setSales(p=>p.map(s=>s.id===soId?{...s,...soBase,status:keepStatus}:s));addA("แก้ไข SO",editSO?.soNum||"");setEditSO(null);}
```

with:

```jsx
    if(soId){const oldSO=sales.find(s=>s.id===soId);const keepStatus=oldSO?.status==="pending_special_approval"&&needsApproval?"pending_special_approval":needsApproval?"pending_special_approval":oldSO?.status||"pending_delivery";setSales(p=>p.map(s=>s.id===soId?{...s,...soBase,status:keepStatus}:s));
      const _money=n=>"฿"+fmt(n);const _cust=id=>{const c=contacts.find(x=>x.id===id);return c?cN(c):(id?"#"+id:"—");};const _nameOf=pid=>{const p=products.find(x=>x.id===pid);return p?pN(p):"#"+pid;};
      const _soDefs=[{key:"customerId",label:"ลูกค้า",fmt:_cust},{key:"date",label:"วันที่",fmt:toBE},{key:"payType",label:"การชำระ",fmt:v=>v==="cash"?"เงินสด":v==="credit"?"เครดิต":String(v??"")},{key:"creditDays",label:"เครดิต (วัน)"},{key:"discountAmt",label:"ส่วนลด",fmt:_money},{key:"includeVat",label:"VAT",fmt:v=>v?"รวม":"ไม่รวม"},{key:"vatRepName",label:"ตัวแทน VAT"},{key:"note",label:"หมายเหตุ"}];
      const _changes=oldSO?[...diffFields(oldSO,soBase,_soDefs),...diffLineItems(oldSO.items||[],soBase.items||[],{priceKey:"price",nameOf:_nameOf,fmtMoney:_money})]:[];
      addA("แก้ไข SO",editSO?.soNum||"",_changes);setEditSO(null);}
```

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/Sales.jsx
git commit -m "feat(audit): capture SO edit diff (fields + line items)"
```

---

## Task 4: Capture PO edit diff (`PurchaseOrders.jsx`)

**Files:**
- Modify: `src/components/PurchaseOrders.jsx:3` (import), `:206-207` (updatePO)

- [ ] **Step 1: Add the auditDiff import**

Replace:

```jsx
import { fmt, toBE, todayStr, mkLog, nowStr, fmtD, nextDocNum, shipmentTotals, poStatusFromShipments, buildDropshipShipmentSO, poEditViolation } from "../utils/helpers.js";
```

with:

```jsx
import { fmt, toBE, todayStr, mkLog, nowStr, fmtD, nextDocNum, shipmentTotals, poStatusFromShipments, buildDropshipShipmentSO, poEditViolation } from "../utils/helpers.js";
import { diffFields, diffLineItems } from "../utils/auditDiff.ts";
```

- [ ] **Step 2: Build + pass `changes` in `updatePO`**

Replace:

```jsx
    setPOs(p=>p.map(x=>x.id===editPO.id?{...x,...base}:x));
    addA("แก้ไข PO",editPO.poNum);setEditPO(null);cM();
```

with:

```jsx
    setPOs(p=>p.map(x=>x.id===editPO.id?{...x,...base}:x));
    const _money=n=>"฿"+fmt(n);const _cust=id=>{const c=contacts.find(x=>x.id===id);return c?cN(c):(id?"#"+id:"—");};const _nameOf=pid=>{const p=products.find(x=>x.id===pid);return p?pN(p):"#"+pid;};
    const _poDefs=[{key:"supplierId",label:"ผู้ขาย",fmt:_cust},{key:"date",label:"วันที่",fmt:toBE},{key:"deliveryDate",label:"วันส่ง",fmt:toBE},{key:"creditDays",label:"เครดิต (วัน)"},{key:"refNo",label:"เลขอ้างอิง"},{key:"dropShip",label:"ส่งนอกสถานที่",fmt:v=>v?"ใช่":"ไม่"},{key:"dropShipCustomerId",label:"ลูกค้าปลายทาง",fmt:_cust},{key:"note",label:"หมายเหตุ"}];
    const _changes=[...diffFields(editPO,base,_poDefs),...diffLineItems(editPO.items||[],base.items||[],{priceKey:"cost",nameOf:_nameOf,fmtMoney:_money})];
    addA("แก้ไข PO",editPO.poNum,_changes);setEditPO(null);cM();
```

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/PurchaseOrders.jsx
git commit -m "feat(audit): capture PO edit diff (fields + line items)"
```

---

## Task 5: Capture product edit diff (`Products.jsx`)

**Files:**
- Modify: `src/components/Products.jsx:3` (import), `:70` (saveProd edit branch)

- [ ] **Step 1: Add the auditDiff import**

Replace:

```jsx
import { fmt, mkLog, getSS, toBE, fmtD, DEFAULT_SPLIT_PARTS } from "../utils/helpers.js";
```

with:

```jsx
import { fmt, mkLog, getSS, toBE, fmtD, DEFAULT_SPLIT_PARTS } from "../utils/helpers.js";
import { diffFields } from "../utils/auditDiff.ts";
```

- [ ] **Step 2: Build + pass `changes` on product edit**

In `saveProd`, replace the exact call:

```jsx
addA("แก้ไขสินค้า",item.code);
```

with:

```jsx
{const _money=n=>"฿"+fmt(n);const _catName=id=>{const c=cats.find(x=>x.id===+id);return c?c.name:(id?"#"+id:"—");};const _prodDefs=[{key:"name",label:"ชื่อ"},{key:"brand",label:"ยี่ห้อ"},{key:"price",label:"ราคาขาย",fmt:_money},{key:"cost",label:"ต้นทุน",fmt:_money},{key:"minStock",label:"ขั้นต่ำ"},{key:"categoryId",label:"หมวด",fmt:_catName},{key:"distributor",label:"ผู้จัดจำหน่าย"}];addA("แก้ไขสินค้า",item.code,diffFields(b,item,_prodDefs));}
```

(The surrounding context is `...item.stock,"Edit","แก้ไข",cu.username));}` then this call, inside `if(b){...}`. Wrapping the new statements in a block `{...}` keeps it a single valid statement in that position.)

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/Products.jsx
git commit -m "feat(audit): capture product edit diff (price/cost/min/category/...)"
```

---

## Task 6: Show changes in the AuditLog popover

**Files:**
- Modify: `src/components/Reports/AuditLog.jsx` (row map ~line 105, action cell, popover ~line 130)

- [ ] **Step 1: Compute change flags per row**

Replace:

```jsx
              const [dpart,tpart]=fmtD(l.date).split(" ");
              const ref=parseAuditRef(l.detail,codes);
              return <tr key={l.id}
```

with:

```jsx
              const [dpart,tpart]=fmtD(l.date).split(" ");
              const ref=parseAuditRef(l.detail,codes);
              const chg=l.changes&&l.changes.length?l.changes:null;
              const hv=ref||chg;
              return <tr key={l.id}
```

- [ ] **Step 2: Wire the action cell to `hv` + add the change-count hint**

Replace:

```jsx
                <td style={{padding:"8px 12px"}}>
                  <span style={{display:"inline-flex",alignItems:"center",gap:8,flexWrap:"wrap",cursor:ref?"help":"default"}}
                    onMouseEnter={ref?(e=>setHover({ref,x:e.clientX,y:e.clientY})):undefined}
                    onMouseMove={ref?(e=>setHover(h=>h?{...h,x:e.clientX,y:e.clientY}:h)):undefined}
                    onMouseLeave={ref?(()=>setHover(null)):undefined}>
                    <CatBadge cat={l.cat}/>
                    <span>{l.action}</span>
                    {l.detail&&<span style={{color:"var(--dim)",textDecoration:ref?"underline dotted":"none",textUnderlineOffset:2}}>{"· "+l.detail}</span>}
                  </span>
                </td>
```

with:

```jsx
                <td style={{padding:"8px 12px"}}>
                  <span style={{display:"inline-flex",alignItems:"center",gap:8,flexWrap:"wrap",cursor:hv?"help":"default"}}
                    onMouseEnter={hv?(e=>setHover({ref,changes:chg,x:e.clientX,y:e.clientY})):undefined}
                    onMouseMove={hv?(e=>setHover(h=>h?{...h,x:e.clientX,y:e.clientY}:h)):undefined}
                    onMouseLeave={hv?(()=>setHover(null)):undefined}>
                    <CatBadge cat={l.cat}/>
                    <span>{l.action}</span>
                    {l.detail&&<span style={{color:"var(--dim)",textDecoration:hv?"underline dotted":"none",textUnderlineOffset:2}}>{"· "+l.detail}</span>}
                    {chg&&<span style={{color:"var(--faint)",fontSize:11}}>{"("+chg.length+" การเปลี่ยนแปลง)"}</span>}
                  </span>
                </td>
```

- [ ] **Step 3: Render the changes list in the popover (priority over preview)**

Replace:

```jsx
      const info=lookup(hover.ref);
      const W=320,M=12;
```

with:

```jsx
      const info=lookup(hover.ref);
      const changes=hover.changes;
      const headerNum=info?info.num:(hover.ref?(hover.ref.num||hover.ref.code):"");
      const W=320,M=12;
```

Then replace the popover body opener:

```jsx
        {!info
          ? <div style={{color:"var(--dim)"}}>ไม่พบเอกสาร (อาจถูกลบ)</div>
```

with:

```jsx
        {changes&&changes.length
          ? <>
              {headerNum&&<div style={{fontWeight:700,fontSize:13,marginBottom:8}}>{headerNum}</div>}
              <div style={{maxHeight:200,overflowY:"auto",display:"flex",flexDirection:"column",gap:8}}>
                {changes.map((c,idx)=><div key={idx}>
                  <div style={{color:"var(--dim)",fontSize:11,marginBottom:1}}>{c.label}</div>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                    <span style={{color:"var(--faint)",textDecoration:"line-through"}}>{c.from}</span>
                    <span style={{color:"var(--dim)"}}>{"→"}</span>
                    <span style={{color:"var(--text)",fontWeight:500}}>{c.to}</span>
                  </div>
                </div>)}
              </div>
            </>
          : !info
            ? <div style={{color:"var(--dim)"}}>ไม่พบเอกสาร (อาจถูกลบ)</div>
```

(The remaining `: info.kind==="product" ? <>...</> : <>...</>` branches are unchanged — the
new `changes` branch is prepended to the existing chain.)

- [ ] **Step 4: Typecheck + build + full test suite**

Run: `npm run typecheck && npm run build && npm test`
Expected: all PASS. Test count = phase-1 baseline (288) + `auditDiff.test.ts` (9) + `mkAudit.test.ts` (3) = 300.

- [ ] **Step 5: Commit**

```bash
git add src/components/Reports/AuditLog.jsx
git commit -m "feat(audit): show edit diff (from->to) in the hover popover + change-count hint"
```

---

## Task 7: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full green gate**

Run: `npm run typecheck && npm run build && npm test`
Expected: all PASS; 300 tests.

- [ ] **Step 2: Manual smoke (optional, read-only)**

Edit an SO / PO / product (changing customer, a discount, an item qty/price, or a product
price), then open Reports → Audit and hover the new "แก้ไข ..." row: the popover shows the
from→to list and the row shows "(N การเปลี่ยนแปลง)". Editing without changing anything logs a
plain "แก้ไข ..." row with no hint. Do not touch save/confirm/delete beyond the edit you are
testing (shared prod Supabase — `feedback_preview_writes_prod`).

---

## Self-review notes

- Spec coverage: `AuditChange`/`diffFields`/`diffLineItems` (Task 1); `changes` on
  `Audit`/`mkAudit`/`addA` (Task 2); SO/PO/product capture with the spec's allowlists +
  line-item diff (Tasks 3–5); popover render + hint, ref-or-changes trigger (Task 6).
  QT excluded; product `stock` excluded; not retroactive — all honored.
- Type/name consistency: `diffFields(old,next,defs)`, `diffLineItems(old,new,{priceKey,nameOf,fmtMoney})`,
  `AuditChange {label,from,to}`, `mkAudit(action,detail,user,changes)`, `addA(a,d,changes)`,
  `setHover({ref,changes,x,y})` used identically across tasks.
- No placeholders: every code step is complete; every run step states the expected result.
