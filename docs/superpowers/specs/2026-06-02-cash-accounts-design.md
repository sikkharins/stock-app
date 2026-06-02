# Cash Accounts (บัญชีเงินสด) — Design Spec

**Date:** 2026-06-02
**Status:** Approved (pending implementation plan)
**Owner:** sikkharins
**Target version:** v1.7.0-cash-accounts

---

## 1. Summary

Add cash account(s) to the Finance section so the business can track physical cash in/out separately from bank accounts. Specifically driven by the need to record cash received from walk-in (ขายสดหน้าร้าน) sales, which currently has no payment record anywhere in the app.

The feature reuses the existing `bankAccs` / `bankTxns` data structures by adding flag fields, rather than introducing parallel `cashAccs` / `cashTxns` arrays. This minimizes new state, leverages existing balance calculation, and lets one Finance tab display all accounts (bank + cash).

A user-defined two-level category system (`cashCats`) tags every transaction — auto-categorized for SO/PO payments, manually picked for ad-hoc entries — to enable future reporting like "total spent on coffee this year".

---

## 2. Goals

1. Track multiple cash accounts (e.g., "เงินสดหน้าร้าน", "Petty cash", future "เงินสดสาขา 2").
2. Receive cash from cash-payType SOs via the existing payment workflow (semi-automatic — user clicks "รับเงิน", picks the cash account).
3. Pay supplier (AP / PO) in cash via the same payment workflow.
4. Transfer between cash↔bank, cash↔cash with a single action that creates two linked transactions.
5. Adjust cash (over/short) with an explicit reason.
6. Set per-account opening balance at creation.
7. Tag every transaction with a user-defined category + sub-category (auto for SO/PO; manual otherwise) so future reports can sum by category.

---

## 3. Non-goals (deferred)

- Reports / charts for category aggregation (will be added later in `Reports/`).
- Multi-currency.
- Cash count sessions (รอบนับเงินเช้า-เย็น).
- Receipt printing for cash-in.
- Per-txn audit trail beyond the existing app-level audit log.

---

## 4. Decisions (Q&A trail)

| # | Question | Decision |
|---|---|---|
| Q1 | How does receiving cash from a SO integrate with the existing payment workflow? | **B — Semi-automatic.** Cash SOs appear in AR list; user clicks "รับเงิน" → method selector includes "เงินสด" → choose a cash account → creates `bankTxn`. Same pattern as cheque/transfer today. |
| Q2 | Single cash drawer or multiple cash accounts? | **B — Multiple, via `bankAccs[].isCash:true` flag.** Reuses existing structure; user can name them ("หน้าร้าน", "Petty cash", per-branch). |
| Q3 | Which cash flows to support on day 1? | **C — Full.** Receive (SO), pay (PO), cash↔bank transfer (both directions), cash↔cash transfer, manual adjustment, opening balance. |
| Q4 | Categories apply to which transactions? | **B — All transactions, including SO/PO.** SO → auto "ขาย → ขายสด (SO)"; PO → auto "ซื้อ → จ่ายซัพ (PO)"; manual → user picks. Enables clean reporting later. |
| Q5 | Category hierarchy depth? | **B — Two levels (cat + sub), like Products.** Matches user's mental model and supports later rollup reporting. |

---

## 5. Data model

### 5.1 `bankAccs[]` — additive fields

```js
{
  id, name, bank, accNo, perms,        // existing
  isCash: false,                        // NEW: true → cash account
  openingBalance: 0,                    // NEW: starting balance (cash only)
  openingDate: "2026-06-02"             // NEW: date of opening balance
}
```

- Existing rows: missing fields default to `isCash:false`, `openingBalance:undefined` (treated as 0).
- For cash accounts: `bank` field stores a display label (e.g., "เงินสด"), `accNo` is empty, `perms` is irrelevant (UI hides perms editor for cash).

### 5.2 `bankTxns[]` — additive fields

```js
{
  id, accId, type, amount, date, from, refId, note,   // existing (type was "in"|"out")
  catId: null,            // NEW: id from cashCats[].id
  subCatId: null,         // NEW: id from cashCats[].subs[].id
  transferPair: null      // NEW: id of paired txn (only set on transfer txns)
}
```

- `type` enum expands: `"in"` | `"out"` | `"transfer"` | `"adjust"` | `"opening"`.
- For `"transfer"`: always created as a pair — one with `type:"transfer"` `amount:-X` (out side) on source account, one with `type:"transfer"` `amount:+X` (in side) on dest account, both share a generated `transferPair` UUID.
- Existing rows: `catId`/`subCatId`/`transferPair` are `null` → displayed as "(ไม่ระบุ)" in UI.

### 5.3 `cashCats[]` — new state array

```js
{
  id,                                // unique
  name,                              // display name e.g. "ค่าใช้จ่ายร้าน"
  type: "in" | "out" | "both",       // filter direction
  subs: [
    { id, name },                    // e.g. { id, name:"ค่ากาแฟ/น้ำดื่ม" }
    ...
  ]
}
```

### 5.4 Seed defaults (`initCashCats` in `data/initData.js`)

| name | type | subs |
|---|---|---|
| ขาย | in | ขายสด (SO), ขายเศษ, อื่นๆ |
| ซื้อ | out | จ่ายซัพ (PO), จ่ายซื้อจิปาถะ |
| ค่าใช้จ่ายร้าน | out | ค่ากาแฟ/น้ำดื่ม, ค่าน้ำมัน/เดินทาง, ค่าทำความสะอาด |
| ค่าสาธารณูปโภค | out | ค่าน้ำ, ค่าไฟ, ค่าโทรศัพท์/เน็ต |
| ค่าสถานที่ | out | ค่าเช่า, ค่าซ่อมแซม |
| โอน/ถอน/ฝาก | both | ฝากเข้าธนาคาร, ถอนจากธนาคาร, โอนระหว่างบัญชี |
| ปรับยอด | both | เกิน, ขาด |
| อื่นๆ | both | (empty) |

Auto-tag mapping (for code references — IDs assigned at seed time but resolved by name):

| Event | catId | subCatId |
|---|---|---|
| SO payment received in cash | "ขาย" | "ขายสด (SO)" |
| PO payment paid in cash | "ซื้อ" | "จ่ายซัพ (PO)" |
| Cash→bank transfer (cash side) | "โอน/ถอน/ฝาก" | "ฝากเข้าธนาคาร" |
| Bank→cash transfer (cash side) | "โอน/ถอน/ฝาก" | "ถอนจากธนาคาร" |
| Cash→cash transfer | "โอน/ถอน/ฝาก" | "โอนระหว่างบัญชี" |
| Opening balance | (system) | — |
| Adjustment over | "ปรับยอด" | "เกิน" |
| Adjustment short | "ปรับยอด" | "ขาด" |

---

## 6. UI changes

### 6.1 Finance tab rename

`tab="bank"` (label "ธนาคาร") → label "บัญชี" (data sub key unchanged for backward compat).

### 6.2 Accounts tab content

```
┌───────────────────────────────────────────────────────────────────┐
│ รวมยอด: เงินสด ฿X · ธนาคาร ฿Y · รวมทั้งหมด ฿Z   [+ บัญชีใหม่] [จัดการหมวด] │
├───────────────────────────────────────────────────────────────────┤
│ [เงินสด]  เงินสดหน้าร้าน    ฿12,500   [โอน] [+ รายการ] [...] │
│ [เงินสด]  Petty cash         ฿800     [โอน] [+ รายการ] [...] │
│ [ธนาคาร]  กสิกร — บัญชี 1   ฿245,890  [โอน] [+ รายการ] [...] │
│ [ธนาคาร]  SCB — บัญชี 2     ฿58,200   [โอน] [+ รายการ] [...] │
│ [ธนาคาร]  TTB — บัญชี 3     ฿0        [โอน] [+ รายการ] [...] │
└───────────────────────────────────────────────────────────────────┘
[ประวัติรายการ filtered by selected account]
```

Cash accounts: green tone badge labeled `เงินสด` (no bank icon, no `accNo` column). Bank accounts keep their existing bank-brand color and icon.

### 6.3 "+ บัญชีใหม่" modal

Step 1: choose type — `[บัญชีธนาคาร]` or `[บัญชีเงินสด]`.

For cash: fields = `ชื่อ` + `ยอดเริ่มต้น` + `วันที่ตั้งยอด` (defaults to today). Submit creates `bankAccs` row with `isCash:true` and a corresponding `bankTxn` of type `"opening"` for the opening balance.

### 6.4 "+ รายการ" modal (manual in/out for any account)

Fields: `ทิศทาง [in/out]` · `จำนวน` · `วันที่` · `จาก/ถึง` · `หมวด` (filtered by direction) · `หมวดย่อย` (filtered by cat) · `อ้างอิง refId` (optional) · `หมายเหตุ`.

The `หมวด` and `หมวดย่อย` selects include `+ เพิ่มหมวดใหม่` as the last option → opens quick-add inline.

### 6.5 "โอน" modal

Fields: `ต้นทาง` (current account locked) · `ปลายทาง` (any other account) · `จำนวน` · `วันที่` · `หมายเหตุ`. Submit → atomically creates 2 `bankTxn` rows (one in, one out) linked by a generated `transferPair` id, auto-categorized as **โอน/ถอน/ฝาก → [ฝากเข้าธนาคาร | ถอนจากธนาคาร | โอนระหว่างบัญชี]** based on source/dest type.

### 6.6 "ปรับยอด" action (per cash account)

Fields: `ยอดที่นับจริง` · `วันที่` · `หมายเหตุ`. Computes diff vs current calculated balance → creates a single `bankTxn` of type `"adjust"` with the signed diff, auto-cat **ปรับยอด → [เกิน|ขาด]**.

### 6.7 "จัดการหมวด" modal

Toolbar action in the "บัญชี" tab. Same pattern as Products' category management:
- Left pane: list of main categories (add/rename/delete + type dropdown in/out/both).
- Right pane: sub-categories of selected main (add/rename/delete).
- Delete is blocked if any `bankTxn` references the cat/subcat — error message lists the count.

### 6.8 SO/PO payment workflow extension

The existing `openPay()` modal (`Finance.jsx`):
- AR (`sub==="ar"`): method options become `["โอนเงิน", "เงินสด", "เช็ค"]`. When method=`"เงินสด"`, the `accId` selector filters to `bankAccs.filter(a=>a.isCash)`.
- AP (`sub==="ap"`): method options become `["โอนเงินออก", "เงินสด", "จ่ายEPP"]`. Same filter on cash account choice.
- On submit: created `bankTxn` is auto-tagged with `catId/subCatId` per the auto-tag mapping in §5.4.

### 6.9 Transaction list display

The history table (already shown in current "bank" sub-tab) gains 2 columns: `หมวด` (chip with cat color) and `หมวดย่อย`. Existing rows show "(ไม่ระบุ)".

---

## 7. KEY_MAP discipline checklist (HANDOFF §9.B)

`cashCats` is a new synced array → must be wired in all 7 places to avoid silent data loss:

1. `useState` in `App.jsx` — `const [cashCats,setCashCats]=useState(INIT_CASHCATS);`
2. `applyData` — `out.cashcats = g(...); setCashCats(out.cashcats);`
3. autosave `current={...}` map — `cashcats: cashCats`
4. autosave `useEffect` deps array
5. `KEY_MAP` in `storage.js` — `v3_cashcats → cashcats`
6. `RT_SETTERS`/`getSetters` — `cashcats: setCashCats`
7. `MERGE_CFG` in `utils/merge.js` — default `keyOf=r=>r.id` works (cats have `id`)

The additive fields on `bankAccs` / `bankTxns` are properties of existing rows; merge by `id` already handles them. No `MERGE_CFG` change needed for those.

---

## 8. Migration

| Field | Existing data behavior |
|---|---|
| `bankAccs[].isCash` | undefined → falsy → treated as bank account (no change) |
| `bankAccs[].openingBalance` | undefined → no opening txn created retroactively (existing balances stay derived from existing txns) |
| `bankTxns[].catId/subCatId` | undefined → display "(ไม่ระบุ)" in cat columns, filterable as "no category" |
| `bankTxns[].transferPair` | undefined → treated as standalone txn (no pairing) |
| `cashCats` | absent from Supabase first load → seeded from `INIT_CASHCATS` |

No data migration script needed. All changes are additive. Old clients reading the new fields will ignore them (graceful degradation), but per HANDOFF deploy practice ("deploy all clients together via Vercel"), this scenario is short-lived.

---

## 9. Risks / open considerations

1. **Renaming "ธนาคาร" → "บัญชี"** — minor UX surprise for existing users. Mitigation: tooltip "(รวมเงินสดด้วย)" on first visit.
2. **Existing bankTxns with no `catId`** — many. The `(ไม่ระบุ)` display is acceptable; future bulk-tag tool could be added.
3. **Transfer pair deletion** — if a user deletes one side of a transfer, the cleanup must remove the other side. This logic lives in the txn delete handler. If sync conflict happens mid-deletion across two devices, the 3-way merge could leave one orphan side. **Acceptable trade-off** (rare; user can re-delete the orphan manually).
4. **Opening balance change after creation** — current spec: not editable. Workaround: create an `"adjust"` txn. Re-evaluate if this becomes painful.
5. **Performance** — `bankTxns` could grow large per cash account (daily entries). Existing list filters/sort already render all rows; pagination is a separate concern (HANDOFF §9.G — already known).
6. **Category type=`"both"`** — adds dropdown complexity. If `type` filtering proves more annoying than useful, we can relax to "all cats appear in both directions" with a simple post-warning. Re-evaluate after first week of use.

---

## 10. Files touched (estimate)

| File | Change kind |
|---|---|
| `src/App.jsx` | + `cashCats` state, autosave key, applyData wiring; rename `tab="bank"` label only |
| `src/components/Finance.jsx` | major: new "บัญชี" tab structure, new modals (transfer / adjust / cash account create / manage cats), txn list column additions, payment method options |
| `src/data/initData.js` | + `initCashCats` export (matches existing `initCats` / `initProducts` convention) |
| `src/utils/storage.js` | + `cashcats` in `KEY_MAP` |
| `src/utils/merge.js` | + `cashcats` entry in `MERGE_CFG` (uses default `keyOf=r=>r.id`) |
| `HANDOFF.md` | §2 add new sync key, §6 add cashCats to KEY_MAP table, §10 add feature row |
| `vite.config.js` | bump `__APP_VERSION__` → `v1.7.0-cash-accounts` |

---

## 11. Test plan

1. **Unit (`merge.test.mjs`)** — extend to assert `mergeByKey` correctly merges concurrent inserts on `bankAccs` (new `isCash` field), `bankTxns` (new `catId`), and `cashCats`.
2. **Manual smoke**
   - Create a cash account with opening balance 5,000 → balance = 5,000.
   - Add manual cash-in 1,000 with category → balance = 6,000; history shows category chip.
   - Receive cash for a cash-SO → balance updates; auto-cat = "ขาย → ขายสด (SO)".
   - Transfer 2,000 from cash → bank → both balances update; both sides share `transferPair`.
   - Delete one side of a transfer → other side also removed.
   - Adjust balance to 5,500 (after manually computing it should be 6,000) → creates `adjust` txn of -500, cat = "ปรับยอด → ขาด".
   - Try to delete a category that has 1+ txn → blocked with count.
3. **Cross-device** — repeat key flows in two tabs to verify the per-key optimistic locking + 3-way merge from v1.6.0 still holds with the new keys.

---

## 12. Out of scope (next iteration ideas)

- "หน้ารายงานหมวดเงินสด" — bar chart of monthly sum per category.
- Petty cash refill workflow (auto-create transfer when balance < threshold).
- Year-end opening balance carry-over.
- Receipt printer integration for cash-in.
