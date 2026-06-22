// 3D warehouse scene — framework-agnostic. Originally prototyped as a standalone
// HTML page (Claude Design handoff), then adapted for embedding inside the React app:
//   - CDN importmap  -> bundler imports (three + OrbitControls)
//   - global document/window  -> scoped to a container element
//   - "copy layout" textarea  -> opts.onSaveLayout(layoutByZone) callback
//   - new "save camera" per-zone control -> opts.onSaveCamera(zoneId, camera)
//   - full dispose() for clean unmount (StrictMode-safe)
//
// Usage: const scene = createWarehouseScene(container, { WAREHOUSE, ZONES, PRODUCTS }, opts);
//        ... later: scene.dispose();
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { planBoxes, productColor, snapClampZoneRect } from "./boxPlan.js";

const STYLE_ID = "wh3d-style";
const CSS = `
.wh3d { position:relative; width:100%; height:100%; overflow:hidden;
  --w3-bg:#0e1116; --w3-panel:rgba(20,25,33,0.92); --w3-panel-solid:#161b23;
  --w3-line:rgba(255,255,255,0.08); --w3-text:#e8ecf2; --w3-muted:#97a1b0; --w3-accent:#4a90d9;
  font-family:"Segoe UI",system-ui,-apple-system,"Noto Sans Thai",sans-serif; color:var(--w3-text); }
.wh3d * { box-sizing:border-box; }
.wh3d #app { position:absolute; inset:0; display:flex; }
.wh3d #viewport { position:relative; flex:1 1 0; min-width:0; }
.wh3d #viewport canvas { display:block; }
.wh3d .panel { background:var(--w3-panel); backdrop-filter:blur(10px); border:1px solid var(--w3-line);
  border-radius:12px; box-shadow:0 12px 40px rgba(0,0,0,0.45); }
.wh3d #titlebar { position:absolute; top:16px; left:16px; padding:12px 16px; max-width:320px; }
.wh3d #titlebar h1 { font-size:15px; margin:0; font-weight:700; letter-spacing:.2px; }
.wh3d #titlebar .sub { font-size:11.5px; color:var(--w3-muted); margin-top:3px; line-height:1.5; }
.wh3d #wh-dims { color:var(--w3-accent); font-weight:600; }
.wh3d #toolbar { position:absolute; top:16px; left:50%; transform:translateX(-50%); display:flex; gap:6px; padding:6px; flex-wrap:wrap; max-width:calc(100% - 320px); }
.wh3d .tbtn { appearance:none; border:1px solid var(--w3-line); background:rgba(255,255,255,0.04); color:var(--w3-text);
  font-size:12px; font-family:inherit; padding:7px 12px; border-radius:8px; cursor:pointer; white-space:nowrap; transition:background .15s,border-color .15s; }
.wh3d .tbtn:hover { background:rgba(255,255,255,0.10); }
.wh3d .tbtn.active { background:var(--w3-accent); border-color:var(--w3-accent); color:#fff; }
.wh3d #zonePanel { position:absolute; top:16px; right:16px; width:270px; padding:14px; max-height:calc(100% - 32px); overflow-y:auto; overflow-x:hidden; }
.wh3d #zonePanel h2 { font-size:12px; text-transform:uppercase; letter-spacing:.12em; color:var(--w3-muted); margin:0 0 10px; }
.wh3d .zone-row { border:1px solid var(--w3-line); border-radius:10px; padding:10px 11px; margin-bottom:8px; cursor:pointer; transition:background .15s,border-color .15s; }
.wh3d .zone-row:hover { background:rgba(255,255,255,0.05); }
.wh3d .zone-row.selected { border-color:var(--w3-accent); background:rgba(74,144,217,0.10); }
.wh3d .zone-row .zr-top { display:flex; align-items:center; gap:8px; }
.wh3d .zr-swatch { width:13px; height:13px; border-radius:3px; flex:0 0 auto; }
.wh3d .zr-name { font-size:13.5px; font-weight:600; flex:1 1 auto; }
.wh3d .zr-cam { border:1px solid var(--w3-line); background:rgba(255,255,255,0.05); color:var(--w3-muted);
  border-radius:6px; font-size:10.5px; padding:3px 7px; cursor:pointer; font-family:inherit; }
.wh3d .zr-cam:hover { color:#fff; border-color:var(--w3-accent); }
.wh3d .zr-note { font-size:11px; color:var(--w3-muted); margin:5px 0 8px; line-height:1.45; }
.wh3d .zr-meta { display:flex; justify-content:space-between; font-size:10.5px; color:var(--w3-muted); margin-bottom:5px; }
.wh3d .zr-actions { display:flex; gap:6px; margin:8px 0 2px; }
.wh3d .zr-actions .zr-cam { flex:1; text-align:center; }
.wh3d .fillbar { height:7px; border-radius:4px; background:rgba(255,255,255,0.08); overflow:hidden; }
.wh3d .fillbar > i { display:block; height:100%; border-radius:4px; transition:width .4s; }
.wh3d .zr-warn { color:#ff6b6b; font-size:10.5px; margin-top:6px; display:none; }
.wh3d .zone-row.overflow .zr-warn { display:block; }
.wh3d .zr-products { display:none; margin-top:10px; border-top:1px solid var(--w3-line); padding-top:9px; }
.wh3d .zone-row.selected .zr-products { display:block; }
.wh3d .zp-head { font-size:10.5px; color:var(--w3-muted); text-transform:uppercase; letter-spacing:.08em; margin-bottom:7px; }
.wh3d .zp-item { display:flex; align-items:center; gap:8px; padding:6px; border-radius:7px; cursor:pointer; }
.wh3d .zp-item:hover { background:rgba(255,255,255,0.06); }
.wh3d .zp-sw { width:11px; height:11px; border-radius:2px; flex:0 0 auto; }
.wh3d .zp-info { flex:1 1 auto; min-width:0; }
.wh3d .zp-name { font-size:12px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.wh3d .zp-sub { font-size:10px; color:var(--w3-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.wh3d .zp-qty { font-size:13px; font-weight:700; font-variant-numeric:tabular-nums; text-align:right; flex:0 0 auto; line-height:1.1; }
.wh3d .zp-qty small { display:block; font-size:9.5px; font-weight:500; color:var(--w3-muted); }
.wh3d #legend { position:absolute; bottom:16px; left:16px; padding:12px 14px; font-size:11.5px; max-width:240px; }
.wh3d #legend h3 { font-size:10.5px; text-transform:uppercase; letter-spacing:.12em; color:var(--w3-muted); margin:0 0 8px; }
.wh3d .lg-row { display:flex; align-items:center; gap:8px; margin-bottom:5px; }
.wh3d .lg-sw { width:12px; height:12px; border-radius:3px; flex:0 0 auto; }
.wh3d .lg-scale { display:flex; height:8px; border-radius:4px; overflow:hidden; margin:8px 0 4px; }
.wh3d .lg-scale > i { flex:1; }
.wh3d .lg-scale-lbl { display:flex; justify-content:space-between; color:var(--w3-muted); font-size:10px; }
.wh3d #popup { position:absolute; bottom:16px; right:16px; width:290px; padding:0; overflow:hidden; display:none; }
.wh3d #popup .pp-head { padding:12px 14px; color:#fff; }
.wh3d #popup .pp-code { font-size:11px; opacity:.85; letter-spacing:.05em; }
.wh3d #popup .pp-name { font-size:15px; font-weight:700; margin-top:2px; line-height:1.25; }
.wh3d #popup .pp-name small { display:block; font-size:11.5px; font-weight:500; opacity:.85; margin-top:2px; }
.wh3d #popup .pp-body { padding:12px 14px; }
.wh3d .pp-grid { display:grid; grid-template-columns:auto 1fr; gap:5px 12px; font-size:12px; }
.wh3d .pp-grid dt { color:var(--w3-muted); }
.wh3d .pp-grid dd { margin:0; text-align:right; font-variant-numeric:tabular-nums; }
.wh3d .pp-tag { display:inline-block; font-size:10px; padding:2px 7px; border-radius:20px; margin-top:8px; }
.wh3d .pp-close { position:absolute; top:8px; right:10px; cursor:pointer; color:#fff; opacity:.8; font-size:18px; line-height:1; }
.wh3d .pp-close:hover { opacity:1; }
.wh3d #cctvPane { flex:0 0 0; width:0; overflow:hidden; background:#0a0d12; border-left:1px solid var(--w3-line); display:flex; flex-direction:column; }
.wh3d .cc-head { padding:12px 16px; border-bottom:1px solid var(--w3-line); display:flex; align-items:center; justify-content:space-between; }
.wh3d .cc-head .t { font-size:13px; font-weight:600; }
.wh3d .cc-head .s { font-size:11px; color:var(--w3-muted); }
.wh3d .cc-stage { flex:1 1 auto; position:relative; display:flex; align-items:center; justify-content:center; padding:16px; }
.wh3d #cctvImg { max-width:100%; max-height:100%; border-radius:8px; display:none; }
.wh3d .cc-drop { position:absolute; inset:16px; border:2px dashed var(--w3-line); border-radius:12px; display:flex; flex-direction:column;
  align-items:center; justify-content:center; gap:10px; color:var(--w3-muted); font-size:12.5px; text-align:center; padding:20px; cursor:pointer; }
.wh3d .cc-drop:hover { border-color:var(--w3-accent); color:var(--w3-text); }
.wh3d .cc-drop svg { opacity:.5; }
.wh3d .cc-foot { padding:10px 16px; border-top:1px solid var(--w3-line); font-size:11px; color:var(--w3-muted); display:flex; gap:8px; align-items:center; }
.wh3d #zoneEditPanel { display:none; }
.wh3d.zoneediting #zoneEditPanel { display:block; }
.wh3d .ze-row { display:flex; gap:8px; margin:8px 0; }
.wh3d .ze-row label { font-size:11px; color:var(--w3-muted); display:flex; flex-direction:column; gap:3px; flex:1; }
.wh3d .ze-row input { width:100%; box-sizing:border-box; padding:5px 7px; border:1px solid var(--w3-line); border-radius:6px; background:#11151c; color:var(--w3-text); font-family:inherit; }
.wh3d .cc-bar { padding:8px 16px; border-bottom:1px solid var(--w3-line); display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
.wh3d .cc-bar .cc-lbl { font-size:11px; color:var(--w3-muted); margin-right:2px; }
.wh3d .cc-err { position:absolute; left:16px; right:16px; bottom:8px; font-size:11px; color:#ff8e7e; text-align:center; display:none; }
.wh3d #hint { position:absolute; bottom:16px; left:50%; transform:translateX(-50%); font-size:11px; color:var(--w3-muted);
  background:var(--w3-panel); border:1px solid var(--w3-line); padding:6px 12px; border-radius:20px; pointer-events:none; opacity:.9; }
.wh3d #movePanel { position:absolute; bottom:16px; left:50%; transform:translateX(-50%); width:360px; padding:13px 15px; display:none; }
.wh3d.moving #movePanel { display:block; }
.wh3d.moving #hint { display:none; }
.wh3d.moving #viewport canvas { cursor:grab; }
.wh3d .mp-title { font-size:13px; font-weight:700; margin-bottom:4px; }
.wh3d .mp-hint { font-size:11px; color:var(--w3-muted); line-height:1.45; margin-bottom:9px; }
.wh3d .mp-sel { font-size:12px; background:rgba(255,255,255,0.05); border:1px solid var(--w3-line); border-radius:8px; padding:8px 10px; margin-bottom:9px; min-height:18px; }
.wh3d .mp-sel b { color:var(--w3-accent); }
.wh3d .mp-rot { display:flex; gap:6px; margin-bottom:9px; }
.wh3d .mp-rot .tbtn { flex:1; text-align:center; }
.wh3d .mp-copy { width:100%; }
`;

const TEMPLATE = `
<div id="app">
  <div id="viewport">
    <div id="titlebar" class="panel">
      <h1>โกดังสินค้า 3D · ตามขนาดจริง</h1>
      <div class="sub">สเกล 1 หน่วย = 1 เมตร · โกดัง <span id="wh-dims"></span><br>คลิกสินค้าเพื่อดูรายละเอียด · ลาก = หมุน · ล้อเมาส์ = ซูม · ปุ่มลูกศร = เลื่อน</div>
    </div>
    <div id="toolbar" class="panel">
      <button class="tbtn active" id="btnViewAll">ดูทั้งหมด</button>
      <button class="tbtn" id="btnLabels">ป้ายชื่อ</button>
      <button class="tbtn" id="btnGrid">กริด</button>
      <button class="tbtn" id="btnOnly">เฉพาะโซนที่เลือก</button>
      <button class="tbtn" id="btnCompare">เทียบ CCTV</button>
      <button class="tbtn" id="btnMove">✋ จัดเรียง</button>
      <button class="tbtn" id="btnZoneEdit">✥ แก้โซน</button>
      <button class="tbtn" id="btnReset">รีเซ็ตมุม</button>
    </div>
    <div id="zonePanel" class="panel">
      <h2>โซน (Zones)</h2>
      <div id="zoneList"></div>
    </div>
    <div id="legend" class="panel">
      <h3>คำอธิบาย</h3>
      <div id="legendZones"></div>
      <div class="lg-scale"><i style="background:#39b56a"></i><i style="background:#d8c23a"></i><i style="background:#e0823a"></i><i style="background:#e0503a"></i></div>
      <div class="lg-scale-lbl"><span>ว่าง 0%</span><span>เต็ม 100%</span></div>
    </div>
    <div id="popup" class="panel">
      <div class="pp-close" id="ppClose">×</div>
      <div class="pp-head" id="ppHead"><div class="pp-code" id="ppCode"></div><div class="pp-name" id="ppName"></div></div>
      <div class="pp-body"><dl class="pp-grid" id="ppGrid"></dl><span class="pp-tag" id="ppTag"></span></div>
    </div>
    <div id="hint">เลือกโซนทางขวา แล้วกด “มุมกล้องโซนนี้” เพื่อเทียบกับภาพ CCTV</div>
    <div id="movePanel" class="panel">
      <div class="mp-title">✋ โหมดจัดเรียง</div>
      <div class="mp-hint">ลากกล่อง <b>ทีละชิ้น</b> ด้วยคลิกซ้าย — ชิ้นชนิดเดียวกันจะดูดเข้ากริด และวางทับสินค้าคนละชนิดไม่ได้ · คลิกขวาค้าง = หมุนกล้อง · ล้อ = ซูม</div>
      <div id="mpSel" class="mp-sel">— ยังไม่ได้เลือกสินค้า —</div>
      <div class="mp-rot">
        <button class="tbtn" id="mpRotL">⟲ −15°</button>
        <button class="tbtn" id="mpRotR">+15° ⟳</button>
        <button class="tbtn" id="mpResetPos">คืนตำแหน่งเดิม</button>
      </div>
      <button class="tbtn mp-copy" id="mpCopy">💾 บันทึกการจัดเรียงทั้งหมด</button>
    </div>
    <div id="zoneEditPanel" class="panel">
      <div class="mp-title">✥ แก้โซน</div>
      <div class="mp-hint">คลิกเลือกโซน · ลากบนพื้น = ย้าย (snap 0.5ม.) · กรอกกว้าง/ยาว = รีไซซ์ · คลิกขวาค้าง = หมุนกล้อง</div>
      <div id="zeSel" class="mp-sel">— ยังไม่ได้เลือกโซน —</div>
      <div class="ze-row">
        <label>กว้าง <input id="zeW" type="number" step="0.5" min="0.5" /></label>
        <label>ยาว <input id="zeL" type="number" step="0.5" min="0.5" /></label>
      </div>
      <button class="tbtn mp-copy" id="zeSave" disabled>💾 บันทึกโซน</button>
    </div>
  </div>
  <div id="cctvPane">
    <div class="cc-head">
      <div><div class="t">ภาพกล้องวงจรปิด (CCTV)</div><div class="s" id="ccZoneName">—</div></div>
      <button class="tbtn" id="ccClose">ปิด</button>
    </div>
    <div class="cc-bar" id="ccLiveBar"></div>
    <div class="cc-stage">
      <img id="cctvImg" alt="CCTV" />
      <div class="cc-err" id="ccErr"></div>
      <div class="cc-drop" id="ccDrop">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <div>ลาก/คลิกเพื่ออัปโหลดภาพถ่ายจากกล้องวงจรจริง<br>เพื่อทาบเทียบกับมุม 3D ทางซ้าย</div>
      </div>
    </div>
    <div class="cc-foot">ซ้าย = render 3D มุมเดียวกับ CCTV · ขวา = ภาพจริงสำหรับให้ AI เทียบนับ stock</div>
  </div>
</div>
<input type="file" id="ccFile" accept="image/*" style="display:none" />
`;

export function createWarehouseScene(container, data, opts = {}) {
  const { WAREHOUSE, ZONES, PRODUCTS } = data;
  const canEdit = opts.canEdit !== false;
  const onSaveLayout = typeof opts.onSaveLayout === "function" ? opts.onSaveLayout : null;
  const onSaveCamera = typeof opts.onSaveCamera === "function" ? opts.onSaveCamera : null;
  const snapshotUrl = typeof opts.snapshotUrl === "function" ? opts.snapshotUrl : null;
  const onSaveZoneGeom = typeof opts.onSaveZoneGeom === "function" ? opts.onSaveZoneGeom : null;

  // ---- inject scoped stylesheet once ----
  if (!document.getElementById(STYLE_ID)) {
    const st = document.createElement("style");
    st.id = STYLE_ID; st.textContent = CSS;
    document.head.appendChild(st);
  }

  // ---- build DOM inside the container, scoped queries ----
  container.classList.add("wh3d");
  container.innerHTML = TEMPLATE;
  const root = container;
  const gid = (id) => root.querySelector("#" + id);

  // derived data
  const SIZECLASS_VOL = { S: 0.03, M: 0.125, L: 0.5, XL: 1.5 };
  const productById = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));

  // ---- lifecycle bookkeeping (for dispose) ----
  let disposed = false;
  let rafId = 0;
  const winListeners = [];
  const addWin = (type, fn, optArg) => { window.addEventListener(type, fn, optArg); winListeners.push([type, fn, optArg]); };
  const timeouts = [];
  const setT = (fn, ms) => { const t = setTimeout(fn, ms); timeouts.push(t); return t; };

  /* ===== SCENE + lights + floor + grid + edge labels ===== */
  const viewport = gid("viewport");
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#eef0f3");

  const camera = new THREE.PerspectiveCamera(55, Math.max(1, viewport.clientWidth) / Math.max(1, viewport.clientHeight), 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(Math.max(1, viewport.clientWidth), Math.max(1, viewport.clientHeight));
  renderer.shadowMap.enabled = false;
  viewport.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.minDistance = 2;
  controls.maxDistance = 120;
  controls.listenToKeyEvents(window);
  controls.keyPanSpeed = 16;
  controls.keys = { LEFT: "ArrowLeft", RIGHT: "ArrowRight", UP: "", BOTTOM: "" };
  const _kfwd = new THREE.Vector3();
  addWin("keydown", (e) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    e.preventDefault();
    camera.getWorldDirection(_kfwd); _kfwd.y = 0;
    if (_kfwd.lengthSq() < 1e-6) return;
    _kfwd.normalize().multiplyScalar((e.key === "ArrowUp" ? 1 : -1) * 1.5);
    camera.position.add(_kfwd);
    controls.target.add(_kfwd);
  });

  const WC = { x: WAREHOUSE.widthM / 2, z: WAREHOUSE.lengthM / 2 };
  const DEFAULT_VIEW = {
    position: [WAREHOUSE.widthM * 1.05, Math.max(WAREHOUSE.widthM, WAREHOUSE.lengthM) * 0.95, WAREHOUSE.lengthM * 1.25],
    target: [WC.x, 1.0, WC.z], fov: 50,
  };

  scene.add(new THREE.HemisphereLight("#ffffff", "#aeb4be", 0.62));
  scene.add(new THREE.AmbientLight("#ffffff", 0.34));
  const dir = new THREE.DirectionalLight("#ffffff", 0.98);
  dir.position.set(WAREHOUSE.widthM * 1.4, WAREHOUSE.heightM * 3.2, WAREHOUSE.lengthM * 1.1);
  scene.add(dir);
  const dir2 = new THREE.DirectionalLight("#dfe7f5", 0.28);
  dir2.position.set(-WAREHOUSE.widthM, WAREHOUSE.heightM * 2, -WAREHOUSE.lengthM * 0.3);
  scene.add(dir2);

  const W = WAREHOUSE.widthM, L = WAREHOUSE.lengthM, H = WAREHOUSE.heightM;

  function makeFloorTexture() {
    const ppm = 48, cw = Math.round(W * ppm), ch = Math.round(L * ppm);
    const cv = document.createElement("canvas"); cv.width = cw; cv.height = ch;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#cacdd2"; ctx.fillRect(0, 0, cw, ch);
    for (let i = 0; i < 1200; i++) {
      const r = Math.random() * ppm * 0.7 + 5, x = Math.random() * cw, y = Math.random() * ch, g = Math.round(Math.random() * 22 - 11);
      ctx.fillStyle = `rgba(${200 + g},${204 + g},${210 + g},0.045)`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
    ctx.strokeStyle = "rgba(120,126,134,0.13)"; ctx.lineWidth = 1.4;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath(); let x = Math.random() * cw, y = Math.random() * ch; ctx.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * ppm * 2; y += (Math.random() - 0.5) * ppm * 2; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4; tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  const floorMat = new THREE.MeshLambertMaterial({ map: makeFloorTexture() });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, L), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(WC.x, 0.012, WC.z);
  scene.add(floor);

  const baseH = 0.7;
  const base = new THREE.Mesh(new THREE.BoxGeometry(W, baseH, L), new THREE.MeshLambertMaterial({ color: "#c2c6cd" }));
  base.position.set(WC.x, -baseH / 2, WC.z);
  scene.add(base);
  const rim = new THREE.Mesh(new THREE.BoxGeometry(W + 0.06, 0.06, L + 0.06), new THREE.MeshLambertMaterial({ color: "#dfe2e7" }));
  rim.position.set(WC.x, -0.03, WC.z);
  scene.add(rim);

  const wallT = 0.28;
  const wallMat = new THREE.MeshLambertMaterial({ color: "#a3a9b3", side: THREE.DoubleSide });
  const wallTrimMat = new THREE.MeshLambertMaterial({ color: "#8f95a0", side: THREE.DoubleSide });
  const wallA = new THREE.Mesh(new THREE.BoxGeometry(W + wallT, H, wallT), wallMat);
  wallA.position.set(WC.x, H / 2, -wallT / 2); scene.add(wallA);
  const wallB = new THREE.Mesh(new THREE.BoxGeometry(wallT, H, L + wallT), wallMat);
  wallB.position.set(-wallT / 2, H / 2, WC.z); scene.add(wallB);
  const beamA = new THREE.Mesh(new THREE.BoxGeometry(W + wallT, 0.35, wallT + 0.1), wallTrimMat);
  beamA.position.set(WC.x, H - 0.18, -wallT / 2); scene.add(beamA);
  const beamB = new THREE.Mesh(new THREE.BoxGeometry(wallT + 0.1, 0.35, L + wallT), wallTrimMat);
  beamB.position.set(-wallT / 2, H - 0.18, WC.z); scene.add(beamB);

  const _blob = (function () {
    const s = 256, cv = document.createElement("canvas"); cv.width = cv.height = s;
    const ctx = cv.getContext("2d");
    const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.06, s / 2, s / 2, s * 0.5);
    g.addColorStop(0, "rgba(22,26,32,0.40)"); g.addColorStop(0.62, "rgba(22,26,32,0.18)"); g.addColorStop(1, "rgba(22,26,32,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    return new THREE.CanvasTexture(cv);
  })();
  function contactShadow(parent, cx, cz, w, l) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.3 + 0.35, l * 1.3 + 0.35),
      new THREE.MeshBasicMaterial({ map: _blob, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(cx, 0.042, cz); m.renderOrder = 1;
    parent.add(m);
  }

  // 1m grid
  const gridGroup = new THREE.Group();
  (function buildGrid() {
    const minor = [], major = [];
    for (let x = 0; x <= WAREHOUSE.widthM; x++) { const arr = x % 5 === 0 ? major : minor; arr.push(x, 0.018, 0, x, 0.018, WAREHOUSE.lengthM); }
    for (let z = 0; z <= WAREHOUSE.lengthM; z++) { const arr = z % 5 === 0 ? major : minor; arr.push(0, 0.018, z, WAREHOUSE.widthM, 0.018, z); }
    const mk = (verts, color, op) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
      return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: op }));
    };
    gridGroup.add(mk(minor, "#9aa3b2", 0.30));
    gridGroup.add(mk(major, "#6f7b8c", 0.65));
  })();
  scene.add(gridGroup);

  function makeTextSprite(message, opt = {}) {
    const { fontSize = 56, color = "#ffffff", bg = null, weight = 700, padX = 22, padY = 12, worldHeight = 0.9 } = opt;
    const dpr = 2;
    const cv = document.createElement("canvas");
    const ctx = cv.getContext("2d");
    const font = `${weight} ${fontSize}px "Segoe UI", system-ui, sans-serif`;
    ctx.font = font;
    const tw = ctx.measureText(message).width;
    cv.width = (tw + padX * 2) * dpr;
    cv.height = (fontSize + padY * 2) * dpr;
    ctx.scale(dpr, dpr);
    ctx.font = font;
    if (bg) { ctx.fillStyle = bg; const r = 10; const w = cv.width / dpr, h = cv.height / dpr; ctx.beginPath(); ctx.roundRect(0, 0, w, h, r); ctx.fill(); }
    ctx.fillStyle = color; ctx.textBaseline = "middle"; ctx.textAlign = "left";
    ctx.fillText(message, padX, cv.height / dpr / 2 + 1);
    const tex = new THREE.CanvasTexture(cv); tex.minFilter = THREE.LinearFilter;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
    const aspect = cv.width / cv.height;
    spr.scale.set(worldHeight * aspect, worldHeight, 1);
    spr.userData.isLabel = true;
    return spr;
  }

  const edgeLabels = new THREE.Group();
  for (let x = 0; x <= WAREHOUSE.widthM; x += 5) {
    const s = makeTextSprite(x + " ม.", { fontSize: 40, color: "#5b6470", worldHeight: 0.7 });
    s.position.set(x, 0.05, WAREHOUSE.lengthM + 0.9); edgeLabels.add(s);
  }
  for (let z = 0; z <= WAREHOUSE.lengthM; z += 5) {
    const s = makeTextSprite(z + " ม.", { fontSize: 40, color: "#5b6470", worldHeight: 0.7 });
    s.position.set(WAREHOUSE.widthM + 0.9, 0.05, z); edgeLabels.add(s);
  }
  scene.add(edgeLabels);

  /* ===== BUILD zones + place products ===== */
  const dummy = new THREE.Object3D();
  const _c = new THREE.Color();
  function mix(hexA, hexB, t) { return _c.set(hexA).lerp(new THREE.Color(hexB), t).getStyle(); }
  function volumeOf(p) {
    if (typeof p.cubicM === "number") return p.cubicM;
    if (p.widthCm && p.lengthCm && p.heightCm) return (p.widthCm / 100) * (p.lengthCm / 100) * (p.heightCm / 100);
    return SIZECLASS_VOL[p.sizeClass] ?? 0.125;
  }
  function boxDims(p) {
    if (p.widthCm && p.lengthCm && p.heightCm) return { w: p.widthCm / 100, l: p.lengthCm / 100, h: p.heightCm / 100 };
    const s = Math.cbrt(SIZECLASS_VOL[p.sizeClass] ?? 0.125);
    return { w: s, l: s, h: s };
  }

  const CARDBOARD = "#c79a5e";
  const GAP = 0.04;
  const MARGIN = 0.35;

  // yellow painted floor lines along every zone edge (marks the WAY/aisle borders)
  const YELLOW_MARK = new THREE.MeshBasicMaterial({ color: "#e8b008" });
  const MARK_W = 0.15;
  function yellowEdges(group, ox, oz, w, l) {
    const mk = (cx, cz, sw, sl) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(sw, sl), YELLOW_MARK);
      m.rotation.x = -Math.PI / 2;
      m.position.set(cx, 0.05, cz);
      m.userData.zonePart = true;
      m.renderOrder = 2;
      group.add(m);
    };
    mk(ox + w / 2, oz, w, MARK_W);          // back edge
    mk(ox + w / 2, oz + l, w, MARK_W);      // front edge
    mk(ox, oz + l / 2, MARK_W, l);          // left edge
    mk(ox + w, oz + l / 2, MARK_W, l);      // right edge
  }

  const zoneState = {};
  const pickables = [];
  const zoneFloors = [];
  const UNITS = [];
  const OBSTACLES = [];

  ZONES.forEach((zone) => {
    const group = new THREE.Group();
    group.userData.zoneId = zone.id;
    scene.add(group);

    const cx = zone.origin.x + zone.size.w / 2;
    const cz = zone.origin.z + zone.size.l / 2;

    const zf = new THREE.Mesh(new THREE.PlaneGeometry(zone.size.w, zone.size.l),
      new THREE.MeshLambertMaterial({ color: zone.color, transparent: true, opacity: 0.16, depthWrite: false }));
    zf.rotation.x = -Math.PI / 2; zf.position.set(cx, 0.02, cz); zf.userData.zonePart = true; group.add(zf);
    zf.userData.zoneId = zone.id; zoneFloors.push(zf);

    const fy = 0.04, ox = zone.origin.x, oz = zone.origin.z, w = zone.size.w, l = zone.size.l;
    const fg = new THREE.BufferGeometry();
    fg.setAttribute("position", new THREE.Float32BufferAttribute([
      ox, fy, oz, ox + w, fy, oz, ox + w, fy, oz, ox + w, fy, oz + l,
      ox + w, fy, oz + l, ox, fy, oz + l, ox, fy, oz + l, ox, fy, oz,
    ], 3));
    const frame = new THREE.LineSegments(fg, new THREE.LineBasicMaterial({ color: zone.color }));
    frame.userData.zonePart = true; group.add(frame);
    yellowEdges(group, ox, oz, w, l);

    const label = makeTextSprite(String(zone.id), { fontSize: 64, bg: zone.color, color: "#ffffff", worldHeight: 1.1 });
    label.position.set(cx, WAREHOUSE.heightM + 0.7, cz); label.userData.isLabel = true; group.add(label);

    const st = { group, meshes: [], volProducts: 0, fill: 0, overflow: false, label, floorMat: zf.material, frameMat: frame.material, baseOpacity: 0.16, productMeta: {} };
    zoneState[zone.id] = st;

    let curX = ox + MARGIN, curZ = oz + MARGIN, bandDepth = 0;
    const innerXMax = ox + w - MARGIN;
    const innerW = w - 2 * MARGIN, innerL = l - 2 * MARGIN;

    zone.productIds.forEach((pid) => {
      const p = productById[pid];
      if (!p) return;
      const d = boxDims(p);
      const volPer = volumeOf(p);
      st.volProducts += volPer * p.stock;
      const manual = zone.layout && zone.layout[pid] ? zone.layout[pid] : null;
      const pitchX = d.w + GAP, pitchZ = d.l + GAP;
      const plan = planBoxes(d, { innerW, innerL, ceilingH: WAREHOUSE.heightM }, {
        stock: p.stock, gap: GAP, manualCols: manual && manual.cols ? manual.cols : null,
      });
      const { usePile, cols, rows, layersMax, footW, footL } = plan;
      const layersUsed = plan.layers; // uncapped -> stacks above ceiling when overflowing
      if (plan.overflow) st.overflow = true;

      const pg = new THREE.Group();
      group.add(pg);
      let fw, fl;

      if (usePile) {
        const totalVol = volPer * p.stock;
        const targetH = Math.min(WAREHOUSE.heightM * 0.85, 3.2);
        let side = Math.sqrt(totalVol / targetH);
        side = Math.min(side, innerW * 0.92, innerL * 0.6);
        side = Math.max(side, 0.8);
        const ph = Math.min(totalVol / (side * side), WAREHOUSE.heightM * 0.95);
        fw = side; fl = side;

        const pile = new THREE.Mesh(new THREE.BoxGeometry(side, ph, side),
          new THREE.MeshLambertMaterial({ color: mix(CARDBOARD, productColor(p.id), 0.55) }));
        pile.position.set(side / 2, ph / 2 + 0.12, side / 2);
        pile.userData = { product: p, zoneId: zone.id, isPile: true, layersMax, volPer, pg, pid };
        pg.add(pile); st.meshes.push(pile); pickables.push(pile);

        const pal = new THREE.Mesh(new THREE.BoxGeometry(side * 1.02, 0.12, side * 1.02), new THREE.MeshLambertMaterial({ color: "#8a6a3f" }));
        pal.position.set(side / 2, 0.06, side / 2); pal.userData.zonePart = true; pg.add(pal); st.meshes.push(pal);

        const tag = makeTextSprite("×" + p.stock, { fontSize: 46, bg: "rgba(15,18,24,0.85)", color: "#fff", worldHeight: 0.8 });
        tag.position.set(side / 2, ph + 0.55, side / 2); tag.userData.isLabel = true; tag.userData.zoneTag = true; pg.add(tag); st.meshes.push(tag);

        st.productMeta[pid] = { product: p, zoneId: zone.id, isPile: true, layersMax, volPer, pileSide: side };
      } else {
        const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(d.w, d.h, d.l),
          new THREE.MeshLambertMaterial({ color: mix(CARDBOARD, productColor(p.id), 0.55) }), p.stock);
        const perLayer = cols * rows;
        for (let i = 0; i < p.stock; i++) {
          const layer = Math.floor(i / perLayer);
          const rem = i % perLayer;
          const r = Math.floor(rem / cols), cc = rem % cols;
          dummy.position.set(cc * pitchX + d.w / 2, layer * d.h + d.h / 2 + 0.005, r * pitchZ + d.l / 2);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          inst.setMatrixAt(i, dummy.matrix);
        }
        inst.instanceMatrix.needsUpdate = true;
        inst.userData = { product: p, zoneId: zone.id, isPile: false, layersMax, volPer, cols, rows, layersUsed, pg, pid };
        fw = footW; fl = footL;
        pg.add(inst); st.meshes.push(inst); pickables.push(inst);
        st.productMeta[pid] = { product: p, zoneId: zone.id, isPile: false, layersMax, volPer, cols, rows, layersUsed, inst, dW: d.w, dL: d.l, dH: d.h, pitchX, pitchZ, perLayer };
      }

      let bx, bz, rotDeg = 0;
      if (manual) {
        bx = ox + (manual.x ?? 0);
        bz = oz + (manual.z ?? 0);
        rotDeg = manual.rot ?? 0;
      } else {
        if (curX + fw > innerXMax) { curX = ox + MARGIN; curZ += bandDepth + GAP; bandDepth = 0; }
        bx = curX; bz = curZ;
        curX += fw + GAP * 4;
        bandDepth = Math.max(bandDepth, fl);
      }
      pg.position.set(bx, 0, bz);
      pg.rotation.y = -rotDeg * Math.PI / 180;
      pg.userData = { pid, zoneId: zone.id };
      Object.assign(st.productMeta[pid], { pg, fw, fl, zoneOrigin: { x: ox, z: oz } });
      contactShadow(pg, fw / 2, fl / 2, fw, fl);

      const meta = st.productMeta[pid];
      if (meta.inst) {
        pg.updateMatrixWorld(true);
        const anchor = pg.localToWorld(new THREE.Vector3(0, 0, 0));
        meta.anchorX = anchor.x; meta.anchorZ = anchor.z;
        meta.inst.userData.units = [];
        for (let i = 0; i < p.stock; i++) {
          const layer = Math.floor(i / meta.perLayer), rem = i % meta.perLayer;
          const r = Math.floor(rem / meta.cols), cc = rem % meta.cols;
          const wp = pg.localToWorld(new THREE.Vector3(cc * meta.pitchX + meta.dW / 2, layer * meta.dH + meta.dH / 2 + 0.005, r * meta.pitchZ + meta.dL / 2));
          const u = { pid, zoneId: zone.id, w: meta.dW, l: meta.dL, h: meta.dH, x: wp.x, y: wp.y, z: wp.z, home: { x: wp.x, y: wp.y, z: wp.z }, pg, inst: meta.inst, idx: i };
          UNITS.push(u);
          meta.inst.userData.units[i] = u;
        }
      } else if (meta.isPile) {
        pg.updateMatrixWorld(true);
        const c = pg.localToWorld(new THREE.Vector3(meta.pileSide / 2, 0, meta.pileSide / 2));
        OBSTACLES.push({ x: c.x, z: c.z, w: meta.pileSide, l: meta.pileSide });
      }

      if (bx < ox - 0.01 || bz < oz - 0.01 || bx + fw > ox + w + 0.01 || bz + fl > oz + l + 0.01) st.overflow = true;
    });

    const zoneVol = zone.size.w * zone.size.l * WAREHOUSE.heightM;
    st.fill = Math.min(999, (st.volProducts / zoneVol) * 100);
    st.zoneVol = zoneVol;
    if (st.overflow || st.fill > 100) {
      const RED = "#e0503a";
      st.floorMat.color.set(mix(zone.color, RED, 0.7));
      st.frameMat.color.set(RED);
      st.baseOpacity = 0.28; st.floorMat.opacity = 0.28;
    }
  });

  /* ===== UI / panels / legend / popup ===== */
  gid("wh-dims").textContent = `${WAREHOUSE.widthM} × ${WAREHOUSE.lengthM} × ${WAREHOUSE.heightM} ม.`;

  function fillColor(pct) {
    if (pct < 50) return "#39b56a";
    if (pct < 80) return "#d8c23a";
    if (pct <= 100) return "#e0823a";
    return "#e0503a";
  }

  let selectedZone = null;
  let showOnlySelected = false;

  const zoneList = gid("zoneList");
  ZONES.forEach((zone) => {
    const st = zoneState[zone.id];
    const totalUnits = zone.productIds.reduce((s, pid) => s + (productById[pid]?.stock || 0), 0);
    const prodHtml = zone.productIds.map((pid) => {
      const p = productById[pid];
      if (!p) return "";
      const sw = mix(CARDBOARD, productColor(p.id), 0.55);
      return `<div class="zp-item" data-pid="${pid}">
        <span class="zp-sw" style="background:${sw}"></span>
        <div class="zp-info">
          <div class="zp-name">${p.nameT}</div>
          <div class="zp-sub">${p.code} · ${p.widthCm}×${p.lengthCm}×${p.heightCm} ซม.${p.noLayDown ? " · ⚠ห้ามตะแคง" : ""}</div>
        </div>
        <div class="zp-qty">${(p.stock || 0).toLocaleString()}<small>${p.unit}</small></div>
      </div>`;
    }).join("");

    const camBtns = `<button class="zr-cam zr-go">📷 มุมกล้องโซนนี้</button>` +
      (canEdit && onSaveCamera ? `<button class="zr-cam zr-save">💾 บันทึกมุมนี้</button>` : ``);

    const row = document.createElement("div");
    row.className = "zone-row" + (st.overflow ? " overflow" : "");
    row.dataset.zone = zone.id;
    row.innerHTML = `
      <div class="zr-top">
        <span class="zr-swatch" style="background:${zone.color}"></span>
        <span class="zr-name">${zone.name}</span>
      </div>
      <div class="zr-note">${zone.note || ""}</div>
      <div class="zr-meta"><span>ความเต็มพื้นที่</span><span>${st.fill.toFixed(1)}%</span></div>
      <div class="fillbar"><i style="width:${Math.min(100, st.fill)}%; background:${fillColor(st.fill)}"></i></div>
      <div class="zr-actions">${camBtns}</div>
      <div class="zr-warn">⚠ สินค้าล้นเกินพื้นที่โซน</div>
      <div class="zr-products">
        <div class="zp-head">สินค้า ${zone.productIds.length} รายการ · รวม ${totalUnits.toLocaleString()} ชิ้น</div>
        ${prodHtml}
      </div>`;
    row.addEventListener("click", () => selectZone(zone.id));
    row.querySelector(".zr-go").addEventListener("click", (e) => { e.stopPropagation(); snapCCTV(zone.id); });
    const saveBtn = row.querySelector(".zr-save");
    if (saveBtn) saveBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      onSaveCamera(zone.id, captureCamera());
      saveBtn.textContent = "✓ บันทึกแล้ว";
      setT(() => { saveBtn.textContent = "💾 บันทึกมุมนี้"; }, 1600);
    });
    row.querySelectorAll(".zp-item").forEach((it) => {
      it.addEventListener("click", (e) => {
        e.stopPropagation();
        const meta = st.productMeta[it.dataset.pid];
        if (meta) showPopup(meta);
      });
    });
    zoneList.appendChild(row);
  });

  const legendZones = gid("legendZones");
  ZONES.forEach((zone) => {
    const r = document.createElement("div");
    r.className = "lg-row";
    r.innerHTML = `<span class="lg-sw" style="background:${zone.color}"></span><span>${zone.name}</span>`;
    legendZones.appendChild(r);
  });

  function applyVisibility() {
    ZONES.forEach((zone) => {
      const st = zoneState[zone.id];
      const isSel = selectedZone === zone.id;
      const dim = selectedZone && !isSel;
      if (showOnlySelected && selectedZone) st.group.visible = isSel; else st.group.visible = true;
      const op = dim ? 0.12 : 1;
      st.floorMat.opacity = dim ? 0.05 : st.baseOpacity;
      st.frameMat.opacity = dim ? 0.25 : 1; st.frameMat.transparent = true;
      st.meshes.forEach((m) => {
        if (m.isSprite) { m.material.opacity = dim ? 0.18 : 1; return; }
        if (m.material) { m.material.transparent = op < 1; m.material.opacity = op; }
      });
      st.label.material.opacity = dim ? 0.25 : 1;
    });
  }

  function selectZone(id) {
    selectedZone = selectedZone === id ? null : id;
    root.querySelectorAll(".zone-row").forEach((r) => r.classList.toggle("selected", r.dataset.zone === String(selectedZone)));
    gid("btnViewAll").classList.toggle("active", !selectedZone);
    applyVisibility();
    if (selectedZone) frameZone(selectedZone); else tweenTo(DEFAULT_VIEW);
  }
  function viewAll() {
    selectedZone = null;
    root.querySelectorAll(".zone-row").forEach((r) => r.classList.remove("selected"));
    gid("btnViewAll").classList.add("active");
    applyVisibility();
    tweenTo(DEFAULT_VIEW);
  }
  function frameZone(id) {
    const z = ZONES.find((z) => z.id === id);
    const cx = z.origin.x + z.size.w / 2, cz = z.origin.z + z.size.l / 2;
    const span = Math.max(z.size.w, z.size.l);
    tweenTo({ position: [cx + span * 0.7, span * 1.05 + 2, cz + span * 1.1], target: [cx, 1.2, cz], fov: 50 });
  }
  function snapCCTV(id) {
    const z = ZONES.find((z) => z.id === id);
    if (!z) return;
    selectedZone = id;
    root.querySelectorAll(".zone-row").forEach((r) => r.classList.toggle("selected", r.dataset.zone === String(id)));
    gid("btnViewAll").classList.remove("active");
    applyVisibility();
    const cfg = z.camera || { position: DEFAULT_VIEW.position, target: [z.origin.x + z.size.w / 2, 1, z.origin.z + z.size.l / 2], fov: 55 };
    tweenTo({ position: cfg.position.slice(), target: cfg.target.slice(), fov: cfg.fov || 55 });
    gid("ccZoneName").textContent = z.name + " · มุมกล้องเลียนแบบ CCTV";
    renderLiveBar(z);
  }
  // capture current orbit camera as a persistable preset
  function captureCamera() {
    return {
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: [controls.target.x, controls.target.y, controls.target.z],
      fov: camera.fov,
    };
  }

  let tween = null;
  function tweenTo(view, dur) {
    tween = {
      fromPos: camera.position.clone(), toPos: new THREE.Vector3(...view.position),
      fromTgt: controls.target.clone(), toTgt: new THREE.Vector3(...view.target),
      fromFov: camera.fov, toFov: view.fov ?? camera.fov, dur: dur || 0.6, t: 0,
    };
  }
  function updateTween(dt) {
    if (!tween) return;
    tween.t = Math.min(1, tween.t + dt / tween.dur);
    const e = tween.t < 0.5 ? 2 * tween.t * tween.t : 1 - Math.pow(-2 * tween.t + 2, 2) / 2;
    camera.position.lerpVectors(tween.fromPos, tween.toPos, e);
    controls.target.lerpVectors(tween.fromTgt, tween.toTgt, e);
    camera.fov = tween.fromFov + (tween.toFov - tween.fromFov) * e;
    camera.updateProjectionMatrix();
    if (tween.t >= 1) tween = null;
  }

  gid("btnViewAll").addEventListener("click", viewAll);
  gid("btnReset").addEventListener("click", viewAll);

  const btnLabels = gid("btnLabels");
  btnLabels.classList.add("active");
  let labelsOn = true;
  btnLabels.addEventListener("click", () => {
    labelsOn = !labelsOn;
    btnLabels.classList.toggle("active", labelsOn);
    scene.traverse((o) => { if (o.isSprite && o.userData.isLabel) o.visible = labelsOn; });
  });

  const btnGrid = gid("btnGrid");
  btnGrid.classList.add("active");
  let gridOn = true;
  btnGrid.addEventListener("click", () => {
    gridOn = !gridOn;
    btnGrid.classList.toggle("active", gridOn);
    gridGroup.visible = gridOn; edgeLabels.visible = gridOn;
  });

  const btnOnly = gid("btnOnly");
  btnOnly.addEventListener("click", () => {
    showOnlySelected = !showOnlySelected;
    btnOnly.classList.toggle("active", showOnlySelected);
    applyVisibility();
  });

  // ---- CCTV compare pane ----
  const btnCompare = gid("btnCompare");
  const cctvPaneEl = gid("cctvPane");
  let compareOn = false;
  function sizeComparePane() {
    const px = compareOn ? Math.round(gid("app").clientWidth * 0.42) : 0;
    cctvPaneEl.style.flexBasis = px + "px";
    cctvPaneEl.style.width = px + "px";
  }
  function setCompare(on) {
    compareOn = on;
    btnCompare.classList.toggle("active", on);
    sizeComparePane();
    if (on) snapCCTV(selectedZone || ZONES[0]?.id);
    setT(onResize, 60);
    setT(onResize, 300);
  }
  btnCompare.addEventListener("click", () => setCompare(!compareOn));
  gid("ccClose").addEventListener("click", () => setCompare(false));
  const ccFile = gid("ccFile");
  const ccImg = gid("cctvImg");
  const ccDrop = gid("ccDrop");
  ccDrop.addEventListener("click", () => ccFile.click());
  function loadCCTV(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    ccImg.src = url; ccImg.style.display = "block"; ccDrop.style.display = "none";
  }
  ccFile.addEventListener("change", (e) => loadCCTV(e.target.files[0]));
  ["dragover", "drop"].forEach((ev) => ccDrop.addEventListener(ev, (e) => { e.preventDefault(); if (ev === "drop") loadCCTV(e.dataTransfer.files[0]); }));

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

  // ---- click -> product popup ----
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downPt = { x: 0, y: 0 };
  renderer.domElement.addEventListener("pointerdown", (e) => { downPt.x = e.clientX; downPt.y = e.clientY; });
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (moveMode) return;
    if (Math.hypot(e.clientX - downPt.x, e.clientY - downPt.y) > 5) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pickables.filter((m) => m.visible && (!selectedZone || !showOnlySelected || m.userData.zoneId === selectedZone)), false);
    if (hits.length) showPopup(hits[0].object.userData); else hidePopup();
  });

  const popup = gid("popup");
  function showPopup(ud) {
    const p = ud.product; if (!p) return;
    const zone = ZONES.find((z) => z.id === ud.zoneId);
    gid("ppHead").style.background = zone.color;
    gid("ppCode").textContent = p.code + (p.brand && p.brand !== "-" ? " · " + p.brand : "");
    gid("ppName").innerHTML = `${p.nameT}<small>${p.name}</small>`;
    const vol = ud.volPer;
    const layers = ud.layersMax;
    const rows = [
      ["สต็อก", `<b>${(p.stock || 0).toLocaleString()}</b> ${p.unit}`],
      ["ขนาด (กxยxส)", `${p.widthCm}×${p.lengthCm}×${p.heightCm} ซม.`],
      ["ปริมาตร/ชิ้น", `${vol.toFixed(3)} m³`],
      ["ปริมาตรรวม", `${(vol * p.stock).toFixed(2)} m³`],
      ["ซ้อนได้สูงสุด", `${layers} ชั้น (เพดาน ${WAREHOUSE.heightM} ม.)`],
      ["การจัดเก็บ", ud.isPile ? "กอง/พาเลทตัวแทน" : `${ud.cols}×${ud.rows} ต่อชั้น`],
    ];
    gid("ppGrid").innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
    const tag = gid("ppTag");
    if (p.noLayDown) { tag.textContent = "⚠ ห้ามวางตะแคง — ตั้งตามแกนสูงเสมอ"; tag.style.background = "rgba(224,80,58,0.18)"; tag.style.color = "#ff8e7e"; }
    else { tag.textContent = "✓ วางซ้อน/หมุนได้ตามปกติ"; tag.style.background = "rgba(57,181,106,0.16)"; tag.style.color = "#7ee0a3"; }
    popup.style.display = "block";
  }
  function hidePopup() { popup.style.display = "none"; }
  gid("ppClose").addEventListener("click", hidePopup);

  /* ===== arrange mode: drag products + rotate + save layout ===== */
  let moveMode = false, dragging = null, selectedUD = null, dragUnit = null, selUnit = null, selKind = null;
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const dragOff = new THREE.Vector3(), hitPt = new THREE.Vector3();
  const btnMove = gid("btnMove");
  const mpSel = gid("mpSel");

  if (!canEdit) { btnMove.remove(); }

  function ndc(e) {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  }
  function floorAt(e) { ndc(e); raycaster.setFromCamera(pointer, camera); return raycaster.ray.intersectPlane(dragPlane, hitPt) ? hitPt : null; }
  function captureHome() {
    ZONES.forEach((z) => Object.values(zoneState[z.id].productMeta).forEach((m) => {
      if (m.pg && !m.pg.userData.home) m.pg.userData.home = { x: m.pg.position.x, z: m.pg.position.z, rotY: m.pg.rotation.y };
    }));
  }
  function normDeg(rad) { return ((Math.round(-rad * 180 / Math.PI) % 360) + 360) % 360; }
  function selInfo(ud) {
    if (!ud) { mpSel.innerHTML = "— ยังไม่ได้เลือกสินค้า —"; return; }
    const z = ZONES.find((z) => z.id === ud.zoneId);
    const m = zoneState[ud.zoneId].productMeta[ud.pid];
    const rx = m.pg.position.x - z.origin.x, rz = m.pg.position.z - z.origin.z;
    mpSel.innerHTML = `<b>${ud.product.nameT}</b> · ${ud.product.code}<br>โซน ${z.id} · x ${rx.toFixed(2)} ม. · z ${rz.toFixed(2)} ม. · หมุน ${normDeg(m.pg.rotation.y)}°`;
  }
  function setMove(on) {
    moveMode = on;
    if (on && typeof setZoneEdit === "function" && zoneEditMode) setZoneEdit(false);
    root.classList.toggle("moving", on);
    btnMove.classList.toggle("active", on);
    controls.mouseButtons = on
      ? { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
      : { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    if (on) { captureHome(); hidePopup(); }
    else { dragging = null; dragUnit = null; selectedUD = null; selUnit = null; selMarker.visible = false; }
  }
  if (canEdit) btnMove.addEventListener("click", () => setMove(!moveMode));

  const selMarker = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
    new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, depthTest: false }));
  selMarker.visible = false; selMarker.renderOrder = 999; scene.add(selMarker);
  function showMarker(u, ok) {
    selMarker.geometry.dispose();
    selMarker.geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(u.w + 0.03, u.h + 0.03, u.l + 0.03));
    selMarker.position.set(u.x, u.y, u.z);
    selMarker.material.color.set(ok ? "#ffffff" : "#ff5a5a");
    selMarker.visible = true;
  }
  function writeUnit(u) {
    u.pg.updateMatrixWorld();
    const local = u.pg.worldToLocal(new THREE.Vector3(u.x, u.y, u.z));
    dummy.position.copy(local);
    dummy.rotation.set(0, -u.pg.rotation.y, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    u.inst.setMatrixAt(u.idx, dummy.matrix);
    u.inst.instanceMatrix.needsUpdate = true;
  }
  function overlapXZ(ax, az, aw, al, bx, bz, bw, bl) {
    return Math.abs(ax - bx) < (aw + bw) / 2 - 1e-3 && Math.abs(az - bz) < (al + bl) / 2 - 1e-3;
  }
  function resolvePlacement(u, cx, cz) {
    const meta = zoneState[u.zoneId].productMeta[u.pid];
    const sx = meta.anchorX + Math.round((cx - u.w / 2 - meta.anchorX) / meta.pitchX) * meta.pitchX + u.w / 2;
    const sz = meta.anchorZ + Math.round((cz - u.l / 2 - meta.anchorZ) / meta.pitchZ) * meta.pitchZ + u.l / 2;
    if (sx - u.w / 2 < -0.02 || sz - u.l / 2 < -0.02 || sx + u.w / 2 > WAREHOUSE.widthM + 0.02 || sz + u.l / 2 > WAREHOUSE.lengthM + 0.02) return null;
    let stackTop = 0;
    for (const o of UNITS) {
      if (o === u) continue;
      if (!overlapXZ(sx, sz, u.w, u.l, o.x, o.z, o.w, o.l)) continue;
      if (o.pid !== u.pid) return null;
      stackTop = Math.max(stackTop, o.y + o.h / 2);
    }
    for (const o of OBSTACLES) { if (overlapXZ(sx, sz, u.w, u.l, o.x, o.z, o.w, o.l)) return null; }
    const y = stackTop + u.h / 2;
    if (y + u.h / 2 > WAREHOUSE.heightM + 0.02) return null;
    return { x: sx, y, z: sz };
  }
  function unitInfo(u, ok) {
    const p = productById[u.pid];
    mpSel.innerHTML = `<b>${p.nameT}</b> · ${p.code}<br>x ${u.x.toFixed(2)} · z ${u.z.toFixed(2)} · สูง ${u.y.toFixed(2)} ม.`
      + (ok ? "" : ' <span style="color:#ff8e7e">· วางทับสินค้าอื่นไม่ได้</span>');
  }

  renderer.domElement.addEventListener("pointerdown", (e) => {
    if (!moveMode) return;
    ndc(e); raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pickables.filter((m) => m.visible), false);
    if (!hits.length) { selectedUD = null; selUnit = null; dragUnit = null; dragging = null; selMarker.visible = false; selInfo(null); return; }
    const h0 = hits[0], obj = h0.object;
    if (obj.isInstancedMesh && h0.instanceId != null && obj.userData.units) {
      dragUnit = obj.userData.units[h0.instanceId];
      dragging = null; selUnit = dragUnit; selKind = "unit"; selectedUD = obj.userData;
      const fp = floorAt(e); if (fp) dragOff.set(fp.x - dragUnit.x, 0, fp.z - dragUnit.z);
      showMarker(dragUnit, true); unitInfo(dragUnit, true);
    } else {
      const ud = obj.userData; dragging = ud.pg; dragUnit = null; selUnit = null; selKind = "block"; selectedUD = ud;
      const fp = floorAt(e); if (fp) dragOff.set(fp.x - ud.pg.position.x, 0, fp.z - ud.pg.position.z);
      selMarker.visible = false; selInfo(ud);
    }
    renderer.domElement.style.cursor = "grabbing";
  });
  renderer.domElement.addEventListener("pointermove", (e) => {
    if (!moveMode) return;
    if (dragUnit) {
      const fp = floorAt(e); if (!fp) return;
      const place = resolvePlacement(dragUnit, fp.x - dragOff.x, fp.z - dragOff.z);
      if (place) { dragUnit.x = place.x; dragUnit.y = place.y; dragUnit.z = place.z; writeUnit(dragUnit); showMarker(dragUnit, true); unitInfo(dragUnit, true); }
      else { showMarker(dragUnit, false); unitInfo(dragUnit, false); }
    } else if (dragging) {
      const fp = floorAt(e); if (!fp) return;
      dragging.position.x = Math.max(0, Math.min(WAREHOUSE.widthM, fp.x - dragOff.x));
      dragging.position.z = Math.max(0, Math.min(WAREHOUSE.lengthM, fp.z - dragOff.z));
      selInfo(selectedUD);
    }
  });
  addWin("pointerup", () => { if (dragUnit || dragging) { dragUnit = null; dragging = null; renderer.domElement.style.cursor = ""; } });

  // ===== zone-edit mode: move/resize a zone footprint, save to warehouse_layout =====
  let zoneEditMode = false, zeId = null, zePending = null, zeDragging = false;
  const zeOff = new THREE.Vector3();
  const btnZoneEdit = gid("btnZoneEdit");
  if (!canEdit || !onSaveZoneGeom) { btnZoneEdit.remove(); }

  const zePreview = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, depthTest: false }));
  zePreview.renderOrder = 1000; zePreview.visible = false; scene.add(zePreview);
  function setPreviewRect(ox, oz, w, l) {
    const y = 0.12;
    const pts = [ox, y, oz, ox + w, y, oz, ox + w, y, oz, ox + w, y, oz + l,
      ox + w, y, oz + l, ox, y, oz + l, ox, y, oz + l, ox, y, oz];
    zePreview.geometry.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    zePreview.geometry.computeBoundingSphere();
    zePreview.visible = true;
  }
  function zeReadout() {
    const sel = gid("zeSel"), save = gid("zeSave");
    if (!zeId || !zePending) { sel.innerHTML = "— ยังไม่ได้เลือกโซน —"; save.disabled = true; return; }
    const z = ZONES.find((z) => z.id === zeId);
    const { origin: o, size: s } = zePending;
    sel.innerHTML = `<b>โซน ${z ? z.name : zeId}</b><br>x ${o.x} · z ${o.z} ม. · กว้าง ${s.w} · ยาว ${s.l} ม.`;
    save.disabled = false;
  }
  function selectZone(id) {
    const z = ZONES.find((z) => z.id === id);
    if (!z) return;
    zeId = id;
    zePending = snapClampZoneRect({ x: z.origin.x, z: z.origin.z }, { w: z.size.w, l: z.size.l }, WAREHOUSE);
    setPreviewRect(zePending.origin.x, zePending.origin.z, zePending.size.w, zePending.size.l);
    gid("zeW").value = zePending.size.w;
    gid("zeL").value = zePending.size.l;
    zeReadout();
  }
  function setZoneEdit(on) {
    zoneEditMode = on;
    root.classList.toggle("zoneediting", on);
    btnZoneEdit.classList.toggle("active", on);
    controls.mouseButtons = on
      ? { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
      : { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    if (on && moveMode) setMove(false);
    if (!on) { zeId = null; zePending = null; zeDragging = false; zePreview.visible = false; zeReadout(); }
    else { hidePopup(); }
  }
  if (canEdit && onSaveZoneGeom) btnZoneEdit.addEventListener("click", () => setZoneEdit(!zoneEditMode));

  // hover highlight
  let hovered = null;
  renderer.domElement.addEventListener("pointermove", (e) => {
    if (moveMode) return;
    ndc(e); raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pickables.filter((m) => m.visible), false);
    const obj = hits.length ? hits[0].object : null;
    if (obj === hovered) return;
    if (hovered && hovered.material && hovered.material.emissive) hovered.material.emissive.setHex(0x000000);
    hovered = obj;
    if (hovered && hovered.material && hovered.material.emissive) {
      const zc = ZONES.find((z) => z.id === hovered.userData.zoneId);
      hovered.material.emissive.set(zc ? zc.color : "#ffffff");
      hovered.material.emissiveIntensity = 0.28;
    }
    renderer.domElement.style.cursor = hovered ? "pointer" : "";
  });

  function rotateSel(deg) {
    if (selKind !== "block" || !selectedUD || !selectedUD.pg) return;
    selectedUD.pg.rotation.y -= deg * Math.PI / 180; selInfo(selectedUD);
  }
  if (canEdit) {
    gid("mpRotL").addEventListener("click", () => rotateSel(-15));
    gid("mpRotR").addEventListener("click", () => rotateSel(15));
    gid("mpResetPos").addEventListener("click", () => {
      if (selKind === "unit" && selUnit) {
        const h = selUnit.home; selUnit.x = h.x; selUnit.y = h.y; selUnit.z = h.z;
        writeUnit(selUnit); showMarker(selUnit, true); unitInfo(selUnit, true);
      } else if (selectedUD && selectedUD.pg) {
        const pg = selectedUD.pg, h = pg.userData.home;
        if (h) { pg.position.x = h.x; pg.position.z = h.z; pg.rotation.y = h.rotY; }
        selInfo(selectedUD);
      }
    });
    // save the whole arrangement back to the app (warehouse_layout.zones[id].layout)
    gid("mpCopy").addEventListener("click", () => {
      const layoutByZone = {};
      ZONES.forEach((z) => {
        const st = zoneState[z.id], entries = {};
        z.productIds.forEach((pid) => {
          const m = st.productMeta[pid]; if (!m || !m.pg) return;
          const rx = +(m.pg.position.x - z.origin.x).toFixed(2);
          const rz = +(m.pg.position.z - z.origin.z).toFixed(2);
          const rot = normDeg(m.pg.rotation.y);
          entries[pid] = rot ? { x: rx, z: rz, rot } : { x: rx, z: rz };
        });
        if (Object.keys(entries).length) layoutByZone[z.id] = entries;
      });
      if (onSaveLayout) onSaveLayout(layoutByZone);
      const btn = gid("mpCopy");
      btn.textContent = "✓ บันทึกแล้ว";
      setT(() => { btn.textContent = "💾 บันทึกการจัดเรียงทั้งหมด"; }, 1600);
    });
  }

  /* ===== render loop + resize ===== */
  const START_VIEW = {
    position: [DEFAULT_VIEW.position[0] * 1.4, DEFAULT_VIEW.position[1] * 1.55, DEFAULT_VIEW.position[2] * 1.4],
    target: DEFAULT_VIEW.target, fov: DEFAULT_VIEW.fov + 7,
  };
  camera.position.set(...START_VIEW.position);
  camera.fov = START_VIEW.fov;
  camera.updateProjectionMatrix();
  controls.target.set(...START_VIEW.target);
  controls.update();
  tweenTo(DEFAULT_VIEW, 1.6);

  const clock = new THREE.Clock();
  function syncRendererSize() {
    const w = viewport.clientWidth, h = viewport.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio, 2);
    const needW = Math.floor(w * dpr), needH = Math.floor(h * dpr);
    if (renderer.domElement.width !== needW || renderer.domElement.height !== needH) {
      sizeComparePane();
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
  }
  function animate() {
    if (disposed) return;
    rafId = requestAnimationFrame(animate);
    syncRendererSize();
    const dt = clock.getDelta();
    updateTween(dt);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  function onResize() {
    sizeComparePane();
    const w = viewport.clientWidth, h = viewport.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    renderer.render(scene, camera);
  }
  addWin("resize", onResize);
  const ro = new ResizeObserver(onResize); ro.observe(viewport);
  onResize();
  [0, 100, 300, 800].forEach((t) => setT(onResize, t));

  /* ===== dispose ===== */
  function dispose() {
    if (disposed) return;
    disposed = true;
    if (rafId) cancelAnimationFrame(rafId);
    try { ro.disconnect(); } catch { /* noop */ }
    winListeners.forEach(([type, fn, optArg]) => window.removeEventListener(type, fn, optArg));
    timeouts.forEach((t) => clearTimeout(t));
    try { controls.dispose(); } catch { /* noop */ }
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose?.();
      const m = o.material;
      if (m) { (Array.isArray(m) ? m : [m]).forEach((mm) => { mm.map?.dispose?.(); mm.dispose?.(); }); }
    });
    try { renderer.dispose(); renderer.forceContextLoss?.(); } catch { /* noop */ }
    if (renderer.domElement && renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    container.classList.remove("wh3d", "moving");
    container.innerHTML = "";
  }

  return { dispose };
}
