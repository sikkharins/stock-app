# Admin Edit of Loaded (เตรียมส่ง) Delivery Runs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin edit a loaded (`out_for_delivery`) delivery run in place — truck/driver, date, helpers, and SO membership — from the run-history card.

**Architecture:** A new pure helper `recomputeRunRecord` in `helpers.ts` owns the denormalized-totals arithmetic. A parent handler `editLoadedRun` in `DeliveryPlanning.jsx` flips SO status for added/removed SOs (no stock change — stock only moves on delivery confirm) and writes the recomputed record. `RunCard` gains a `loadedEditMode` that renders an inline edit form, reusing `CustomSelect`, `ThaiDateInput`, and the existing helper-chip pattern.

**Tech Stack:** React (JSX), TypeScript helpers, Vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-06-24-admin-edit-loaded-delivery-run-design.md`

---

## File Structure

- `src/utils/helpers.ts` — add pure `recomputeRunRecord` (near `consolidatePickList`, line ~1223). Calls existing `soVolumeM3` (line 590) and `soRevenue` (line 605).
- `src/utils/helpers.test.ts` — unit tests for `recomputeRunRecord`.
- `src/components/DeliveryPlanning.jsx` — import `recomputeRunRecord`; add `editLoadedRun` handler; compute `availableSOs` + per-run `soMeta` at the RunCard call site (line ~2366); pass new props; add `loadedEditMode` UI to `RunCard` (line 36).
- `src/components/DeliveryPlanning.test.tsx` — component test for the edit flow.

---

## Task 1: Pure helper `recomputeRunRecord` (TDD)

**Files:**
- Test: `src/utils/helpers.test.ts`
- Modify: `src/utils/helpers.ts` (add after `consolidatePickList`, ~line 1256)

- [ ] **Step 1: Write the failing test**

Add to `src/utils/helpers.test.ts` (top: ensure `recomputeRunRecord` is added to the existing `import { ... } from "./helpers";` line):

```ts
describe("recomputeRunRecord", () => {
  const products = [{ id: 1, name: "Fridge", sizeClass: "L", price: 10000 }]; // 1.0 m³
  const contacts = [
    { id: 1, name: "ลูกค้า A" },
    { id: 2, name: "ลูกค้า B" },
  ];
  const sales = [
    { soNum: "SO-A", customerId: 1, items: [{ productId: 1, qty: 2, price: 10000 }] },
    { soNum: "SO-B", customerId: 2, items: [{ productId: 1, qty: 3, price: 10000 }] },
  ];
  const cN = (c: any) => c.name;

  test("totals + customerNames parallel to soNums", () => {
    const r = recomputeRunRecord({
      soNums: ["SO-A", "SO-B"],
      truck: { id: 7, name: "รถ 7", driverName: "สมชาย" },
      helperIds: [11],
      helpers: [{ id: 11, name: "ผู้ช่วย 1" }, { id: 12, name: "ผู้ช่วย 2" }],
      sales, contacts, products, cN,
    });
    expect(r.customerNames).toEqual(["ลูกค้า A", "ลูกค้า B"]);
    expect(r.truckId).toBe(7);
    expect(r.truckName).toBe("รถ 7");
    expect(r.driverName).toBe("สมชาย");
    expect(r.helperIds).toEqual([11]);
    expect(r.helperNames).toEqual(["ผู้ช่วย 1"]);
    expect(r.revenue).toBe(50000); // (2 + 3) × 10000
    expect(r.volumeM3).toBeCloseTo(5.0); // 5 × 1.0 m³ (sizeClass L)
  });

  test("dropping an SO recomputes totals; unknown SO yields empty name", () => {
    const r = recomputeRunRecord({
      soNums: ["SO-A", "SO-X"],
      truck: null,
      helperIds: [],
      helpers: [],
      sales, contacts, products, cN,
    });
    expect(r.customerNames).toEqual(["ลูกค้า A", ""]); // SO-X not found
    expect(r.revenue).toBe(20000); // only SO-A (2 × 10000)
    expect(r.volumeM3).toBeCloseTo(2.0);
    expect(r.truckId).toBeNull();
    expect(r.truckName).toBe("");
    expect(r.driverName).toBe("");
    expect(r.helperNames).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/helpers.test.ts -t recomputeRunRecord`
Expected: FAIL — `recomputeRunRecord is not a function` / not exported.

- [ ] **Step 3: Write minimal implementation**

Add to `src/utils/helpers.ts` immediately after `consolidatePickList` (after line ~1256):

```ts
export interface RecomputedRun {
  truckId: number | string | null;
  truckName: string;
  driverName: string;
  helperIds: (number | string)[];
  helperNames: string[];
  customerNames: string[];
  revenue: number;
  volumeM3: number;
}

// Recompute a delivery run's denormalized fields for a new SO membership / truck /
// helpers. Pure — no stock or status side effects (the caller flips SO status).
// customerNames is built parallel to soNums (one entry per SO, never deduped) — see
// the warning in DeliveryPlanning.commitRun.
export const recomputeRunRecord = ({
  soNums,
  truck,
  helperIds,
  helpers,
  sales,
  contacts,
  products,
  cN,
}: {
  soNums: string[];
  truck: { id: number | string; name?: string; driverName?: string } | null;
  helperIds: (number | string)[];
  helpers: { id: number | string; name: string }[];
  sales: Sale[] | null | undefined;
  contacts: Contact[] | null | undefined;
  products: Product[] | null | undefined;
  cN: (c: Contact) => string;
}): RecomputedRun => {
  const soByNum = new Map((sales || []).map((s) => [s.soNum, s]));
  const custById = new Map((contacts || []).map((c) => [c.id, c]));
  const helperById = new Map((helpers || []).map((h) => [h.id, h]));

  const customerNames: string[] = [];
  let revenue = 0;
  let volumeM3 = 0;
  for (const sn of soNums) {
    const so = soByNum.get(sn);
    if (!so) {
      customerNames.push("");
      continue;
    }
    const cust = so.customerId != null ? custById.get(so.customerId) : null;
    customerNames.push(cust ? cN(cust) : "—");
    revenue += soRevenue(so);
    volumeM3 += soVolumeM3(so, products);
  }

  const helperNames = (helperIds || [])
    .map((id) => helperById.get(id)?.name)
    .filter((n): n is string => Boolean(n));

  return {
    truckId: truck?.id ?? null,
    truckName: truck?.name || "",
    driverName: truck?.driverName || "",
    helperIds: [...(helperIds || [])],
    helperNames,
    customerNames,
    revenue,
    volumeM3,
  };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/helpers.test.ts -t recomputeRunRecord`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/helpers.ts src/utils/helpers.test.ts
git commit -m "feat(delivery): recomputeRunRecord pure helper for run edits"
```

---

## Task 2: Parent handler `editLoadedRun` + wire props at RunCard call site

**Files:**
- Modify: `src/components/DeliveryPlanning.jsx` (helpers import; add handler near `cancelRun` line ~728; call site line ~2366)

- [ ] **Step 1: Import the helper**

In the existing `import { ... } from "../utils/helpers..."` block in `DeliveryPlanning.jsx`, add `recomputeRunRecord` to the named imports (alongside `soVolumeM3`, `soRevenue`, `consolidatePickList`).

- [ ] **Step 2: Add the `editLoadedRun` handler**

Insert after `cancelRun` (after its closing `};`, ~line 742):

```jsx
  // Admin edit of a loaded (out_for_delivery) run: change truck/date/helpers and SO
  // membership. Stock is untouched (it only moves on delivery confirm) — we just flip
  // SO status for added/removed SOs and recompute the run's denormalized totals.
  const editLoadedRun = (runId, patch) => {
    const run = (deliveryRuns || []).find((r) => r.id === runId);
    if (!run || run.status !== "out_for_delivery") return;
    const newSoNums = patch.soNums || [];
    if (newSoNums.length === 0) return; // empty guarded in the UI

    const oldSet = new Set(run.soNums || []);
    const newSet = new Set(newSoNums);
    const added = newSoNums.filter((sn) => !oldSet.has(sn));
    const removed = (run.soNums || []).filter((sn) => !newSet.has(sn));

    if (added.length || removed.length) {
      setSales((prev) =>
        (prev || []).map((s) => {
          if (added.includes(s.soNum)) return { ...s, status: "out_for_delivery" };
          if (removed.includes(s.soNum)) return { ...s, status: "pending_delivery" };
          return s;
        })
      );
    }

    const newTruck = (trucks || []).find((t) => t.id === patch.truckId) || null;
    const totals = recomputeRunRecord({
      soNums: newSoNums,
      truck: newTruck,
      helperIds: patch.helperIds || [],
      helpers: deliveryHelpers || [],
      sales,
      contacts,
      products,
      cN,
    });

    setDeliveryRuns((prev) =>
      (prev || []).map((r) =>
        r.id === runId ? { ...r, date: patch.date, soNums: [...newSoNums], ...totals } : r
      )
    );
  };
```

- [ ] **Step 3: Compute `availableSOs` and pass props at the call site**

In the `runHistory` modal, replace the run-mapping block (currently lines ~2366-2395) with the version below. It adds `availableSOs` (pending pool) before the map, `soMeta` (this run's SOs) inside the map, and four new props on `<RunCard>`:

```jsx
              {(() => {
                const availableSOs = pendingSOs.map((so) => {
                  const cust = (contacts || []).find((c) => c.id === so.customerId);
                  return {
                    soNum: so.soNum,
                    custName: cust ? cN(cust) : "—",
                    volM3: soVolumeM3(so, products),
                  };
                });
                return (deliveryRuns || [])
                  .slice()
                  .sort((a, b) => b.createdAt - a.createdAt)
                  .map((r) => {
                    // Legacy runs (created before status field) → treat as completed.
                    const status = r.status || "completed";
                    const resolvedNames = (r.soNums || []).map((sn, i) => {
                      const cached = (r.customerNames || [])[i];
                      if (cached) return cached;
                      const so = (sales || []).find((s) => s.soNum === sn);
                      if (!so) return "";
                      const cust = (contacts || []).find((c) => c.id === so.customerId);
                      return cust ? cN(cust) : "";
                    });
                    const soMeta = {};
                    (r.soNums || []).forEach((sn, i) => {
                      const so = (sales || []).find((s) => s.soNum === sn);
                      soMeta[sn] = {
                        custName: resolvedNames[i] || "",
                        volM3: so ? soVolumeM3(so, products) : 0,
                      };
                    });
                    return (
                      <RunCard
                        key={r.id}
                        run={{ ...r, customerNames: resolvedNames }}
                        status={status}
                        onConfirm={(deliveredSoNums) => confirmRunDelivery(r.id, deliveredSoNums)}
                        onCancel={() => cancelRun(r.id)}
                        onDelete={() => deleteRun(r.id)}
                        onEditLoaded={editLoadedRun}
                        activeTrucks={activeTrucks}
                        activeHelpers={activeHelpers}
                        availableSOs={availableSOs}
                        soMeta={soMeta}
                        maxHelpers={MAX_HELPERS_PER_RUN}
                        ed={ed}
                        cd={cd}
                      />
                    );
                  });
              })()}
```

- [ ] **Step 4: Verify the app still builds / existing tests still pass**

Run: `npx vitest run src/components/DeliveryPlanning.test.tsx`
Expected: PASS (5 tests) — props are additive; RunCard ignores the new props until Task 3.

- [ ] **Step 5: Commit**

```bash
git add src/components/DeliveryPlanning.jsx
git commit -m "feat(delivery): editLoadedRun handler + RunCard edit props"
```

---

## Task 3: RunCard inline edit UI (`loadedEditMode`)

**Files:**
- Modify: `src/components/DeliveryPlanning.jsx` — `RunCard` (line 36)

- [ ] **Step 1: Extend the signature and add edit state**

Change the signature (line 36) to accept the new props:

```jsx
function RunCard({ run, status, onConfirm, onCancel, onDelete, onEditLoaded, activeTrucks, activeHelpers, availableSOs, soMeta, maxHelpers, ed, cd }) {
```

Add state next to the existing `editMode` state (after line 47):

```jsx
  const [loadedEditMode, setLoadedEditMode] = useState(false);
  const [editTruckId, setEditTruckId] = useState(run.truckId ?? null);
  const [editDate, setEditDate] = useState(run.date);
  const [editHelperIds, setEditHelperIds] = useState(run.helperIds || []);
  const [editSoNums, setEditSoNums] = useState(run.soNums || []);

  const enterLoadedEdit = () => {
    setEditTruckId(run.truckId ?? null);
    setEditDate(run.date);
    setEditHelperIds([...(run.helperIds || [])]);
    setEditSoNums([...(run.soNums || [])]);
    setLoadedEditMode(true);
  };

  // Per-SO lookups merged from this run's SOs (soMeta) + the pending pool (availableSOs).
  const availMap = useMemo(() => {
    const m = {};
    (availableSOs || []).forEach((o) => { m[o.soNum] = o; });
    return m;
  }, [availableSOs]);
  const custOf = (sn) => (soMeta && soMeta[sn]?.custName) || availMap[sn]?.custName || "";
  const volOf = (sn) => (soMeta && soMeta[sn]?.volM3) ?? availMap[sn]?.volM3 ?? 0;

  const editTruck = (activeTrucks || []).find((t) => t.id === editTruckId) || null;
  const editCap = editTruck?.capacityM3 || 0;
  const editVol = editSoNums.reduce((s, sn) => s + volOf(sn), 0);
  const overCap = editCap > 0 && editVol > editCap;
  const addOptions = (availableSOs || [])
    .filter((o) => !editSoNums.includes(o.soNum))
    .map((o) => ({ value: o.soNum, label: `${o.soNum} — ${o.custName}`, searchText: o.custName }));

  const saveLoadedEdit = () => {
    if (editSoNums.length === 0) return;
    onEditLoaded(run.id, {
      truckId: editTruckId,
      date: editDate,
      soNums: editSoNums,
      helperIds: editHelperIds,
    });
    setLoadedEditMode(false);
  };
```

- [ ] **Step 2: Gate the existing loaded checklist + action bar behind `!loadedEditMode`**

The existing SO checklist (lines ~144-183) and the loaded action bar (the `isLoaded && ed && !confirmAction` block, lines ~186-220) must hide while editing. Wrap each opening condition:

- SO checklist `<div>` (line ~144): wrap as `{!loadedEditMode && (<div ...>...</div>)}`.
- Loaded action bar (line ~186): change condition to `{isLoaded && ed && !confirmAction && !loadedEditMode && (`.

Then, **inside** that loaded action bar (between the "ยกเลิกรอบ" button and the "ยืนยันส่งเสร็จ" button, i.e. right after the cancel button at line ~202), add the edit trigger:

```jsx
              <button
                onClick={enterLoadedEdit}
                style={{
                  padding: "6px 14px",
                  borderRadius: 7,
                  border: "1px solid var(--line)",
                  background: "var(--bg2)",
                  color: "var(--text)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 12,
                }}
              >
                แก้ไข
              </button>
```

- [ ] **Step 3: Render the edit form**

Inside the `expanded` block, after the gated action bar (after line ~220, still inside `expanded`), add:

```jsx
          {loadedEditMode && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 4 }}>รถ/คนขับ</div>
                <CustomSelect
                  value={String(editTruckId ?? "")}
                  onChange={(v) => setEditTruckId(+v)}
                  options={(activeTrucks || []).map((t) => ({
                    value: String(t.id),
                    label: `${t.name} — ${t.capacityM3} m³`,
                  }))}
                />
              </div>

              <div>
                <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 4 }}>วันที่จัดส่ง</div>
                <ThaiDateInput value={editDate} onChange={(e) => setEditDate(e.target.value)} />
              </div>

              <div>
                <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 4 }}>
                  ผู้ช่วย ({editHelperIds.length}/{maxHelpers})
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(activeHelpers || []).map((h) => {
                    const picked = editHelperIds.includes(h.id);
                    const atMax = !picked && editHelperIds.length >= maxHelpers;
                    return (
                      <button
                        key={h.id}
                        disabled={atMax}
                        onClick={() =>
                          setEditHelperIds((prev) =>
                            picked ? prev.filter((x) => x !== h.id) : [...prev, h.id]
                          )
                        }
                        style={{
                          padding: "5px 12px",
                          borderRadius: 99,
                          border: "1px solid",
                          borderColor: picked ? "var(--blue)" : "var(--line)",
                          background: picked ? "var(--blue)" : atMax ? "var(--hover2)" : "var(--bg2)",
                          color: picked ? "#fff" : atMax ? "var(--faint)" : "var(--text)",
                          cursor: atMax ? "not-allowed" : "pointer",
                          fontSize: 12,
                          fontFamily: "inherit",
                        }}
                      >
                        {picked ? "✓ " : ""}
                        {h.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 4 }}>
                  รายชื่อ SO ({editSoNums.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 6 }}>
                  {editSoNums.map((sn) => (
                    <div
                      key={sn}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 10px",
                        background: "var(--bg)",
                        border: "1px solid var(--line)",
                        borderRadius: 6,
                        fontSize: 13,
                      }}
                    >
                      <span style={{ fontWeight: 600, color: "var(--blue)" }}>{sn}</span>
                      <span style={{ color: "var(--dim)", flex: 1 }}>{custOf(sn)}</span>
                      <button
                        aria-label={`ถอด ${sn}`}
                        onClick={() => setEditSoNums((prev) => prev.filter((x) => x !== sn))}
                        style={{
                          padding: "2px 8px",
                          borderRadius: 5,
                          border: "1px solid var(--red)",
                          background: "rgba(255,59,48,0.10)",
                          color: "var(--red)",
                          cursor: "pointer",
                          fontSize: 12,
                          fontFamily: "inherit",
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                {addOptions.length > 0 && (
                  <CustomSelect
                    searchable
                    value=""
                    onChange={(v) =>
                      v && setEditSoNums((prev) => (prev.includes(v) ? prev : [...prev, v]))
                    }
                    options={[{ value: "", label: "+ เพิ่ม SO…" }, ...addOptions]}
                  />
                )}
              </div>

              <div style={{ fontSize: 12, color: overCap ? "var(--red)" : "var(--dim)" }}>
                ปริมาตรรวม {editVol.toFixed(2)} / {editCap} m³{overCap ? " — เกินความจุรถ" : ""}
              </div>
              {editSoNums.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--red)" }}>
                  ต้องมีอย่างน้อย 1 SO — ถ้าจะยกเลิกทั้งรอบ ใช้ปุ่ม "ยกเลิกรอบ"
                </div>
              )}

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setLoadedEditMode(false)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 7,
                    border: "1px solid var(--line)",
                    background: "var(--bg2)",
                    color: "var(--text)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 12,
                  }}
                >
                  ยกเลิกแก้ไข
                </button>
                <button
                  onClick={saveLoadedEdit}
                  disabled={editSoNums.length === 0}
                  style={{
                    padding: "6px 16px",
                    borderRadius: 7,
                    border: "none",
                    background: editSoNums.length === 0 ? "var(--hover2)" : "var(--blue)",
                    color: editSoNums.length === 0 ? "var(--dim)" : "#fff",
                    cursor: editSoNums.length === 0 ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  บันทึก
                </button>
              </div>
            </div>
          )}
```

- [ ] **Step 4: Run existing tests to confirm no regression**

Run: `npx vitest run src/components/DeliveryPlanning.test.tsx`
Expected: PASS (5 tests) — `loadedEditMode` defaults off, so existing rendering is unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/components/DeliveryPlanning.jsx
git commit -m "feat(delivery): inline admin edit form for loaded runs in RunCard"
```

---

## Task 4: Component test for the edit flow

**Files:**
- Modify: `src/components/DeliveryPlanning.test.tsx` (add a test + a focused harness)

- [ ] **Step 1: Write the test**

Append to `src/components/DeliveryPlanning.test.tsx` (inside the top-level `describe("DeliveryPlanning", ...)`). This harness wires reactive `sales` + `deliveryRuns` and exposes state via test-id nodes:

```tsx
  test("admin edits a loaded run: remove an SO and save", async () => {
    const user = userEvent.setup();

    function EditHarness() {
      const [sales, setSales] = useState<any[]>([
        { soNum: "SO-A", customerId: 1, status: "out_for_delivery", items: [{ productId: 1, qty: 2, price: 10000 }] },
        { soNum: "SO-B", customerId: 2, status: "out_for_delivery", items: [{ productId: 1, qty: 3, price: 10000 }] },
      ]);
      const [deliveryRuns, setDeliveryRuns] = useState<any[]>([
        {
          id: 1,
          status: "out_for_delivery",
          date: "2026-06-24",
          truckId: 1,
          truckName: "รถ 1",
          driverName: "",
          helperIds: [],
          helperNames: [],
          soNums: ["SO-A", "SO-B"],
          customerNames: ["ลูกค้า A", "ลูกค้า B"],
          revenue: 50000,
          volumeM3: 5,
          createdAt: 1000,
        },
      ]);
      const [modal, setModal] = useState<string | null>("runHistory");
      const sh: any = {
        cN: (c: any) => c?.name ?? "—",
        pN: (p: any) => p?.name ?? "—",
        contacts: [
          { id: 1, name: "ลูกค้า A", lat: 13.75, lng: 100.5 },
          { id: 2, name: "ลูกค้า B", lat: 13.76, lng: 100.51 },
        ],
        sales,
        setSales,
        products: [{ id: 1, name: "Fridge", sizeClass: "L" }],
        setProducts: () => {},
        addLog: () => {},
        cats: [],
        trucks: [{ id: 1, name: "รถ 1", capacityM3: 8, isActive: true }],
        setTrucks: () => {},
        deliveryRuns,
        setDeliveryRuns,
        deliveryHelpers: [],
        setDeliveryHelpers: () => {},
        canE: () => true,
        canD: () => true,
        cu: { username: "admin" },
        modal,
        oM: (n: string) => setModal(n),
        cM: () => setModal(null),
      };
      const runSoNums = (deliveryRuns[0]?.soNums || []).join(",");
      const soBStatus = sales.find((s) => s.soNum === "SO-B")?.status;
      return (
        <>
          <DeliveryPlanningPage sh={sh} />
          <div data-testid="run-soNums">{runSoNums}</div>
          <div data-testid="so-b-status">{soBStatus}</div>
        </>
      );
    }

    render(<EditHarness />);

    // History modal is open; the loaded run auto-expands. Enter edit mode.
    await user.click(screen.getByRole("button", { name: "แก้ไข" }));

    // Remove SO-B, then save.
    await user.click(screen.getByRole("button", { name: "ถอด SO-B" }));
    await user.click(screen.getByRole("button", { name: "บันทึก" }));

    // Run record now holds only SO-A; SO-B returned to pending_delivery.
    expect(screen.getByTestId("run-soNums").textContent).toBe("SO-A");
    expect(screen.getByTestId("so-b-status").textContent).toBe("pending_delivery");
  });
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/components/DeliveryPlanning.test.tsx -t "admin edits a loaded run"`
Expected: PASS.

> If it fails on `getByRole("button", { name: "แก้ไข" })` being ambiguous, scope it: the only "แก้ไข" button visible is the loaded-run edit trigger (no completed runs in this harness), so a bare name match is correct. If `ThaiDateInput` or `CustomSelect` throws under jsdom, confirm the run auto-expands and that the form rendered before interacting.

- [ ] **Step 3: Run the full delivery test file**

Run: `npx vitest run src/components/DeliveryPlanning.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 4: Commit**

```bash
git add src/components/DeliveryPlanning.test.tsx
git commit -m "test(delivery): admin edit of loaded run removes SO + flips status"
```

---

## Final verification

- [ ] Run the whole suite: `npx vitest run` — expect green.
- [ ] Manual smoke (optional, dev server): open Delivery Planning → ประวัติรอบ → a "เตรียมส่ง" run → แก้ไข → change truck/date/helpers, remove + add an SO → บันทึก. Confirm the card reflects new truck/SO count/revenue and that a removed SO reappears in the Step-2 pending pool.

## Notes

- Stock is intentionally never touched here (loaded runs hold no stock delta). Do **not** add stock logging to `editLoadedRun`.
- `customerNames` must always be rebuilt parallel to `soNums` — `recomputeRunRecord` owns this; don't bypass it.
- Parallel-work caution: a separate locked worktree is editing the picklist/print region of `DeliveryPlanning.jsx`. The RunCard region differs, but rebase/merge may still need a manual reconcile.
