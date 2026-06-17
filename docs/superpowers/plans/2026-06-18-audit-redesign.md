# Audit Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Audit page as a filterable "smart table" (search + date range + user + category + risk filters, category color-coding, risk-row highlight, and a detail hover popover that previews the referenced SO/PO/QT/product).

**Architecture:** Two new pure, unit-tested helpers (`auditCategory.ts` for keyword→category, `auditRefs.ts` for parsing the document/product reference and the Thai-BE date out of an audit row). `AuditLog.jsx` is rewritten to consume them; `ReportsPage.jsx` passes the extra data it already holds. No change to the audit data model, `mkAudit`, `addA`, or the 500-entry cap. Read-only page.

**Tech Stack:** React (function components, hooks), TypeScript for utils, Vitest for tests, Vite build. House style: inline styles with CSS theme vars (`var(--red)` etc.).

**Spec:** `docs/superpowers/specs/2026-06-18-audit-redesign-design.md`

---

## Background the engineer needs

- `audit` is an array of `{ id, date, action, detail, user }` (newest first). `action` is
  free-text Thai (e.g. `"สร้าง SO"`, `"ลบสินค้า"`, `"อนุมัติ PO"`, `"ปรับสต็อก"`). `detail`
  usually holds a document number (`"SO-2026-203"`) or product code (`"TS-AMP-200"`) or a
  count (`"5 รายการ"`).
- `date` is **Thai Buddhist-era** text from `nowStr()`: `"DD/MM/BBBB HH:MM"`, e.g.
  `"18/06/2569 14:32"` (2569 = 2026 + 543). It is NOT ISO and NOT directly sortable.
- `fmtD(s)` (in `src/utils/helpers.ts`) normalizes that string for display, keeping the BE year:
  `"18/06/2569 14:32"`.
- Document number formats vary: legacy `PO-2026-001` and current monthly `PO-2026-06-001`.
- `.ts` utils are imported from `.jsx` **with the `.ts` extension** (e.g.
  `import { x } from "../utils/foo.ts"`). `helpers`/`csv` are imported as `.js`.
- Theme color vars (light/dark both defined): `--red --pink --blue --green --orange --purple --teal --dim --blue-bg --hover --line --panel --text --bg --faint`.
- Existing status-badge convention (see `CustomerProfile.jsx`): a pill with explicit
  `background` tint + `color` var, e.g. `background:"rgba(52,199,89,0.12)";color:"var(--green)"`.
- `sh` (passed to `ReportsPage`) contains `pN, cN, sales, pos, quotes, products, contacts, audit`.
  `pN(product)` → product display name; `cN(contact)` → contact display name.
- Tests run with `npm test` (`vitest run`). Pure-util tests live next to the util as
  `name.test.ts` and import from `vitest`. Components are not unit-tested in this repo —
  verify them with `npm run typecheck && npm run build`.

## File structure

- Create `src/utils/auditCategory.ts` — `categorizeAudit(action)`, `CATEGORIES`, `AuditCategory` type.
- Create `src/utils/auditCategory.test.ts`.
- Create `src/utils/auditRefs.ts` — `parseAuditRef(detail, productCodes)`, `parseAuditDate(dateStr)`, `auditInRange(dateStr, range, now)`, types.
- Create `src/utils/auditRefs.test.ts`.
- Modify `src/components/Reports/ReportsPage.jsx` — destructure `quotes, cN`; pass extra props to `AuditTab`.
- Rewrite `src/components/Reports/AuditLog.jsx`.

---

## Task 1: `auditCategory.ts` — keyword → category (pure, TDD)

**Files:**
- Create: `src/utils/auditCategory.ts`
- Test: `src/utils/auditCategory.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/utils/auditCategory.test.ts`:

```ts
import { describe, test, expect } from "vitest";
import { categorizeAudit, CATEGORIES } from "./auditCategory";

describe("categorizeAudit", () => {
  test("classifies destructive actions as risk", () => {
    expect(categorizeAudit("ลบสินค้า").key).toBe("delete");
    expect(categorizeAudit("ลบสินค้า").risk).toBe(true);
    expect(categorizeAudit("ยกเลิก PO").key).toBe("cancel");
    expect(categorizeAudit("ยกเลิก PO").risk).toBe(true);
    expect(categorizeAudit("ปฏิเสธ PO").key).toBe("reject");
    expect(categorizeAudit("ปฏิเสธ PO").risk).toBe(true);
  });

  test("destructive keyword wins over later keywords", () => {
    expect(categorizeAudit("ลบ SO อัตโนมัติ (ยกเลิก PO)").key).toBe("delete");
  });

  test("submit is detected before approve", () => {
    expect(categorizeAudit("ส่งขออนุมัติ PO").key).toBe("submit");
    expect(categorizeAudit("อนุมัติ PO").key).toBe("approve");
    expect(categorizeAudit("อนุมัติพิเศษ SO").key).toBe("approve");
  });

  test("non-destructive categories", () => {
    expect(categorizeAudit("สร้าง SO").key).toBe("create");
    expect(categorizeAudit("แปลง QT เป็น SO").key).toBe("create");
    expect(categorizeAudit("แก้ไข PO").key).toBe("edit");
    expect(categorizeAudit("เปลี่ยนหมวด (กลุ่ม)").key).toBe("edit");
    expect(categorizeAudit("ปรับสต็อก").key).toBe("stock");
    expect(categorizeAudit("จัดส่ง SO").key).toBe("logistics");
    expect(categorizeAudit("นำเข้า Excel").key).toBe("import");
    expect(categorizeAudit("ส่ง QT").key).toBe("send");
  });

  test("create (AI Bot) still classifies by the verb", () => {
    expect(categorizeAudit("สร้าง SO (AI Bot)").key).toBe("create");
  });

  test("unknown action falls back to other, never risk", () => {
    expect(categorizeAudit("อะไรสักอย่าง").key).toBe("other");
    expect(categorizeAudit("").key).toBe("other");
    expect(categorizeAudit("อะไรสักอย่าง").risk).toBe(false);
  });

  test("exactly delete/cancel/reject are risky", () => {
    const risky = CATEGORIES.filter(c => c.risk).map(c => c.key).sort();
    expect(risky).toEqual(["cancel", "delete", "reject"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/auditCategory.test.ts`
Expected: FAIL — cannot find module `./auditCategory`.

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/auditCategory.ts`:

```ts
export interface AuditCategory {
  key: string;
  label: string;
  color: string; // CSS var, e.g. "var(--red)"
  bg: string;    // tint background to match existing badge style
  risk: boolean;
}

// Ordered rules — first keyword match wins. Destructive keywords are listed
// first so a mixed string like "ลบ SO (ยกเลิก PO)" classifies as a risk.
const RULES: Array<{ kw: string[]; cat: AuditCategory }> = [
  { kw: ["ลบ"],       cat: { key: "delete",    label: "ลบ",       color: "var(--red)",    bg: "rgba(255,59,48,0.12)",  risk: true } },
  { kw: ["ยกเลิก"],   cat: { key: "cancel",    label: "ยกเลิก",   color: "var(--red)",    bg: "rgba(255,59,48,0.12)",  risk: true } },
  { kw: ["ปฏิเสธ"],   cat: { key: "reject",    label: "ปฏิเสธ",   color: "var(--pink)",   bg: "rgba(255,45,85,0.12)",  risk: true } },
  { kw: ["ขออนุมัติ"], cat: { key: "submit",    label: "ขออนุมัติ", color: "var(--blue)",   bg: "var(--blue-bg)",        risk: false } },
  { kw: ["อนุมัติ"],   cat: { key: "approve",   label: "อนุมัติ",   color: "var(--blue)",   bg: "var(--blue-bg)",        risk: false } },
  { kw: ["แก้ไข", "เปลี่ยน", "อัปเดต"], cat: { key: "edit", label: "แก้ไข", color: "var(--orange)", bg: "rgba(255,149,0,0.14)", risk: false } },
  { kw: ["สร้าง", "แปลง"], cat: { key: "create", label: "สร้าง", color: "var(--green)", bg: "rgba(52,199,89,0.12)", risk: false } },
  { kw: ["ปรับสต็อก", "สต็อก"], cat: { key: "stock", label: "สต็อก", color: "var(--purple)", bg: "rgba(175,82,222,0.12)", risk: false } },
  { kw: ["จัดส่ง", "รับของ", "การส่ง"], cat: { key: "logistics", label: "จัดส่ง", color: "var(--teal)", bg: "rgba(90,200,250,0.16)", risk: false } },
  { kw: ["นำเข้า"],   cat: { key: "import",    label: "นำเข้า",   color: "var(--teal)",   bg: "rgba(90,200,250,0.16)", risk: false } },
  { kw: ["ส่ง"],      cat: { key: "send",      label: "ส่ง",      color: "var(--blue)",   bg: "var(--blue-bg)",        risk: false } },
];

const OTHER: AuditCategory = { key: "other", label: "อื่น ๆ", color: "var(--dim)", bg: "var(--hover)", risk: false };

export function categorizeAudit(action: string): AuditCategory {
  const a = action || "";
  for (const r of RULES) {
    if (r.kw.some(k => a.includes(k))) return r.cat;
  }
  return OTHER;
}

// Distinct categories (display order, deduped) for the filter dropdown.
export const CATEGORIES: AuditCategory[] = (() => {
  const seen = new Set<string>();
  const out: AuditCategory[] = [];
  for (const r of RULES) {
    if (!seen.has(r.cat.key)) { seen.add(r.cat.key); out.push(r.cat); }
  }
  out.push(OTHER);
  return out;
})();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/auditCategory.test.ts`
Expected: PASS (all assertions).

- [ ] **Step 5: Commit**

```bash
git add src/utils/auditCategory.ts src/utils/auditCategory.test.ts
git commit -m "feat(audit): categorizeAudit pure helper + tests"
```

---

## Task 2: `auditRefs.ts` — parse the SO/PO/QT/product reference (pure, TDD)

**Files:**
- Create: `src/utils/auditRefs.ts`
- Test: `src/utils/auditRefs.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/utils/auditRefs.test.ts`:

```ts
import { describe, test, expect } from "vitest";
import { parseAuditRef } from "./auditRefs";

describe("parseAuditRef", () => {
  const codes = ["TS-AMP-200", "TS-SPK-15"];

  test("extracts SO/PO/QT document numbers (legacy + monthly)", () => {
    expect(parseAuditRef("SO-2026-203", codes)).toEqual({ type: "so", num: "SO-2026-203" });
    expect(parseAuditRef("อนุมัติ PO PO-2026-06-014", codes)).toEqual({ type: "po", num: "PO-2026-06-014" });
    expect(parseAuditRef("QT-2026-001", codes)).toEqual({ type: "qt", num: "QT-2026-001" });
  });

  test("takes the first id when detail has two", () => {
    expect(parseAuditRef("SO-2026-201 ← PO-2026-014", codes)).toEqual({ type: "so", num: "SO-2026-201" });
  });

  test("matches a product by exact code token", () => {
    expect(parseAuditRef("TS-AMP-200", codes)).toEqual({ type: "product", code: "TS-AMP-200" });
    expect(parseAuditRef("5 รายการ: TS-AMP-200, TS-SPK-15", codes)).toEqual({ type: "product", code: "TS-AMP-200" });
  });

  test("does not match a partial/substring code", () => {
    expect(parseAuditRef("TS-AMP-2000", codes)).toBeNull();
  });

  test("returns null when there is nothing to reference", () => {
    expect(parseAuditRef("5 รายการ", codes)).toBeNull();
    expect(parseAuditRef("", codes)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/auditRefs.test.ts`
Expected: FAIL — cannot find module `./auditRefs`.

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/auditRefs.ts`:

```ts
export type AuditRef =
  | { type: "so" | "po" | "qt"; num: string }
  | { type: "product"; code: string }
  | null;

// Matches "PO-2026-001" (legacy) and "PO-2026-06-001" (monthly): a 4-digit year
// then one or two more numeric groups.
const DOC_RE = /(SO|PO|QT)-\d{4}(?:-\d+){1,2}/;

export function parseAuditRef(detail: string, productCodes: string[] = []): AuditRef {
  const d = detail || "";
  const m = d.match(DOC_RE);
  if (m) {
    return { type: m[1].toLowerCase() as "so" | "po" | "qt", num: m[0] };
  }
  const codeSet = new Set(productCodes);
  for (const t of d.split(/[\s,()]+/).filter(Boolean)) {
    if (codeSet.has(t)) return { type: "product", code: t };
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/auditRefs.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/auditRefs.ts src/utils/auditRefs.test.ts
git commit -m "feat(audit): parseAuditRef pure helper + tests"
```

---

## Task 3: `auditRefs.ts` — parse Thai-BE date + range check (pure, TDD)

**Files:**
- Modify: `src/utils/auditRefs.ts`
- Modify: `src/utils/auditRefs.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `src/utils/auditRefs.test.ts`:

```ts
import { parseAuditDate, auditInRange } from "./auditRefs";

describe("parseAuditDate", () => {
  test("parses nowStr Thai-BE format to a CE Date", () => {
    const d = parseAuditDate("18/06/2569 14:32")!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // June = 5
    expect(d.getDate()).toBe(18);
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(32);
  });

  test("returns null on malformed input", () => {
    expect(parseAuditDate("")).toBeNull();
    expect(parseAuditDate("nonsense")).toBeNull();
  });
});

describe("auditInRange", () => {
  const now = new Date(2026, 5, 18, 12, 0); // 18 Jun 2026

  test("all always passes", () => {
    expect(auditInRange("01/01/2500 00:00", "all", now)).toBe(true);
  });
  test("today matches same calendar day only", () => {
    expect(auditInRange("18/06/2569 09:00", "today", now)).toBe(true);
    expect(auditInRange("17/06/2569 23:59", "today", now)).toBe(false);
  });
  test("7d includes the last 7 calendar days", () => {
    expect(auditInRange("12/06/2569 00:00", "7d", now)).toBe(true);  // 6 days back
    expect(auditInRange("11/06/2569 23:59", "7d", now)).toBe(false); // 7 days back
  });
  test("month matches same calendar month", () => {
    expect(auditInRange("01/06/2569 00:00", "month", now)).toBe(true);
    expect(auditInRange("31/05/2569 00:00", "month", now)).toBe(false);
  });
  test("unparseable date fails any non-all range", () => {
    expect(auditInRange("bad", "today", now)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/utils/auditRefs.test.ts`
Expected: FAIL — `parseAuditDate`/`auditInRange` not exported.

- [ ] **Step 3: Implement**

Append to `src/utils/auditRefs.ts`:

```ts
// audit.date is Thai Buddhist-era text from nowStr(): "DD/MM/BBBB HH:MM".
export function parseAuditDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const [datePart, timePart = ""] = dateStr.split(" ");
  const dp = datePart.split("/");
  if (dp.length !== 3) return null;
  const day = +dp[0];
  const month = +dp[1];
  let year = +dp[2];
  if (!day || !month || !year) return null;
  if (year > 2400) year -= 543; // BE -> CE
  const [hh = "0", mm = "0"] = timePart.split(":");
  const d = new Date(year, month - 1, day, +hh || 0, +mm || 0);
  return isNaN(d.getTime()) ? null : d;
}

export type DateRange = "all" | "today" | "7d" | "month";

export function auditInRange(dateStr: string, range: DateRange, now: Date = new Date()): boolean {
  if (range === "all") return true;
  const d = parseAuditDate(dateStr);
  if (!d) return false;
  const sameMonth = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  if (range === "today") return sameMonth && d.getDate() === now.getDate();
  if (range === "month") return sameMonth;
  // "7d": from start of the day 6 days ago through now.
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0);
  return d.getTime() >= start.getTime();
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/utils/auditRefs.test.ts`
Expected: PASS (all describe blocks).

- [ ] **Step 5: Commit**

```bash
git add src/utils/auditRefs.ts src/utils/auditRefs.test.ts
git commit -m "feat(audit): parseAuditDate + auditInRange helpers + tests"
```

---

## Task 4: Wire extra data into `ReportsPage.jsx`

**Files:**
- Modify: `src/components/Reports/ReportsPage.jsx:12` and `:22`

- [ ] **Step 1: Destructure quotes + cN**

In `ReportsPage.jsx`, change the destructure line (currently line 12):

```jsx
  const{products,sales,pos,pN,targets,setTargets,audit,priceHist,users,contacts,canE,cats}=sh;
```

to:

```jsx
  const{products,sales,pos,pN,cN,quotes,targets,setTargets,audit,priceHist,users,contacts,canE,cats}=sh;
```

- [ ] **Step 2: Pass props to AuditTab**

Change the audit render line (currently line 22):

```jsx
    {sub==="audit"&&<AuditTab audit={audit}/>}
```

to:

```jsx
    {sub==="audit"&&<AuditTab audit={audit} sales={sales} pos={pos} quotes={quotes} products={products} contacts={contacts} pN={pN} cN={cN}/>}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no new errors; this only widens props).

- [ ] **Step 4: Commit**

```bash
git add src/components/Reports/ReportsPage.jsx
git commit -m "feat(audit): pass sales/pos/quotes/products/contacts into AuditTab"
```

---

## Task 5: Rewrite `AuditLog.jsx` — filters, summary, table, CSV (no popover yet)

**Files:**
- Rewrite: `src/components/Reports/AuditLog.jsx`

- [ ] **Step 1: Replace the file**

Overwrite `src/components/Reports/AuditLog.jsx` with:

```jsx
import { useState, useMemo } from "react";
import { fmtD } from "../../utils/helpers.js";
import { dlCSV } from "../../utils/csv.js";
import { categorizeAudit, CATEGORIES } from "../../utils/auditCategory.ts";
import { auditInRange } from "../../utils/auditRefs.ts";
import CustomSelect from "../ui/CustomSelect.jsx";

const DATE_CHIPS = [["all","ทั้งหมด"],["today","วันนี้"],["7d","7 วัน"],["month","เดือนนี้"]];

function CatBadge({ cat }) {
  return <span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:cat.bg,color:cat.color,fontWeight:500,whiteSpace:"nowrap"}}>{cat.label}</span>;
}

function Stat({ label, value, color, dot }) {
  return <div style={{background:"var(--panel)",border:"0.5px solid var(--line)",borderRadius:10,padding:"8px 12px"}}>
    <div style={{fontSize:11,color:"var(--dim)",display:"flex",alignItems:"center",gap:4}}>
      {dot&&<span style={{width:6,height:6,borderRadius:"50%",background:dot}}/>}{label}
    </div>
    <div style={{fontSize:18,fontWeight:600,color:color||"var(--text)"}}>{value}</div>
  </div>;
}

export default function AuditTab({ audit, sales, pos, quotes, products, contacts, pN, cN }){
  const [q,setQ]=useState("");
  const [range,setRange]=useState("all");
  const [fU,setFU]=useState("");
  const [fCat,setFCat]=useState("");
  const [riskOnly,setRiskOnly]=useState(false);

  const rows=useMemo(()=>audit.map(l=>({...l,cat:categorizeAudit(l.action)})),[audit]);
  const users=useMemo(()=>[...new Set(audit.map(l=>l.user))],[audit]);

  const ql=q.trim().toLowerCase();
  const filtered=rows.filter(l=>{
    if(ql && !((l.user+" "+l.action+" "+l.detail).toLowerCase().includes(ql))) return false;
    if(fU && l.user!==fU) return false;
    if(fCat && l.cat.key!==fCat) return false;
    if(riskOnly && !l.cat.risk) return false;
    if(!auditInRange(l.date,range)) return false;
    return true;
  });

  const todayCount=filtered.filter(l=>auditInRange(l.date,"today")).length;
  const riskCount=filtered.filter(l=>l.cat.risk).length;
  const userCount=new Set(filtered.map(l=>l.user)).size;

  const exportCSV=()=>{
    const hdr=["วันที่","ผู้ใช้","หมวด","การกระทำ","รายละเอียด"];
    const out=filtered.map(l=>[fmtD(l.date),l.user,l.cat.label,l.action,l.detail]);
    dlCSV("audit-log.csv",[hdr,...out]);
  };

  const chip=(active)=>({fontSize:12,padding:"5px 12px",borderRadius:99,cursor:"pointer",whiteSpace:"nowrap",border:active?"0.5px solid transparent":"0.5px solid var(--line)",background:active?"var(--blue)":"var(--panel)",color:active?"#fff":"var(--text)"});

  return <div>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,background:"var(--panel)",border:"0.5px solid var(--line)",borderRadius:10,padding:"8px 12px"}}>
      <span style={{color:"var(--dim)",fontSize:14}}>{"\u{1F50D}"}</span>
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder="ค้นหา ผู้ใช้ / การกระทำ / เลขเอกสาร..." style={{flex:1,border:"none",outline:"none",background:"transparent",fontSize:13,color:"var(--text)",fontFamily:"inherit"}}/>
      {q&&<span onClick={()=>setQ("")} style={{cursor:"pointer",color:"var(--dim)",fontSize:14}}>{"✕"}</span>}
    </div>

    <div style={{display:"flex",flexWrap:"wrap",gap:6,alignItems:"center",marginBottom:12}}>
      {DATE_CHIPS.map(([k,label])=><span key={k} onClick={()=>setRange(k)} style={chip(range===k)}>{label}</span>)}
      <CustomSelect value={fU} onChange={setFU} options={[{value:"",label:"ทุก User"},...users.map(u=>({value:u,label:u}))]} style={{width:"auto",minWidth:130}}/>
      <CustomSelect value={fCat} onChange={setFCat} options={[{value:"",label:"ทุกประเภท"},...CATEGORIES.map(c=>({value:c.key,label:c.label}))]} style={{width:"auto",minWidth:130}}/>
      <span onClick={()=>setRiskOnly(v=>!v)} style={{fontSize:12,padding:"5px 12px",borderRadius:99,cursor:"pointer",whiteSpace:"nowrap",border:"0.5px solid var(--red)",background:riskOnly?"var(--red)":"rgba(255,59,48,0.1)",color:riskOnly?"#fff":"var(--red)",fontWeight:500}}>{"⚠ เฉพาะเสี่ยง"}</span>
      <div style={{flex:1}}/>
      {filtered.length>0&&<button onClick={exportCSV} style={{padding:"6px 14px",borderRadius:6,border:"0.5px solid var(--line)",background:"var(--bg)",fontSize:12,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"inherit",color:"var(--text)"}}>Export CSV</button>}
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
      <Stat label="เหตุการณ์" value={filtered.length}/>
      <Stat label="วันนี้" value={todayCount}/>
      <Stat label="เสี่ยง" value={riskCount} color="var(--red)" dot="var(--red)"/>
      <Stat label="ผู้ใช้" value={userCount}/>
    </div>

    {filtered.length===0
      ? <div style={{textAlign:"center",color:"var(--dim)",padding:"2rem"}}>{audit.length===0?"ยังไม่มี":"ไม่พบรายการ"}</div>
      : <>
        <div style={{fontSize:11,color:"var(--dim)",marginBottom:6}}>{"แสดง "+filtered.length+" รายการ"}</div>
        <div style={{overflowX:"auto",maxHeight:"70vh",overflowY:"auto",border:"0.5px solid var(--line)",borderRadius:10}}>
          <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}>
            <thead><tr style={{position:"sticky",top:0,zIndex:1,background:"var(--bg)"}}>
              {["เวลา","การกระทำ","ผู้ใช้"].map(h=><th key={h} style={{padding:"8px 12px",textAlign:h==="ผู้ใช้"?"right":"left",fontWeight:500,color:"var(--dim)",borderBottom:"1px solid var(--line)",whiteSpace:"nowrap"}}>{h}</th>)}
            </tr></thead>
            <tbody>{filtered.map(l=>{
              const [dpart,tpart]=fmtD(l.date).split(" ");
              return <tr key={l.id} style={{borderBottom:"0.5px solid var(--line)",borderLeft:l.cat.risk?"3px solid var(--red)":"3px solid transparent",background:l.cat.risk?"rgba(255,59,48,0.05)":"transparent"}}>
                <td style={{padding:"8px 12px",color:"var(--dim)",fontSize:11,whiteSpace:"nowrap"}}>
                  <div style={{color:"var(--text)"}}>{tpart||"-"}</div>
                  <div style={{color:"var(--faint)"}}>{dpart}</div>
                </td>
                <td style={{padding:"8px 12px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <CatBadge cat={l.cat}/>
                    <span>{l.action}</span>
                    {l.detail&&<span style={{color:"var(--dim)"}}>{"· "+l.detail}</span>}
                  </div>
                </td>
                <td style={{padding:"8px 12px",fontWeight:500,textAlign:"right",whiteSpace:"nowrap"}}>{l.user}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </>}
  </div>;
}
```

- [ ] **Step 2: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 3: Run the full test suite (no regressions)**

Run: `npm test`
Expected: PASS (all existing tests + the 3 new helper test files).

- [ ] **Step 4: Commit**

```bash
git add src/components/Reports/AuditLog.jsx
git commit -m "feat(audit): smart-table redesign — search/date/user/category/risk filters + summary + risk highlight"
```

---

## Task 6: Add the detail hover popover to `AuditLog.jsx`

Mirrors the `CustomerProfile.jsx:195-209` popover (fixed position, flip-left near the
right edge, clamp top). The popover previews the **current** state of the referenced
record; rows with no parseable ref get no popover.

**Files:**
- Modify: `src/components/Reports/AuditLog.jsx`

- [ ] **Step 1: Add imports + ref state + lookup**

Change the `auditRefs.ts` import line to also import `parseAuditRef`:

```jsx
import { auditInRange, parseAuditRef } from "../../utils/auditRefs.ts";
```

Add status-label maps and small helpers near the top of the file, below the
`DATE_CHIPS` const:

```jsx
const SO_ST={pending_delivery:"รอส่ง",out_for_delivery:"เตรียมส่ง",completed:"สำเร็จ",cancelled:"ยกเลิก",pending_special_approval:"รออนุมัติ"};
const PO_ST={draft:"ร่าง",pending_approval:"รออนุมัติ",approved:"อนุมัติ",partial:"รับบางส่วน",received:"รับครบ",closed:"ปิดรับ",cancelled:"ยกเลิก"};
const QT_ST={draft:"ร่าง",sent:"ส่งแล้ว",approved:"อนุมัติ",converted:"แปลง SO",cancelled:"ยกเลิก",expired:"หมดอายุ"};
const baht=n=>"฿"+Number(n||0).toLocaleString("th-TH");
```

Inside the component (after the `riskOnly` state), add:

```jsx
  const [hover,setHover]=useState(null); // {ref,x,y}
  const codes=useMemo(()=>(products||[]).map(p=>p.code).filter(Boolean),[products]);
  const cName=id=>{const c=(contacts||[]).find(x=>x.id===id);return c?cN(c):"#"+id;};

  const lookup=(ref)=>{
    if(!ref) return null;
    if(ref.type==="so"){const r=(sales||[]).find(s=>s.soNum===ref.num);return r&&{kind:"so",num:r.soNum,st:SO_ST[r.status]||r.status,who:cName(r.customerId),total:(r.items||[]).reduce((s,i)=>s+i.qty*i.price,0)-(r.discountAmt||0),n:(r.items||[]).length};}
    if(ref.type==="po"){const r=(pos||[]).find(p=>p.poNum===ref.num);return r&&{kind:"po",num:r.poNum,st:PO_ST[r.status]||r.status,who:cName(r.supplierId),total:(r.items||[]).reduce((s,i)=>s+i.qty*i.cost,0),n:(r.items||[]).length};}
    if(ref.type==="qt"){const r=(quotes||[]).find(x=>x.qtNum===ref.num);return r&&{kind:"qt",num:r.qtNum,st:QT_ST[r.status]||r.status,who:cName(r.customerId),total:(r.items||[]).reduce((s,i)=>s+i.qty*i.price,0),n:(r.items||[]).length};}
    if(ref.type==="product"){const r=(products||[]).find(p=>p.code===ref.code);return r&&{kind:"product",num:r.code,name:pN(r),stock:r.stock,price:r.price};}
    return null;
  };
```

- [ ] **Step 2: Attach hover handlers to the action cell**

Replace the action `<td>` (the middle column) in the table body with this version,
which computes the ref and wires mouse events:

```jsx
                <td style={{padding:"8px 12px"}}
                  onMouseEnter={e=>{const ref=parseAuditRef(l.detail,codes);if(ref)setHover({ref,x:e.clientX,y:e.clientY});}}
                  onMouseMove={e=>setHover(h=>h?{...h,x:e.clientX,y:e.clientY}:h)}
                  onMouseLeave={()=>setHover(null)}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <CatBadge cat={l.cat}/>
                    <span>{l.action}</span>
                    {l.detail&&<span style={{color:"var(--dim)",textDecoration:parseAuditRef(l.detail,codes)?"underline dotted":"none",textUnderlineOffset:2}}>{"· "+l.detail}</span>}
                  </div>
                </td>
```

- [ ] **Step 3: Render the popover**

Add this immediately before the final closing `</div>` of the component's returned
JSX (after the `filtered.length===0 ? ... : ...` block):

```jsx
    {hover&&(()=>{
      const info=lookup(hover.ref);
      const W=300,M=12;
      const vw=typeof window!=="undefined"?window.innerWidth:1280;
      const vh=typeof window!=="undefined"?window.innerHeight:800;
      const flipLeft=hover.x-W-M>0;
      const top=Math.min(Math.max(hover.y-30,M),vh-220);
      const pos=flipLeft?{right:vw-hover.x+M,top}:{left:hover.x+M,top};
      return <div style={{position:"fixed",...pos,width:W,background:"var(--panel)",border:"1px solid var(--line)",borderRadius:10,boxShadow:"var(--shadow-card-hi, 0 12px 28px rgba(0,0,0,0.35))",padding:"12px 14px",zIndex:200,pointerEvents:"none",fontSize:12}}>
        {!info
          ? <div style={{color:"var(--dim)"}}>ไม่พบเอกสาร (อาจถูกลบ)</div>
          : info.kind==="product"
            ? <>
                <div style={{fontWeight:700,fontSize:13,marginBottom:6}}>{info.num}</div>
                <div style={{color:"var(--text)",marginBottom:8}}>{info.name}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"2px 12px",color:"var(--dim)"}}>
                  <div>คงเหลือ: <span style={{color:"var(--text)",fontWeight:500}}>{info.stock}</span></div>
                  <div>ราคา: <span style={{color:"var(--text)",fontWeight:500}}>{baht(info.price)}</span></div>
                </div>
              </>
            : <>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:6}}>
                  <span style={{fontWeight:700,fontSize:13}}>{info.num}</span>
                  <span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:"var(--hover)",color:"var(--dim)",fontWeight:500}}>{info.st}</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"2px 12px",color:"var(--dim)"}}>
                  <div style={{gridColumn:"1/-1"}}>{info.kind==="po"?"ผู้ขาย":"ลูกค้า"}: <span style={{color:"var(--text)",fontWeight:500}}>{info.who}</span></div>
                  <div>รายการ: <span style={{color:"var(--text)",fontWeight:500}}>{info.n}</span></div>
                  <div>ยอด: <span style={{color:"var(--text)",fontWeight:500}}>{baht(info.total)}</span></div>
                </div>
              </>}
      </div>;
    })()}
```

- [ ] **Step 4: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS (unchanged count + 3 new helper files).

- [ ] **Step 6: Commit**

```bash
git add src/components/Reports/AuditLog.jsx
git commit -m "feat(audit): detail hover popover previewing referenced SO/PO/QT/product"
```

---

## Task 7: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full green gate**

Run: `npm run typecheck && npm run build && npm test`
Expected: all PASS. Test count = previous baseline (269) + the new `auditCategory.test.ts`
and `auditRefs.test.ts` cases.

- [ ] **Step 2: Manual smoke (optional, read-only — safe per `feedback_preview_writes_prod`)**

Start the dev server, open Reports → Audit tab, and confirm:
- typing in search narrows rows live; date chips, user, category dropdowns, and the red
  "เฉพาะเสี่ยง" toggle all combine;
- destructive rows (ลบ/ยกเลิก/ปฏิเสธ) show the red left border + tint;
- hovering a row whose detail has an SO/PO/QT number or a product code shows the preview
  popover; rows like "5 รายการ" show none;
- Export CSV downloads with the new หมวด column.
- Do NOT click any save/confirm/delete controls (the audit page has none, but the rest of
  the app shares prod Supabase).

---

## Self-review notes

- Spec coverage: search/date/user/category/risk (Task 5), summary chips (Task 5),
  category model + risk set (Task 1), risk-row highlight + sticky header (Task 5),
  hover popover + ref parsing (Tasks 2, 6), BE-date range (Task 3), CSV หมวด column
  (Task 5), ReportsPage wiring (Task 4). Diff capture is explicitly out of scope (phase 2).
- Type/name consistency: `categorizeAudit`/`CATEGORIES`/`AuditCategory`,
  `parseAuditRef`/`parseAuditDate`/`auditInRange`/`AuditRef`/`DateRange` are used with the
  same signatures across tasks and the component.
- No placeholders: every code step contains complete code; every run step has an expected
  result.
