import { useEffect, useMemo, useRef, useCallback } from "react";
import { buildWarehouseData, claudeDesignZones } from "../utils/warehouse3d.js";
import { createWarehouseScene } from "../lib/warehouse3d/scene.js";

// 3D warehouse tab: renders real products/zones at scale, lets editors arrange boxes
// and capture per-zone CCTV camera angles (persisted to warehouse_layout), and exports
// the full { WAREHOUSE, ZONES, PRODUCTS } DATA as JSON.
export default function Warehouse3DPage({ sh }) {
  const { products, zones, setZones, warehouseLayout, setWarehouseLayout, canE } = sh;
  const canEdit = !!(canE && canE("warehouse_3d"));

  const containerRef = useRef(null);

  // Rebuild the scene only when the catalog / zone membership / warehouse dims change —
  // not when per-zone camera or layout presets are saved.
  const rebuildKey = useMemo(() => JSON.stringify({
    p: (products || []).map((p) => [p.id, p.stock, p.widthCm, p.lengthCm, p.heightCm, p.sizeClass, p.noLayDown, p.cubicM, p.nameT, p.name, p.code, p.unit, p.brand]),
    z: (zones || []).map((z) => [z.id, z.name, z.note, z.productIds]),
    w: (warehouseLayout && warehouseLayout.warehouse) || null,
  }), [products, zones, warehouseLayout]);

  // Persist with functional updates (no stale closure, stable identity).
  const onSaveLayout = useCallback((layoutByZone) => {
    setWarehouseLayout((prev) => {
      const next = { ...(prev || {}) };
      const zonesL = { ...(next.zones || {}) };
      for (const zid of Object.keys(layoutByZone)) {
        zonesL[zid] = { ...(zonesL[zid] || {}), layout: layoutByZone[zid] };
      }
      next.zones = zonesL;
      return next;
    });
  }, [setWarehouseLayout]);

  const onSaveCamera = useCallback((zoneId, camera) => {
    setWarehouseLayout((prev) => {
      const next = { ...(prev || {}) };
      const zonesL = { ...(next.zones || {}) };
      zonesL[zoneId] = { ...(zonesL[zoneId] || {}), camera };
      next.zones = zonesL;
      return next;
    });
  }, [setWarehouseLayout]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // products/zones/warehouseLayout are intentionally read here but excluded from deps:
    // rebuildKey already changes exactly when a rebuild is warranted (catalog/zones/dims),
    // so camera/layout saves update state + persist without forcing a jarring rebuild.
    const data = buildWarehouseData(products, zones, warehouseLayout);
    const scene = createWarehouseScene(el, data, {
      canEdit,
      onSaveLayout: canEdit ? onSaveLayout : null,
      onSaveCamera: canEdit ? onSaveCamera : null,
    });
    return () => scene.dispose();
    // rebuildKey/canEdit fully capture when a rebuild is needed; callbacks are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rebuildKey, canEdit]);

  const exportJSON = () => {
    const data = buildWarehouseData(products, zones, warehouseLayout);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "warehouse-3d-data.json" });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const zoneCount = (zones || []).length;
  const isSeed = zoneCount === 0; // showing the Claude Design template, not real zones yet

  // Materialize the Claude Design layout (19 zones with origin/size/colour) into the app's
  // real zones data, so the sizes are stored in the zone records and editable in the Zones tab.
  const importDesignZones = () => {
    if (!isSeed) return;
    setZones(claudeDesignZones());
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>โกดัง 3D</div>
          <div style={{ fontSize: 12.5, color: "var(--dim)" }}>
            {isSeed
              ? "ตัวอย่างผังโซนจาก Claude Design (ยังไม่ใช่โซนจริง)" + (canEdit ? " · กด “นำเข้าผังเป็นโซนจริง” เพื่อบันทึกโซน+ขนาดลงข้อมูลจริง" : "")
              : `แสดงสินค้า/โซนจริงตามขนาด · ${zoneCount} โซน` + (canEdit ? " · กด ✋ จัดเรียง เพื่อลากกล่อง แล้วกด 💾 บันทึก · กด 💾 บันทึกมุมนี้ ที่การ์ดโซนเพื่อเก็บมุมกล้อง CCTV" : " · โหมดดูอย่างเดียว")}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {isSeed && canEdit && (
            <button onClick={importDesignZones} style={{ fontSize: 13, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--blue)", background: "var(--blue-bg)", color: "var(--blue)", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
              ↧ นำเข้าผังเป็นโซนจริง (19 โซน)
            </button>
          )}
          <button onClick={exportJSON} style={{ fontSize: 13, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg2)", color: "var(--text)", cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
            ⬇ ส่งออก JSON
          </button>
        </div>
      </div>
      <div ref={containerRef} style={{ position: "relative", width: "100%", height: "calc(100vh - 200px)", minHeight: 480, borderRadius: 12, overflow: "hidden", border: "1px solid var(--line)" }} />
    </div>
  );
}
