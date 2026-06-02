# Cash Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cash account(s) + transaction categories to Finance, reusing `bankAccs`/`bankTxns` via additive flags; auto-tag SO/PO payments and support cash-method receive/pay, account-to-account transfers (paired txns), opening balance, and per-account adjustment.

**Architecture:** Additive schema (no breaking changes). `bankAccs[].isCash` flag distinguishes cash from bank; same balance/history machinery. New `cashCats[]` state for category metadata with 2-level structure; `bankTxns[]` gain `catId`/`subCatId`/`transferPair` fields. UI in `Finance.jsx` extends the existing "bank" sub-tab (rename to "บัญชี") with new modals (cash-create, transfer, adjust, manage-categories) and the payment workflow gains cash method options.

**Tech Stack:** React 19 + Vite 6 (no test framework for UI — verify via ESLint + `npm run build` + manual browser preview); Node-based unit tests for pure functions (`merge.test.mjs`).

**Spec:** `docs/superpowers/specs/2026-06-02-cash-accounts-design.md`

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/data/initData.js` | Seed `initCashCats` (8 default categories with subs) | Modify |
| `src/utils/storage.js` | Add `v3_cashcats → cashcats` to KEY_MAP | Modify |
| `src/utils/merge.js` | Add `cashcats: {}` to MERGE_CFG (default by-id) | Modify |
| `src/utils/merge.test.mjs` | Add regression tests for cashCats and new bankAccs/bankTxns fields | Modify |
| `src/App.jsx` | Add `cashCats` state + applyData/seedSync wiring + autosave deps + RT_SETTERS + bankAccs field migration | Modify |
| `src/components/Finance.jsx` | All UI: tab rename, cash account create, manual in/out with cats, manage cats, transfer modal, adjust modal, payment method ext., txn list cat column | Modify (major) |
| `HANDOFF.md` | §6 add `cashcats` to KEY_MAP table; §10 add row | Modify |
| `vite.config.js` | Bump `__APP_VERSION__` to `v1.7.0-cash-accounts` | Modify |

---

## Task 1: Schema scaffolding — `cashCats` state + sync wiring + tests

**Why:** Establish the data layer first so subsequent UI tasks can rely on a working sync pipeline. Build → tests pass before any UI changes.

**Files:**
- Modify: `src/data/initData.js` (append at end)
- Modify: `src/utils/storage.js:20-44` (KEY_MAP)
- Modify: `src/utils/merge.js:62-71` (MERGE_CFG)
- Modify: `src/utils/merge.test.mjs` (append new tests)
- Modify: `src/App.jsx` (~5 places per HANDOFF §9.B checklist)

---

- [ ] **Step 1.1: Add `initCashCats` export to initData.js**

Append at end of `src/data/initData.js`:

```js
export const initCashCats = [
  { id: 1, name: "ขาย", type: "in", subs: [
    { id: 11, name: "ขายสด (SO)" },
    { id: 12, name: "ขายเศษ" },
    { id: 13, name: "อื่นๆ" },
  ]},
  { id: 2, name: "ซื้อ", type: "out", subs: [
    { id: 21, name: "จ่ายซัพ (PO)" },
    { id: 22, name: "จ่ายซื้อจิปาถะ" },
  ]},
  { id: 3, name: "ค่าใช้จ่ายร้าน", type: "out", subs: [
    { id: 31, name: "ค่ากาแฟ/น้ำดื่ม" },
    { id: 32, name: "ค่าน้ำมัน/เดินทาง" },
    { id: 33, name: "ค่าทำความสะอาด" },
  ]},
  { id: 4, name: "ค่าสาธารณูปโภค", type: "out", subs: [
    { id: 41, name: "ค่าน้ำ" },
    { id: 42, name: "ค่าไฟ" },
    { id: 43, name: "ค่าโทรศัพท์/เน็ต" },
  ]},
  { id: 5, name: "ค่าสถานที่", type: "out", subs: [
    { id: 51, name: "ค่าเช่า" },
    { id: 52, name: "ค่าซ่อมแซม" },
  ]},
  { id: 6, name: "โอน/ถอน/ฝาก", type: "both", subs: [
    { id: 61, name: "ฝากเข้าธนาคาร" },
    { id: 62, name: "ถอนจากธนาคาร" },
    { id: 63, name: "โอนระหว่างบัญชี" },
  ]},
  { id: 7, name: "ปรับยอด", type: "both", subs: [
    { id: 71, name: "เกิน" },
    { id: 72, name: "ขาด" },
  ]},
  { id: 8, name: "อื่นๆ", type: "both", subs: [] },
];
```

- [ ] **Step 1.2: Add `v3_cashcats → cashcats` to KEY_MAP**

Edit `src/utils/storage.js`. In the `KEY_MAP` object (around line 20-44), add the new entry alphabetically near `cats`:

```js
const KEY_MAP = {
  v3_products: "products",
  v3_contacts: "contacts",
  v3_pos: "pos",
  v3_sales: "sales",
  v3_cats: "cats",
  v3_cashcats: "cashcats",          // NEW
  v3_brands: "brands",
  // ...rest unchanged
};
```

- [ ] **Step 1.3: Add `cashcats: {}` to MERGE_CFG**

Edit `src/utils/merge.js` line 62-71. The default config (no custom `keyOf`) is correct because records have `id`:

```js
export const MERGE_CFG = {
  products: {}, contacts: {}, pos: {}, sales: {}, cats: {}, cashcats: {}, brands: {},
  payments: {}, quotes: {}, targets: {}, cheques: {}, bankaccs: {},
  banktxns: {}, cnotes: {}, billings: {}, defectives: {}, supcnotes: {},
  promos: {}, events: {},
  logs: { keyOf: (x) => (x.id != null ? x.id : `${x.date}|${x.type}|${x.productId}|${x.ref}|${x.qty}`) },
  audit: { cap: 500, ts: (x) => x.id || 0 },
  pricehist: { cap: 500, ts: (x) => x.id || 0 },
  activity: { keyOf: (x) => `${x.userId ?? ""}|${x.loginTime ?? ""}`, cap: 200, ts: (x) => x.loginTime || 0 },
};
```

- [ ] **Step 1.4: Write failing test for cashCats merge**

Append to `src/utils/merge.test.mjs` (before `console.log` at the bottom):

```js
test("cashcats: concurrent insert different subs survives", () => {
  const base = [{ id: 1, name: "ขาย", type: "in", subs: [{ id: 11, name: "ขายสด (SO)" }] }];
  const mine = [{ id: 1, name: "ขาย", type: "in", subs: [{ id: 11, name: "ขายสด (SO)" }] }, { id: 99, name: "Custom A", type: "out", subs: [] }];
  const remote = [{ id: 1, name: "ขาย", type: "in", subs: [{ id: 11, name: "ขายสด (SO)" }] }, { id: 100, name: "Custom B", type: "out", subs: [] }];
  const merged = mergeForKey("cashcats", base, mine, remote);
  assert.equal(merged.length, 3, "should keep base + both inserts");
  assert.ok(merged.some(c => c.id === 99));
  assert.ok(merged.some(c => c.id === 100));
});

test("banktxns: new catId field merged with deep equality", () => {
  const base = [{ id: 1, accId: 1, type: "in", amount: 100, catId: null, subCatId: null }];
  const mine = [{ id: 1, accId: 1, type: "in", amount: 100, catId: 1, subCatId: 11 }];
  const remote = [{ id: 1, accId: 1, type: "in", amount: 100, catId: null, subCatId: null }];
  // mine added a category, remote unchanged → mine wins
  const merged = mergeForKey("banktxns", base, mine, remote);
  assert.equal(merged[0].catId, 1);
  assert.equal(merged[0].subCatId, 11);
});

test("bankaccs: isCash flag merged correctly", () => {
  const base = [{ id: 1, name: "บัญชี 1", bank: "กสิกร" }];
  const mine = [{ id: 1, name: "บัญชี 1", bank: "กสิกร" }, { id: 2, name: "เงินสดหน้าร้าน", bank: "เงินสด", isCash: true, openingBalance: 5000 }];
  const remote = [{ id: 1, name: "บัญชี 1", bank: "กสิกร" }];
  const merged = mergeForKey("bankaccs", base, mine, remote);
  assert.equal(merged.length, 2);
  const cash = merged.find(a => a.isCash);
  assert.ok(cash, "cash account should be in merged result");
  assert.equal(cash.openingBalance, 5000);
});
```

- [ ] **Step 1.5: Run tests to verify they pass**

Run: `node src/utils/merge.test.mjs`
Expected: All tests pass (previous 13 + 3 new = 16 tests with `ok -` lines, ending `Pass: 16, Fail: 0` or equivalent).

If a test fails, the wiring is wrong — fix before proceeding.

- [ ] **Step 1.6: Wire `cashCats` into App.jsx state**

Edit `src/App.jsx`. Required changes in 7 places per HANDOFF §9.B.

**(a) Add import for `initCashCats`** in the import line for initData.js (around line 7):

```js
import { initProducts, initContacts, initPOs, initSales, initCats, initCashCats, initBrands, initUsers, initQuotes, initTargets } from "./data/initData.js";
```

**(b) Add `useState` near other state arrays** (search for where `cats` state is declared, e.g. `const[cats,setCats]=useState(initCats);`). Add right after:

```js
const[cashCats,setCashCats]=useState(initCashCats);
```

**(c) Add to `applyData` function.** Find the section that maps loaded data to each state. There's a pattern like:

```js
out.cats=g(d?.cats,"v3_cats",initCats);setCats(out.cats);
```

Add right after the `cats` line:

```js
out.cashcats=g(d?.cashcats,"v3_cashcats",initCashCats);setCashCats(out.cashcats);
```

**(d) Add to autosave `current` map** (around line 307 — the big object inside the autosave effect):

```js
const current={products,contacts,pos,sales,cats,cashcats:cashCats,brands,logs,...};
```

(Insert `cashcats:cashCats,` immediately after `cats,`.)

**(e) Add to autosave `useEffect` deps array** (around line 322 — the long array with all state names):

```js
},[products,contacts,pos,sales,cats,cashCats,brands,logs,...,loaded]);
```

(Insert `cashCats,` after `cats,`.)

**(f) Add to `RT_SETTERS`/`getSetters` map** (around line 156):

```js
if(!RT_SETTERS.current)RT_SETTERS.current={products:setProducts,contacts:setContacts,...,cats:setCats,cashcats:setCashCats,...};
```

(Insert `cashcats:setCashCats,` after `cats:setCats,`.)

**(g) Pass to Finance via the `sh` state-hub object.** Find where `sh` is constructed (search for `const sh=`). Add `cashCats, setCashCats` to the destructured exports.

- [ ] **Step 1.7: Verify wiring**

Run in parallel:

```bash
node src/utils/merge.test.mjs   # tests still pass
npx eslint src/App.jsx          # no new errors at the lines we touched
npm run build                   # build clean
```

Expected:
- merge tests: all pass (16 ok)
- eslint: 7 problems still (same as before; we added a new state correctly)
- build: clean, mode `generateSW` succeeds, 76 PWA precache entries

- [ ] **Step 1.8: Commit**

```bash
git add src/data/initData.js src/utils/storage.js src/utils/merge.js src/utils/merge.test.mjs src/App.jsx
git commit -m "$(cat <<'EOF'
feat(sync): wire cashCats state machinery (Task 1 of cash-accounts)

- initCashCats seed (8 categories with subs) in initData.js
- v3_cashcats → cashcats in KEY_MAP
- cashcats default config in MERGE_CFG (keyOf=byId)
- 3 new merge.test.mjs cases (cashcats insert/insert; banktxns catId merge;
  bankaccs isCash field merge)
- App.jsx: useState, applyData, autosave current+deps, RT_SETTERS, sh hub
- Spec: docs/superpowers/specs/2026-06-02-cash-accounts-design.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Cash account creation modal

**Why:** Allow user to create their first cash account with an opening balance. Opens a path for all subsequent flows.

**Files:**
- Modify: `src/components/Finance.jsx` (extend "+ บัญชีใหม่" button + new form state + handler; in the `sub==="bank"` section)

---

- [ ] **Step 2.1: Add cash account form state**

In `Finance.jsx` near the existing `accForm` state (around line 41), add:

```js
const[acctType,setAcctType]=useState(null);  // null | "bank" | "cash" — chosen step
const[cashAcctForm,setCashAcctForm]=useState({name:"",openingBalance:"",openingDate:todayStr()});
```

- [ ] **Step 2.2: Add `saveCashAccount` handler**

In `Finance.jsx`, near the existing `saveAcc` handler, add:

```js
const saveCashAccount=()=>{
  if(!cashAcctForm.name.trim())return;
  const openingAmt=+cashAcctForm.openingBalance||0;
  const newId=Date.now();
  const newAcc={id:newId,name:cashAcctForm.name.trim(),bank:"เงินสด",accNo:"",
    isCash:true,openingBalance:openingAmt,openingDate:cashAcctForm.openingDate,
    perms:{receive:true,payOut:true,transfer:true,clearCheque:false}};
  setBankAccs(p=>[...p,newAcc]);
  if(openingAmt>0){
    setBankTxns(p=>[...p,{id:newId+1,accId:newId,type:"opening",
      amount:openingAmt,date:cashAcctForm.openingDate,
      from:"ตั้งยอดเริ่มต้น",refId:"",note:"ยอดเริ่มต้น",
      catId:null,subCatId:null,transferPair:null}]);
  }
  setCashAcctForm({name:"",openingBalance:"",openingDate:todayStr()});
  setAcctType(null);
  cM();
};
```

- [ ] **Step 2.3: Modify "+ บัญชีใหม่" button to open type picker**

Find the existing "+ บัญชีใหม่" button (search for `บัญชีใหม่` in `sub==="bank"` block — around line 365-415). Change its onClick to:

```jsx
<Btn onClick={()=>{setAcctType(null);oM("newAccount");}}>+ บัญชีใหม่</Btn>
```

- [ ] **Step 2.4: Add `newAccount` modal (type picker → form)**

Add this modal block near the other modals (search for `modal==="addAcc"` to find an existing modal pattern, then add a new one):

```jsx
{modal==="newAccount"&&ed&&<Modal title="สร้างบัญชีใหม่" onClose={()=>{setAcctType(null);cM();}}>
  {!acctType&&<div style={{display:"flex",gap:12,padding:8}}>
    <button onClick={()=>setAcctType("bank")} style={{flex:1,padding:"24px 16px",border:"1px solid var(--line)",borderRadius:10,background:"var(--panel)",cursor:"pointer",fontFamily:"inherit",fontSize:14,color:"var(--text)"}}>
      <div style={{fontSize:16,fontWeight:500,marginBottom:6}}>บัญชีธนาคาร</div>
      <div style={{fontSize:12,color:"var(--dim)"}}>กสิกร · SCB · TTB · ฯลฯ</div>
    </button>
    <button onClick={()=>setAcctType("cash")} style={{flex:1,padding:"24px 16px",border:"1px solid var(--line)",borderRadius:10,background:"var(--panel)",cursor:"pointer",fontFamily:"inherit",fontSize:14,color:"var(--text)"}}>
      <div style={{fontSize:16,fontWeight:500,marginBottom:6}}>บัญชีเงินสด</div>
      <div style={{fontSize:12,color:"var(--dim)"}}>ลิ้นชักหน้าร้าน / Petty cash</div>
    </button>
  </div>}
  {acctType==="cash"&&<div>
    <Field label="ชื่อบัญชี"><input value={cashAcctForm.name} onChange={e=>setCashAcctForm({...cashAcctForm,name:e.target.value})} placeholder="เช่น เงินสดหน้าร้าน" style={{...IB,background:"var(--bg2)",border:"1px solid var(--line)",color:"var(--text)"}}/></Field>
    <Field label="ยอดเริ่มต้น (บาท)"><input type="number" value={cashAcctForm.openingBalance} onChange={e=>setCashAcctForm({...cashAcctForm,openingBalance:e.target.value})} placeholder="0" style={{...IB,background:"var(--bg2)",border:"1px solid var(--line)",color:"var(--text)"}}/></Field>
    <Field label="วันที่ตั้งยอด"><input type="date" value={cashAcctForm.openingDate} onChange={e=>setCashAcctForm({...cashAcctForm,openingDate:e.target.value})} style={{...IB,background:"var(--bg2)",border:"1px solid var(--line)",color:"var(--text)"}}/></Field>
    <div style={{display:"flex",gap:8,marginTop:16}}>
      <Btn onClick={()=>setAcctType(null)} variant="ghost">ย้อนกลับ</Btn>
      <Btn onClick={saveCashAccount} disabled={!cashAcctForm.name.trim()}>บันทึก</Btn>
    </div>
  </div>}
  {acctType==="bank"&&<div style={{padding:12,fontSize:13,color:"var(--dim)"}}>กำลังเปลี่ยนไปฟอร์มบัญชีธนาคารเดิม...</div>}
</Modal>}
```

- [ ] **Step 2.5: Route the `บัญชีธนาคาร` choice to the existing addAcc modal**

The codebase already has a full bank-account form (modal `addAcc` with `accForm` state — fields ชื่อ, ธนาคาร, เลขบัญชี, perms). Rather than duplicating it, change the type-picker `บัญชีธนาคาร` button so picking bank closes the new modal and opens the existing one:

```jsx
<button onClick={()=>{cM();setTimeout(()=>oM("addAcc"),0);}} ...>
  <div style={{fontSize:16,fontWeight:500,marginBottom:6}}>บัญชีธนาคาร</div>
  <div style={{fontSize:12,color:"var(--dim)"}}>กสิกร · SCB · TTB · ฯลฯ</div>
</button>
```

(The `setTimeout(...,0)` defers the open until after the close transition; without it, both modals can collide briefly.)

This keeps the existing bank-form behavior 100% unchanged. The `acctType==="bank"` branch in the JSX from Step 2.4 is now just a transient placeholder visible for one frame; replace it with `null` if you prefer (no need).

- [ ] **Step 2.6: Add cash-account visual treatment in the accounts list**

Find the accounts list rendering in `sub==="bank"` block (search for `bankAccs.map`). For each account row, conditional class/style based on `acc.isCash`:

```jsx
{bankAccs.map(acc=>{
  const isCash=!!acc.isCash;
  const accBalance=(acc.openingBalance||0)+bankTxns.filter(t=>t.accId===acc.id).reduce((s,t)=>{
    if(t.type==="in"||t.type==="opening")return s+(+t.amount||0);
    if(t.type==="out")return s-(+t.amount||0);
    if(t.type==="transfer")return s+(+t.amount||0);   // amount is already signed for transfer
    if(t.type==="adjust")return s+(+t.amount||0);     // amount is signed (+over / -short)
    return s;
  },0);
  return (
    <div key={acc.id} style={{...}}>
      <span style={{background:isCash?"rgba(52,199,89,0.12)":"var(--blue-bg)",color:isCash?"var(--green)":"var(--blue)",padding:"2px 8px",borderRadius:4,fontSize:11,fontWeight:500}}>
        {isCash?"เงินสด":"ธนาคาร"}
      </span>
      <span>{acc.name}</span>
      <span style={{fontVariantNumeric:"tabular-nums",fontWeight:600}}>฿{fmt(accBalance)}</span>
      {/* existing action buttons */}
    </div>
  );
})}
```

Note: the balance computation now must include `opening`, `transfer`, `adjust` types in addition to `in`/`out`. The transfer/adjust amounts will be stored signed in later tasks; account for this now to keep balances correct.

- [ ] **Step 2.7: Verify**

Run:

```bash
npm run build         # build clean
npx eslint src/components/Finance.jsx 2>&1 | tail -3   # no new errors
```

Then manually in the browser at `http://localhost:5173`:
1. Navigate to Finance → "บัญชี" tab (formerly "ธนาคาร")
2. Click "+ บัญชีใหม่" → choose "บัญชีเงินสด"
3. Name: "เงินสดหน้าร้าน", opening: 5000, today's date
4. Submit → verify a new row appears with green "เงินสด" badge and balance ฿5,000
5. Refresh the page → verify the cash account persists (Supabase round-trip) and balance recomputes correctly

- [ ] **Step 2.8: Commit**

```bash
git add src/components/Finance.jsx
git commit -m "$(cat <<'EOF'
feat(finance): create cash account with opening balance (Task 2 of cash-accounts)

- "+ บัญชีใหม่" now opens a type picker (บัญชีธนาคาร / บัญชีเงินสด)
- Cash form: name + openingBalance + openingDate
- Saves bankAccs row with isCash:true plus an "opening" bankTxn
- Account list shows green "เงินสด" badge for cash accounts
- Balance formula extended to include opening/transfer/adjust txn types

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Manual cash in/out with category selectors

**Why:** Allow the user to record ad-hoc cash in/out (e.g., ค่ากาแฟ) tagged with a category — the primary use case for free-form cash tracking.

**Files:**
- Modify: `src/components/Finance.jsx` (extend `txnForm` state + the txn modal + the txn list rendering)

---

- [ ] **Step 3.1: Extend `txnForm` state to include category fields**

Find the existing `txnForm` state (around line 39):

```js
const[txnForm,setTxnForm]=useState({accId:bankAccs[0]?.id||1,type:"in",amount:"",date:todayStr(),from:"",refId:"",note:""});
```

Replace with:

```js
const[txnForm,setTxnForm]=useState({accId:bankAccs[0]?.id||1,type:"in",amount:"",date:todayStr(),from:"",refId:"",note:"",catId:"",subCatId:""});
```

- [ ] **Step 3.2: Add cashCats to the destructured `sh` exports**

At the top of `FinPage` (the line that destructures from `sh`), add `cashCats, setCashCats`:

```js
const{cN,pN,contacts,setContacts,...,cashCats,setCashCats,...}=sh;
```

- [ ] **Step 3.3: Add category selector helpers**

Near the top of `FinPage` (after the form-state declarations), add memoized derived lists:

```js
const catsForDir=useMemo(()=>(dir)=>{
  if(!dir)return cashCats;
  return cashCats.filter(c=>c.type===dir||c.type==="both");
},[cashCats]);

const subsForCat=useMemo(()=>(catId)=>{
  if(!catId)return [];
  const c=cashCats.find(x=>x.id===+catId);
  return c?.subs||[];
},[cashCats]);
```

- [ ] **Step 3.4: Extend the existing txn modal to render category fields**

Locate the existing `modal==="addTxn"` (or whatever its name is — search for `txnForm` in JSX). Add inside the form, after the `note` field:

```jsx
<Field label="หมวด">
  <select value={txnForm.catId} onChange={e=>setTxnForm({...txnForm,catId:e.target.value,subCatId:""})} style={{...IB,background:"var(--bg2)",border:"1px solid var(--line)",color:"var(--text)"}}>
    <option value="">(ไม่ระบุ)</option>
    {catsForDir(txnForm.type).map(c=>(
      <option key={c.id} value={c.id}>{c.name}</option>
    ))}
  </select>
</Field>
{txnForm.catId&&subsForCat(txnForm.catId).length>0&&<Field label="หมวดย่อย">
  <select value={txnForm.subCatId} onChange={e=>setTxnForm({...txnForm,subCatId:e.target.value})} style={{...IB,background:"var(--bg2)",border:"1px solid var(--line)",color:"var(--text)"}}>
    <option value="">(ไม่ระบุ)</option>
    {subsForCat(txnForm.catId).map(s=>(
      <option key={s.id} value={s.id}>{s.name}</option>
    ))}
  </select>
</Field>}
```

- [ ] **Step 3.5: Extend the txn save handler to persist catId/subCatId**

Find the save handler (the function called by the modal's submit button — search for `setBankTxns(p=>[...p,{` near `txnForm`). Add `catId`/`subCatId` to the new txn object:

```js
const newTxn={
  id:Date.now(),
  accId:txnForm.accId,
  type:txnForm.type,
  amount:+txnForm.amount,
  date:txnForm.date,
  from:txnForm.from,
  refId:txnForm.refId,
  note:txnForm.note,
  catId:txnForm.catId?+txnForm.catId:null,
  subCatId:txnForm.subCatId?+txnForm.subCatId:null,
  transferPair:null,
};
setBankTxns(p=>[...p,newTxn]);
```

- [ ] **Step 3.6: Show category chip in txn history list**

Find the txn history table rendering (search for the list of `bankTxns.map` inside `sub==="bank"`). Add a new column for `หมวด`:

```jsx
<td style={{padding:"8px"}}>
  {txn.catId?(()=>{
    const c=cashCats.find(x=>x.id===txn.catId);
    if(!c)return <span style={{color:"var(--faint)"}}>(หาไม่เจอ)</span>;
    const s=txn.subCatId?(c.subs||[]).find(x=>x.id===txn.subCatId):null;
    return <span style={{fontSize:11,background:"var(--blue-bg)",color:"var(--blue)",padding:"2px 7px",borderRadius:4}}>
      {c.name}{s?" / "+s.name:""}
    </span>;
  })():<span style={{color:"var(--faint)",fontSize:11}}>(ไม่ระบุ)</span>}
</td>
```

Add the matching `<th>หมวด</th>` to the table header.

- [ ] **Step 3.7: Verify**

```bash
npm run build
npx eslint src/components/Finance.jsx 2>&1 | tail -3
```

Manual smoke:
1. Open Finance → บัญชี → select the cash account from Task 2
2. Click "+ รายการ" → choose ออก (out), amount 50, note "กาแฟ", หมวด "ค่าใช้จ่ายร้าน" → หมวดย่อย "ค่ากาแฟ/น้ำดื่ม"
3. Save → balance drops to 4,950; history row shows the chip "ค่าใช้จ่ายร้าน / ค่ากาแฟ/น้ำดื่ม"
4. Try with direction=in → category dropdown shows only `type:"in"|"both"` cats (no "ซื้อ" or "ค่าใช้จ่ายร้าน")

- [ ] **Step 3.8: Commit**

```bash
git add src/components/Finance.jsx
git commit -m "$(cat <<'EOF'
feat(finance): manual cash in/out with category fields (Task 3 of cash-accounts)

- txnForm gains catId/subCatId
- "+ รายการ" modal renders cat select filtered by in/out, sub-cat
  shown when parent has subs
- Saved bankTxn carries catId/subCatId (null if user picks "(ไม่ระบุ)")
- Txn history table gains a หมวด column with chip display

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Manage cash categories (จัดการหมวด) modal

**Why:** Let the user add/rename/delete categories and sub-categories beyond the seeded defaults. Mirrors the Products category management pattern.

**Files:**
- Modify: `src/components/Finance.jsx`

---

- [ ] **Step 4.1: Add state and helpers**

Near other form state in `FinPage`:

```js
const[selCatId,setSelCatId]=useState(null);
const[newCatName,setNewCatName]=useState("");
const[newCatType,setNewCatType]=useState("both");
const[newSubName,setNewSubName]=useState("");
const[catUsageWarn,setCatUsageWarn]=useState(null);

const catUsageCount=(catId,subCatId=null)=>bankTxns.filter(t=>
  subCatId==null?t.catId===catId:(t.catId===catId&&t.subCatId===subCatId)).length;

const addCat=()=>{
  if(!newCatName.trim())return;
  const id=Date.now();
  setCashCats(p=>[...p,{id,name:newCatName.trim(),type:newCatType,subs:[]}]);
  setNewCatName("");setNewCatType("both");setSelCatId(id);
};
const renameCat=(id,name)=>setCashCats(p=>p.map(c=>c.id===id?{...c,name}:c));
const changeCatType=(id,type)=>setCashCats(p=>p.map(c=>c.id===id?{...c,type}:c));
const delCat=(id)=>{
  const used=catUsageCount(id);
  if(used>0){setCatUsageWarn({type:"cat",id,count:used});return;}
  setCashCats(p=>p.filter(c=>c.id!==id));
  if(selCatId===id)setSelCatId(null);
};
const addSub=(catId)=>{
  if(!newSubName.trim())return;
  const id=Date.now();
  setCashCats(p=>p.map(c=>c.id===catId?{...c,subs:[...(c.subs||[]),{id,name:newSubName.trim()}]}:c));
  setNewSubName("");
};
const renameSub=(catId,subId,name)=>setCashCats(p=>p.map(c=>c.id===catId?{...c,subs:c.subs.map(s=>s.id===subId?{...s,name}:s)}:c));
const delSub=(catId,subId)=>{
  const used=catUsageCount(catId,subId);
  if(used>0){setCatUsageWarn({type:"sub",catId,subId,count:used});return;}
  setCashCats(p=>p.map(c=>c.id===catId?{...c,subs:c.subs.filter(s=>s.id!==subId)}:c));
};
```

- [ ] **Step 4.2: Add the "จัดการหมวด" button next to "+ บัญชีใหม่"**

In the `sub==="bank"` toolbar:

```jsx
<Btn onClick={()=>oM("manageCats")} variant="ghost">จัดการหมวด</Btn>
```

- [ ] **Step 4.3: Add the manage-cats modal**

```jsx
{modal==="manageCats"&&ed&&<Modal title="จัดการหมวดเงินสด" onClose={cM} width={720}>
  <div style={{display:"flex",gap:16,minHeight:420}}>
    {/* Left pane — main cats */}
    <div style={{flex:"0 0 280px",borderRight:"1px solid var(--line)",paddingRight:16}}>
      <div style={{fontSize:13,fontWeight:600,marginBottom:8}}>หมวดหลัก</div>
      {cashCats.map(c=>(
        <div key={c.id} onClick={()=>setSelCatId(c.id)} style={{padding:"8px 10px",borderRadius:6,marginBottom:4,cursor:"pointer",background:selCatId===c.id?"var(--blue-bg)":"transparent",display:"flex",alignItems:"center",gap:8}}>
          <input value={c.name} onChange={e=>renameCat(c.id,e.target.value)} onClick={e=>e.stopPropagation()} style={{flex:1,background:"transparent",border:"none",color:"var(--text)",fontSize:13,fontFamily:"inherit"}}/>
          <select value={c.type} onChange={e=>changeCatType(c.id,e.target.value)} onClick={e=>e.stopPropagation()} style={{fontSize:11,padding:"2px 4px",background:"var(--bg2)",border:"1px solid var(--line)",color:"var(--text)",borderRadius:3}}>
            <option value="in">รับ</option>
            <option value="out">จ่าย</option>
            <option value="both">ทั้งคู่</option>
          </select>
          {cd&&<button onClick={e=>{e.stopPropagation();delCat(c.id);}} style={{background:"none",border:"none",cursor:"pointer",color:"var(--red)",fontSize:14}}>×</button>}
        </div>
      ))}
      <div style={{marginTop:12,display:"flex",gap:6}}>
        <input value={newCatName} onChange={e=>setNewCatName(e.target.value)} placeholder="ชื่อหมวดใหม่" style={{flex:1,...IB,background:"var(--bg2)",border:"1px solid var(--line)",color:"var(--text)",fontSize:12}}/>
        <select value={newCatType} onChange={e=>setNewCatType(e.target.value)} style={{fontSize:12,padding:"4px 6px",background:"var(--bg2)",border:"1px solid var(--line)",color:"var(--text)",borderRadius:4}}>
          <option value="in">รับ</option><option value="out">จ่าย</option><option value="both">ทั้งคู่</option>
        </select>
        <Btn onClick={addCat} disabled={!newCatName.trim()}>+</Btn>
      </div>
    </div>
    {/* Right pane — subs */}
    <div style={{flex:1}}>
      {!selCatId&&<div style={{color:"var(--dim)",padding:20,textAlign:"center"}}>เลือกหมวดหลักทางซ้ายเพื่อจัดการหมวดย่อย</div>}
      {selCatId&&(()=>{
        const c=cashCats.find(x=>x.id===selCatId);
        if(!c)return null;
        return <>
          <div style={{fontSize:13,fontWeight:600,marginBottom:8}}>หมวดย่อยของ "{c.name}"</div>
          {(c.subs||[]).map(s=>(
            <div key={s.id} style={{padding:"6px 10px",display:"flex",alignItems:"center",gap:8,marginBottom:4,borderRadius:6,background:"var(--bg2)"}}>
              <input value={s.name} onChange={e=>renameSub(c.id,s.id,e.target.value)} style={{flex:1,background:"transparent",border:"none",color:"var(--text)",fontSize:13,fontFamily:"inherit"}}/>
              {cd&&<button onClick={()=>delSub(c.id,s.id)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--red)",fontSize:14}}>×</button>}
            </div>
          ))}
          <div style={{marginTop:12,display:"flex",gap:6}}>
            <input value={newSubName} onChange={e=>setNewSubName(e.target.value)} placeholder="ชื่อหมวดย่อยใหม่" style={{flex:1,...IB,background:"var(--bg2)",border:"1px solid var(--line)",color:"var(--text)",fontSize:12}}/>
            <Btn onClick={()=>addSub(c.id)} disabled={!newSubName.trim()}>+</Btn>
          </div>
        </>;
      })()}
    </div>
  </div>
</Modal>}

{catUsageWarn&&<Modal title="ลบไม่ได้" onClose={()=>setCatUsageWarn(null)}>
  <div style={{padding:12}}>มีรายการเงินสด {catUsageWarn.count} รายการใช้หมวด{catUsageWarn.type==="sub"?"ย่อย":""}นี้อยู่ — แก้ไขรายการเหล่านั้นก่อนแล้วค่อยลบ</div>
  <Btn onClick={()=>setCatUsageWarn(null)}>ปิด</Btn>
</Modal>}
```

- [ ] **Step 4.4: Verify**

```bash
npm run build
```

Manual:
1. Finance → บัญชี → "จัดการหมวด"
2. Verify 8 seeded categories appear on left
3. Add new cat "ทดสอบ" type=both → appears
4. Click it → right pane empty → add sub "ทดสอบย่อย" → appears
5. Rename cat inline
6. Try to delete "ขาย" (which has txns from Task 5 once that's done — for now nothing references it, so it should delete). Re-create it.
7. Close modal, reopen → state persisted

- [ ] **Step 4.5: Commit**

```bash
git add src/components/Finance.jsx
git commit -m "$(cat <<'EOF'
feat(finance): manage cash categories modal (Task 4 of cash-accounts)

- จัดการหมวด button in บัญชี tab opens a 2-pane modal
- Left: main categories with inline rename, type select (in/out/both), delete
- Right: sub-categories of selected main cat with rename/delete
- Add new cat / sub-cat via inline form
- Delete blocked if 1+ bankTxn references the cat/subcat (shows count)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: SO/PO payment method = "เงินสด"

**Why:** Connect cash sales to cash account in one click — the original ask. Auto-tag with "ขาย → ขายสด (SO)".

**Files:**
- Modify: `src/components/Finance.jsx` (extend method select, accId filter, `savePay`, `delPay`)

---

- [ ] **Step 5.1: Identify auto-tag IDs at the top of FinPage**

Add near the top (after `cashCats` is destructured):

```js
// Resolve auto-tag IDs by name (defensive — user can rename via Task 4 but defaults exist)
const findCat=(name)=>cashCats.find(c=>c.name===name);
const findSub=(cat,subName)=>cat?.subs?.find(s=>s.name===subName);
const TAG_SO=()=>{const c=findCat("ขาย");return c?{catId:c.id,subCatId:findSub(c,"ขายสด (SO)")?.id||null}:{catId:null,subCatId:null};};
const TAG_PO=()=>{const c=findCat("ซื้อ");return c?{catId:c.id,subCatId:findSub(c,"จ่ายซัพ (PO)")?.id||null}:{catId:null,subCatId:null};};
const TAG_TRANSFER=(dir)=>{const c=findCat("โอน/ถอน/ฝาก");if(!c)return{catId:null,subCatId:null};const subName=dir==="depositToBank"?"ฝากเข้าธนาคาร":dir==="withdrawFromBank"?"ถอนจากธนาคาร":"โอนระหว่างบัญชี";return{catId:c.id,subCatId:findSub(c,subName)?.id||null};};
const TAG_ADJUST=(diff)=>{const c=findCat("ปรับยอด");if(!c)return{catId:null,subCatId:null};return{catId:c.id,subCatId:findSub(c,diff>=0?"เกิน":"ขาด")?.id||null};};
```

- [ ] **Step 5.2: Add "เงินสด" as a payment method**

Find the `openPay()` function (around line 66). Update so cash is a valid method option. Also update the method select in the addPay modal. Find the method `<select>` (search for `<option value="โอนเงิน"` near the addPay modal). Add cash option:

For AR (`payForm.type==="ar"`):

```jsx
<select value={payForm.method} onChange={e=>setPayForm({...payForm,method:e.target.value})}>
  <option value="โอนเงิน">โอนเงิน</option>
  <option value="เงินสด">เงินสด</option>     {/* NEW */}
  <option value="เช็ค">เช็ค</option>
  <option value="หักลดหนี้">หักลดหนี้</option>
</select>
```

For AP (`payForm.type==="ap"`):

```jsx
<select value={payForm.method} onChange={e=>setPayForm({...payForm,method:e.target.value})}>
  <option value="โอนเงินออก">โอนเงินออก</option>
  <option value="เงินสด">เงินสด</option>     {/* NEW */}
  <option value="จ่ายEPP">จ่ายEPP</option>
  <option value="หักลดหนี้">หักลดหนี้</option>
</select>
```

- [ ] **Step 5.3: Update account-id selector to filter by method**

Find the account selector in the addPay modal (search for `payForm.accId` in JSX). The selector should now filter:

```jsx
<select value={payForm.accId} onChange={e=>setPayForm({...payForm,accId:+e.target.value})}>
  {bankAccs
    .filter(a=>payForm.method==="เงินสด"?a.isCash:(!a.isCash))
    .map(a=>(
      <option key={a.id} value={a.id}>{a.name}{a.isCash?"":" — "+a.bank}</option>
    ))}
</select>
```

Show this selector when `method` is `โอนเงิน` / `โอนเงินออก` / `เงินสด` / `จ่ายEPP` (i.e., any method that targets an account).

- [ ] **Step 5.4: Extend `savePay` to handle cash method**

Find `savePay` (around line 69). Add `isArCash`/`isApCash` flags and bankTxn creation with auto-tag:

```js
const savePay=()=>{
  // ...existing validation...
  const isApBank=payForm.type==="ap"&&(payForm.method==="โอนเงินออก"||payForm.method==="จ่ายEPP")&&payForm.accId;
  const isArBank=payForm.type==="ar"&&payForm.method==="โอนเงิน"&&payForm.accId;
  const isApCash=payForm.type==="ap"&&payForm.method==="เงินสด"&&payForm.accId;     // NEW
  const isArCash=payForm.type==="ar"&&payForm.method==="เงินสด"&&payForm.accId;     // NEW

  // In the create-new branch (else block), after the existing isArBank/isApBank txn creation:
  if(isArCash){
    const tag=TAG_SO();
    setBankTxns(p=>[...p,{id:Date.now()+1,accId:payForm.accId,type:"in",amount:amt,date:payForm.date,from:payForm.name||"",refId:payForm.refId,note:"รับเงินสด "+payForm.refId,catId:tag.catId,subCatId:tag.subCatId,transferPair:null}]);
  }
  if(isApCash){
    const tag=TAG_PO();
    setBankTxns(p=>[...p,{id:Date.now()+1,accId:payForm.accId,type:"out",amount:amt,date:payForm.date,from:payForm.name||"",refId:payForm.refId,note:"จ่ายเงินสด "+payForm.refId,catId:tag.catId,subCatId:tag.subCatId,transferPair:null}]);
  }
  // Symmetric in the edit branch — replicate the same isArCash/isApCash logic.
};
```

Also update the existing `isArBank`/`isApBank` txn creations to set `catId/subCatId: null, transferPair: null` (additive fields on new rows).

- [ ] **Step 5.5: Ensure `delPay` removes the cash bankTxn correctly**

The existing `delPay` removes bankTxns by matching `refId + amount + date + type`. This already works for cash because `type:"in"|"out"` is the same. Verify by reading the function — no change needed if the heuristic matches. If method-specific match is needed for safety, optionally extend to also match by `note` prefix or skip — minimal change preferred.

- [ ] **Step 5.6: Verify**

```bash
npm run build
```

Manual:
1. Create a cash SO (Sales → new SO → payType=cash → save)
2. Go to Finance → AR — see the SO in the list with status "unpaid"
3. Click "รับเงิน" → method=เงินสด → choose the cash account → amount auto-filled to remaining → save
4. Verify SO status flips to "paid"
5. Go to Finance → บัญชี → click on the cash account → see new history row with chip "ขาย / ขายสด (SO)"
6. Balance increased by SO amount

Repeat for PO/AP path:
1. Create a PO (PurchaseOrders → received status)
2. Finance → AP → "จ่ายเงิน" → method=เงินสด → choose cash account
3. Verify chip "ซื้อ / จ่ายซัพ (PO)" and balance decreased

- [ ] **Step 5.7: Commit**

```bash
git add src/components/Finance.jsx
git commit -m "$(cat <<'EOF'
feat(finance): SO/PO cash payment method (Task 5 of cash-accounts)

- AR payment methods now include "เงินสด" (in addition to โอนเงิน / เช็ค / หักลดหนี้)
- AP payment methods now include "เงินสด" (in addition to โอนเงินออก / จ่ายEPP / หักลดหนี้)
- accId selector filters by isCash flag based on chosen method
- savePay() now creates bankTxn with auto-tag:
  AR cash → "ขาย / ขายสด (SO)" · AP cash → "ซื้อ / จ่ายซัพ (PO)"
- TAG_SO/TAG_PO/TAG_TRANSFER/TAG_ADJUST helpers resolve cat IDs by name
  so renames in Task 4 don't break

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Transfer modal (cash↔bank, cash↔cash, bank↔bank)

**Why:** Move money between any two accounts with a single action that creates two linked txns (one out, one in) sharing a `transferPair` id.

**Files:**
- Modify: `src/components/Finance.jsx`

---

- [ ] **Step 6.1: Add transfer form state**

Note: there's an existing `tfForm` state already; rewrite it to the spec model:

```js
const[tfForm,setTfForm]=useState({fromAccId:"",toAccId:"",amount:"",date:todayStr(),note:""});
```

- [ ] **Step 6.2: Add `saveTransfer` handler**

```js
const saveTransfer=()=>{
  const amt=+tfForm.amount;
  if(!tfForm.fromAccId||!tfForm.toAccId||tfForm.fromAccId===tfForm.toAccId)return;
  if(!amt||amt<=0)return;
  const fromAcc=bankAccs.find(a=>a.id===+tfForm.fromAccId);
  const toAcc=bankAccs.find(a=>a.id===+tfForm.toAccId);
  if(!fromAcc||!toAcc)return;
  const dir=(fromAcc.isCash&&!toAcc.isCash)?"depositToBank":
            (!fromAcc.isCash&&toAcc.isCash)?"withdrawFromBank":
            "interAccount";
  const tag=TAG_TRANSFER(dir);
  const pairId=Date.now();
  const outTxn={id:pairId,accId:fromAcc.id,type:"transfer",amount:-amt,date:tfForm.date,
    from:toAcc.name,refId:"",note:tfForm.note||"โอนไป "+toAcc.name,
    catId:tag.catId,subCatId:tag.subCatId,transferPair:pairId};
  const inTxn={id:pairId+1,accId:toAcc.id,type:"transfer",amount:amt,date:tfForm.date,
    from:fromAcc.name,refId:"",note:tfForm.note||"โอนจาก "+fromAcc.name,
    catId:tag.catId,subCatId:tag.subCatId,transferPair:pairId};
  setBankTxns(p=>[...p,outTxn,inTxn]);
  setTfForm({fromAccId:"",toAccId:"",amount:"",date:todayStr(),note:""});
  cM();
};
```

- [ ] **Step 6.3: Add "โอน" button to each account row + the transfer modal**

In the account list rendering (Task 2 Step 2.6 area), add the action button:

```jsx
<Btn onClick={()=>{setTfForm({fromAccId:acc.id,toAccId:"",amount:"",date:todayStr(),note:""});oM("transfer");}} variant="ghost">โอน</Btn>
```

Add the modal:

```jsx
{modal==="transfer"&&ed&&<Modal title="โอนเงินระหว่างบัญชี" onClose={cM}>
  <Field label="จากบัญชี">
    <select value={tfForm.fromAccId} onChange={e=>setTfForm({...tfForm,fromAccId:+e.target.value})} style={{...IB,background:"var(--bg2)",border:"1px solid var(--line)",color:"var(--text)"}}>
      <option value="">— เลือก —</option>
      {bankAccs.map(a=><option key={a.id} value={a.id}>{a.name}{a.isCash?" (เงินสด)":" — "+a.bank}</option>)}
    </select>
  </Field>
  <Field label="ไปบัญชี">
    <select value={tfForm.toAccId} onChange={e=>setTfForm({...tfForm,toAccId:+e.target.value})} style={{...IB,background:"var(--bg2)",border:"1px solid var(--line)",color:"var(--text)"}}>
      <option value="">— เลือก —</option>
      {bankAccs.filter(a=>a.id!==+tfForm.fromAccId).map(a=><option key={a.id} value={a.id}>{a.name}{a.isCash?" (เงินสด)":" — "+a.bank}</option>)}
    </select>
  </Field>
  <Field label="จำนวน (บาท)"><input type="number" value={tfForm.amount} onChange={e=>setTfForm({...tfForm,amount:e.target.value})} style={{...IB,background:"var(--bg2)",border:"1px solid var(--line)",color:"var(--text)"}}/></Field>
  <Field label="วันที่"><input type="date" value={tfForm.date} onChange={e=>setTfForm({...tfForm,date:e.target.value})} style={{...IB,background:"var(--bg2)",border:"1px solid var(--line)",color:"var(--text)"}}/></Field>
  <Field label="หมายเหตุ"><input value={tfForm.note} onChange={e=>setTfForm({...tfForm,note:e.target.value})} style={{...IB,background:"var(--bg2)",border:"1px solid var(--line)",color:"var(--text)"}}/></Field>
  <Btn onClick={saveTransfer} disabled={!tfForm.fromAccId||!tfForm.toAccId||!tfForm.amount||tfForm.fromAccId===tfForm.toAccId}>บันทึก</Btn>
</Modal>}
```

- [ ] **Step 6.4: Cascade-delete the paired txn**

Find the txn delete handler (search for `setBankTxns(prev=>prev.filter` near `confirmDelTxn`). Before filtering, capture the txn being deleted; if it has a `transferPair`, also remove the matching pair:

```js
const doDeleteTxn=(txn)=>{
  if(txn.transferPair){
    setBankTxns(prev=>prev.filter(t=>t.transferPair!==txn.transferPair));
  } else {
    setBankTxns(prev=>prev.filter(t=>t.id!==txn.id));
  }
  setConfirmDelTxn(null);
};
```

- [ ] **Step 6.5: Verify**

```bash
npm run build
```

Manual:
1. Create a 2nd cash account "Petty cash" with opening 500 (Task 2)
2. From the main cash account, click "โอน" → fromAccount preselected → choose Petty cash → amount 200 → save
3. Both accounts update: main −200, Petty +200
4. Both txns appear in history with chip "โอน/ถอน/ฝาก / โอนระหว่างบัญชี"
5. Delete one side → both sides disappear together
6. Try cash → bank: chip should say "ฝากเข้าธนาคาร"; bank → cash: "ถอนจากธนาคาร"

- [ ] **Step 6.6: Commit**

```bash
git add src/components/Finance.jsx
git commit -m "$(cat <<'EOF'
feat(finance): transfer between accounts with linked pair (Task 6 of cash-accounts)

- "โอน" button per account row opens transfer modal
- Creates 2 bankTxns sharing a transferPair id (out side: amount<0,
  in side: amount>0; both type:"transfer")
- Auto-cat based on direction: depositToBank / withdrawFromBank /
  interAccount (sub of "โอน/ถอน/ฝาก")
- Delete cascades to both sides via transferPair lookup

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Cash adjustment (ปรับยอด) modal

**Why:** End-of-day cash count discrepancy — user enters the actual counted balance and the system records the diff as an `adjust` txn with auto-cat "ปรับยอด → เกิน/ขาด".

**Files:**
- Modify: `src/components/Finance.jsx`

---

- [ ] **Step 7.1: Add adjust form state and balance helper**

```js
const[adjForm,setAdjForm]=useState({accId:null,actualBalance:"",date:todayStr(),note:""});

const calcBalance=(accId)=>{
  const acc=bankAccs.find(a=>a.id===accId);
  if(!acc)return 0;
  const opening=acc.openingBalance||0;
  return opening+bankTxns.filter(t=>t.accId===accId).reduce((s,t)=>{
    if(t.type==="in")return s+(+t.amount||0);
    if(t.type==="out")return s-(+t.amount||0);
    if(t.type==="opening")return s+(+t.amount||0)-opening; // already counted in opening
    if(t.type==="transfer"||t.type==="adjust")return s+(+t.amount||0);
    return s;
  },0);
};
```

(Refactor: this `calcBalance` should replace any inline balance computation done in Task 2 Step 2.6 so logic stays in one place.)

- [ ] **Step 7.2: Add `saveAdjust` handler**

```js
const saveAdjust=()=>{
  if(!adjForm.accId||adjForm.actualBalance===""||isNaN(+adjForm.actualBalance))return;
  const current=calcBalance(adjForm.accId);
  const actual=+adjForm.actualBalance;
  const diff=round2(actual-current);
  if(diff===0){cM();return;}
  const tag=TAG_ADJUST(diff);
  setBankTxns(p=>[...p,{id:Date.now(),accId:adjForm.accId,type:"adjust",
    amount:diff,date:adjForm.date,from:"",refId:"",
    note:adjForm.note||"ปรับยอด ("+(diff>0?"+":"")+fmt(diff)+")",
    catId:tag.catId,subCatId:tag.subCatId,transferPair:null}]);
  setAdjForm({accId:null,actualBalance:"",date:todayStr(),note:""});
  cM();
};
```

- [ ] **Step 7.3: Add "ปรับยอด" button (cash accounts only) + the modal**

In the account row (Task 2 Step 2.6), conditional on `isCash`:

```jsx
{isCash&&<Btn onClick={()=>{setAdjForm({accId:acc.id,actualBalance:"",date:todayStr(),note:""});oM("adjust");}} variant="ghost">ปรับยอด</Btn>}
```

Modal:

```jsx
{modal==="adjust"&&ed&&adjForm.accId&&(()=>{
  const acc=bankAccs.find(a=>a.id===adjForm.accId);
  const current=calcBalance(adjForm.accId);
  const actual=+adjForm.actualBalance||0;
  const diff=round2(actual-current);
  return <Modal title={"ปรับยอด — "+acc?.name} onClose={cM}>
    <div style={{padding:"8px 0",fontSize:13}}>ยอดในระบบตอนนี้: <strong>฿{fmt(current)}</strong></div>
    <Field label="ยอดที่นับจริง (บาท)"><input type="number" value={adjForm.actualBalance} onChange={e=>setAdjForm({...adjForm,actualBalance:e.target.value})} style={{...IB,background:"var(--bg2)",border:"1px solid var(--line)",color:"var(--text)"}}/></Field>
    {adjForm.actualBalance!==""&&<div style={{padding:"6px 0",fontSize:13,color:diff===0?"var(--dim)":diff>0?"var(--green)":"var(--red)"}}>ส่วนต่าง: {diff>=0?"+":""}฿{fmt(diff)} {diff>0?"(เกิน)":diff<0?"(ขาด)":""}</div>}
    <Field label="วันที่"><input type="date" value={adjForm.date} onChange={e=>setAdjForm({...adjForm,date:e.target.value})} style={{...IB,background:"var(--bg2)",border:"1px solid var(--line)",color:"var(--text)"}}/></Field>
    <Field label="หมายเหตุ"><input value={adjForm.note} onChange={e=>setAdjForm({...adjForm,note:e.target.value})} style={{...IB,background:"var(--bg2)",border:"1px solid var(--line)",color:"var(--text)"}}/></Field>
    <Btn onClick={saveAdjust} disabled={adjForm.actualBalance===""||diff===0}>บันทึก</Btn>
  </Modal>;
})()}
```

- [ ] **Step 7.4: Verify**

```bash
npm run build
```

Manual:
1. Open the main cash account → record balance shown
2. Click "ปรับยอด" → enter actual = balance + 100 → diff = +100 (เกิน) green
3. Save → history shows new "adjust" row with chip "ปรับยอด / เกิน"; balance reflects +100
4. Enter actual = balance − 50 → diff = −50 (ขาด) red → chip "ปรับยอด / ขาด"

- [ ] **Step 7.5: Commit**

```bash
git add src/components/Finance.jsx
git commit -m "$(cat <<'EOF'
feat(finance): cash adjustment (ปรับยอด) modal (Task 7 of cash-accounts)

- "ปรับยอด" button on cash account rows
- Modal shows current calculated balance, asks for actual counted balance,
  computes signed diff, color-coded (green=เกิน, red=ขาด)
- Saves bankTxn type:"adjust" with the signed diff and auto-cat
  "ปรับยอด / เกิน" or "ปรับยอด / ขาด"
- calcBalance helper consolidates balance arithmetic in one place

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Tab rename + summary header + HANDOFF + version bump

**Why:** Final polish — rename "ธนาคาร" sub-tab label to "บัญชี" (reflects that it now houses cash too), add the summary header showing cash/bank/total, update HANDOFF.md to capture the new sync key, bump app version.

**Files:**
- Modify: `src/components/Finance.jsx`
- Modify: `HANDOFF.md`
- Modify: `vite.config.js`

---

- [ ] **Step 8.1: Rename the tab label**

In `Finance.jsx`, find the sub-tab navigation (search for `setSub("bank")` — the button label). Change:

```jsx
<button onClick={()=>setSub("bank")} ...>บัญชี</button>
```

(Keep the data sub key as `"bank"` for backward compat with anyone using the URL/anchor.)

- [ ] **Step 8.2: Add the summary header**

At the top of the `sub==="bank"` rendering block, add:

```jsx
{(()=>{
  const cashTotal=bankAccs.filter(a=>a.isCash).reduce((s,a)=>s+calcBalance(a.id),0);
  const bankTotal=bankAccs.filter(a=>!a.isCash).reduce((s,a)=>s+calcBalance(a.id),0);
  return <div style={{display:"flex",gap:12,padding:"8px 0",borderBottom:"1px solid var(--line)",marginBottom:12,fontSize:13}}>
    <span>เงินสด: <strong style={{color:"var(--green)"}}>฿{fmt(cashTotal)}</strong></span>
    <span style={{color:"var(--faint)"}}>·</span>
    <span>ธนาคาร: <strong style={{color:"var(--blue)"}}>฿{fmt(bankTotal)}</strong></span>
    <span style={{color:"var(--faint)"}}>·</span>
    <span>รวมทั้งหมด: <strong>฿{fmt(cashTotal+bankTotal)}</strong></span>
  </div>;
})()}
```

- [ ] **Step 8.3: Update HANDOFF.md §6 KEY_MAP table**

Find the table in §6 listing the 22 keys (search for `v3_cats`). Add a new row:

```markdown
| `v3_cashcats` | `cashcats` | new in v1.7 — cash categories with sub-cats (2-level) |
```

(Match the existing table format — if the columns differ, follow whatever the table uses.)

- [ ] **Step 8.4: Add a §10 row for the cash-accounts feature**

In §10 "Recent Feature Additions", add:

```markdown
| 2026-06-02 | Cash accounts + categories | `bankAccs.isCash` flag, new `cashCats`, Finance "บัญชี" tab unifies bank+cash, transfer modal, adjust modal, SO/PO cash payment method, auto-tagged categories with 2-level user-managed list |
```

- [ ] **Step 8.5: Bump app version**

Edit `vite.config.js` line 12:

```js
__APP_VERSION__: JSON.stringify("v1.7.0-cash-accounts"),
```

- [ ] **Step 8.6: Final verification**

```bash
node src/utils/merge.test.mjs       # all tests pass (16 ok)
npx eslint src/App.jsx              # 7 problems (unchanged from start)
npx eslint src/components/Finance.jsx 2>&1 | tail -3   # no new errors
npm run build                       # clean
```

Manual final sweep:
1. Finance → tab labeled "บัญชี"
2. Summary header shows correct totals
3. All 6 flows from prior tasks still work
4. No console errors

- [ ] **Step 8.7: Commit + push**

```bash
git add src/components/Finance.jsx HANDOFF.md vite.config.js
git commit -m "$(cat <<'EOF'
feat(finance): tab rename + summary + docs + v1.7.0 bump (Task 8 of cash-accounts)

- "ธนาคาร" sub-tab → "บัญชี" (label only; data key unchanged)
- Summary header: เงินสด · ธนาคาร · รวมทั้งหมด at top of บัญชี tab
- HANDOFF.md §6: cashcats added to KEY_MAP table
- HANDOFF.md §10: feature row for cash accounts
- vite.config.js: __APP_VERSION__ → v1.7.0-cash-accounts

Closes the cash-accounts feature plan (8/8).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin master
```

---

## Final Verification Checklist (after all 8 tasks)

- [ ] `node src/utils/merge.test.mjs` — 16/16 tests pass
- [ ] `npm run build` — clean, ~76 PWA entries
- [ ] `npx eslint src/App.jsx` — 7 problems (same as plan start; no new)
- [ ] Production deploy: version label reads `v1.7.0-cash-accounts`
- [ ] End-to-end manual smoke (in a single sitting):
  1. Create cash account "ZZZ-TEST-เงินสด" with opening 1000
  2. Manual "+ รายการ" out 50 with cat "ค่าใช้จ่ายร้าน/ค่ากาแฟ" → balance 950
  3. Create cash SO 2000, pay cash → balance 2950
  4. Create AP PO 500, pay cash → balance 2450
  5. Transfer 500 to bank account 1 → balance 1950, bank +500
  6. ปรับยอด actual=2000 → diff +50 → balance 2000
  7. "จัดการหมวด" add custom cat "ทดสอบ" → delete blocked? (no usage yet, should delete)
  8. Open 2nd tab → verify realtime updates
  9. Cleanup: delete ZZZ-TEST account (should be blocked if it has txns; delete txns first, then account)

## Notes for the implementer

- **Never break existing flows.** Bank-only payments, cheques, batch pay, billings, CN — all must remain unchanged. Run a quick eye-test in each Finance sub-tab after each task.
- **Don't refactor unrelated code.** This plan is focused on cash accounts only.
- **If you find a real bug in the existing code while reading it,** flag it via the chip mechanism (mcp__ccd_session__spawn_task) — don't fix inline.
- **Style match the existing code.** Inline styles, no JSX import for components beyond what's already there, no TypeScript.
- **State-hub `sh` pattern:** anything new in App.jsx state must be exported via the `sh` object that Finance.jsx destructures.
- **`saveData("v3_KEY",value)` is already called by the autosave effect** — don't add manual localStorage writes in handlers; only React `set...` calls.
- **Test after each task** with the verify step before moving on. If a task verification fails, fix it before starting the next task.
