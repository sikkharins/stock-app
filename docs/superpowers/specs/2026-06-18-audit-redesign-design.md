# Audit page redesign — design

**Date:** 2026-06-18
**Status:** Approved scope (phase 1). Diff capture deferred to phase 2.

## Goal

Make the Audit page (`src/components/Reports/AuditLog.jsx`) look better and be
easier to use for two real jobs the user does:

1. **สืบหาเหตุการณ์เฉพาะ** — find a specific event (who / what / when / which document).
2. **จับรายการเสี่ยง/ผิดปกติ** — spot risky/destructive actions at a glance.

Chosen layout: **smart table** (an upgrade of the current table, not a timeline) —
keeps the existing mental model, stays dense and scannable, preserves behavior.

## Non-goals (phase 1)

- **No diff capture** ("แก้ไขจากอะไรเป็นอะไร"). The audit currently stores only a
  document number for edits; before/after was never recorded, so it cannot be shown
  retroactively. Capturing it going forward touches ~4 edit handlers + the data model
  and is a **separate phase 2** with its own brainstorm/spec. See "Future work".
- No change to the audit data model, `mkAudit`, `addA`, or the 500-entry storage cap.
- No change to how/when audit entries are created elsewhere in the app.

## Current state

- `AuditTab({audit})` renders a plain table: วันที่ / ผู้ใช้ / การกระทำ (one blue badge
  for every action) / รายละเอียด. Only filter is a User dropdown. Export CSV present.
  Shows the first 100 of up to 500 stored rows.
- `Audit` shape (`src/utils/helpers.ts`): `{ id, date, action, detail, user }`.
  `action` is free-text Thai (e.g. "สร้าง SO", "ลบสินค้า", "อนุมัติ PO", "ปรับสต็อก",
  "จัดส่ง SO"); `detail` usually holds the document number / product code / a count.
- Rendered from `ReportsPage.jsx`: `{sub==="audit" && <AuditTab audit={audit}/>}`.
  `sh` at that level already has `sales, pos, quotes, products, contacts`.

## Phase 1 — components

### 1. New pure helper: `src/utils/auditCategory.ts`

Because `action` is free-text, the category is derived by ordered keyword matching.
Destructive keywords are checked first so a row like "ลบ SO อัตโนมัติ (ยกเลิก PO)"
classifies as a risk.

`categorizeAudit(action: string): AuditCategory` returns:
`{ key, label, colorVar, icon, risk }`.

Ordered rules (first match wins):

| # | keyword in `action` | key | label | colorVar | icon | risk |
|---|---|---|---|---|---|---|
| 1 | ลบ | delete | ลบ | --red | ti-trash | ✓ |
| 2 | ยกเลิก | cancel | ยกเลิก | --red | ti-x | ✓ |
| 3 | ปฏิเสธ | reject | ปฏิเสธ | --pink | ti-ban | ✓ |
| 4 | ขออนุมัติ | submit | ขออนุมัติ | --blue | ti-send | |
| 5 | อนุมัติ | approve | อนุมัติ | --blue | ti-check | |
| 6 | แก้ไข / เปลี่ยน / อัปเดต | edit | แก้ไข | --orange | ti-edit | |
| 7 | สร้าง / แปลง | create | สร้าง | --green | ti-plus | |
| 8 | ปรับสต็อก / สต็อก | stock | สต็อก | --purple | ti-package | |
| 9 | จัดส่ง / รับของ / การส่ง | logistics | จัดส่ง | --teal | ti-truck | |
| 10 | นำเข้า | import | นำเข้า | --teal | ti-upload | |
| 11 | ส่ง | send | ส่ง | --blue | ti-send | |
| — | (no match) | other | อื่น ๆ | --dim | ti-dots | |

- `risk` is true only for delete / cancel / reject (data-destructive). The red
  quick-filter shows exactly this set.
- Rule order matters: rule 4 ("ขออนุมัติ") sits before rule 5 ("อนุมัติ") so
  "ส่งขออนุมัติ PO" is classified as submit, not approve. Rule 9 ("การส่ง"/"จัดส่ง")
  sits before rule 11 ("ส่ง") so logistics wins over the generic send.
- Helper is pure and unit-tested (mirrors `productStats.ts` convention). Easy to
  extend when new action strings appear.

Export a `CATEGORIES` list (key, label, colorVar) for building the category filter
dropdown, so the dropdown and the badges share one source of truth.

### 2. New pure helper: `src/utils/auditRefs.ts`

`parseAuditRef(detail: string): { type: "so"|"po"|"qt", num: string } | { type: "product", code: string } | null`

- First match of `/(SO|PO|QT)-\d{4}-\d+/` → `{type, num}` (type from the prefix,
  lower-cased). Handles "SO-2026-201 ← PO-2026-014" by taking the first id.
- Else, tokenize `detail` and return the first token that exactly equals a known
  product `code` (caller passes the product-code set) → `{type:"product", code}`.
  This avoids false positives from short substrings.
- Else `null` (e.g. "5 รายการ").

Pure and unit-tested.

### 3. Rewrite `AuditLog.jsx` (smart table)

New props: `AuditTab({ audit, sales, pos, quotes, products, contacts })`.
`ReportsPage.jsx` passes the extra props (all already in `sh`).

**Filter bar (all filters combine with AND):**

- **Search** — controlled text input, live filtering, case-insensitive, matches
  across `user + action + detail`. Document numbers live in `detail`, so this also
  finds SO-/PO-/codes.
- **Date range** — chips: ทั้งหมด / วันนี้ / 7 วัน / เดือนนี้. Compared against `l.date`.
- **User** — existing `CustomSelect` (ทุก User + distinct users).
- **Category** — `CustomSelect` built from `CATEGORIES` (ทุกประเภท + each label).
- **Risk toggle** — red pill; when on, keep only rows where the category's `risk`.

**Summary chips** (4, reflect the *filtered* set): เหตุการณ์ / วันนี้ / เสี่ยง / ผู้ใช้
(distinct user count).

**Table:**

- Columns: เวลา (two lines: time over date) · การกระทำ (category badge with icon +
  the action text + detail) · ผู้ใช้.
- Category badge uses `colorVar` for text on a faint tint of the same color.
- Risk rows: 3px left border in `--red` + faint red row background.
- Sticky header (`position: sticky; top: 0`) within the scroll container.
- Replace the fixed 100-row cap: filter the full set (≤500) and render all matches,
  with a "แสดง N รายการ" count. (500 rows is well within render budget.)
- Empty state: "ไม่พบรายการ" when filters exclude everything (vs. "ยังไม่มี" when
  the log itself is empty).

**Detail hover popup (reuse the `CustomerProfile.jsx:178` pattern):**

- Track `hoverRef = { ref, x, y }` via `onMouseEnter` / `onMouseMove` / `onMouseLeave`
  on the action/detail cell. `ref` = `parseAuditRef(detail, productCodes)`.
- Render a fixed-position popover card with the same flip/clamp logic
  (flip left when near the right edge, clamp top into viewport).
- Card content by `ref.type`:
  - **so** — soNum, customer name (via `contacts`), status, total, item count, date.
  - **po** — poNum, supplier name, status, total, item count.
  - **qt** — qtNum, customer name, status, total.
  - **product** — code, name, stock, price, category.
  - If the id no longer resolves (deleted record) → small "ไม่พบเอกสาร (อาจถูกลบ)" card.
- The popover shows the **current** state of the record, not the state at event time.
  Rows with no parseable ref show plain detail text and no popover.
- Desktop-hover enhancement only; touch/mobile keeps the plain detail text.

**Export CSV:** unchanged trigger and filename (`audit-log.csv`); exports the current
filtered set. Header becomes `["วันที่","ผู้ใช้","หมวด","การกระทำ","รายละเอียด"]`
(new "หมวด" = category label inserted between ผู้ใช้ and การกระทำ).

### Behavior preserved

- Same `audit` data, same source, same 500-cap, same CSV export entry point.
- No new audit entries, no writes — read-only page (consistent with
  `feedback_preview_writes_prod`).
- Mobile: filter chips wrap; table keeps horizontal scroll.

## Edge cases

- `detail` with two ids ("... ← ...") → popover targets the first id.
- Bulk rows ("5 รายการ", "3 รายการ → หมวด X") → no ref, no popover; category still
  derived ("เปลี่ยน..." → edit).
- Unknown/empty `action` → "อื่น ๆ" (gray), never crashes.
- Product code that is a substring of a longer token → excluded by exact-token match.
- Empty audit vs. filtered-to-empty → distinct empty messages.

## Testing

- `auditCategory.test.ts` — one assertion per rule using real action strings seen in
  the codebase (สร้าง SO, ลบสินค้า, ยกเลิก PO, ปฏิเสธ PO, แก้ไข PO, เปลี่ยนหมวด (กลุ่ม),
  ปรับสต็อก, จัดส่ง SO, นำเข้า Excel, ส่งขออนุมัติ PO, สร้าง SO (AI Bot), unknown→other);
  assert the `risk` flag set is exactly delete/cancel/reject.
- `auditRefs.test.ts` — SO/PO/QT extraction, first-id-wins on "←", product exact-token
  match, no-match → null.
- Existing suite stays green (current count 269).

## Future work (phase 2 — separate spec)

Capture field-level edit diffs going forward: a `diffRecord(old, next, labels)` helper,
an optional `changes` field threaded through `mkAudit`/`addA`, wired into the SO / PO /
QT / product edit handlers (the "old" object is already in scope at each site).
Line-item arrays get a summarized diff ("รายการสินค้า: 3 → 4"). The audit page then shows
the from→to list inside the same hover popover for edit rows. Old entries remain
diff-less. Not part of phase 1.
