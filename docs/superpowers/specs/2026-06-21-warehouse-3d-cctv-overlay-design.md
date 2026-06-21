# Spec — โกดัง 3D Phase C: CCTV live overlay (ดึงเฟรมสดจาก Tapo relay)

วันที่: 2026-06-21 · ฟีเจอร์: `warehouse_3d` · ก้อน C จากการแตก "ทำหมดเลย" (A→B→C→D→E)
อ่านคู่กับ [handoff](../../warehouse-3d-handoff.md), memory `project_warehouse_3d.md`, [[project-ai-stock-count]] (Tapo relay = ส่วน 4)

## เป้าหมาย
ในแผงเทียบ CCTV ของแท็บโกดัง 3D ให้ **ดึงเฟรมสดจาก Tapo relay ตาม preset กล้องของโซน** (แทนการลากไฟล์เอง) เพื่อเทียบมุม 3D (ซ้าย) กับภาพจริง (ขวา) ที่ AI ใช้นับ stock

## บริบทสำคัญ (ของส่วนใหญ่มีแล้ว — wire ไม่ build)
- **scene.js มีแผงเทียบ CCTV อยู่แล้ว** (`#cctvPane`, ปุ่ม "เทียบ CCTV", `snapCCTV(id)` ขยับกล้อง 3D ไปมุมที่เซฟของโซน, `loadCCTV(file)` โหลดภาพ **มือ** ผ่าน drag/drop/file picker). ยังไม่ดึงสด
- **relay API** (default `http://localhost:8765`, จาก `getRelayUrl()` ใน `src/utils/cameraCapture.ts`): `GET /presets` → `{presets:[{token,name}]}`; `GET /snapshot?preset=<token>` → ภาพ (ไม่ใส่ preset = มุมปัจจุบัน)
- **โซนผูก preset แล้ว**: `zone.presets = [{token,name}]` ตั้งใน [Zones.jsx](../../../src/components/Zones.jsx) ("preset กล้อง (โซนนี้)") — โซนเดียวกับที่มี `productIds`
- StockCount.jsx ดึงสดด้วย `fetch(relay+"/snapshot?preset=")` + blob (เพราะต้องการ base64 ส่ง AI); แต่ overlay นี้ **แค่โชว์** จึงใช้ `<img src>` ตรง ๆ ได้ (ข้าม origin ไม่ติด CORS)

## Scope ของ C
1. **bridge:** `buildWarehouseData` พา `zone.presets` → `ZONES[].presets` (ปัจจุบันไม่ได้พา)
2. **opts:** `Warehouse3D.jsx` ส่ง `snapshotUrl(token) => string` เข้า `createWarehouseScene` (ปิดทับ `getRelayUrl()` + helper `cctvSnapshotUrl`) — scene.js ไม่ต้อง import cameraCapture/localStorage เอง (decoupled ตามแบบ onSaveCamera)
3. **scene.js CCTV pane:** เพิ่มแถบ "ดึงภาพสด" ที่ผูกกับโซนที่เลือก — แถบ chip **re-render ทุกครั้งที่เปลี่ยนโซน** (เรียกจาก `snapCCTV(id)` ซึ่งตั้ง selectedZone + เปิดแผงอยู่แล้ว)
   - โซนมี presets → chip ต่อ preset, กด chip = ดึงมุมนั้น
   - โซนไม่มี presets → ปุ่มเดียว "ดึงภาพสด (มุมปัจจุบัน)" (relay `/snapshot` ไม่มี preset)
   - กดแล้ว `ccImg.src = snapshotUrl(token)` (มี cache-bust `&t=`), โชว์ภาพแทน drop zone
4. **pure helper:** `cctvSnapshotUrl(base, token?, t?)` ใน cameraCapture.ts (+vitest) — สร้าง URL อย่างเดียว

## Error / fallback
- `ccImg.onerror` → ขึ้นข้อความ "relay ไม่ตอบ — เปิดโปรแกรม relay หรือใช้ลากไฟล์" + คืน drop zone ให้เห็น
- drag/drop/file picker เดิม **คงไว้ตลอด** เป็น fallback (relay ล่ม/ไม่มีในเครื่องนั้น)
- ถ้า `snapshotUrl` ไม่ถูกส่ง (เช่นไม่มี relay base) → ซ่อนปุ่มดึงสด เหลือ drag/drop

## Data flow
```
zone.presets (Zones.jsx, sh.zones)                getRelayUrl() (localStorage, ตั้งใน StockCount)
        │ buildWarehouseData → ZONES[].presets            │ Warehouse3D.jsx: snapshotUrl = t => cctvSnapshotUrl(getRelayUrl(), t, Date.now())
        ▼                                                 ▼ opts.snapshotUrl
   createWarehouseScene(container, data, { ...opts, snapshotUrl })
        ▼  (กดปุ่มดึงสด)  ccImg.src = snapshotUrl(token)  ──GET──▶ relay /snapshot?preset=token  ──▶ ภาพในแผงขวา
```

## ไม่อยู่ใน C (out of scope)
- ไม่แก้ Tapo relay เอง / ไม่เพิ่ม UI ตั้ง relay URL ในแท็บ 3D (ใช้ค่าจาก StockCount ผ่าน getRelayUrl)
- ไม่เก็บภาพสด (transient view); ไม่ส่งภาพเข้า AI (นั่นคือ StockCount); ไม่ auto-fetch (ผู้ใช้เลือกปุ่มดึงสด)
- ไม่แตะ persistence / D-E (ลาก-รีไซส์โซน, เพดานต่อโซน, touch)

## Verification (login ไม่ได้ + WebGL screenshot timeout)
- vitest: `cctvSnapshotUrl` (มี/ไม่มี token, encode token, cache-bust param) — `pickCaptureTargets` มี test อยู่แล้ว
- dev harness `wh3d-dev.html` (ลบหลังเสร็จ): zones บางตัวมี `presets:[{token:"1",name:"มุม A"}]`, ส่ง `snapshotUrl` ที่คืน data-URL ภาพ mock (ไม่ยิง relay จริง) → กด "เทียบ CCTV", ตรวจผ่าน `preview_eval`:
  - เปิดแผง → มี chip preset ตามโซน / ปุ่ม "มุมปัจจุบัน" เมื่อไม่มี preset
  - กด chip → `#cctvImg`.src เปลี่ยนเป็น url ที่คาด, `display!=none`
  - `onerror` path: ส่ง snapshotUrl ที่ชี้ url พัง → ขึ้นข้อความ fallback + drop zone กลับมา
- `npm run typecheck` · `npx eslint` · `npx vitest run`

## Risks / gotchas
- localhost = Supabase prod ([[feedback-preview-writes-prod]]): dev harness ใช้ snapshotUrl stub (data-URL) **ไม่ยิง relay/กล้องจริง** และไม่กดปุ่ม save ใด ๆ
- `<img src>` cross-origin โชว์ได้ไม่ติด CORS (ต่างจาก fetch) — ยืนยันด้วย harness
- getRelayUrl อ่าน localStorage ตอนเรียก; ส่งเป็น closure `snapshotUrl` เพื่อใช้ค่าล่าสุดเสมอ (ไม่ผูกตอน build scene)
- commit/push ตรง master เมื่อสั่ง ([[feedback-branching]]); chat ห้าม emoji ([[feedback-no-emoji]]); LF→CRLF warning ไม่เป็นไร

## Definition of done
- เลือกโซนที่มี preset → กด chip ในแผงเทียบ → ภาพสดจาก relay ขึ้นฝั่งขวา, 3D ฝั่งซ้ายอยู่มุมที่เซฟ
- โซนไม่มี preset → ปุ่ม "มุมปัจจุบัน" ใช้ได้; relay ล่ม → fallback drag/drop + ข้อความ
- `cctvSnapshotUrl` มี vitest ผ่าน; typecheck/eslint สะอาด; ไม่มี dev harness ค้างใน repo
