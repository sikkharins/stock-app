# โกดัง 3D Phase C — CCTV live overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ในแผงเทียบ CCTV ของแท็บโกดัง 3D เพิ่มปุ่ม/chip "ดึงภาพสด" จาก Tapo relay ตาม preset ของโซน (drag/drop เดิมเป็น fallback)

**Architecture:** ส่ง `zone.presets` ผ่าน bridge เข้า scene.js และส่ง `snapshotUrl(token)` (ปิดทับ `getRelayUrl()`+`cctvSnapshotUrl`) ผ่าน opts จาก Warehouse3D.jsx — scene.js แค่ตั้ง `<img src>` (ข้าม CORS) ไม่ผูกกับ relay/localStorage เอง

**Tech Stack:** React + Vite, three.js, vitest. แตะ `cameraCapture.ts`, `warehouse3d.js`, `Warehouse3D.jsx`, `scene.js`

อ่านประกอบ: spec `docs/superpowers/specs/2026-06-21-warehouse-3d-cctv-overlay-design.md`

---

## File Structure
- **Modify** `src/utils/cameraCapture.ts` — เพิ่ม pure `cctvSnapshotUrl(base, token?, t?)`
- **Modify** `src/utils/cameraCapture.test.ts` — test ของ helper
- **Modify** `src/utils/warehouse3d.js` — bridge พา `zone.presets` → `ZONES[].presets`
- **Modify** `src/utils/warehouse3d.test.ts` — test ว่า presets ถูกพา
- **Modify** `src/components/Warehouse3D.jsx` — ส่ง `snapshotUrl` opt
- **Modify** `src/lib/warehouse3d/scene.js` — แถบ "ดึงภาพสด" + onerror fallback
- **Temp (ห้าม commit)** `wh3d-dev.html`

## Gotchas
- localhost = Supabase prod — dev harness ใช้ `snapshotUrl` stub (data-URL) ไม่ยิง relay/กล้องจริง, ห้ามกด save UI
- `<img src>` ข้าม origin โชว์ได้ไม่ติด CORS (ต่างจาก fetch)
- commit/push ตรง master เมื่อสั่ง; chat ห้าม emoji; git LF→CRLF warning ไม่เป็นไร
- scene.js แก้โดยอ้างเนื้อโค้ด (search/replace) ไม่อ้างเลขบรรทัด

---

### Task C1: pure `cctvSnapshotUrl()` + test

**Files:**
- Modify: `src/utils/cameraCapture.ts`
- Test: `src/utils/cameraCapture.test.ts`

- [ ] **Step 1: เขียน test ที่ fail**

เพิ่มท้าย `src/utils/cameraCapture.test.ts`:
```ts
import { cctvSnapshotUrl } from "./cameraCapture";

describe("cctvSnapshotUrl", () => {
  it("ไม่มี token/t -> /snapshot เฉย ๆ", () => {
    expect(cctvSnapshotUrl("http://localhost:8765")).toBe("http://localhost:8765/snapshot");
  });
  it("มี token -> ใส่ preset (encode)", () => {
    expect(cctvSnapshotUrl("http://h:1", "a b")).toBe("http://h:1/snapshot?preset=a+b");
  });
  it("มี token + t -> ใส่ทั้งคู่ (cache-bust)", () => {
    expect(cctvSnapshotUrl("http://h:1", "x", 99)).toBe("http://h:1/snapshot?preset=x&t=99");
  });
  it("ตัด trailing slash ของ base", () => {
    expect(cctvSnapshotUrl("http://h:1/", "x")).toBe("http://h:1/snapshot?preset=x");
  });
  it("token ว่าง/null -> ไม่ใส่ preset", () => {
    expect(cctvSnapshotUrl("http://h:1", null, 5)).toBe("http://h:1/snapshot?t=5");
  });
});
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `npx vitest run src/utils/cameraCapture.test.ts`
Expected: FAIL — `cctvSnapshotUrl is not a function`

- [ ] **Step 3: implement ใน cameraCapture.ts**

เพิ่มท้าย `src/utils/cameraCapture.ts`:
```ts
// Build a relay snapshot URL for live CCTV display via <img src> (no CORS, unlike fetch).
// token -> move PTZ to that preset; omit/null -> current view. t -> cache-bust.
export function cctvSnapshotUrl(base: string, token?: string | null, t?: number): string {
  const q = new URLSearchParams();
  if (token) q.set("preset", String(token));
  if (t != null) q.set("t", String(t));
  const qs = q.toString();
  return `${base.replace(/\/+$/, "")}/snapshot${qs ? "?" + qs : ""}`;
}
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `npx vitest run src/utils/cameraCapture.test.ts`
Expected: PASS (รวมของเดิม)

- [ ] **Step 5: typecheck + commit**

Run: `npm run typecheck`
```bash
git add src/utils/cameraCapture.ts src/utils/cameraCapture.test.ts
git commit -m "feat(warehouse-3d): cctvSnapshotUrl() relay snapshot URL builder"
```

---

### Task C2: bridge พา `zone.presets` เข้า ZONES

**Files:**
- Modify: `src/utils/warehouse3d.js`
- Test: `src/utils/warehouse3d.test.ts`

- [ ] **Step 1: เขียน test ที่ fail**

เพิ่ม test ใน `src/utils/warehouse3d.test.ts` (ในกลุ่ม describe ของ buildWarehouseData):
```ts
it("พา zone.presets เข้า ZONES (default [])", () => {
  const zones = [
    { id: "Z1", name: "z1", productIds: [], presets: [{ token: "1", name: "มุม A" }] },
    { id: "Z2", name: "z2", productIds: [] },
  ];
  const { ZONES } = buildWarehouseData([], zones, {});
  expect(ZONES.find((z) => z.id === "Z1").presets).toEqual([{ token: "1", name: "มุม A" }]);
  expect(ZONES.find((z) => z.id === "Z2").presets).toEqual([]);
});
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `npx vitest run src/utils/warehouse3d.test.ts`
Expected: FAIL — `presets` เป็น undefined (expected []/array)

- [ ] **Step 3: implement**

ใน `src/utils/warehouse3d.js` หา object `out` ใน `ZONES = baseZones.map(...)`:
```js
      color: saved.color || z.color || (geom && geom.color) || ZONE_PALETTE[i % ZONE_PALETTE.length],
      productIds: Array.isArray(z.productIds) ? z.productIds : [],
    };
```
แทรกบรรทัด presets:
```js
      color: saved.color || z.color || (geom && geom.color) || ZONE_PALETTE[i % ZONE_PALETTE.length],
      productIds: Array.isArray(z.productIds) ? z.productIds : [],
      presets: Array.isArray(z.presets) ? z.presets : [],
    };
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `npx vitest run src/utils/warehouse3d.test.ts`
Expected: PASS

- [ ] **Step 5: typecheck + commit**

Run: `npm run typecheck`
```bash
git add src/utils/warehouse3d.js src/utils/warehouse3d.test.ts
git commit -m "feat(warehouse-3d): carry zone.presets through buildWarehouseData"
```

---

### Task C3: Warehouse3D.jsx ส่ง `snapshotUrl` opt

**Files:**
- Modify: `src/components/Warehouse3D.jsx`

- [ ] **Step 1: เพิ่ม import**

หา `import { createWarehouseScene } from "../lib/warehouse3d/scene.js";` เพิ่มบรรทัดถัดไป:
```js
import { getRelayUrl, cctvSnapshotUrl } from "../utils/cameraCapture.ts";
```

- [ ] **Step 2: ส่ง snapshotUrl เข้า opts**

หา:
```js
    const scene = createWarehouseScene(el, data, {
      canEdit,
      onSaveLayout: canEdit ? onSaveLayout : null,
      onSaveCamera: canEdit ? onSaveCamera : null,
    });
```
แทนด้วย:
```js
    const scene = createWarehouseScene(el, data, {
      canEdit,
      onSaveLayout: canEdit ? onSaveLayout : null,
      onSaveCamera: canEdit ? onSaveCamera : null,
      // closure อ่าน relay URL ล่าสุดตอนกดทุกครั้ง + cache-bust ด้วย Date.now()
      snapshotUrl: (token) => cctvSnapshotUrl(getRelayUrl(), token, Date.now()),
    });
```

- [ ] **Step 3: typecheck + lint + commit**

Run: `npm run typecheck`
Run: `npx eslint src/components/Warehouse3D.jsx`
Expected: clean (verify จริงรวมใน Task C5 — แอป login ไม่ได้)
```bash
git add src/components/Warehouse3D.jsx
git commit -m "feat(warehouse-3d): pass snapshotUrl (relay) into scene"
```

---

### Task C4: scene.js แถบ "ดึงภาพสด" + fallback

**Files:**
- Modify: `src/lib/warehouse3d/scene.js`

- [ ] **Step 1: รับ opt snapshotUrl**

หา:
```js
  const onSaveCamera = typeof opts.onSaveCamera === "function" ? opts.onSaveCamera : null;
```
เพิ่มบรรทัดถัดไป:
```js
  const snapshotUrl = typeof opts.snapshotUrl === "function" ? opts.snapshotUrl : null;
```

- [ ] **Step 2: เพิ่ม CSS ของแถบ + error**

หา:
```js
.wh3d .cc-foot { padding:10px 16px; border-top:1px solid var(--w3-line); font-size:11px; color:var(--w3-muted); display:flex; gap:8px; align-items:center; }
```
เพิ่มบรรทัดถัดไป:
```js
.wh3d .cc-bar { padding:8px 16px; border-bottom:1px solid var(--w3-line); display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
.wh3d .cc-bar .cc-lbl { font-size:11px; color:var(--w3-muted); margin-right:2px; }
.wh3d .cc-err { position:absolute; left:16px; right:16px; bottom:8px; font-size:11px; color:#ff8e7e; text-align:center; display:none; }
```

- [ ] **Step 3: เพิ่ม HTML แถบ + error element**

หา:
```js
      <button class="tbtn" id="ccClose">ปิด</button>
    </div>
    <div class="cc-stage">
      <img id="cctvImg" alt="CCTV" />
```
แทนด้วย:
```js
      <button class="tbtn" id="ccClose">ปิด</button>
    </div>
    <div class="cc-bar" id="ccLiveBar"></div>
    <div class="cc-stage">
      <img id="cctvImg" alt="CCTV" />
      <div class="cc-err" id="ccErr"></div>
```

- [ ] **Step 4: เรียก renderLiveBar เมื่อ snap โซน**

หา (ท้าย `snapCCTV`):
```js
    gid("ccZoneName").textContent = z.name + " · มุมกล้องเลียนแบบ CCTV";
  }
```
แทนด้วย:
```js
    gid("ccZoneName").textContent = z.name + " · มุมกล้องเลียนแบบ CCTV";
    renderLiveBar(z);
  }
```

- [ ] **Step 5: นิยาม renderLiveBar + showLiveCCTV**

หา:
```js
  ccFile.addEventListener("change", (e) => loadCCTV(e.target.files[0]));
  ["dragover", "drop"].forEach((ev) => ccDrop.addEventListener(ev, (e) => { e.preventDefault(); if (ev === "drop") loadCCTV(e.dataTransfer.files[0]); }));
```
เพิ่มต่อท้าย block นั้น:
```js
  const ccErr = gid("ccErr");
  function showLiveCCTV(url) {
    if (ccErr) ccErr.style.display = "none";
    ccImg.onerror = () => {
      ccImg.style.display = "none";
      ccDrop.style.display = "";
      if (ccErr) { ccErr.textContent = "relay ไม่ตอบ — เปิดโปรแกรม relay หรือใช้ลากไฟล์"; ccErr.style.display = "block"; }
    };
    ccImg.src = url;
    ccImg.style.display = "block";
    ccDrop.style.display = "none";
  }
  function renderLiveBar(z) {
    const bar = gid("ccLiveBar");
    if (!bar) return;
    if (!snapshotUrl) { bar.style.display = "none"; return; }
    bar.style.display = "";
    const presets = Array.isArray(z.presets) ? z.presets : [];
    bar.innerHTML = `<span class="cc-lbl">ดึงภาพสด:</span>` + (presets.length
      ? presets.map((p) => `<button class="tbtn" data-tok="${String(p.token)}">${p.name}</button>`).join("")
      : `<button class="tbtn" data-tok="">มุมปัจจุบัน</button>`);
    bar.querySelectorAll("button[data-tok]").forEach((b) => b.addEventListener("click", () => {
      showLiveCCTV(snapshotUrl(b.getAttribute("data-tok") || null));
    }));
  }
```
(หมายเหตุ: `snapCCTV` อ้าง `renderLiveBar` ได้แม้ประกาศทีหลัง เพราะ function declaration hoist; ตอนรันจริง snap เกิดหลัง init แล้ว)

- [ ] **Step 6: typecheck + lint**

Run: `npm run typecheck`
Run: `npx eslint src/lib/warehouse3d/scene.js`
Expected: clean

- [ ] **Step 7: commit**

```bash
git add src/lib/warehouse3d/scene.js
git commit -m "feat(warehouse-3d): live CCTV fetch bar (per-zone presets) with drag-drop fallback"
```

---

### Task C5: verify เต็ม + cleanup

**Files:**
- Temp: `wh3d-dev.html`

- [ ] **Step 1: สร้าง dev harness (stub snapshotUrl — ไม่ยิง relay จริง)**

`wh3d-dev.html` ที่ root:
```html
<div id="host" style="position:fixed;inset:0"></div>
<script type="module">
  import { buildWarehouseData } from "/src/utils/warehouse3d.js";
  import { createWarehouseScene } from "/src/lib/warehouse3d/scene.js";
  // 1x1 png data-URL = "สำเร็จ"; token 'bad' -> url พัง = ทดสอบ onerror
  const OK = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const products = [{ id:"p1", code:"A1", nameT:"กล่อง", stock:50, widthCm:40,lengthCm:40,heightCm:40, unit:"ชิ้น" }];
  const zones = [
    { id:"Z1", name:"โซนมี preset", origin:{x:1,z:1}, size:{w:12,l:8}, productIds:["p1"], presets:[{token:"1",name:"มุม A"},{token:"bad",name:"มุมพัง"}] },
    { id:"Z2", name:"โซนไม่มี preset", origin:{x:15,z:1}, size:{w:8,l:8}, productIds:["p1"] },
  ];
  const data = buildWarehouseData(products, zones, {});
  window.__DATA = data;
  window.__SCENE = createWarehouseScene(document.getElementById("host"), data, {
    canEdit:true, onSaveLayout:()=>{}, onSaveCamera:()=>{},
    snapshotUrl: (tok) => tok === "bad" ? "http://127.0.0.1:1/nope.png" : OK,
  });
</script>
```

- [ ] **Step 2: รัน + force ขนาด + เปิดแผงเทียบ**

- `preview_start` (stock-app), เปิด `http://localhost:5173/wh3d-dev.html`
- `preview_eval`: `document.getElementById('host').style.cssText='position:fixed;left:0;top:0;width:1300px;height:760px'; window.dispatchEvent(new Event('resize'));`
- `preview_eval`: `document.getElementById('btnCompare').click(); 'opened'` (เปิดแผง → snapCCTV(Z1) → renderLiveBar)

- [ ] **Step 3: ตรวจผล**

- chip ตามโซน Z1: `preview_eval`:
  `[...document.querySelectorAll('#ccLiveBar button')].map(b=>b.textContent)` — Expected: `["มุม A","มุมพัง"]`
- กดดึงสำเร็จ: `preview_eval`:
  `document.querySelector('#ccLiveBar button[data-tok="1"]').click(); ({src: document.getElementById('cctvImg').src.slice(0,30), shown: getComputedStyle(document.getElementById('cctvImg')).display})`
  Expected: `src` ขึ้นต้น `data:image/png`, `shown: "block"`
- เลือกโซนไม่มี preset: `preview_eval`:
  `__SCENE; document.querySelector('.zone-row[data-zone="Z2"] .zr-go').click(); [...document.querySelectorAll('#ccLiveBar button')].map(b=>b.textContent)`
  Expected: `["มุมปัจจุบัน"]`
- onerror fallback: `preview_eval` (กดมุมพัง แล้วรอ error):
  `document.querySelector('.zone-row[data-zone="Z1"] .zr-go').click(); document.querySelector('#ccLiveBar button[data-tok="bad"]').click(); new Promise(r=>setTimeout(()=>r({err: getComputedStyle(document.getElementById('ccErr')).display, drop: getComputedStyle(document.getElementById('ccDrop')).display}),400))`
  Expected: `err: "block"` (ข้อความ relay ไม่ตอบ), `drop` ไม่ใช่ "none" (drop zone กลับมา)
- `preview_console_logs` level error — Expected: ไม่มี (ภาพ 127.0.0.1 net error ถือว่าคาดไว้/ผ่าน onerror)

- [ ] **Step 4: ลบ harness + test/typecheck/lint ครบ + ปิด server**

```bash
rm -f wh3d-dev.html
```
Run: `npx vitest run` (Expected: ทุกไฟล์ของเรา (cameraCapture/warehouse3d/boxPlan) ผ่าน; DeliveryPlanning อาจยังแดงจากงาน picklist อื่น — ไม่เกี่ยว)
Run: `npm run typecheck` · `npx eslint src/lib/warehouse3d/ src/utils/cameraCapture.ts src/components/Warehouse3D.jsx`
- `preview_stop`, ยืนยัน `git status` ไม่มี `wh3d-dev.html`

- [ ] **Step 5: commit (ถ้ามีแก้ระหว่าง verify)**

ถ้าเจอบั๊กแล้วแก้ ให้ commit; ถ้าไม่ ข้าม
```bash
git add -A -- src/lib/warehouse3d src/utils src/components/Warehouse3D.jsx
git commit -m "test(warehouse-3d): verify live CCTV bar via dev harness"
```

---

## Self-Review

**Spec coverage:**
- bridge presets → C2 · opts snapshotUrl → C3 · pure helper+test → C1 · scene.js แถบ chip/ปุ่มดึงสด + re-render ต่อโซน → C4 (renderLiveBar เรียกใน snapCCTV) · error/fallback drag-drop → C4 (onerror) · ไม่มี preset → ปุ่ม "มุมปัจจุบัน" → C4 · verify (stub ไม่ยิง relay) → C5
ครบทุกข้อใน spec

**Placeholder scan:** ไม่มี TBD/วาง ๆ — ทุก step มีโค้ด/คำสั่ง/ค่าที่คาด

**Type consistency:** `snapshotUrl(token)` — Warehouse3D ส่ง `(token)=>cctvSnapshotUrl(getRelayUrl(),token,Date.now())` (C3), scene.js เรียก `snapshotUrl(b.getAttribute('data-tok')||null)` (C4) — ตรงกัน; `cctvSnapshotUrl(base,token?,t?)` นิยาม C1 ใช้ C3 ตรง; `ZONES[].presets` สร้าง C2 ใช้ C4 (`z.presets`) ตรง

**หมายเหตุ:** C3/C4 (React/scene DOM) ไม่ unit-test — verify ผ่าน C5 dev harness (DOM/eval) + typecheck/lint; helper+bridge (C1/C2) unit-test เต็ม
