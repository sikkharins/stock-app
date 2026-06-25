# AR Payment Matcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มความสามารถ "ใส่ยอดเงินที่ได้รับ แล้วระบบหาชุด SO ที่รวมแล้วได้พอดี (เผื่อเศษ)" เข้าไปใน modal "รับชำระรวม" เดิม

**Architecture:** แยกตรรกะ subset-sum เป็นฟังก์ชัน pure `findSOCombos` ใน `helpers.ts` (เทสต์เดี่ยวได้) แล้วต่อ UI + state + handler เข้าไปใน `ARAP.jsx` modal batchPay โดยใช้ flow บันทึกเดิม (`saveBatch`) ทั้งหมด

**Tech Stack:** React (JSX), TypeScript helper, Vitest + @testing-library/react

อ้างอิง spec: [2026-06-25-ar-payment-matcher-design.md](../specs/2026-06-25-ar-payment-matcher-design.md)

---

## File Structure

- `src/utils/helpers.ts` — เพิ่ม pure function `findSOCombos` + types `ComboSO`, `SOCombo` (บ้านของ pure finance helpers เดิม เช่น `soRevenue`, `scoreSO`)
- `src/utils/helpers.test.ts` — เพิ่ม unit tests ของ `findSOCombos`
- `src/components/Finance/ARAP.jsx` — เพิ่ม state/handler (`recvAmount`, `recvTol`, `matchResults`, `matchMsg`, `runMatch`, `applyCombo`) + UI ใน modal batchPay + reset ใน `openBatch`
- `src/components/Finance.test.tsx` — เพิ่ม integration test (harness 3 SO) ของพฤติกรรม auto-match

---

## Task 1: `findSOCombos` pure function

**Files:**
- Modify: `src/utils/helpers.ts` (เพิ่มท้ายไฟล์)
- Test: `src/utils/helpers.test.ts`

- [ ] **Step 1: เพิ่ม import และ failing tests ใน `helpers.test.ts`**

เพิ่ม `findSOCombos` เข้าไปใน import list ที่บนสุดของไฟล์ (กลุ่ม `import { ... } from "./helpers.js"`):

```ts
  findSOCombos,
```

เพิ่ม describe block นี้ท้ายไฟล์:

```ts
describe("findSOCombos", () => {
  const sos = [
    { soNum: "A", remaining: 1000, date: "2026-01-01" },
    { soNum: "B", remaining: 2000, date: "2026-01-02" },
    { soNum: "C", remaining: 3000, date: "2026-01-03" },
  ];

  test("exact match — fewer SOs ranked first on equal diff", () => {
    const r = findSOCombos(sos, 300000, 0); // target 3000.00 baht
    // {C}=3000 and {A,B}=3000 both diff 0 -> {C} (1 SO) ranks first
    expect(r[0].soNums).toEqual(["C"]);
    expect(r[0].diffSatang).toBe(0);
    expect(r.some((c) => [...c.soNums].sort().join() === "A,B")).toBe(true);
  });

  test("tolerance — finds combos within ± tol of target", () => {
    const r = findSOCombos(sos, 305000, 5000); // target 3050, tol 50 -> 3000 is within
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].soNums).toEqual(["C"]);
    expect(r[0].diffSatang).toBe(-5000);
  });

  test("date tiebreak — more recent SO ranked first on equal diff & size", () => {
    const two = [
      { soNum: "OLD", remaining: 1000, date: "2026-01-01" },
      { soNum: "NEW", remaining: 1000, date: "2026-02-01" },
    ];
    const r = findSOCombos(two, 100000, 0); // target 1000
    expect(r[0].soNums).toEqual(["NEW"]);
  });

  test("no match within tolerance returns empty array", () => {
    const r = findSOCombos(sos, 999900, 0); // 9999 baht — no subset sums to it
    expect(r).toEqual([]);
  });

  test("all SOs combined matches the grand total", () => {
    const r = findSOCombos(sos, 600000, 0); // 6000 = A+B+C
    expect([...r[0].soNums].sort()).toEqual(["A", "B", "C"]);
    expect(r[0].diffSatang).toBe(0);
  });

  test("ignores fully-paid SOs (remaining <= 0)", () => {
    const withPaid = [...sos, { soNum: "PAID", remaining: 0, date: "2026-01-04" }];
    const r = findSOCombos(withPaid, 300000, 0);
    expect(r.every((c) => !c.soNums.includes("PAID"))).toBe(true);
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่า fail**

Run: `npx vitest run src/utils/helpers.test.ts -t "findSOCombos"`
Expected: FAIL — `findSOCombos is not a function` / import error

- [ ] **Step 3: implement `findSOCombos` ใน `helpers.ts`**

เพิ่มท้ายไฟล์ `src/utils/helpers.ts`:

```ts
// --- AR payment matcher: find subsets of outstanding SOs summing near a target -
// Pure subset-sum over ONE customer's outstanding SOs (small N). Works in integer
// satang to avoid float drift. Used by ARAP "รับชำระรวม" auto-match.
export interface ComboSO {
  soNum: string;
  remaining: number; // baht
  date?: string;
}

export interface SOCombo {
  soNums: string[];
  sumSatang: number;
  diffSatang: number; // signed: sum - target
}

export const findSOCombos = (
  sos: ComboSO[],
  targetSatang: number,
  tolSatang: number,
  maxResults = 5,
): SOCombo[] => {
  // positive remaining only, integer satang, sorted desc for branch-and-bound
  const items = sos
    .filter((s) => s.remaining > 0)
    .map((s) => ({
      soNum: s.soNum,
      sat: Math.round(s.remaining * 100),
      date: s.date || "",
    }))
    .sort((a, b) => b.sat - a.sat);

  const hi = targetSatang + tolSatang;
  const found: { soNums: string[]; sat: number; date: string }[] = [];
  let nodes = 0;
  const NODE_CAP = 200000;

  const dfs = (i: number, sumSat: number, picked: number[]) => {
    if (nodes++ > NODE_CAP) return;
    if (sumSat > hi) return; // all items positive -> adding more only grows sum
    if (picked.length > 0 && Math.abs(sumSat - targetSatang) <= tolSatang) {
      found.push({
        soNums: picked.map((idx) => items[idx].soNum),
        sat: sumSat,
        date: picked.reduce(
          (m, idx) => (items[idx].date > m ? items[idx].date : m),
          "",
        ),
      });
    }
    for (let j = i; j < items.length; j++) {
      dfs(j + 1, sumSat + items[j].sat, [...picked, j]);
    }
  };
  dfs(0, 0, []);

  found.sort((a, b) => {
    const da = Math.abs(a.sat - targetSatang);
    const db = Math.abs(b.sat - targetSatang);
    if (da !== db) return da - db; // closest first
    if (a.soNums.length !== b.soNums.length)
      return a.soNums.length - b.soNums.length; // fewer SOs first
    return b.date.localeCompare(a.date); // more recent first
  });

  return found.slice(0, maxResults).map((c) => ({
    soNums: c.soNums,
    sumSatang: c.sat,
    diffSatang: c.sat - targetSatang,
  }));
};
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน + typecheck**

Run: `npx vitest run src/utils/helpers.test.ts -t "findSOCombos"`
Expected: PASS (6 tests)

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 5: commit**

```bash
git add src/utils/helpers.ts src/utils/helpers.test.ts
git commit -m "feat(finance): findSOCombos subset-sum helper for AR payment matching

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: ต่อ auto-match เข้า ARAP batchPay modal

**Files:**
- Modify: `src/components/Finance/ARAP.jsx`
- Test: `src/components/Finance.test.tsx`

- [ ] **Step 1: เพิ่ม failing integration test ใน `Finance.test.tsx`**

เพิ่ม describe block นี้ท้ายไฟล์ (หลัง describe เดิม):

```tsx
describe("รับชำระรวม — auto-match by received amount", () => {
  function MultiSOHarness() {
    const [modal, setModal] = useState<string | null>(null);
    const [payments, setPayments] = useState<any[]>([]);
    const [cheques, setCheques] = useState<any[]>([]);
    const [bankTxns, setBankTxns] = useState<any[]>([]);
    const [contacts, setContacts] = useState<any[]>([
      { id: "c1", name: "ABC Co", type: "customer" },
    ]);
    const [supCNotes, setSupCNotes] = useState<any[]>([]);
    const mkSO = (n: string, price: number, date: string) => ({
      soNum: n,
      customerId: "c1",
      status: "completed",
      items: [{ productId: "p1", qty: 1, price }],
      discountAmt: 0,
      date,
      payType: "cash",
      creditDays: 0,
    });
    const sh: any = {
      cN: (c: any) => c?.name ?? "",
      pN: (p: any) => p?.name ?? "",
      contacts,
      setContacts,
      sales: [
        mkSO("SO-001", 1000, "2026-01-01"),
        mkSO("SO-002", 2000, "2026-01-02"),
        mkSO("SO-003", 3000, "2026-01-03"),
      ],
      pos: [],
      quotes: [],
      payments,
      setPayments,
      products: [{ id: "p1", name: "Widget" }],
      canE: () => true,
      canD: () => true,
      modal,
      oM: (name: string) => setModal(name),
      cM: () => setModal(null),
      setCheques,
      cheques,
      bankAccs: [
        {
          id: 1,
          name: "บัญชี 1",
          bank: "กสิกร",
          isCash: false,
          perms: { receive: true, transferOut: true, payEPP: true },
        },
      ],
      setBankTxns,
      bankTxns,
      cnotes: [],
      billings: [],
      supCNotes,
      setSupCNotes,
      tagMappings: [],
    };
    return <FinPage sh={sh} />;
  }

  test("typing received amount + กดหา auto-ticks the unique matching SO set", async () => {
    const user = userEvent.setup();
    render(<MultiSOHarness />);

    await user.click(screen.getByText("เก็บเงินลูกค้า"));
    await user.click(screen.getByText("รับชำระรวม"));

    // select customer in the searchable CustomSelect
    await user.click(screen.getByText("— เลือกลูกค้า —"));
    await user.click(screen.getByText("ABC Co"));

    // 6000 = SO-001 + SO-002 + SO-003, the only subset summing to it
    await user.type(screen.getByPlaceholderText("ยอดที่ได้รับ"), "6000");
    await user.click(screen.getByRole("button", { name: "หา SO ที่ตรงยอด" }));

    expect(screen.getByText(/ยอดรวมที่เลือก: ฿6,000/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่า fail**

Run: `npx vitest run src/components/Finance.test.tsx -t "auto-ticks"`
Expected: FAIL — ไม่มี placeholder "ยอดที่ได้รับ" / ไม่มีปุ่ม "หา SO ที่ตรงยอด"

- [ ] **Step 3: เพิ่ม import helper ใน `ARAP.jsx`**

แก้บรรทัด import helpers (บรรทัด 3) จาก:

```jsx
import { fmt, todayStr, toBE, shipmentTotals } from "../../utils/helpers.js";
```

เป็น:

```jsx
import { fmt, todayStr, toBE, shipmentTotals, findSOCombos, round2 } from "../../utils/helpers.js";
```

- [ ] **Step 4: เพิ่ม state สำหรับ auto-match**

หลังบรรทัด `const[batchLines,setBatchLines]=useState([...])` (บรรทัด 42) เพิ่ม:

```jsx
  const[recvAmount,setRecvAmount]=useState("");
  const[recvTol,setRecvTol]=useState("50");
  const[matchResults,setMatchResults]=useState([]);
  const[matchMsg,setMatchMsg]=useState("");
```

- [ ] **Step 5: เพิ่ม handler `applyCombo` + `runMatch`**

หลัง `const toggleBatchSO=...` (บรรทัด 73) เพิ่ม (วาง `applyCombo` ก่อน `runMatch` เพราะ runMatch เรียก applyCombo):

```jsx
  const applyCombo=combo=>{
    setBatchSOs(combo.soNums);
    const total=combo.soNums.reduce((s,n)=>{const so=batchSOList.find(x=>x.soNum===n);return s+(so?Math.max(0,so.remaining):0);},0);
    setBatchLines(p=>p.map((l,i)=>i===0?{...l,amount:String(round2(total))}:l));
    setMatchResults([]);setMatchMsg("");
  };
  const runMatch=()=>{
    const amt=+recvAmount;if(!amt||amt<=0){setMatchResults([]);setMatchMsg("");return;}
    const tol=Math.max(0,+recvTol||0);
    const target=Math.round(amt*100);const tolSat=Math.round(tol*100);
    const sos=batchSOList.map(so=>({soNum:so.soNum,remaining:Math.max(0,so.remaining),date:so.date}));
    const combos=findSOCombos(sos,target,tolSat);
    if(combos.length===1){applyCombo(combos[0]);}
    else if(combos.length>1){setMatchResults(combos);setMatchMsg("");}
    else{
      const near=findSOCombos(sos,target,Math.max(tolSat*10,10000));
      setMatchResults([]);
      setMatchMsg(near.length?("ไม่เจอชุดที่รวมได้พอดี — ชุดที่ใกล้สุด: "+near[0].soNums.join(", ")+" (฿"+fmt(near[0].sumSatang/100)+")"):"ไม่เจอชุดที่รวมได้ใกล้ยอดนี้");
    }
  };
```

- [ ] **Step 6: reset state ใน `openBatch`**

แก้ `openBatch` (บรรทัด 72) จาก:

```jsx
  const openBatch=()=>{setBatchCust("");setBatchSOs([]);setBatchLines([{method:"เช็ค",amount:"",accId:bankAccs[0]?.id||1,chequeNo:"",chequeBank:"",chequeDue:"",date:todayStr()}]);oM("batchPay");};
```

เป็น:

```jsx
  const openBatch=()=>{setBatchCust("");setBatchSOs([]);setBatchLines([{method:"เช็ค",amount:"",accId:bankAccs[0]?.id||1,chequeNo:"",chequeBank:"",chequeDue:"",date:todayStr()}]);setRecvAmount("");setRecvTol("50");setMatchResults([]);setMatchMsg("");oM("batchPay");};
```

- [ ] **Step 7: เพิ่ม UI block ใน modal batchPay**

ใน modal batchPay หา `{batchCust&&<>` (บรรทัด 232) ที่ตามด้วย `<div ...>SO ค้างชำระ</div>` แทรก block นี้ทันทีหลัง `{batchCust&&<>` และก่อนบรรทัด `<div style={{fontSize:12,fontWeight:600,color:"var(--dim)",marginBottom:6}}>SO ค้างชำระ</div>`:

```jsx
        {/* auto-match by received amount */}
        <div style={{display:"flex",gap:8,alignItems:"flex-end",marginBottom:matchMsg||matchResults.length>1?8:14,flexWrap:"wrap"}}>
          <Field label="ยอดเงินที่ได้รับ"><input type="number" value={recvAmount} onChange={e=>setRecvAmount(e.target.value)} placeholder="ยอดที่ได้รับ" style={{...IB,width:160}}/></Field>
          <Field label="± บาท"><input type="number" value={recvTol} onChange={e=>setRecvTol(e.target.value)} style={{...IB,width:80}}/></Field>
          <button onClick={runMatch} disabled={!recvAmount} style={{padding:"7px 14px",fontSize:12,borderRadius:7,border:"none",background:recvAmount?"var(--blue)":"var(--line)",color:"#fff",cursor:recvAmount?"pointer":"default",fontFamily:"inherit",fontWeight:500}}>หา SO ที่ตรงยอด</button>
        </div>
        {matchMsg&&<div style={{fontSize:12,color:"var(--dim)",marginBottom:14}}>{matchMsg}</div>}
        {matchResults.length>1&&<div style={{border:"1px solid var(--line)",borderRadius:8,marginBottom:14,overflow:"hidden"}}>
          <div style={{fontSize:12,fontWeight:600,color:"var(--dim)",padding:"8px 12px",background:"var(--bg)"}}>{"เจอ "+matchResults.length+" ชุดที่เป็นไปได้ — เลือกชุด"}</div>
          {matchResults.map((combo,i)=><div key={i} onClick={()=>applyCombo(combo)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"8px 12px",borderTop:"1px solid var(--line)",cursor:"pointer"}}>
            <span style={{fontSize:12}}>{combo.soNums.join(", ")}<span style={{color:"var(--dim)",marginLeft:6}}>{"("+combo.soNums.length+" ใบ)"}</span></span>
            <span style={{fontWeight:600,fontVariantNumeric:"tabular-nums"}}>{"฿"+fmt(combo.sumSatang/100)}{combo.diffSatang!==0&&<span style={{fontSize:11,color:"var(--orange)",marginLeft:6}}>{(combo.diffSatang>0?"+":"")+fmt(combo.diffSatang/100)}</span>}</span>
          </div>)}
        </div>}
```

- [ ] **Step 8: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/components/Finance.test.tsx`
Expected: PASS (รวมเทสต์เดิมทั้งหมด + เทสต์ใหม่)

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 9: commit**

```bash
git add src/components/Finance/ARAP.jsx src/components/Finance.test.tsx
git commit -m "feat(finance): auto-match received amount to SO set in รับชำระรวม

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: ตรวจของจริงใน preview (ไม่บันทึก)

> หมายเหตุความปลอดภัย: localhost dev ใช้ Supabase ตัว prod ร่วมกัน — **ห้ามกดบันทึก/ยืนยัน** ระหว่างตรวจ ทำได้แค่เปิด modal + ใส่ยอด + กดหา (เป็น local state ล้วน ไม่เขียน DB) แล้ว screenshot

**Files:** ไม่มี (verification only)

- [ ] **Step 1: เปิด dev server + ไปหน้า Finance → เก็บเงินลูกค้า → รับชำระรวม**

ใช้ preview tools: `preview_start` → เปิดแอป → ไปแท็บ Finance → sub "เก็บเงินลูกค้า" → ปุ่ม "รับชำระรวม"

- [ ] **Step 2: เลือกลูกค้าที่มี SO ค้างหลายใบ ใส่ยอดที่รวมได้พอดี กด "หา SO ที่ตรงยอด"**

ตรวจว่า SO ชุดที่ตรงถูกติ๊กอัตโนมัติ + "ยอดรวมที่เลือก" ขึ้นถูก (กรณีเจอชุดเดียว) หรือมีลิสต์ "เจอ N ชุด" ให้เลือก (กรณีหลายชุด)

- [ ] **Step 3: ลองใส่ยอดที่ไม่ตรงใคร**

ตรวจว่าขึ้นข้อความ "ไม่เจอชุดที่รวมได้พอดี — ชุดที่ใกล้สุด: ..."

- [ ] **Step 4: screenshot ส่งให้ผู้ใช้ดู (ไม่กดบันทึก)**

---

## Self-Review

**Spec coverage:**
- UI ยอดที่ได้รับ + tol + ปุ่มหา ใต้ลูกค้า ก่อนรายการ SO → Task 2 Step 7 ✓
- subset-sum เป็นสตางค์ + DFS ตัดกิ่ง + cap + จัดอันดับ (|diff| → จำนวนใบ → ใบล่าสุด) → Task 1 Step 3 ✓
- 1 ชุด auto-tick / >1 โชว์ลิสต์ → Task 2 Step 5 `runMatch` ✓
- ไม่เจอ → เรียกซ้ำ tol×10 โชว์ชุดใกล้สุด → Task 2 Step 5 ✓
- เติมยอดบรรทัดชำระ = ยอดรวมชุดที่ match → Task 2 Step 5 `applyCombo` ✓
- ปุ่มหา disabled จนเลือกลูกค้า → UI อยู่ใน `{batchCust&&...}` + `disabled={!recvAmount}` ✓
- reset state ใน openBatch → Task 2 Step 6 ✓
- เทสต์ครบ 6 เคส pure fn + 1 integration → Task 1 / Task 2 ✓
- ใช้ saveBatch เดิมบันทึก → ไม่แตะ saveBatch ✓

**Placeholder scan:** ไม่มี TBD/TODO; ทุก step มีโค้ดจริง ✓

**Type consistency:** `findSOCombos(sos, targetSatang, tolSatang)` คืน `SOCombo[]` ที่มี `soNums`/`sumSatang`/`diffSatang` — ใช้ตรงกันใน runMatch/applyCombo/UI ✓ ; `ComboSO` มี `soNum`/`remaining`/`date` — runMatch map จาก batchSOList ตรง field ✓
