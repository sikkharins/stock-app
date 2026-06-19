import { useState, useMemo, useEffect } from "react";
import { IB } from "../utils/constants.js";
import { useMediaQuery } from "../utils/useMediaQuery.js";
import { roadKmSync, prefetchRoadDistances } from "../utils/roadDistance.js";
import {
  fmt,
  todayStr,
  toBE,
  nowStr,
  scoreSO,
  soVolumeM3,
  soRevenue,
  consolidatePickList,
  soItemsByCategory,
  mkLog,
  PROXIMITY_RADIUS_KM,
  MAX_HELPERS_PER_RUN,
  MAX_HELPER_POOL,
} from "../utils/helpers.js";
import { Modal, MBtns } from "./ui/Modal.jsx";
import Field from "./ui/Field.jsx";
import CustomSelect from "./ui/CustomSelect.jsx";
import ThaiDateInput from "./ui/ThaiDateInput.jsx";
import DeliveryMap from "./DeliveryMap.jsx";

// Delivery Planning — pick SOs from `pending_delivery` pool that balance
// proximity (cluster of nearby customers), capacity (close to truck full),
// and revenue (worth the trip). Output: consolidated pick list (model × qty).
// Modal hub stays here; sub-views are inline.


// Single run row in the history modal. Behavior depends on status:
//   out_for_delivery → expandable card with per-SO checkboxes + Confirm/Cancel.
//   completed/cancelled → readonly summary.
function RunCard({ run, status, onConfirm, onCancel, onDelete, ed, cd }) {
  const allSoNums = run.soNums || [];
  // Default-checked = SOs that ended up delivered (for completed runs) or all
  // (for runs about to be confirmed).
  const initialChecked = useMemo(() => {
    if (status === "out_for_delivery") return new Set(allSoNums);
    return new Set(run.deliveredSoNums || allSoNums);
  }, [status, run.deliveredSoNums, allSoNums]);
  const [checked, setChecked] = useState(initialChecked);
  const [expanded, setExpanded] = useState(status === "out_for_delivery");
  const [confirmAction, setConfirmAction] = useState(null); // "confirm" | "cancel" | "delete" | null
  const [editMode, setEditMode] = useState(false);

  // Clear inline state when status changes from loaded → final.
  useEffect(() => {
    if (status !== "out_for_delivery") setConfirmAction(null);
  }, [status]);

  // When entering edit mode, reset checked from current saved state.
  useEffect(() => {
    if (editMode) setChecked(new Set(run.deliveredSoNums || allSoNums));
  }, [editMode, run.deliveredSoNums, allSoNums]);

  const toggleSo = (sn) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(sn)) next.delete(sn);
      else next.add(sn);
      return next;
    });
  };

  const statusLabel =
    status === "out_for_delivery"
      ? { label: "เตรียมส่ง", color: "var(--orange)", bg: "rgba(255,149,0,0.14)" }
      : status === "cancelled"
      ? { label: "ยกเลิก", color: "var(--red)", bg: "rgba(255,59,48,0.10)" }
      : { label: "ส่งเสร็จ", color: "var(--green)", bg: "rgba(52,199,89,0.12)" };

  const delivered = (run.deliveredSoNums || []).length;
  const skipped = (run.skippedSoNums || []).length;
  const isLoaded = status === "out_for_delivery";

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 8,
        background: status === "cancelled" ? "var(--hover)" : "var(--bg2)",
        opacity: status === "cancelled" ? 0.7 : 1,
      }}
    >
      <div
        onClick={() => setExpanded((e) => !e)}
        style={{
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: "pointer",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            padding: "2px 9px",
            borderRadius: 99,
            background: statusLabel.bg,
            color: statusLabel.color,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {statusLabel.label}
        </span>
        <strong style={{ fontSize: 14 }}>{toBE(run.date)}</strong>
        <span style={{ color: "var(--dim)", fontSize: 13 }}>{run.truckName}</span>
        {run.driverName && (
          <span style={{ color: "var(--dim)", fontSize: 12 }}>· {run.driverName}</span>
        )}
        <span style={{ color: "var(--dim)", fontSize: 12 }}>· {allSoNums.length} SO</span>
        {status === "completed" && skipped > 0 && (
          <span style={{ color: "var(--orange)", fontSize: 12 }}>
            · ส่ง {delivered}/{allSoNums.length} (ไม่ได้ส่ง {skipped})
          </span>
        )}
        <span
          style={{ marginLeft: "auto", fontWeight: 600, color: "var(--green)", fontSize: 13 }}
        >
          ฿{fmt(Math.round(run.revenue || 0))}
        </span>
        <span style={{ color: "var(--dim)", fontSize: 12 }}>
          {(run.volumeM3 || 0).toFixed(2)} m³
        </span>
        <span style={{ fontSize: 14, color: "var(--dim)", transform: expanded ? "rotate(180deg)" : "none" }}>
          ▾
        </span>
      </div>

      {expanded && (
        <div style={{ padding: "10px 14px 14px", borderTop: "1px solid var(--line)" }}>
          {run.driverNote && (
            <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 8 }}>
              📝 {run.driverNote}
            </div>
          )}

          {/* SO list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
            {allSoNums.map((sn, i) => {
              const custName = (run.customerNames || [])[i] || "";
              const isChecked = checked.has(sn);
              const wasSkipped = status === "completed" && (run.skippedSoNums || []).includes(sn);
              return (
                <label
                  key={sn}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 10px",
                    background: wasSkipped && !editMode ? "rgba(255,149,0,0.08)" : "var(--bg)",
                    border: "1px solid " + (wasSkipped && !editMode ? "var(--orange)" : "var(--line)"),
                    borderRadius: 6,
                    cursor: isLoaded || editMode ? "pointer" : "default",
                    fontSize: 13,
                  }}
                >
                  {isLoaded || editMode ? (
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSo(sn)}
                    />
                  ) : (
                    <span style={{ fontSize: 14, color: wasSkipped ? "var(--orange)" : "var(--green)" }}>
                      {wasSkipped ? "✕" : "✓"}
                    </span>
                  )}
                  <span style={{ fontWeight: 600, color: "var(--blue)" }}>{sn}</span>
                  <span style={{ color: "var(--dim)", flex: 1 }}>{custName}</span>
                  {wasSkipped && !editMode && (
                    <span style={{ fontSize: 11, color: "var(--orange)" }}>ไม่ได้ส่ง</span>
                  )}
                </label>
              );
            })}
          </div>

          {/* Actions — only for loaded runs */}
          {isLoaded && ed && !confirmAction && (
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setConfirmAction("cancel")}
                style={{
                  padding: "6px 14px",
                  borderRadius: 7,
                  border: "1px solid var(--red)",
                  background: "rgba(255,59,48,0.10)",
                  color: "var(--red)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 12,
                }}
              >
                ✕ ยกเลิกรอบ
              </button>
              <button
                onClick={() => setConfirmAction("confirm")}
                style={{
                  padding: "6px 16px",
                  borderRadius: 7,
                  border: "none",
                  background: "var(--green)",
                  color: "#fff",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                ✓ ยืนยันส่งเสร็จ ({checked.size}/{allSoNums.length})
              </button>
            </div>
          )}

          {/* 2-step confirmation prompt */}
          {confirmAction === "confirm" && (
            <div
              style={{
                background: "rgba(52,199,89,0.10)",
                border: "1px solid var(--green)",
                borderRadius: 7,
                padding: "10px 12px",
                fontSize: 12,
                color: "var(--text)",
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <span>
                ยืนยัน: ส่ง <strong>{checked.size}</strong> SO,{" "}
                {allSoNums.length - checked.size > 0 && (
                  <>คืน <strong>{allSoNums.length - checked.size}</strong> SO กลับ "รอจัดส่ง"</>
                )}
                ?
              </span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <button
                  onClick={() => setConfirmAction(null)}
                  style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid var(--line)", background: "var(--bg2)", color: "var(--text)", cursor: "pointer", fontFamily: "inherit", fontSize: 11 }}
                >
                  ยกเลิก
                </button>
                <button
                  onClick={() => onConfirm(Array.from(checked))}
                  style={{ padding: "4px 12px", borderRadius: 5, border: "none", background: "var(--green)", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600 }}
                >
                  ยืนยัน
                </button>
              </div>
            </div>
          )}

          {confirmAction === "cancel" && (
            <div
              style={{
                background: "rgba(255,59,48,0.10)",
                border: "1px solid var(--red)",
                borderRadius: 7,
                padding: "10px 12px",
                fontSize: 12,
                color: "var(--text)",
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <span>
                ยกเลิกรอบนี้? SO ทั้ง <strong>{allSoNums.length}</strong> ใบจะกลับไป "รอจัดส่ง"
              </span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <button
                  onClick={() => setConfirmAction(null)}
                  style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid var(--line)", background: "var(--bg2)", color: "var(--text)", cursor: "pointer", fontFamily: "inherit", fontSize: 11 }}
                >
                  ไม่ใช่
                </button>
                <button
                  onClick={onCancel}
                  style={{ padding: "4px 12px", borderRadius: 5, border: "none", background: "var(--red)", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600 }}
                >
                  ยืนยันยกเลิก
                </button>
              </div>
            </div>
          )}

          {/* Admin actions on finalized runs (completed/cancelled) */}
          {!isLoaded && !confirmAction && !editMode && (ed || cd) && (
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              {ed && status === "completed" && (
                <button
                  onClick={() => setEditMode(true)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--line)",
                    background: "var(--bg2)",
                    color: "var(--dim)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 11,
                  }}
                >
                  แก้ไข
                </button>
              )}
              {cd && (
                <button
                  onClick={() => setConfirmAction("delete")}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--line)",
                    background: "var(--bg2)",
                    color: "var(--red)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 11,
                  }}
                >
                  ลบ
                </button>
              )}
            </div>
          )}

          {/* Edit mode action bar (completed run, admin editing delivered/skipped) */}
          {editMode && (
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setEditMode(false)}
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
                onClick={() => {
                  onConfirm(Array.from(checked));
                  setEditMode(false);
                }}
                style={{
                  padding: "6px 16px",
                  borderRadius: 7,
                  border: "none",
                  background: "var(--blue)",
                  color: "#fff",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                บันทึก ({checked.size}/{allSoNums.length} ส่ง)
              </button>
            </div>
          )}

          {/* Delete confirmation */}
          {confirmAction === "delete" && (
            <div
              style={{
                background: "rgba(255,59,48,0.10)",
                border: "1px solid var(--red)",
                borderRadius: 7,
                padding: "10px 12px",
                fontSize: 12,
                color: "var(--text)",
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <span>
                ลบรอบนี้? <span style={{ color: "var(--dim)" }}>(สถานะ SO ที่ส่งแล้วจะคงเดิม — ลบแค่บันทึก)</span>
              </span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <button
                  onClick={() => setConfirmAction(null)}
                  style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid var(--line)", background: "var(--bg2)", color: "var(--text)", cursor: "pointer", fontFamily: "inherit", fontSize: 11 }}
                >
                  ไม่ใช่
                </button>
                <button
                  onClick={onDelete}
                  style={{ padding: "4px 12px", borderRadius: 5, border: "none", background: "var(--red)", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600 }}
                >
                  ยืนยันลบ
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Numbered step badge used in the 3-step layout (choose truck → pick SO → summary).
function StepBadge({ n }) {
  return (
    <span
      style={{
        width: 24,
        height: 24,
        borderRadius: "50%",
        background: "var(--blue-bg)",
        color: "var(--blue)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 13,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {n}
    </span>
  );
}

const STEP_TOOL_BTN = {
  padding: "6px 12px",
  borderRadius: 7,
  border: "1px solid var(--line)",
  background: "var(--bg2)",
  color: "var(--text)",
  cursor: "pointer",
  fontSize: 12,
  fontFamily: "inherit",
};

// 80mm thermal-receipt element styles, scoped under `scope` (e.g. "body" for the
// preview iframe, "#thermal-print-root" for the print node). Class names are
// tr-* to avoid clashing with app styles when injected into the main document.
const thermalReceiptCss = (scope) =>
  `${scope}{width:76mm;margin:0 auto;padding:2mm;background:#fff;color:#000;` +
  `font-family:'Sarabun','Tahoma',sans-serif;font-size:13px;line-height:1.35;box-sizing:border-box}` +
  `${scope} *{box-sizing:border-box}` +
  `${scope} .tr-hdr{text-align:center;font-weight:700;font-size:16px;margin-bottom:2px}` +
  `${scope} .tr-sub{text-align:center;font-size:11px;margin-bottom:1px}` +
  `${scope} .tr-tot{text-align:center;font-size:12px;font-weight:600;margin:4px 0}` +
  `${scope} .tr-sep{border-top:1px dashed #000;margin:4px 0}` +
  `${scope} .tr-row{padding:4px 0;border-bottom:1px dashed #999}` +
  `${scope} .tr-row:last-child{border-bottom:none}` +
  `${scope} .tr-row-top{display:flex;align-items:baseline;gap:4px}` +
  `${scope} .tr-brand{font-weight:600;flex:1;min-width:0;font-size:12px;word-break:break-word}` +
  `${scope} .tr-qty{font-weight:800;font-size:22px;margin-left:auto}` +
  `${scope} .tr-cat{font-size:10px;color:#444}` +
  `${scope} .tr-name{font-weight:600;font-size:14px;word-break:break-word}` +
  `${scope} .tr-foot{text-align:center;font-size:10px;margin-top:6px;color:#555}`;

export default function DeliveryPlanningPage({ sh }) {
  const {
    cN,
    pN,
    contacts,
    sales,
    setSales,
    products,
    setProducts,
    addLog,
    cats,
    trucks,
    setTrucks,
    deliveryRuns,
    setDeliveryRuns,
    deliveryHelpers,
    setDeliveryHelpers,
    canE,
    canD,
    cu,
    modal,
    oM,
    cM,
  } = sh;
  const ed = canE("delivery_planning");
  const cd = canD("delivery_planning");
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [roadVer, setRoadVer] = useState(0);

  const activeTrucks = useMemo(
    () => (trucks || []).filter((t) => t.isActive !== false),
    [trucks]
  );
  const [truckId, setTruckId] = useState(activeTrucks[0]?.id ?? null);
  const truck = useMemo(
    () => (trucks || []).find((t) => t.id === truckId) || activeTrucks[0] || null,
    [trucks, truckId, activeTrucks]
  );
  const truckCapM3 = truck?.capacityM3 || 0;
  const [date, setDate] = useState(todayStr());
  const [picked, setPicked] = useState(new Set());
  const [zoneFilter, setZoneFilter] = useState("");
  const [viewMode, setViewMode] = useState("list"); // "list" | "map"

  // Truck CRUD form (lives in manage trucks modal)
  const [driverNote, setDriverNote] = useState("");
  const [warnMsg, setWarnMsg] = useState(null);
  const [runHelperIds, setRunHelperIds] = useState([]);
  const [previewFormat, setPreviewFormat] = useState("a4"); // "a4" | "80mm"

  // Helper-pool CRUD form
  const emptyHelper = { id: null, name: "", phone: "", isActive: true };
  const [helperForm, setHelperForm] = useState(emptyHelper);
  const activeHelpers = useMemo(
    () => (deliveryHelpers || []).filter((h) => h.isActive !== false),
    [deliveryHelpers]
  );
  const toggleRunHelper = (id) => {
    setRunHelperIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_HELPERS_PER_RUN) return prev; // cap silently
      return [...prev, id];
    });
  };
  const startNewHelper = () => {
    setHelperForm(emptyHelper);
    oM("editHelper");
  };
  const startEditHelper = (h) => {
    setHelperForm({ ...emptyHelper, ...h });
    oM("editHelper");
  };
  const saveHelper = () => {
    if (!helperForm.name.trim()) return;
    setDeliveryHelpers((prev) => {
      if (helperForm.id != null) {
        return (prev || []).map((h) =>
          h.id === helperForm.id
            ? {
                ...h,
                name: helperForm.name.trim(),
                phone: helperForm.phone || "",
                isActive: helperForm.isActive !== false,
              }
            : h
        );
      }
      if ((prev || []).length >= MAX_HELPER_POOL) {
        setWarnMsg(`พนักงานส่งของเก็บได้สูงสุด ${MAX_HELPER_POOL} คน`);
        return prev || [];
      }
      return [
        ...(prev || []),
        {
          id: Date.now(),
          name: helperForm.name.trim(),
          phone: helperForm.phone || "",
          isActive: true,
        },
      ];
    });
    cM();
  };
  const delHelper = (id) => {
    if (!confirm("ลบพนักงานคนนี้?")) return;
    setDeliveryHelpers((prev) => (prev || []).filter((h) => h.id !== id));
    setRunHelperIds((prev) => prev.filter((x) => x !== id));
  };

  const commitRun = () => {
    if (pickedRows.length === 0) {
      setWarnMsg("ยังไม่ได้เลือก SO");
      return;
    }
    if (!truck) {
      setWarnMsg("ยังไม่ได้เลือกรถ");
      return;
    }
    const pickedSoNums = pickedRows.map((r) => r.so.soNum);
    const helperNames = runHelperIds
      .map((id) => (deliveryHelpers || []).find((h) => h.id === id)?.name)
      .filter(Boolean);
    const run = {
      id: Date.now(),
      date,
      truckId: truck.id,
      truckName: truck.name,
      driverName: truck.driverName || "",
      helperIds: [...runHelperIds],
      helperNames,
      soNums: pickedSoNums,
      // Parallel to soNums (one entry per SO, not deduped). Earlier versions
      // stored the deduped list which broke per-SO display in the history modal.
      customerNames: pickedRows.map((r) => r.custName),
      revenue: pickedRevenue,
      volumeM3: pickedVolM3,
      driverNote: driverNote.trim(),
      createdAt: Date.now(),
      createdBy: cu?.username || "",
      status: "out_for_delivery",
      completedAt: null,
      deliveredSoNums: [],
      skippedSoNums: [],
    };
    setDeliveryRuns((prev) => [run, ...(prev || [])]);
    // Move picked SOs from pending_delivery → out_for_delivery (loaded onto truck,
    // not yet delivered). They'll be marked completed once the driver confirms.
    setSales((prev) =>
      (prev || []).map((s) =>
        pickedSoNums.includes(s.soNum) ? { ...s, status: "out_for_delivery" } : s
      )
    );
    setPicked(new Set());
    setDriverNote("");
    setRunHelperIds([]);
    cM();
  };

  // Mark/edit a run's delivery outcome. `deliveredSoNums` = SOs that actually
  // got delivered (the rest go back to pending_delivery so they can be re-planned).
  // Works for both out_for_delivery (first confirmation) and completed runs (admin
  // edit fixing a mistake) — for the latter, SO statuses flip accordingly.
  // Stock is deducted/restored to mirror Sales.confirmDelivery so totals stay
  // consistent regardless of which entry point flips the status.
  const confirmRunDelivery = (runId, deliveredSoNums) => {
    const run = (deliveryRuns || []).find((r) => r.id === runId);
    if (!run || run.status === "cancelled") return;
    const delivered = new Set(deliveredSoNums);
    const allInRun = run.soNums || [];
    const skipped = allInRun.filter((sn) => !delivered.has(sn));

    // Walk each SO and figure out the stock delta vs its current status.
    // newCompleted: pending/out_for_delivery → completed → subtract stock
    // wasCompleted: completed → pending_delivery (admin uncheck) → add stock back
    // No-op when status is unchanged.
    const stockDelta = new Map(); // productId → qty (negative = subtract)
    const logEntries = []; // { pid, qty, soNum, dir: "out"|"in" }
    for (const sn of allInRun) {
      const so = (sales || []).find((s) => s.soNum === sn);
      if (!so) continue;
      const wasCompleted = so.status === "completed";
      const willBeCompleted = delivered.has(sn);
      if (willBeCompleted === wasCompleted) continue;
      const sign = willBeCompleted ? -1 : 1;
      for (const it of so.items || []) {
        stockDelta.set(it.productId, (stockDelta.get(it.productId) || 0) + sign * it.qty);
        logEntries.push({
          pid: it.productId,
          qty: it.qty,
          soNum: sn,
          dir: willBeCompleted ? "out" : "in",
        });
      }
    }

    setSales((prev) =>
      (prev || []).map((s) => {
        if (!allInRun.includes(s.soNum)) return s;
        return delivered.has(s.soNum)
          ? { ...s, status: "completed" }
          : { ...s, status: "pending_delivery" };
      })
    );

    if (stockDelta.size > 0) {
      setProducts((pp) =>
        pp.map((pr) => {
          const d = stockDelta.get(pr.id);
          if (d == null || d === 0) return pr;
          return { ...pr, stock: Math.max(0, pr.stock + d) };
        })
      );
      for (const e of logEntries) {
        const pr = (products || []).find((p) => p.id === e.pid);
        if (!pr) continue;
        const before = pr.stock;
        const after = Math.max(0, before + (e.dir === "out" ? -e.qty : e.qty));
        addLog(
          mkLog(
            pr.id,
            e.dir,
            e.qty,
            before,
            after,
            e.soNum,
            e.dir === "out" ? "ยืนยันส่งจากประวัติรอบ" : "ย้อน SO กลับ (ประวัติรอบ)",
            cu?.username || ""
          )
        );
      }
    }

    setDeliveryRuns((prev) =>
      (prev || []).map((r) =>
        r.id === runId
          ? {
              ...r,
              status: "completed",
              completedAt: r.completedAt || Date.now(),
              deliveredSoNums: Array.from(delivered),
              skippedSoNums: skipped,
            }
          : r
      )
    );
  };

  // Cancel a loaded run before it goes out — return SOs to pending_delivery and
  // mark the run record cancelled (kept for audit, not deleted).
  const cancelRun = (runId) => {
    const run = (deliveryRuns || []).find((r) => r.id === runId);
    if (!run || run.status !== "out_for_delivery") return;
    const allInRun = run.soNums || [];
    setSales((prev) =>
      (prev || []).map((s) =>
        allInRun.includes(s.soNum) ? { ...s, status: "pending_delivery" } : s
      )
    );
    setDeliveryRuns((prev) =>
      (prev || []).map((r) =>
        r.id === runId ? { ...r, status: "cancelled" } : r
      )
    );
  };

  // Permanently remove a run record (audit log only — SO statuses unchanged).
  // For mistaken/duplicate entries. Admin-only.
  const deleteRun = (runId) => {
    setDeliveryRuns((prev) => (prev || []).filter((r) => r.id !== runId));
  };

  const emptyTruck = {
    id: null,
    name: "",
    capacityM3: 8,
    isActive: true,
    note: "",
    widthCm: 200,
    lengthCm: 400,
    heightCm: 200,
    driverName: "",
  };
  const [truckForm, setTruckForm] = useState(emptyTruck);

  // dropShip SOs are auto-created from drop-ship POs where the supplier delivers
  // directly to the customer — TS does not transport these, so they don't belong
  // in the delivery-planning pool.
  const pendingSOs = useMemo(
    () =>
      (sales || []).filter(
        (s) => s.status === "pending_delivery" && !s.dropShip
      ),
    [sales]
  );

  const ranked = useMemo(() => {
    const rows = pendingSOs.map((so) => {
      const cust = (contacts || []).find((c) => c.id === so.customerId) || null;
      const byCategory = soItemsByCategory(so, products, cats);
      return {
        so,
        cust,
        custName: cust ? cN(cust) : "—",
        score: scoreSO(so, pendingSOs, contacts, products, truckCapM3),
        volM3: soVolumeM3(so, products),
        revenue: soRevenue(so),
        hasGeo: cust && typeof cust.lat === "number" && typeof cust.lng === "number",
        byCategory,
        hasNoLayDown: byCategory.some((g) => g.hasNoLayDown),
        distToPicked: null, // populated below when picks exist
      };
    });
    const filtered = zoneFilter
      ? rows.filter((r) => {
          const blob =
            (r.cust?.address || "") +
            " " +
            (r.cust?.geoNote || "") +
            " " +
            (r.custName || "") +
            " " +
            (r.so?.soNum || "");
          return blob.toLowerCase().includes(zoneFilter.toLowerCase());
        })
      : rows;

    // No picks yet → static intrinsic ranking
    if (picked.size === 0) {
      return filtered.sort((a, b) => b.score - a.score);
    }

    // With picks: keep picked rows at the top (sorted by intrinsic score among
    // themselves), then unpicked rows sorted by "closest to nearest picked
    // customer" — so the dispatcher sees nearby SOs surface as they build the
    // pick. Items without geo fall to the bottom of the unpicked block,
    // ordered by their intrinsic score.
    const pickedAnchors = filtered
      .filter((r) => picked.has(r.so.soNum))
      .map((r) => r.cust)
      .filter((c) => c && typeof c.lat === "number" && typeof c.lng === "number");

    const annotated = filtered.map((r) => {
      if (
        pickedAnchors.length === 0 ||
        !r.cust ||
        typeof r.cust.lat !== "number" ||
        typeof r.cust.lng !== "number"
      ) {
        return r;
      }
      let minD = Infinity;
      for (const a of pickedAnchors) {
        const d = roadKmSync(
          { lat: r.cust.lat, lng: r.cust.lng },
          { lat: a.lat, lng: a.lng }
        );
        if (d < minD) minD = d;
      }
      return { ...r, distToPicked: minD };
    });

    const pickedRowsLocal = annotated
      .filter((r) => picked.has(r.so.soNum))
      .sort((a, b) => b.score - a.score);
    const unpicked = annotated.filter((r) => !picked.has(r.so.soNum));

    unpicked.sort((a, b) => {
      const aHas = a.distToPicked != null;
      const bHas = b.distToPicked != null;
      if (aHas && bHas) return a.distToPicked - b.distToPicked; // nearer first
      if (aHas) return -1; // geo'd rows beat un-geo'd
      if (bHas) return 1;
      return b.score - a.score; // both un-geo'd → by intrinsic score
    });

    return [...pickedRowsLocal, ...unpicked];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSOs, contacts, products, truckCapM3, zoneFilter, cN, picked, roadVer]);

  const pickedRows = useMemo(
    () => ranked.filter((r) => picked.has(r.so.soNum)),
    [ranked, picked]
  );

  // Prefetch road distances (OSRM) between picked anchors and remaining SOs.
  // Sync render uses cached values or haversine×1.4 estimate; this effect upgrades
  // the estimates to real road km in the background.
  const pickedKey = useMemo(
    () => Array.from(picked).sort().join(","),
    [picked]
  );
  useEffect(() => {
    if (picked.size === 0) return;
    const withGeo = pendingSOs
      .map((so) => {
        const cust = (contacts || []).find((c) => c.id === so.customerId);
        if (
          !cust ||
          typeof cust.lat !== "number" ||
          typeof cust.lng !== "number"
        )
          return null;
        return { soNum: so.soNum, lat: cust.lat, lng: cust.lng };
      })
      .filter(Boolean);
    const anchors = withGeo.filter((x) => picked.has(x.soNum));
    const targets = withGeo.filter((x) => !picked.has(x.soNum));
    if (anchors.length === 0 || targets.length === 0) return;
    let cancelled = false;
    (async () => {
      const updated = await prefetchRoadDistances(anchors, targets);
      if (!cancelled && updated) setRoadVer((v) => v + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [pickedKey, pendingSOs, contacts, picked]);
  const pickedVolM3 = pickedRows.reduce((s, r) => s + r.volM3, 0);
  const pickedRevenue = pickedRows.reduce((s, r) => s + r.revenue, 0);
  const pickedCustomers = [...new Set(pickedRows.map((r) => r.custName))];
  const utilPct =
    truckCapM3 > 0 ? Math.min(100, (pickedVolM3 / truckCapM3) * 100) : 0;
  const overCapacity = pickedVolM3 > truckCapM3 && truckCapM3 > 0;

  const toggle = (soNum) => {
    const next = new Set(picked);
    if (next.has(soNum)) next.delete(soNum);
    else next.add(soNum);
    setPicked(next);
  };
  const clearAll = () => setPicked(new Set());

  const pickList = useMemo(() => {
    const raw = consolidatePickList(
      pickedRows.map((r) => r.so),
      products
    );
    const productMap = new Map((products || []).map((p) => [p.id, p]));
    const catMap = new Map((cats || []).map((c) => [c.id, c]));
    const subByPair = new Map();
    for (const c of cats || [])
      for (const s of c.subs || [])
        subByPair.set(`${c.id}|${s.id}`, s.name);
    const soByNum = new Map((sales || []).map((s) => [s.soNum, s]));
    const custMap = new Map((contacts || []).map((c) => [c.id, c]));

    return raw.map((e) => {
      const p = productMap.get(e.productId);
      const cat = p?.categoryId != null ? catMap.get(p.categoryId) : null;
      const subName =
        p?.categoryId != null
          ? subByPair.get(`${p.categoryId}|${p.subcategoryId}`) || ""
          : "";

      const custSet = new Set();
      for (const soNum of e.sources || []) {
        const so = soByNum.get(soNum);
        if (so?.customerId != null) {
          const cust = custMap.get(so.customerId);
          if (cust) custSet.add(cN(cust));
        }
      }

      return {
        ...e,
        brand: p?.brand || "",
        catName: cat?.name || "",
        subName,
        customers: [...custSet],
      };
    });
  }, [pickedRows, products, cats, sales, contacts, cN]);

  // Aggregate category breakdown across all picked SOs (volume-sorted DESC)
  const pickedByCategory = useMemo(() => {
    if (pickedRows.length === 0) return [];
    const allItems = pickedRows.flatMap((r) => r.so.items || []);
    const synthSO = { soNum: "agg", items: allItems };
    return soItemsByCategory(synthSO, products, cats);
  }, [pickedRows, products, cats]);

  // Truck CRUD
  const startNewTruck = () => {
    setTruckForm(emptyTruck);
    oM("editTruck");
  };
  const startEditTruck = (t) => {
    setTruckForm({ ...emptyTruck, ...t });
    oM("editTruck");
  };
  const saveTruck = () => {
    if (!truckForm.name.trim() || !(truckForm.capacityM3 > 0)) return;
    const cap = +truckForm.capacityM3;
    const dims = {
      widthCm: +truckForm.widthCm || undefined,
      lengthCm: +truckForm.lengthCm || undefined,
      heightCm: +truckForm.heightCm || undefined,
      driverName: (truckForm.driverName || "").trim() || undefined,
    };
    setTrucks((prev) => {
      if (truckForm.id != null) {
        return prev.map((t) =>
          t.id === truckForm.id
            ? {
                ...t,
                name: truckForm.name.trim(),
                capacityM3: cap,
                isActive: !!truckForm.isActive,
                note: truckForm.note || "",
                ...dims,
              }
            : t
        );
      }
      const id = Date.now();
      return [
        ...prev,
        {
          id,
          name: truckForm.name.trim(),
          capacityM3: cap,
          isActive: true,
          note: truckForm.note || "",
          ...dims,
        },
      ];
    });
    cM();
  };
  const delTruck = (id) => {
    if (!confirm("ลบรถคันนี้?")) return;
    setTrucks((prev) => prev.filter((t) => t.id !== id));
  };

  // Inner markup of the 80mm receipt (no <html>/<style> wrapper). Shared by the
  // modal preview iframe and the print node so they never drift.
  const thermalInner = useMemo(() => {
    if (pickList.length === 0) return "";
    const esc = (s) =>
      String(s || "").replace(/[&<>"']/g, (c) =>
        c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;"
      );
    const totalQty = pickList.reduce((s, e) => s + e.totalQty, 0);
    const rows = pickList
      .map((e) =>
        '<div class="tr-row">' +
        '<div class="tr-row-top">' +
        '<span class="tr-brand">' + esc(e.brand || "—") + "</span>" +
        '<span class="tr-qty">×' + e.totalQty + "</span>" +
        "</div>" +
        '<div class="tr-cat">' + esc(e.catName) + "</div>" +
        '<div class="tr-name">' + esc(e.name) + "</div>" +
        "</div>"
      )
      .join("");
    const headerLine =
      esc(truck?.name || "—") +
      (truck?.driverName ? " · " + esc(truck.driverName) : "");
    return (
      "<div class='tr-hdr'>ใบจัดของ</div>" +
      "<div class='tr-sub'>" + esc(toBE(date)) + "</div>" +
      "<div class='tr-sub'>" + headerLine + "</div>" +
      "<div class='tr-tot'>" + totalQty + " ชิ้น · " + pickList.length + " รายการ · " + pickedRows.length + " SO</div>" +
      "<div class='tr-sep'></div>" +
      rows +
      "<div class='tr-sep'></div>" +
      "<div class='tr-foot'>พิมพ์ " + esc(nowStr()) + "</div>"
    );
  }, [pickList, pickedRows.length, truck, date]);

  // Standalone document for the modal preview iframe + the print window.
  // viewport width=302px (=80mm @96dpi) pins the layout width so mobile print
  // services render the receipt at full paper width instead of shrinking a
  // narrow body centered in a wide page.
  const thermalHtml = useMemo(() => {
    if (!thermalInner) return "";
    return (
      "<!DOCTYPE html><html><head><meta charset='utf-8'>" +
      "<meta name='viewport' content='width=302, initial-scale=1'>" +
      "<title>ใบจัดของ</title><style>" +
      "@page{size:80mm auto;margin:0}html,body{margin:0;padding:0;background:#fff}" +
      thermalReceiptCss("body") +
      "</style></head><body>" + thermalInner + "</body></html>"
    );
  }, [thermalInner]);

  // Print the 80mm receipt in its own top-level window (document = only the
  // receipt) and auto-fire print. On desktop with the Epson roll driver this
  // prints true-size at 80mm; whatever a mobile print service captures is also
  // just the receipt.
  const printThermal = () => {
    if (!thermalHtml) return;
    const w = window.open("", "_blank");
    if (!w) {
      setWarnMsg(
        'เบราว์เซอร์บล็อกหน้าต่างพิมพ์ — อนุญาต pop-up สำหรับเว็บนี้แล้วลองใหม่'
      );
      return;
    }
    const printDoc = thermalHtml.replace(
      "</body>",
      "<scr" + "ipt>window.onload=function(){setTimeout(function(){window.focus();window.print();},300);};</scr" + "ipt></body>"
    );
    w.document.open();
    w.document.write(printDoc);
    w.document.close();
  };

  // --- Render ---

  if (!activeTrucks.length) {
    return (
      <div style={{ padding: 24 }}>
        <h2 style={{ marginTop: 0 }}>วางแผนจัดส่ง</h2>
        <div style={{ marginBottom: 16, color: "var(--dim)" }}>
          ยังไม่มีรถบรรทุก — เพิ่มรถก่อนเพื่อเริ่มวางแผน
        </div>
        {ed && (
          <button
            onClick={startNewTruck}
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              border: "none",
              background: "var(--blue)",
              color: "#fff",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            + เพิ่มรถบรรทุก
          </button>
        )}
        {modal === "editTruck" && renderTruckModal()}
      </div>
    );
  }

  function renderTruckModal() {
    return (
      <Modal
        title={truckForm.id != null ? "แก้ไขรถ" : "เพิ่มรถ"}
        onClose={cM}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="ชื่อรถ">
            <input
              value={truckForm.name}
              onChange={(e) =>
                setTruckForm((f) => ({ ...f, name: e.target.value }))
              }
              style={IB}
              placeholder="เช่น รถ 1"
            />
          </Field>
          <Field label="ความจุ (m³)">
            <input
              type="number"
              step="0.5"
              value={truckForm.capacityM3}
              onChange={(e) =>
                setTruckForm((f) => ({ ...f, capacityM3: e.target.value }))
              }
              style={IB}
            />
          </Field>
          <div style={{ gridColumn: "1/-1" }}>
            <Field label="พนักงานขับรถ">
              <input
                value={truckForm.driverName || ""}
                onChange={(e) =>
                  setTruckForm((f) => ({ ...f, driverName: e.target.value }))
                }
                style={IB}
                placeholder="เช่น สมชาย"
              />
            </Field>
          </div>
          <div
            style={{
              gridColumn: "1/-1",
              background: "var(--hover)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              padding: "10px 12px",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--dim)",
                marginBottom: 8,
              }}
            >
              ขนาดพื้นที่บรรทุก (cm) — สำหรับ AI จัดของลงรถ
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 8,
              }}
            >
              <Field label="กว้าง W">
                <input
                  type="number"
                  step="1"
                  value={truckForm.widthCm ?? ""}
                  onChange={(e) =>
                    setTruckForm((f) => ({
                      ...f,
                      widthCm:
                        e.target.value === "" ? undefined : parseFloat(e.target.value),
                    }))
                  }
                  style={IB}
                  placeholder="200"
                />
              </Field>
              <Field label="ยาว L">
                <input
                  type="number"
                  step="1"
                  value={truckForm.lengthCm ?? ""}
                  onChange={(e) =>
                    setTruckForm((f) => ({
                      ...f,
                      lengthCm:
                        e.target.value === "" ? undefined : parseFloat(e.target.value),
                    }))
                  }
                  style={IB}
                  placeholder="400"
                />
              </Field>
              <Field label="สูง H">
                <input
                  type="number"
                  step="1"
                  value={truckForm.heightCm ?? ""}
                  onChange={(e) =>
                    setTruckForm((f) => ({
                      ...f,
                      heightCm:
                        e.target.value === "" ? undefined : parseFloat(e.target.value),
                    }))
                  }
                  style={IB}
                  placeholder="200"
                />
              </Field>
            </div>
            <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 6 }}>
              ปริมาตร gross ที่คำนวณจาก W×L×H ≠ "ความจุใช้งาน" — ความจุใช้งานน้อยกว่า (เผื่อ
              ผนัง/ช่องระหว่าง/ของแตกง่าย)
            </div>
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <Field label="หมายเหตุ (ไม่บังคับ)">
              <input
                value={truckForm.note || ""}
                onChange={(e) =>
                  setTruckForm((f) => ({ ...f, note: e.target.value }))
                }
                style={IB}
              />
            </Field>
          </div>
          <label
            style={{
              gridColumn: "1/-1",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={truckForm.isActive !== false}
              onChange={(e) =>
                setTruckForm((f) => ({ ...f, isActive: e.target.checked }))
              }
            />
            ใช้งานอยู่
          </label>
        </div>
        <MBtns onCancel={cM} onSave={saveTruck} />
      </Modal>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>วางแผนจัดส่ง</h2>
      </div>

      {/* ① Step 1 — choose transport truck */}
      <div
        style={{
          background: "var(--panel)",
          border: "2px solid var(--blue)",
          borderRadius: 10,
          padding: "14px 16px",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
          <StepBadge n={1} />
          <span style={{ fontSize: 15, fontWeight: 600 }}>เลือกรถขนส่ง</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {ed && (
              <button onClick={() => oM("manageTrucks")} style={STEP_TOOL_BTN}>
                จัดการรถ
              </button>
            )}
            <button onClick={() => oM("runHistory")} style={STEP_TOOL_BTN}>
              ประวัติรอบ ({(deliveryRuns || []).length})
            </button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 4 }}>รถ</div>
            <CustomSelect
              value={String(truckId ?? "")}
              onChange={(v) => setTruckId(+v)}
              options={activeTrucks.map((t) => ({
                value: String(t.id),
                label: `${t.name} — ${t.capacityM3} m³`,
              }))}
            />
          </div>
          <div style={{ width: 140 }}>
            <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 4 }}>
              วันที่จัดส่ง
            </div>
            <ThaiDateInput value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 20, alignItems: "center", paddingBottom: 2 }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--dim)" }}>ความจุ</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--blue)" }}>
                {truckCapM3}{" "}
                <span style={{ fontSize: 13, color: "var(--dim)", fontWeight: 400 }}>m³</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--dim)" }}>พนักงานขับรถ</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>
                {truck?.driverName || (
                  <span style={{ color: "var(--faint)", fontWeight: 400 }}>—</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body: ranked SO list + summary */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "minmax(0,2fr) minmax(280px,1fr)",
          gap: isMobile ? 10 : 16,
          alignItems: "start",
        }}
      >
        {/* LEFT: SO list */}
        <div
          style={{
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: 10,
            padding: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 10,
              flexWrap: "wrap",
            }}
          >
            <StepBadge n={2} />
            <div style={{ fontWeight: 600, fontSize: 14 }}>เลือก SO ที่จะจัดส่ง</div>
            <span style={{ fontSize: 12, color: "var(--dim)" }}>
              เลือกแล้ว {pickedRows.length}/{ranked.length} · {pickedVolM3.toFixed(2)} m³
            </span>
            <div
              style={{
                display: "inline-flex",
                background: "var(--bg)",
                border: "1px solid var(--line)",
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              {[
                ["list", "รายการ"],
                ["map", "แผนที่"],
              ].map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setViewMode(k)}
                  style={{
                    padding: "4px 10px",
                    border: "none",
                    background: viewMode === k ? "var(--blue)" : "transparent",
                    color: viewMode === k ? "#fff" : "var(--dim)",
                    cursor: "pointer",
                    fontSize: 12,
                    fontFamily: "inherit",
                    fontWeight: viewMode === k ? 600 : 400,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {viewMode === "list" && (
              <input
                value={zoneFilter}
                onChange={(e) => setZoneFilter(e.target.value)}
                placeholder="ค้นหาลูกค้า/เลข SO/เขต/พื้นที่..."
                style={{ ...IB, flex: 1, padding: "5px 10px", fontSize: 12 }}
              />
            )}
            {picked.size > 0 && (
              <button
                onClick={clearAll}
                style={{
                  padding: "4px 10px",
                  borderRadius: 5,
                  border: "1px solid var(--line)",
                  background: "var(--hover)",
                  color: "var(--dim)",
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "inherit",
                }}
              >
                ล้างที่เลือก
              </button>
            )}
          </div>

          {viewMode === "map" ? (
            <DeliveryMap rows={ranked} picked={picked} onToggle={toggle} />
          ) : ranked.length === 0 ? (
            <div
              style={{
                padding: "30px 0",
                textAlign: "center",
                color: "var(--faint)",
                fontSize: 13,
              }}
            >
              {pendingSOs.length === 0
                ? "ไม่มี SO รอจัดส่ง"
                : "ไม่มี SO ตรงกับตัวกรอง"}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {ranked.map((r) => {
                const isPicked = picked.has(r.so.soNum);
                return (
                  <div
                    key={r.so.soNum}
                    onClick={() => toggle(r.so.soNum)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr",
                      gap: 10,
                      alignItems: "center",
                      padding: "10px 12px",
                      border: "1px solid " + (isPicked ? "var(--blue)" : "var(--line)"),
                      background: isPicked ? "var(--blue-bg)" : "var(--bg2)",
                      borderRadius: 8,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isPicked}
                      onChange={() => toggle(r.so.soNum)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <span style={{ fontWeight: 600, color: "var(--blue)" }}>
                          {r.so.soNum}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            color: r.hasGeo ? "var(--green)" : "var(--faint)",
                            background: r.hasGeo
                              ? "rgba(52,199,89,0.12)"
                              : "var(--hover)",
                            padding: "1px 7px",
                            borderRadius: 99,
                          }}
                        >
                          {r.hasGeo ? "มีพิกัด" : "ไม่มีพิกัด"}
                        </span>
                        {r.distToPicked != null && !picked.has(r.so.soNum) && (
                          <span
                            style={{
                              fontSize: 12,
                              color:
                                r.distToPicked <= PROXIMITY_RADIUS_KM
                                  ? "var(--blue)"
                                  : "var(--dim)",
                              background:
                                r.distToPicked <= PROXIMITY_RADIUS_KM
                                  ? "var(--blue-bg)"
                                  : "var(--bg)",
                              padding: "1px 7px",
                              borderRadius: 99,
                              border:
                                r.distToPicked <= PROXIMITY_RADIUS_KM
                                  ? "1px solid var(--blue)"
                                  : "1px solid var(--line)",
                            }}
                            title="ระยะถึง SO ที่เลือกใกล้สุด"
                          >
                            {r.distToPicked < 1
                              ? `${(r.distToPicked * 1000).toFixed(0)} m`
                              : `${r.distToPicked.toFixed(1)} km`}{" "}
                            จากที่เลือก
                          </span>
                        )}
                        <span style={{ fontSize: 13, color: "var(--text)" }}>
                          {r.custName}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--dim)",
                          marginTop: 2,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {r.cust?.address || "—"}
                        {r.cust?.geoNote ? ` · ${r.cust.geoNote}` : ""}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--dim)",
                          marginTop: 4,
                          display: "flex",
                          gap: 14,
                          flexWrap: "wrap",
                        }}
                      >
                        <span>
                          <span style={{ color: "var(--dim)" }}>ปริมาตร </span>
                          <span style={{ color: "var(--text)" }}>
                            {r.volM3.toFixed(2)} m³
                          </span>
                        </span>
                        <span>
                          <span style={{ color: "var(--dim)" }}>ยอด </span>
                          <span style={{ color: "var(--text)" }}>
                            ฿{fmt(Math.round(r.revenue))}
                          </span>
                        </span>
                        {r.hasNoLayDown && (
                          <span
                            style={{
                              color: "var(--orange)",
                              fontSize: 11,
                              padding: "1px 7px",
                              borderRadius: 99,
                              background: "rgba(255,149,0,0.14)",
                              border: "1px solid var(--orange)",
                            }}
                            title="มีสินค้าห้ามนอน (ต้องวางตั้ง)"
                          >
                            ห้ามนอน
                          </span>
                        )}
                      </div>
                      {r.byCategory.length > 0 && (
                        <div
                          style={{
                            marginTop: 6,
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 4,
                          }}
                        >
                          {r.byCategory.map((g, gi) => (
                            <span
                              key={gi}
                              style={{
                                fontSize: 11,
                                padding: "2px 8px",
                                borderRadius: 5,
                                background: "var(--bg)",
                                border: "1px solid var(--line)",
                                color: "var(--text)",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              {g.hasNoLayDown && (
                                <span style={{ color: "var(--orange)", fontSize: 10, fontWeight: 700 }}>!</span>
                              )}
                              <span style={{ color: "var(--dim)" }}>
                                {g.catName}
                                {g.subName ? ` · ${g.subName}` : ""}
                              </span>
                              <strong style={{ color: "var(--blue)" }}>
                                ×{g.qty}
                              </strong>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT: summary */}
        <div
          style={{
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: 10,
            padding: isMobile ? 10 : 14,
            position: "sticky",
            top: isMobile ? 0 : 16,
            order: isMobile ? -1 : 0,
            zIndex: isMobile ? 5 : "auto",
          }}
        >
          {isMobile ? (
            <button
              onClick={() => setSummaryOpen((o) => !o)}
              style={{
                display: "flex",
                width: "100%",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                background: "transparent",
                border: "none",
                padding: 0,
                marginBottom: summaryOpen ? 10 : 0,
                color: "var(--text)",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>สรุป & จัดส่ง</span>
                <span style={{ fontSize: 13, color: "var(--green)", fontWeight: 700 }}>
                  ฿{fmt(Math.round(pickedRevenue))}
                </span>
                <span style={{ fontSize: 12, color: overCapacity ? "var(--red)" : "var(--dim)" }}>
                  {pickedVolM3.toFixed(2)}/{truckCapM3} m³
                </span>
                <span style={{ fontSize: 12, color: "var(--dim)" }}>
                  {pickedRows.length}/{ranked.length} SO
                </span>
              </div>
              <span style={{ fontSize: 14, color: "var(--dim)", transform: summaryOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }}>
                ▾
              </span>
            </button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <StepBadge n={3} />
              <span style={{ fontWeight: 600, fontSize: 14 }}>
                สรุป & จัดส่ง — {truck?.name || "—"}
              </span>
            </div>
          )}
          {(!isMobile || summaryOpen) && (<>

          {/* Volume gauge */}
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                marginBottom: 4,
              }}
            >
              <span style={{ color: "var(--dim)" }}>ปริมาตร</span>
              <span
                style={{
                  fontWeight: 600,
                  color: overCapacity ? "var(--red)" : "var(--text)",
                }}
              >
                {pickedVolM3.toFixed(2)} / {truckCapM3} m³
              </span>
            </div>
            <div
              style={{
                height: 10,
                background: "var(--bg)",
                borderRadius: 6,
                overflow: "hidden",
                border: "1px solid var(--line)",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${utilPct}%`,
                  background: overCapacity
                    ? "var(--red)"
                    : utilPct >= 70
                    ? "var(--green)"
                    : "var(--blue)",
                  transition: "width .2s",
                }}
              />
            </div>
            {overCapacity && (
              <div style={{ fontSize: 11, color: "var(--red)", marginTop: 4 }}>
                เกินกำลังบรรทุก {(pickedVolM3 - truckCapM3).toFixed(2)} m³
              </div>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: "var(--dim)" }}>ยอดขายรวม</div>
              <div
                style={{ fontSize: 18, fontWeight: 700, color: "var(--green)" }}
              >
                ฿{fmt(Math.round(pickedRevenue))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--dim)" }}>ปลายทาง</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {pickedCustomers.length}
              </div>
            </div>
          </div>

          {pickedCustomers.length > 0 && (
            <div
              style={{
                background: "var(--bg)",
                border: "1px solid var(--line)",
                borderRadius: 6,
                padding: "8px 10px",
                marginBottom: 10,
                maxHeight: 120,
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "var(--dim)",
                  marginBottom: 4,
                  fontWeight: 500,
                }}
              >
                รายชื่อปลายทาง
              </div>
              {pickedCustomers.map((n, i) => (
                <div key={i} style={{ fontSize: 12, marginTop: 2 }}>
                  {i + 1}. {n}
                </div>
              ))}
            </div>
          )}

          {pickedByCategory.length > 0 && (
            <div
              style={{
                background: "var(--bg)",
                border: "1px solid var(--line)",
                borderRadius: 6,
                padding: "8px 10px",
                marginBottom: 12,
                maxHeight: 160,
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "var(--dim)",
                  marginBottom: 6,
                  fontWeight: 500,
                }}
              >
                หมวดสินค้าที่ต้องบรรทุก (รวมทุก SO)
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 4,
                }}
              >
                {pickedByCategory.map((g, gi) => (
                  <span
                    key={gi}
                    style={{
                      fontSize: 12,
                      padding: "3px 9px",
                      borderRadius: 5,
                      background: "var(--bg2)",
                      border: "1px solid var(--line)",
                      color: "var(--text)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    {g.hasNoLayDown && (
                      <span style={{ color: "var(--orange)", fontSize: 10, fontWeight: 700 }}>!</span>
                    )}
                    <span style={{ color: "var(--dim)" }}>
                      {g.catName}
                      {g.subName ? ` · ${g.subName}` : ""}
                    </span>
                    <strong style={{ color: "var(--blue)" }}>
                      ×{g.qty}
                    </strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          </>)}

          <button
            onClick={() => oM("pickList")}
            disabled={pickedRows.length === 0}
            style={{
              width: "100%",
              padding: "10px 16px",
              borderRadius: 8,
              border: "none",
              background:
                pickedRows.length === 0 ? "var(--hover2)" : "var(--blue)",
              color: pickedRows.length === 0 ? "var(--dim)" : "#fff",
              cursor: pickedRows.length === 0 ? "not-allowed" : "pointer",
              fontWeight: 600,
              fontSize: 14,
              fontFamily: "inherit",
              marginBottom: 8,
            }}
          >
            พิมพ์ใบจัดของ
          </button>
          {ed && (
            <button
              onClick={() => {
                setDriverNote("");
                oM("confirmRun");
              }}
              disabled={pickedRows.length === 0}
              style={{
                width: "100%",
                padding: "10px 16px",
                borderRadius: 8,
                border: "1px solid",
                borderColor:
                  pickedRows.length === 0 ? "var(--line)" : "var(--green)",
                background:
                  pickedRows.length === 0
                    ? "var(--hover2)"
                    : "rgba(52,199,89,0.12)",
                color: pickedRows.length === 0 ? "var(--dim)" : "var(--green)",
                cursor: pickedRows.length === 0 ? "not-allowed" : "pointer",
                fontWeight: 600,
                fontSize: 14,
                fontFamily: "inherit",
              }}
            >
              ✓ บันทึกรอบจัดส่ง
            </button>
          )}
        </div>
      </div>

      {/* Modals */}
      {modal === "pickList" && (
        <Modal title={`ใบจัดของ — ${toBE(date)} (${truck?.name || "—"})`} onClose={cM} wide>
          <div
            style={{
              display: "flex",
              gap: 14,
              marginBottom: 12,
              fontSize: 13,
              color: "var(--dim)",
            }}
          >
            <span>
              รวม{" "}
              <strong style={{ color: "var(--text)" }}>
                {pickList.reduce((s, e) => s + e.totalQty, 0)} ชิ้น
              </strong>
            </span>
            <span>{pickList.length} รายการ</span>
            <span>{pickedRows.length} SO</span>
          </div>

          {/* Format switcher */}
          <div style={{ display: "flex", gap: 0, marginBottom: 10, borderRadius: 7, overflow: "hidden", border: "1px solid var(--line)", width: "fit-content" }}>
            {[
              ["a4", "A4"],
              ["80mm", '80mm (3")'],
            ].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setPreviewFormat(k)}
                style={{
                  padding: "6px 14px",
                  border: "none",
                  background: previewFormat === k ? "var(--blue)" : "var(--bg2)",
                  color: previewFormat === k ? "#fff" : "var(--dim)",
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "inherit",
                  fontWeight: previewFormat === k ? 600 : 400,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {previewFormat === "80mm" ? (
            <div
              style={{
                border: "1px solid var(--line)",
                borderRadius: 8,
                background: "var(--hover)",
                padding: 12,
                marginBottom: 12,
                display: "flex",
                justifyContent: "center",
              }}
            >
              <iframe
                title="80mm preview"
                srcDoc={thermalHtml}
                style={{
                  width: 302,
                  height: 600,
                  border: "1px solid var(--line)",
                  background: "#fff",
                  borderRadius: 4,
                }}
              />
            </div>
          ) : (
          <div
            style={{
              border: "1px solid var(--line)",
              borderRadius: 8,
              overflow: "hidden",
              marginBottom: 12,
            }}
          >
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr
                  style={{
                    background: "var(--bg)",
                    borderBottom: "1px solid var(--line)",
                  }}
                >
                  {["#", "ยี่ห้อ", "หมวด", "สินค้า", "จำนวน", "ลูกค้า"].map((h, i) => (
                    <th
                      key={i}
                      style={{
                        padding: "8px 12px",
                        textAlign: i === 4 ? "right" : "left",
                        fontWeight: 500,
                        color: "var(--dim)",
                        fontSize: 12,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pickList.map((e, i) => (
                  <tr key={e.productId} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "8px 12px", color: "var(--dim)" }}>
                      {i + 1}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        fontSize: 12,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {e.brand || "—"}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        fontSize: 12,
                        color: "var(--dim)",
                      }}
                    >
                      {e.catName}
                      {e.subName ? ` · ${e.subName}` : ""}
                    </td>
                    <td style={{ padding: "8px 12px", fontWeight: 500 }}>
                      {e.name}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        textAlign: "right",
                        fontWeight: 700,
                        fontSize: 15,
                      }}
                    >
                      {e.totalQty}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        fontSize: 11,
                        color: "var(--dim)",
                      }}
                      title={(e.customers || []).join(", ")}
                    >
                      {(e.customers || []).join(", ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => previewFormat === "80mm" ? printThermal() : window.print()}
              style={{
                padding: "8px 18px",
                borderRadius: 7,
                border: "1px solid var(--blue)",
                background: "var(--blue)",
                color: "#fff",
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: 600,
              }}
            >
              พิมพ์ {previewFormat === "80mm" ? '80mm' : 'A4'}
            </button>
            <button
              onClick={cM}
              style={{
                padding: "8px 16px",
                borderRadius: 7,
                border: "none",
                background: "var(--blue)",
                color: "#fff",
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: 500,
              }}
            >
              ปิด
            </button>
          </div>
        </Modal>
      )}

      {modal === "manageTrucks" && (
        <Modal title="จัดการรถบรรทุก" onClose={cM}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {(trucks || []).map((t) => (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  background: t.isActive === false ? "var(--hover)" : "var(--bg2)",
                  border: "1px solid var(--line)",
                  borderRadius: 7,
                  opacity: t.isActive === false ? 0.6 : 1,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>
                    {t.name}{" "}
                    {t.isActive === false && (
                      <span style={{ fontSize: 11, color: "var(--dim)" }}>
                        (ปิดใช้)
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--dim)" }}>
                    ความจุ {t.capacityM3} m³
                    {t.widthCm && t.lengthCm && t.heightCm
                      ? ` · ${t.widthCm}×${t.lengthCm}×${t.heightCm} cm`
                      : ""}
                    {t.driverName ? ` · พนักงานขับรถ ${t.driverName}` : ""}
                    {t.note ? ` · ${t.note}` : ""}
                  </div>
                </div>
                {ed && (
                  <button
                    onClick={() => startEditTruck(t)}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 5,
                      border: "1px solid var(--blue)",
                      background: "var(--blue-bg)",
                      color: "var(--blue)",
                      cursor: "pointer",
                      fontSize: 12,
                      fontFamily: "inherit",
                    }}
                  >
                    แก้ไข
                  </button>
                )}
                {cd && (
                  <button
                    onClick={() => delTruck(t.id)}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 5,
                      border: "1px solid var(--red)",
                      background: "rgba(255,59,48,0.12)",
                      color: "var(--red)",
                      cursor: "pointer",
                      fontSize: 12,
                      fontFamily: "inherit",
                    }}
                  >
                    ลบ
                  </button>
                )}
              </div>
            ))}
          </div>
          {ed && (
            <button
              onClick={startNewTruck}
              style={{
                width: "100%",
                padding: "8px 14px",
                borderRadius: 7,
                border: "1px dashed var(--blue)",
                background: "var(--blue-bg)",
                color: "var(--blue)",
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "inherit",
              }}
            >
              + เพิ่มรถ
            </button>
          )}
        </Modal>
      )}

      {modal === "editTruck" && renderTruckModal()}

      {modal === "confirmRun" && (
        <Modal title="บันทึกรอบจัดส่ง" onClose={cM}>
          <div
            style={{
              background: "var(--bg)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 12,
              fontSize: 13,
            }}
          >
            <div style={{ marginBottom: 4 }}>
              <span style={{ color: "var(--dim)" }}>รถ:</span>{" "}
              <strong>{truck?.name}</strong>
              {truck?.driverName ? (
                <>
                  {" "}
                  <span style={{ color: "var(--dim)" }}>· พนักงานขับรถ:</span>{" "}
                  <strong>{truck.driverName}</strong>
                </>
              ) : (
                <span style={{ fontSize: 11, color: "var(--orange)", marginLeft: 6 }}>
                  ยังไม่ตั้งพนักงานขับรถ (แก้ใน "จัดการรถ")
                </span>
              )}
            </div>
            <div style={{ marginBottom: 4 }}>
              <span style={{ color: "var(--dim)" }}>วันที่:</span>{" "}
              <strong>{toBE(date)}</strong>
            </div>
            <div style={{ marginBottom: 4 }}>
              <span style={{ color: "var(--dim)" }}>SO:</span>{" "}
              <strong>{pickedRows.length} ใบ</strong>{" "}
              <span style={{ color: "var(--dim)" }}>
                · {pickedCustomers.length} ปลายทาง
              </span>
            </div>
            <div style={{ marginBottom: 4 }}>
              <span style={{ color: "var(--dim)" }}>ยอดรวม:</span>{" "}
              <strong style={{ color: "var(--green)" }}>
                ฿{fmt(Math.round(pickedRevenue))}
              </strong>{" "}
              <span style={{ color: "var(--dim)" }}>
                · {pickedVolM3.toFixed(2)} m³ ({utilPct.toFixed(0)}%)
              </span>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--dim)" }}>
                พนักงานส่งของ ({runHelperIds.length}/{MAX_HELPERS_PER_RUN})
              </span>
              {ed && (
                <button
                  onClick={() => oM("manageHelpers")}
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 4,
                    border: "1px solid var(--line)",
                    background: "var(--bg2)",
                    color: "var(--dim)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  จัดการพนักงาน
                </button>
              )}
            </div>
            {activeHelpers.length === 0 ? (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--faint)",
                  padding: "10px 12px",
                  background: "var(--bg)",
                  borderRadius: 6,
                  border: "1px dashed var(--line)",
                }}
              >
                ยังไม่มีพนักงานส่งของ — กด "จัดการพนักงาน" เพื่อเพิ่ม
              </div>
            ) : (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {activeHelpers.map((h) => {
                  const isPicked = runHelperIds.includes(h.id);
                  const atMax =
                    !isPicked && runHelperIds.length >= MAX_HELPERS_PER_RUN;
                  return (
                    <button
                      key={h.id}
                      onClick={() => toggleRunHelper(h.id)}
                      disabled={atMax}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 99,
                        border: "1px solid",
                        borderColor: isPicked ? "var(--blue)" : "var(--line)",
                        background: isPicked
                          ? "var(--blue)"
                          : atMax
                          ? "var(--hover2)"
                          : "var(--bg2)",
                        color: isPicked
                          ? "#fff"
                          : atMax
                          ? "var(--faint)"
                          : "var(--text)",
                        cursor: atMax ? "not-allowed" : "pointer",
                        fontSize: 12,
                        fontFamily: "inherit",
                        fontWeight: isPicked ? 600 : 400,
                      }}
                    >
                      {isPicked ? "✓ " : ""}
                      {h.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <Field label="หมายเหตุ (ไม่บังคับ)">
            <input
              value={driverNote}
              onChange={(e) => setDriverNote(e.target.value)}
              style={IB}
              placeholder="เช่น ออก 8:00 / แวะปั๊มก่อน"
            />
          </Field>
          <div
            style={{
              background: "rgba(255,149,0,0.12)",
              border: "1px solid var(--orange)",
              borderRadius: 6,
              padding: "8px 12px",
              fontSize: 12,
              color: "var(--orange)",
              marginTop: 12,
            }}
          >
            เมื่อบันทึก SO ทั้ง {pickedRows.length} ใบจะเปลี่ยนสถานะเป็น
            "เตรียมส่ง" (ของขึ้นรถแล้ว) · ยังยกเลิกได้จากหน้า "ประวัติรอบ"
            · ยืนยันส่งเสร็จหลังพนักงานขับรถกลับมา
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              marginTop: 16,
            }}
          >
            <button
              onClick={cM}
              style={{
                padding: "6px 13px",
                borderRadius: 7,
                border: "1px solid var(--line)",
                background: "var(--bg2)",
                color: "var(--text)",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 13,
              }}
            >
              ยกเลิก
            </button>
            <button
              onClick={commitRun}
              style={{
                padding: "6px 13px",
                borderRadius: 7,
                border: "none",
                background: "var(--green)",
                color: "#fff",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              ✓ ยืนยันบันทึก
            </button>
          </div>
        </Modal>
      )}

      {modal === "runHistory" && (
        <Modal title="ประวัติรอบจัดส่ง" onClose={cM} wide>
          {(deliveryRuns || []).length === 0 ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "var(--faint)", fontSize: 13 }}>
              ยังไม่มีประวัติรอบจัดส่ง
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 600, overflowY: "auto" }}>
              {(deliveryRuns || [])
                .slice()
                .sort((a, b) => b.createdAt - a.createdAt)
                .map((r) => {
                  // Legacy runs (created before status field) → treat as completed.
                  const status = r.status || "completed";
                  // Resolve per-SO customer names at render time so legacy runs
                  // whose stored customerNames was deduped still display each SO's
                  // customer correctly.
                  const resolvedNames = (r.soNums || []).map((sn, i) => {
                    const cached = (r.customerNames || [])[i];
                    if (cached) return cached;
                    const so = (sales || []).find((s) => s.soNum === sn);
                    if (!so) return "";
                    const cust = (contacts || []).find((c) => c.id === so.customerId);
                    return cust ? cN(cust) : "";
                  });
                  return (
                    <RunCard
                      key={r.id}
                      run={{ ...r, customerNames: resolvedNames }}
                      status={status}
                      onConfirm={(deliveredSoNums) => confirmRunDelivery(r.id, deliveredSoNums)}
                      onCancel={() => cancelRun(r.id)}
                      onDelete={() => deleteRun(r.id)}
                      ed={ed}
                      cd={cd}
                    />
                  );
                })}
            </div>
          )}
        </Modal>
      )}

      {modal === "manageHelpers" && (
        <Modal title={`จัดการพนักงานส่งของ (${(deliveryHelpers||[]).length}/${MAX_HELPER_POOL})`} onClose={cM}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              marginBottom: 12,
            }}
          >
            {(deliveryHelpers || []).length === 0 && (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--faint)",
                  textAlign: "center",
                  padding: "16px 0",
                }}
              >
                ยังไม่มีพนักงาน
              </div>
            )}
            {(deliveryHelpers || []).map((h) => (
              <div
                key={h.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  background:
                    h.isActive === false ? "var(--hover)" : "var(--bg2)",
                  border: "1px solid var(--line)",
                  borderRadius: 7,
                  opacity: h.isActive === false ? 0.6 : 1,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {h.name}
                    {h.isActive === false && (
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--dim)",
                          marginLeft: 6,
                        }}
                      >
                        (ปิดใช้)
                      </span>
                    )}
                  </div>
                  {h.phone && (
                    <div style={{ fontSize: 11, color: "var(--dim)" }}>
                      ☎ {h.phone}
                    </div>
                  )}
                </div>
                {ed && (
                  <button
                    onClick={() => startEditHelper(h)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 5,
                      border: "1px solid var(--blue)",
                      background: "var(--blue-bg)",
                      color: "var(--blue)",
                      cursor: "pointer",
                      fontSize: 12,
                      fontFamily: "inherit",
                    }}
                  >
                    แก้ไข
                  </button>
                )}
                {cd && (
                  <button
                    onClick={() => delHelper(h.id)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 5,
                      border: "1px solid var(--red)",
                      background: "rgba(255,59,48,0.12)",
                      color: "var(--red)",
                      cursor: "pointer",
                      fontSize: 12,
                      fontFamily: "inherit",
                    }}
                  >
                    ลบ
                  </button>
                )}
              </div>
            ))}
          </div>
          {ed && (deliveryHelpers || []).length < MAX_HELPER_POOL && (
            <button
              onClick={startNewHelper}
              style={{
                width: "100%",
                padding: "8px 14px",
                borderRadius: 7,
                border: "1px dashed var(--blue)",
                background: "var(--blue-bg)",
                color: "var(--blue)",
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "inherit",
              }}
            >
              + เพิ่มพนักงาน
            </button>
          )}
          {(deliveryHelpers || []).length >= MAX_HELPER_POOL && (
            <div
              style={{
                fontSize: 11,
                color: "var(--faint)",
                textAlign: "center",
                marginTop: 6,
              }}
            >
              ถึงโควต้าสูงสุด {MAX_HELPER_POOL} คนแล้ว
            </div>
          )}
        </Modal>
      )}

      {modal === "editHelper" && (
        <Modal
          title={helperForm.id != null ? "แก้ไขพนักงาน" : "เพิ่มพนักงาน"}
          onClose={cM}
        >
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <Field label="ชื่อ">
              <input
                value={helperForm.name}
                onChange={(e) =>
                  setHelperForm((f) => ({ ...f, name: e.target.value }))
                }
                style={IB}
                placeholder="เช่น สมศักดิ์"
              />
            </Field>
            <Field label="เบอร์โทร (ไม่บังคับ)">
              <input
                value={helperForm.phone || ""}
                onChange={(e) =>
                  setHelperForm((f) => ({ ...f, phone: e.target.value }))
                }
                style={IB}
                placeholder="081-..."
              />
            </Field>
            <label
              style={{
                gridColumn: "1/-1",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={helperForm.isActive !== false}
                onChange={(e) =>
                  setHelperForm((f) => ({ ...f, isActive: e.target.checked }))
                }
              />
              ใช้งานอยู่
            </label>
          </div>
          <MBtns onCancel={cM} onSave={saveHelper} />
        </Modal>
      )}

      {warnMsg && (
        <Modal title="แจ้งเตือน" onClose={() => setWarnMsg(null)}>
          <div
            style={{
              background: "rgba(255,149,0,0.12)",
              border: "1px solid var(--orange)",
              borderRadius: 8,
              padding: "12px 16px",
              marginBottom: 16,
              fontSize: 14,
              color: "var(--orange)",
              fontWeight: 500,
            }}
          >
            {warnMsg}
          </div>
          <button
            onClick={() => setWarnMsg(null)}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 8,
              border: "none",
              background: "var(--blue)",
              color: "#fff",
              fontWeight: 500,
              fontSize: 14,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ตกลง
          </button>
        </Modal>
      )}
    </div>
  );
}
