# Admin edit of "เตรียมส่ง" (loaded) delivery runs

Date: 2026-06-24
Status: Approved design — ready for implementation plan

## Context / problem

The delivery run history modal ("ประวัติรอบจัดส่ง") lets admins act on runs by status:

- `completed` (ส่งเสร็จ): admin can **edit** (toggle which SOs were delivered/skipped)
  and **delete**.
- `cancelled` (ยกเลิก): admin can **delete**.
- `out_for_delivery` (เตรียมส่ง — loaded on the truck, not yet delivered): admin can
  only **confirm delivered** or **cancel** the whole run. There is **no way to edit**.

When a loaded run was built with the wrong truck/driver/helpers, the wrong date, or
the wrong set of SOs, the admin's only recourse today is to cancel the entire run and
rebuild it from scratch. This feature adds in-place admin editing of loaded runs.

## Goal

Allow an admin (permission `ed` = `canE("delivery_planning")`) to edit a loaded
(`out_for_delivery`) run's:

1. Truck / driver (driver travels with the truck)
2. Delivery date
3. Helper assignment
4. SO membership (add / remove SOs)

Out of scope: deleting a loaded run (cancel already exists); editing completed or
cancelled runs (already handled).

## Why this is safe

Stock is **not** deducted when a run is loaded — it moves only on delivery
confirmation (`confirmRunDelivery`, `DeliveryPlanning.jsx:643`). Editing a loaded
run therefore never touches stock. It only:

- flips SO `status` for added/removed SOs (mirroring `cancelRun`,
  `DeliveryPlanning.jsx:728`, but per-SO), and
- recomputes the run record's denormalized totals (mirroring `commitRun`,
  `DeliveryPlanning.jsx:588`).

## UI — inline edit in `RunCard` (approach A)

`RunCard` (`DeliveryPlanning.jsx:36`) is a presentational component. It already has a
completed-run `editMode`. Add a **separate** state `loadedEditMode` so the two never
collide.

- For loaded runs (`isLoaded`), add a **"แก้ไข"** button to the existing action bar
  (next to "ยกเลิกรอบ" / "ยืนยันส่งเสร็จ", `DeliveryPlanning.jsx:186`), shown when `ed`.
- When `loadedEditMode` is on, the card body shows an edit form instead of the
  confirm/cancel checklist:
  - **รถ/คนขับ** — dropdown of active trucks; selecting a truck implies its driver.
  - **วันที่** — date input.
  - **ผู้ช่วย** — multi-select of active helpers.
  - **รายชื่อ SO** — each current SO has a remove `[✕]`; a "+ เพิ่ม SO" dropdown lists
    available SOs from the `pending_delivery` pool (`pendingSOs`,
    `DeliveryPlanning.jsx:766`). Show running total volume vs the selected truck's
    capacity with a **soft** over-capacity warning (does not block save).
  - **บันทึก / ยกเลิกแก้ไข** buttons.
- Hide the confirm/cancel action bar while `loadedEditMode` is on, to avoid two
  competing flows.

### Local state in `RunCard` while editing

`editTruckId`, `editDate`, `editHelperIds` (array), `editSoNums` (array, order
preserved). Initialized from the run when entering `loadedEditMode`.

### New props passed to `RunCard`

- `activeTrucks` — active trucks `{ id, name, driverName, capacityM3 }`
- `activeHelpers` — active helpers `{ id, name }`
- `availableSOs` — `pendingSOs` annotated `{ soNum, custName, revenue, volM3 }`
- `onEditLoaded(runId, patch)` — apply handler

## Data flow — parent handler `editLoadedRun(runId, patch)`

`patch = { truckId, date, soNums, helperIds }`

1. Find run; **guard** `run.status === "out_for_delivery"` (no-op otherwise).
2. Diff membership: `added = soNums − run.soNums`, `removed = run.soNums − soNums`.
3. `setSales`: `removed` → `pending_delivery`, `added` → `out_for_delivery`.
   **No stock change, no stock log.**
4. Recompute the run record for the new `soNums` (order preserved), reusing existing
   pure helpers `soVolumeM3(so, products)`, `soRevenue(so)`, `cN(cust)`:
   - `truckId`, `truckName`, `driverName` from the chosen truck
   - `helperIds`, `helperNames` from the chosen helpers
   - `customerNames` — one entry per SO, **parallel to `soNums`** (see the warning at
     `DeliveryPlanning.jsx:610`)
   - `revenue` = Σ per-SO revenue, `volumeM3` = Σ per-SO volume
5. `setDeliveryRuns`: replace the matching run with the recomputed record.

### Pure-helper extraction (for testability)

Extract the record recomputation into a pure helper in `src/utils/helpers.ts`
(matching the existing `consolidatePickList` pattern). It calls the already-exported
`soVolumeM3` (`helpers.ts:590`) and `soRevenue` (`helpers.ts:605`) directly, and takes
`cN` (the customer-name resolver from `sh`) as a small injected param to stay pure:

```
recomputeRunRecord({ soNums, truck, helperIds, helpers, sales, contacts, products, cN })
  → { truckId, truckName, driverName, helperIds, helperNames, customerNames, revenue, volumeM3 }
```

The component supplies lookups and applies the SO `status` flip + state writes; the
pure helper owns the arithmetic and the `soNums`/`customerNames` parallelism.

## Edge cases

- **Empty membership:** removing the last SO is not allowed to save — show an inline
  warning directing the admin to "ยกเลิกรอบ" instead.
- **Over capacity:** changing the truck or adding SOs past capacity shows a soft
  warning but still saves (admin override).
- **Add pool:** the dropdown excludes SOs already in `editSoNums`; the run's own SOs
  are `out_for_delivery` so they never appear in `pendingSOs`.
- **Parallel arrays:** `customerNames` is always rebuilt alongside `soNums`.

## Testing

- **Unit (`src/utils/helpers.test.ts`):** `recomputeRunRecord` — totals, parallel
  `customerNames`, driver/helper resolution, empty/edge inputs.
- **Component (`src/components/DeliveryPlanning.test.tsx`):** render the harness with a
  loaded run in `deliveryRuns`; open history → "แก้ไข" → remove one SO, add one SO,
  change truck → "บันทึก"; assert the run record's `soNums`/`truckName`/`revenue`
  updated and that the removed SO returned to `pending_delivery` while the added SO
  became `out_for_delivery`. Extend the test harness `sh` slice as needed
  (`deliveryRuns`, `setDeliveryRuns`, `setSales`, active trucks/helpers).

## Footprint / parallel-work note

Changes are confined to `src/components/DeliveryPlanning.jsx` (RunCard edit UI +
`editLoadedRun` handler + new props), a small pure helper in `src/utils/helpers.ts`,
and the two test files. A parallel agent is editing the **picklist/print** area of the
same component in a separate locked worktree (`agent-ab238a76a9369e265`); the run-history
RunCard is a different region, but a future merge may still need a manual reconcile.
