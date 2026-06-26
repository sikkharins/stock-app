# Box edges — outline lines on 3D product boxes

Date: 2026-06-27
Status: approved (design)

## Goal

วาดเส้นขอบกล่อง (outline edges) ให้กล่องสินค้าทุกใบในโกดัง 3D เพื่อให้
มองเห็นแต่ละกล่อง/แต่ละชั้นที่ซ้อนกัน และอ่านความสูงได้จากการนับชั้น
ปัจจุบันกล่องสีเดียวกันเป็น `MeshLambertMaterial` สีตัน ไม่มีเส้นขอบ จึงกลืน
เป็นแท่งทึบ มองไม่ออกว่าซ้อนกันกี่ใบ (เป็นที่มาของคำขอ "ไม่มีเส้นบอกความสูง").

เป็นการเพิ่ม **visual ล้วน** ไม่แตะ data / persistence / logic การจัด-วางกล่องเดิม.

## Background

ใน `scene.js` (ส่วน build กล่อง ~บรรทัด 465–567) แต่ละสินค้าในโซน render สองทาง:

- **กล่องปกติ** (`!usePile`): `InstancedMesh(BoxGeometry(d.w, d.h, d.l), MeshLambertMaterial, p.stock)`
  วาง instance เป็นกริด `cols × rows × layers`. instance แต่ละใบต่างกัน **แค่ตำแหน่ง**
  (`dummy.rotation.set(0,0,0)` เสมอ — การหมุนโซน/บล็อกอยู่ที่ `pg.rotation.y` ของ group).
  center ของ instance ที่ i = `(cc*pitchX + d.w/2, layer*d.h + d.h/2 + 0.005, r*pitchZ + d.l/2)`.
- **กองใหญ่** (`usePile`, stock > `REP_THRESHOLD`=5000): `Mesh(BoxGeometry(side, ph, side))` ก้อนเดียว.

โค้ดมี pattern `EdgesGeometry` + `LineSegments` อยู่แล้ว (กรอบเลือกกล่อง `selMarker` ~บรรทัด 906;
`zePreview` ~บรรทัด 992) — ใช้ pattern เดียวกัน.

โหมดจัดเรียง (✋ move mode): ลาก **ทั้งบล็อก** (`dragging = ud.pg`) ขยับ `pg.position`;
หรือลาก **กล่องเดี่ยว** (`dragUnit`) → `writeUnit()` → `inst.setMatrixAt(idx, …)`. drop ที่
`pointerup` (~บรรทัด 984).

## Design

### รูปลักษณ์

- กล่องทุกใบได้เส้นขอบกล่อง 12 เส้น สีเข้มโปร่งแสง (`#2a2018`, `opacity 0.35`).
- เคารพ depth ปกติ (เส้นด้านหลังถูกบังตามจริง) — ไม่ตั้ง `depthTest:false`/`renderOrder`
  ต่างจาก `selMarker` (ที่ตั้งใจให้ลอยทับ).
- กองใหญ่ (pile) ตีกรอบเส้นขอบรอบก้อน 1 อัน.
- เส้นบาง/จาง พอให้กองหนาแน่นไม่ดูรก แต่กองบาง ๆ เห็นแยกใบชัด.

### โครงสร้าง

เส้นขอบของสินค้าหนึ่งตัว = `LineSegments` **ก้อนเดียว** (1 draw call) ที่ merge เส้นขอบ
ของทุก instance ไว้ด้วยกัน เพราะ instance ต่างกันแค่ตำแหน่ง การ merge จึงเป็นแค่
"บวก offset ตำแหน่งกล่อง" เข้ากับ template ของกล่องใบเดียว ไม่ต้องคูณ matrix.

`LineSegments` เป็น **ลูกของ `pg` group เดิม** → inherit การหมุน/เลื่อนของโซนและบล็อก
อัตโนมัติ (ลากทั้งบล็อกในโหมดจัดเรียง เส้นขอบขยับตามเองโดยไม่ต้อง rebuild).

ไม่ push เข้า `pickables` → ไม่ถูก raycast เวลาลาก ไม่กวน logic pick/drag เดิม.

### material แยกต่อสินค้า (ไม่ใช้ shared) — เหตุผล

`applyVisibility` (~บรรทัด 667–670) วน `st.meshes` แล้ว set `m.material.opacity`/`transparent`
ต่อโซน เพื่อ dim โซนที่ไม่ได้เลือก (op = 1 ปกติ, 0.12 เวลา dim). ดังนั้น:

- เส้นขอบต้องมี `LineBasicMaterial` **ของตัวเอง** (ไม่ share ข้ามสินค้า/โซน) ไม่งั้น dim
  โซนเดียวจะกระทบทุกโซน และค่า 0.35 จะถูกทับ.
- tag `userData.isEdge = true` แล้ว **special-case ใน `applyVisibility`** ให้คง 0.35 ตอนปกติ
  และจางลงตอน dim (ดู §applyVisibility).

### helper ใหม่ใน `scene.js`

helper สร้าง `LineSegments` (พร้อม material ของตัวเอง) จาก list ของ center (local space) + ขนาดกล่อง:

```js
const EDGE_COLOR = "#2a2018", EDGE_OP = 0.35;
// merge box-edge outlines for boxes centered at `centers` (local), each sized dim {w,l,h}
function boxEdges(centers, dim) {
  if (!centers.length) return null;
  const tmpl = new THREE.EdgesGeometry(new THREE.BoxGeometry(dim.w, dim.h, dim.l)); // matches solid box order
  const tp = tmpl.attributes.position, n = tp.count;
  const arr = new Float32Array(n * 3 * centers.length);
  let o = 0;
  for (const c of centers) {
    for (let v = 0; v < n; v++) { arr[o++] = tp.getX(v) + c.x; arr[o++] = tp.getY(v) + c.y; arr[o++] = tp.getZ(v) + c.z; }
  }
  tmpl.dispose();
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
  g.computeBoundingSphere();
  const ls = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: EDGE_COLOR, transparent: true, opacity: EDGE_OP }));
  ls.userData.isEdge = true;
  return ls;
}
```

`BoxGeometry(dim.w, dim.h, dim.l)` ต้องเรียงพารามิเตอร์ให้ตรงกับกล่อง solid (`d.w, d.h, d.l`)
เพื่อให้ edge ทับกล่องพอดี.

### จุดที่เรียก

1. **กล่องปกติ** (ใน `else` branch ~บรรทัด 509–527): ระหว่าง loop ที่ตั้ง matrix
   (`for i<p.stock`) เก็บ center แต่ละใบลง array `centers` แล้วหลัง loop:
   ```js
   const edges = boxEdges(centers, { w: d.w, l: d.l, h: d.h });
   if (edges) { pg.add(edges); st.meshes.push(edges); }
   st.productMeta[pid].edges = edges;            // เก็บไว้ rebuild ตอนย้ายกล่องเดี่ยว
   st.productMeta[pid].dim = { w: d.w, l: d.l, h: d.h };
   ```
   (center = ค่าเดียวกับที่ส่งให้ `dummy.position.set(...)` อยู่แล้ว นำมา reuse).

2. **กองใหญ่** (ใน `usePile` branch ~บรรทัด 496–508): หลังสร้าง `pile`:
   ```js
   const pe = new THREE.LineSegments(new THREE.EdgesGeometry(pile.geometry),
     new THREE.LineBasicMaterial({ color: EDGE_COLOR, transparent: true, opacity: EDGE_OP }));
   pe.position.copy(pile.position); pe.userData.isEdge = true;
   pg.add(pe); st.meshes.push(pe);
   ```

### rebuild ตอนย้ายกล่องเดี่ยว (move mode)

ลากกล่องเดี่ยวแล้วปล่อย → center ของสินค้านั้นเปลี่ยน ต้อง rebuild เส้นขอบของ pid นั้น.
ที่ `pointerup` (~บรรทัด 984) ถ้ามี `dragUnit` ให้ rebuild ก่อนเคลียร์ state:

```js
addWin("pointerup", () => {
  if (dragUnit) rebuildEdges(dragUnit.zoneId, dragUnit.pid);
  if (dragUnit || dragging) { dragUnit = null; dragging = null; renderer.domElement.style.cursor = ""; }
});
```

`rebuildEdges(zoneId, pid)`:
- อ่าน `meta = zoneState[zoneId].productMeta[pid]`; ถ้าไม่มี `meta.edges`/`meta.dim` → return.
- รวบรวม center local จาก `meta.inst.userData.units` (world `u.x/u.y/u.z` → `pg.worldToLocal`).
- remove `meta.edges` ออกจาก `pg`, dispose ทั้ง `.geometry` **และ** `.material`, ลบออกจาก `st.meshes`.
- สร้างใหม่ด้วย `boxEdges(centers, meta.dim)`, `pg.add(edges)`, `st.meshes.push(edges)`,
  อัปเดต `meta.edges = edges`.

ลาก **ทั้งบล็อก** (`dragging`) ไม่ต้อง rebuild — เส้นขอบเป็นลูก `pg` ขยับตามเอง.

### applyVisibility (dim โซนที่ไม่ได้เลือก)

ใน loop `st.meshes.forEach` (~บรรทัด 667–670) เพิ่ม special-case ก่อนบรรทัด generic `if (m.material)`:

```js
st.meshes.forEach((m) => {
  if (m.isSprite) { m.material.opacity = dim ? 0.18 : 1; return; }
  if (m.userData.isEdge) { m.material.transparent = true; m.material.opacity = dim ? 0.08 : EDGE_OP; return; }
  if (m.material) { m.material.transparent = op < 1; m.material.opacity = op; }
});
```

→ เส้นขอบคง 0.35 ตอนปกติ และจางลง (0.08) ตอนโซนถูก dim พร้อมกล่อง.

### dispose

ไม่ต้องแก้ — `dispose()` (~บรรทัด 1190) ใช้ `scene.traverse` dispose `o.geometry` และ material
ของ **ทุก object** รวม `LineSegments` (มี `.geometry` + `.material`) อยู่แล้ว. material เป็นของ
ตัวเองต่อสินค้า (ไม่ share) จึงถูก dispose ครั้งเดียวต่ออัน. rebuild ต้อง dispose ทั้ง
`geometry` **และ** `material` ของ `LineSegments` เก่าเองก่อนสร้างใหม่ (กัน leak ระหว่าง session).

## ขอบเขต / ไฟล์

- แตะเฉพาะ `src/lib/warehouse3d/scene.js` (helper + 2 จุด build + pointerup rebuild + dispose).
- ไม่แตะ `boxPlan.js`, `warehouse3d.js`, `Warehouse3D.jsx`, persistence, logic pick/drag/resize เดิม.
- ไม่เพิ่มตัวเลขเมตร/สเกลความสูง (เป็นฟีเจอร์แยก ถ้าต้องการค่อยทำภายหลัง).

## Edge cases

- สินค้า stock = 0 หรือไม่มี product → `centers` ว่าง, `boxEdges` คืน `null`, ข้าม.
- กล่องที่ overflow ทะลุเพดาน: เส้นขอบ build ตาม center จริง (รวมใบที่เกิน) เหมือนกล่อง solid.
- กองใหญ่ (pile): footprint สี่เหลี่ยม เส้นขอบเป็นกรอบกล่องเดียว ถูกต้อง.
- โหมดจัดเรียงปิดอยู่ (`!canEdit`): ไม่มี move/rebuild — เส้นขอบ static ตั้งแต่ build, ถูกต้อง.

## Testing / verify

- `npm run typecheck` · `npx eslint src/lib/warehouse3d/` สะอาด.
- dev harness (`wh3d-dev.html`, ดู `docs/warehouse-3d-handoff.md` "วิธี verify"):
  - หลัง mount: แต่ละ `pg` ของสินค้ามี child `LineSegments` เพิ่ม (นับ `__SCENE`/traverse).
  - `position` attribute count ของเส้นขอบ = `edgesPerBox * stock` (กล่องปกติ).
  - toggle โหมดจัดเรียง (`#btnMove`) ไป-กลับ ไม่ throw; ลาก-ปล่อยกล่องเดี่ยว (จำลองผ่าน
    eval `writeUnit` + เรียก rebuild) แล้วเส้นขอบ count ยังตรง.
  - `host.querySelector('canvas')` ยัง render (no error ใน `preview_console_logs`).
- ⚠ `preview_screenshot` ของ WebGL timeout เสมอ — ตรวจผ่าน eval/`__DATA`/console เท่านั้น
  ([[warehouse-3d-handoff]]). ภาพจริงผู้ใช้ยืนยันเองในแอป.

## Out of scope

- ป้ายตัวเลขความสูงเป็นเมตร (เส้น + label "2.4 ม.").
- ไม้บรรทัดสเกลแนวตั้งที่มุมโกดัง.
- เส้นกริดอ้างอิงความสูงบนผนัง.
