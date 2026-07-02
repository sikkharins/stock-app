import { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { buildWarehouseData, claudeDesignZones, clearZoneLayout, applyZoneLayout, mergeZoneEntry } from "../utils/warehouse3d.js";
import { createWarehouseScene } from "../lib/warehouse3d/scene.js";
import { getRelayUrl, cctvSnapshotUrl } from "../utils/cameraCapture.ts";

// 3D warehouse tab: renders real products/zones at scale, lets editors arrange boxes
// and capture per-zone CCTV camera angles (persisted to warehouse_layout), and exports
// the full { WAREHOUSE, ZONES, PRODUCTS } DATA as JSON.
export default function Warehouse3DPage({ sh }) {
  const { products, zones, setZones, warehouseLayout, setWarehouseLayout, saveNow, canE } = sh;
  const canEdit = !!(canE && canE("warehouse_3d"));

  const containerRef = useRef(null);
  const sceneApiRef = useRef(null);
  const [rebuildNonce, setRebuildNonce] = useState(0);
  // whRef ยังจำเป็น: สอง save ใน tick เดียวกันต้อง merge ต่อกัน (commitLayout อัปเดต ref ทันที)
  const whRef = useRef(warehouseLayout); whRef.current = warehouseLayout;
  const saveNowRef = useRef(saveNow); saveNowRef.current = saveNow;

  // Rebuild the scene only when the catalog / zone membership / warehouse dims change —
  // not when per-zone camera or layout presets are saved.
  const rebuildKey = useMemo(() => JSON.stringify({
    p: (products || []).map((p) => [p.id, p.stock, p.widthCm, p.lengthCm, p.heightCm, p.sizeClass, p.noLayDown, p.cubicM, p.nameT, p.name, p.code, p.unit, p.brand]),
    z: (zones || []).map((z) => [z.id, z.name, z.note, z.productIds, z.boxConfig, z.arrangeRot]),
    w: (warehouseLayout && warehouseLayout.warehouse) || null,
    // per-zone geometry: rebuild when origin/size changes (NOT on camera/layout saves)
    g: (warehouseLayout && warehouseLayout.zones)
      ? Object.entries(warehouseLayout.zones).map(([id, z]) => [id, z && z.origin, z && z.size, z && z.heightM])
      : null,
    n: rebuildNonce,
  }), [products, zones, warehouseLayout, rebuildNonce]);

  // Compute next from refs (latest), set state, and persist immediately via saveNow.
  // Refs are required because the scene caches these callbacks (it rebuilds only on
  // geometry/nonce, not on layout/camera saves), so a closure value would go stale.
  // commitLayout updates whRef.current SYNCHRONOUSLY: a second save fired in the same
  // tick (before React re-renders, e.g. geometry blur + camera save) must merge on top
  // of this save, not on the stale pre-render value — otherwise the first save is lost.
  const commitLayout = useCallback((next) => {
    whRef.current = next;
    setWarehouseLayout(next);
    saveNowRef.current?.("warehouse_layout", next);
  }, [setWarehouseLayout]);

  const onSaveLayout = useCallback((layoutByZone) => {
    commitLayout(applyZoneLayout(whRef.current, layoutByZone));
  }, [commitLayout]);

  const onClearLayout = useCallback((zoneId) => {
    commitLayout(clearZoneLayout(whRef.current, zoneId));
    setRebuildNonce((n) => n + 1);
  }, [commitLayout]);

  const onSaveCamera = useCallback((zoneId, camera) => {
    commitLayout(mergeZoneEntry(whRef.current, zoneId, { camera }));
  }, [commitLayout]);

  const onSaveZoneGeom = useCallback((zoneId, geom) => {
    const patch = { origin: geom.origin, size: geom.size };
    if (geom.heightM != null) patch.heightM = geom.heightM;
    commitLayout(mergeZoneEntry(whRef.current, zoneId, patch));
  }, [commitLayout]);

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
      onClearLayout: canEdit ? onClearLayout : null,
      onSaveCamera: canEdit ? onSaveCamera : null,
      onSaveZoneGeom: canEdit ? onSaveZoneGeom : null,
      // closure reads the latest relay URL on every click + cache-busts with Date.now()
      snapshotUrl: (token) => cctvSnapshotUrl(getRelayUrl(), token, Date.now()),
    });
    sceneApiRef.current = scene;
    return () => { sceneApiRef.current = null; scene.dispose(); };
    // rebuildKey/canEdit fully capture when a rebuild is needed; callbacks are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rebuildKey, canEdit]);

  // Push fresh callbacks into the live scene every render (scene reads them at call time
  // via setCallbacks) — callback ใหม่ในอนาคตใช้ closure ปกติได้เลย ไม่ต้องทำ ref-mirror
  useEffect(() => {
    sceneApiRef.current?.setCallbacks({
      onSaveLayout: canEdit ? onSaveLayout : null,
      onClearLayout: canEdit ? onClearLayout : null,
      onSaveCamera: canEdit ? onSaveCamera : null,
      onSaveZoneGeom: canEdit ? onSaveZoneGeom : null,
      snapshotUrl: (token) => cctvSnapshotUrl(getRelayUrl(), token, Date.now()),
    });
  });

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
