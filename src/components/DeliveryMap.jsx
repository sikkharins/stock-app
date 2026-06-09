import { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fmt, haversineKm } from "../utils/helpers.js";

// Order picked rows by greedy nearest-neighbor starting from the highest-revenue
// pick (proxy for "most important to drop first"). Produces a reasonable route
// without needing a real TSP solver.
function sequencePicks(rows) {
  const withGeo = rows.filter(
    (r) => r.cust && typeof r.cust.lat === "number" && typeof r.cust.lng === "number"
  );
  if (withGeo.length <= 1) return withGeo;
  const remaining = [...withGeo];
  // Start from the highest revenue
  remaining.sort((a, b) => b.revenue - a.revenue);
  const ordered = [remaining.shift()];
  while (remaining.length) {
    const last = ordered[ordered.length - 1];
    let bestI = 0;
    let bestD = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(
        last.cust.lat,
        last.cust.lng,
        remaining[i].cust.lat,
        remaining[i].cust.lng
      );
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    }
    ordered.push(remaining.splice(bestI, 1)[0]);
  }
  return ordered;
}

// Build a HTML divIcon so we can color pins by score / picked state.
function buildPinIcon({ score, isPicked, order }) {
  const bg = isPicked
    ? "#0a84ff"
    : score >= 70
    ? "#34c759"
    : score >= 40
    ? "#ff9500"
    : "#ff3b30";
  const size = isPicked ? 36 : 28;
  const label = isPicked && order != null ? String(order) : String(score);
  return L.divIcon({
    className: "delivery-pin",
    html: `<div style="
      width:${size}px;height:${size}px;
      border-radius:50% 50% 50% 0;
      background:${bg};
      transform:rotate(-45deg);
      border:2px solid #fff;
      box-shadow:0 2px 6px rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;
    "><span style="
      transform:rotate(45deg);
      color:#fff;font-size:11px;font-weight:700;line-height:1;
    ">${label}</span></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

export default function DeliveryMap({ rows, picked, onToggle }) {
  // Rows passed in already include `cust` (Contact), `score`, `revenue`, `volM3`.
  const geoRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.cust && typeof r.cust.lat === "number" && typeof r.cust.lng === "number"
      ),
    [rows]
  );

  const pickedRows = useMemo(
    () => rows.filter((r) => picked.has(r.so.soNum)),
    [rows, picked]
  );
  const orderedPicks = useMemo(() => sequencePicks(pickedRows), [pickedRows]);
  const orderMap = useMemo(() => {
    const m = new Map();
    orderedPicks.forEach((r, i) => m.set(r.so.soNum, i + 1));
    return m;
  }, [orderedPicks]);

  // Center: avg of geo rows, fall back to Bangkok
  const center = useMemo(() => {
    if (geoRows.length === 0) return [13.7563, 100.5018];
    const sum = geoRows.reduce(
      (a, r) => [a[0] + r.cust.lat, a[1] + r.cust.lng],
      [0, 0]
    );
    return [sum[0] / geoRows.length, sum[1] / geoRows.length];
  }, [geoRows]);

  const polylinePts = orderedPicks
    .filter((r) => r.cust)
    .map((r) => [r.cust.lat, r.cust.lng]);

  if (geoRows.length === 0) {
    return (
      <div
        style={{
          padding: "60px 20px",
          textAlign: "center",
          color: "var(--faint)",
          fontSize: 14,
          background: "var(--bg2)",
          border: "1px solid var(--line)",
          borderRadius: 8,
        }}
      >
        ลูกค้ายังไม่มี lat/lng — ใส่พิกัดในหน้า "ลูกค้า" ก่อนเพื่อใช้แผนที่
        <div style={{ fontSize: 12, marginTop: 6 }}>
          (paste URL จาก Google Maps ในช่อง "วาง URL")
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        height: 560,
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid var(--line)",
      }}
    >
      <MapContainer
        center={center}
        zoom={geoRows.length === 1 ? 12 : 7}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {polylinePts.length >= 2 && (
          <Polyline
            positions={polylinePts}
            pathOptions={{
              color: "#0a84ff",
              weight: 4,
              opacity: 0.7,
              dashArray: "8 4",
            }}
          />
        )}
        {geoRows.map((r) => {
          const isPicked = picked.has(r.so.soNum);
          return (
            <Marker
              key={r.so.soNum}
              position={[r.cust.lat, r.cust.lng]}
              icon={buildPinIcon({
                score: r.score,
                isPicked,
                order: orderMap.get(r.so.soNum),
              })}
              eventHandlers={{
                click: () => {
                  // Click bubbles to popup; only toggle from button to avoid surprises
                },
              }}
            >
              <Popup>
                <div style={{ minWidth: 200 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 13,
                      marginBottom: 4,
                      color: "#0a84ff",
                    }}
                  >
                    {r.so.soNum}
                  </div>
                  <div style={{ fontSize: 12, marginBottom: 2 }}>
                    {r.custName}
                  </div>
                  <div
                    style={{ fontSize: 11, color: "#666", marginBottom: 6 }}
                  >
                    {r.cust.address || "—"}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      display: "flex",
                      gap: 10,
                      marginBottom: 6,
                    }}
                  >
                    <span>📦 {r.volM3.toFixed(2)} m³</span>
                    <span>💰 ฿{fmt(Math.round(r.revenue))}</span>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      marginBottom: 8,
                      color: "#666",
                    }}
                  >
                    คะแนน {r.score}
                    {isPicked && orderMap.get(r.so.soNum) && (
                      <span style={{ color: "#0a84ff", fontWeight: 600 }}>
                        {" "}
                        · ลำดับ #{orderMap.get(r.so.soNum)}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => onToggle(r.so.soNum)}
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: "none",
                      background: isPicked ? "#ff3b30" : "#0a84ff",
                      color: "#fff",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontWeight: 500,
                      fontSize: 12,
                    }}
                  >
                    {isPicked ? "ยกเลิกเลือก" : "เลือก SO นี้"}
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
