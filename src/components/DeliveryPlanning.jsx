import { useState, useMemo } from "react";
import { IB } from "../utils/constants.js";
import {
  fmt,
  todayStr,
  toBE,
  scoreSO,
  soVolumeM3,
  soRevenue,
  consolidatePickList,
  soItemsByCategory,
  MAX_HELPERS_PER_RUN,
  MAX_HELPER_POOL,
} from "../utils/helpers.js";
import { Modal, MBtns } from "./ui/Modal.jsx";
import Field from "./ui/Field.jsx";
import CustomSelect from "./ui/CustomSelect.jsx";
import ThaiDateInput from "./ui/ThaiDateInput.jsx";
import StatCard from "./ui/StatCard.jsx";
import DeliveryMap from "./DeliveryMap.jsx";

// Delivery Planning — pick SOs from `pending_delivery` pool that balance
// proximity (cluster of nearby customers), capacity (close to truck full),
// and revenue (worth the trip). Output: consolidated pick list (model × qty).
// Modal hub stays here; sub-views are inline.

const SCORE_COLORS = (s) =>
  s >= 70 ? "var(--green)" : s >= 40 ? "var(--orange)" : "var(--red)";
const SCORE_BG = (s) =>
  s >= 70
    ? "rgba(52,199,89,0.12)"
    : s >= 40
    ? "rgba(255,149,0,0.14)"
    : "rgba(255,59,48,0.12)";

export default function DeliveryPlanningPage({ sh }) {
  const {
    cN,
    pN,
    contacts,
    sales,
    setSales,
    products,
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
      customerNames: pickedCustomers,
      revenue: pickedRevenue,
      volumeM3: pickedVolM3,
      driverNote: driverNote.trim(),
      createdAt: Date.now(),
      createdBy: cu?.username || "",
    };
    setDeliveryRuns((prev) => [run, ...(prev || [])]);
    // Move picked SOs from pending_delivery → completed
    setSales((prev) =>
      (prev || []).map((s) =>
        pickedSoNums.includes(s.soNum) ? { ...s, status: "completed" } : s
      )
    );
    setPicked(new Set());
    setDriverNote("");
    setRunHelperIds([]);
    cM();
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

  const pendingSOs = useMemo(
    () => (sales || []).filter((s) => s.status === "pending_delivery"),
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
      };
    });
    const filtered = zoneFilter
      ? rows.filter((r) => {
          const blob = (r.cust?.address || "") + " " + (r.cust?.geoNote || "");
          return blob.toLowerCase().includes(zoneFilter.toLowerCase());
        })
      : rows;
    return filtered.sort((a, b) => b.score - a.score);
  }, [pendingSOs, contacts, products, truckCapM3, zoneFilter, cN]);

  const pickedRows = useMemo(
    () => ranked.filter((r) => picked.has(r.so.soNum)),
    [ranked, picked]
  );
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

  const pickList = useMemo(
    () =>
      consolidatePickList(
        pickedRows.map((r) => r.so),
        products
      ),
    [pickedRows, products]
  );

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

  const csvExport = () => {
    const rows = [
      ["รหัส", "สินค้า", "จำนวน", "SO ต้นทาง"],
      ...pickList.map((e) => [
        String(e.productId),
        e.name,
        String(e.totalQty),
        e.sources.join(", "),
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${(c || "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pick-list-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
            <Field label="คนขับประจำรถ">
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ margin: 0 }}>วางแผนจัดส่ง</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "var(--dim)" }}>รถ:</span>
          <div style={{ minWidth: 180 }}>
            <CustomSelect
              value={String(truckId ?? "")}
              onChange={(v) => setTruckId(+v)}
              options={activeTrucks.map((t) => ({
                value: String(t.id),
                label: `${t.name} — ${t.capacityM3} m³`,
              }))}
            />
          </div>
          <span style={{ fontSize: 12, color: "var(--dim)", marginLeft: 8 }}>
            วันที่:
          </span>
          <div style={{ width: 140 }}>
            <ThaiDateInput value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          {ed && (
            <button
              onClick={() => oM("manageTrucks")}
              style={{
                padding: "6px 14px",
                borderRadius: 7,
                border: "1px solid var(--line)",
                background: "var(--bg2)",
                color: "var(--text)",
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "inherit",
              }}
            >
              จัดการรถ
            </button>
          )}
          <button
            onClick={() => oM("runHistory")}
            style={{
              padding: "6px 14px",
              borderRadius: 7,
              border: "1px solid var(--line)",
              background: "var(--bg2)",
              color: "var(--text)",
              cursor: "pointer",
              fontSize: 13,
              fontFamily: "inherit",
            }}
          >
            ประวัติรอบ ({(deliveryRuns || []).length})
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <StatCard label="SO รอจัดส่ง" value={String(pendingSOs.length)} />
        <StatCard
          label="เลือกแล้ว"
          value={`${pickedRows.length} / ${ranked.length}`}
          color="var(--blue)"
        />
        <StatCard
          label="ปริมาตรใช้"
          value={`${pickedVolM3.toFixed(2)} / ${truckCapM3} m³`}
          color={overCapacity ? "var(--red)" : "var(--green)"}
          sub={`${utilPct.toFixed(0)}% ของรถ`}
        />
        <StatCard
          label="ยอดขายรวม"
          value={`฿${fmt(Math.round(pickedRevenue))}`}
          color="var(--green)"
        />
      </div>

      {/* Body: ranked SO list + summary */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,2fr) minmax(280px,1fr)",
          gap: 16,
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
            <div style={{ fontWeight: 600, fontSize: 14 }}>SO รอจัดส่ง</div>
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
                placeholder="ค้นหาเขต/พื้นที่/จุดส่ง..."
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
                      gridTemplateColumns: "auto 1fr auto",
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
                    <div
                      style={{
                        textAlign: "center",
                        padding: "6px 10px",
                        borderRadius: 8,
                        background: SCORE_BG(r.score),
                        color: SCORE_COLORS(r.score),
                        fontWeight: 700,
                        minWidth: 50,
                      }}
                    >
                      <div style={{ fontSize: 18, lineHeight: 1 }}>{r.score}</div>
                      <div style={{ fontSize: 10, opacity: 0.7 }}>คะแนน</div>
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
            padding: 14,
            position: "sticky",
            top: 16,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>
            สรุปรอบจัดส่ง — {truck?.name || "—"}
          </div>

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
            สร้าง Pick List
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
        <Modal title={`Pick List — ${toBE(date)} (${truck?.name || "—"})`} onClose={cM} wide>
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
                  {["#", "สินค้า", "จำนวน", "SO ต้นทาง"].map((h, i) => (
                    <th
                      key={i}
                      style={{
                        padding: "8px 12px",
                        textAlign: i === 2 ? "right" : "left",
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
                    <td style={{ padding: "8px 12px", fontWeight: 500 }}>{e.name}</td>
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
                        fontFamily: "monospace",
                      }}
                    >
                      {e.sources.join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              onClick={() => window.print()}
              style={{
                padding: "8px 16px",
                borderRadius: 7,
                border: "1px solid var(--line)",
                background: "var(--bg2)",
                color: "var(--text)",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              พิมพ์
            </button>
            <button
              onClick={csvExport}
              style={{
                padding: "8px 16px",
                borderRadius: 7,
                border: "1px solid var(--line)",
                background: "var(--bg2)",
                color: "var(--text)",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              CSV
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
                    {t.driverName ? ` · คนขับ ${t.driverName}` : ""}
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
                  <span style={{ color: "var(--dim)" }}>· คนขับ:</span>{" "}
                  <strong>{truck.driverName}</strong>
                </>
              ) : (
                <span style={{ fontSize: 11, color: "var(--orange)", marginLeft: 6 }}>
                  ยังไม่ตั้งคนขับ (แก้ใน "จัดการรถ")
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
            "ส่งเสร็จ" และหายจากรายการรอจัดส่ง
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
            <div
              style={{
                padding: "40px 0",
                textAlign: "center",
                color: "var(--faint)",
                fontSize: 13,
              }}
            >
              ยังไม่มีประวัติรอบจัดส่ง
            </div>
          ) : (
            <div
              style={{
                border: "1px solid var(--line)",
                borderRadius: 8,
                overflow: "hidden",
                maxHeight: 500,
                overflowY: "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  fontSize: 13,
                  borderCollapse: "collapse",
                }}
              >
                <thead style={{ position: "sticky", top: 0 }}>
                  <tr
                    style={{
                      background: "var(--bg)",
                      borderBottom: "1px solid var(--line)",
                    }}
                  >
                    {["วันที่", "รถ", "ผู้ส่ง", "SO", "ปลายทาง", "ปริมาตร", "ยอดรวม", "หมายเหตุ"].map(
                      (h, i) => (
                        <th
                          key={i}
                          style={{
                            padding: "8px 12px",
                            textAlign: i >= 3 && i <= 6 ? "right" : "left",
                            fontWeight: 500,
                            color: "var(--dim)",
                            fontSize: 12,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {(deliveryRuns || [])
                    .slice()
                    .sort((a, b) => b.createdAt - a.createdAt)
                    .map((r) => (
                      <tr
                        key={r.id}
                        style={{ borderBottom: "1px solid var(--line)" }}
                      >
                        <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                          {toBE(r.date)}
                        </td>
                        <td style={{ padding: "8px 12px", fontWeight: 500 }}>
                          {r.truckName}
                        </td>
                        <td
                          style={{
                            padding: "8px 12px",
                            fontSize: 12,
                            color: "var(--text)",
                            minWidth: 140,
                          }}
                        >
                          {r.driverName ? (
                            <>
                              <span style={{ color: "var(--dim)", fontSize: 11 }}>
                                คนขับ:{" "}
                              </span>
                              {r.driverName}
                            </>
                          ) : (
                            <span style={{ color: "var(--faint)" }}>—</span>
                          )}
                          {(r.helperNames || []).length > 0 && (
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--dim)",
                                marginTop: 2,
                              }}
                            >
                              <span style={{ color: "var(--faint)" }}>พนง:</span>{" "}
                              {r.helperNames.join(", ")}
                            </div>
                          )}
                        </td>
                        <td
                          style={{
                            padding: "8px 12px",
                            textAlign: "right",
                            fontWeight: 600,
                          }}
                          title={(r.soNums || []).join(", ")}
                        >
                          {(r.soNums || []).length}
                        </td>
                        <td
                          style={{
                            padding: "8px 12px",
                            textAlign: "right",
                            color: "var(--dim)",
                          }}
                          title={(r.customerNames || []).join(", ")}
                        >
                          {(r.customerNames || []).length}
                        </td>
                        <td
                          style={{
                            padding: "8px 12px",
                            textAlign: "right",
                            color: "var(--dim)",
                          }}
                        >
                          {(r.volumeM3 || 0).toFixed(2)} m³
                        </td>
                        <td
                          style={{
                            padding: "8px 12px",
                            textAlign: "right",
                            fontWeight: 600,
                            color: "var(--green)",
                          }}
                        >
                          ฿{fmt(Math.round(r.revenue || 0))}
                        </td>
                        <td
                          style={{
                            padding: "8px 12px",
                            fontSize: 11,
                            color: "var(--dim)",
                            maxWidth: 180,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={r.driverNote || ""}
                        >
                          {r.driverNote || "—"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
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
