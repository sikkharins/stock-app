# Split-part box sizes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้แต่ละส่วนของสินค้าขายแยกส่วน (แอร์ = คอยล์ร้อน + คอยล์เย็น) มีขนาดกล่อง + ห้ามนอน ของตัวเอง และถือเป็น "สินค้าแยก" ในการจัดเรียง zone / โกดัง 3D และคิดปริมาตรถูกต้องทุกที่.

**Architecture:** ขยาย `SplitPart` ให้ถือมิติกล่อง; รวมปริมาตรที่ `productCubicM` ตัวเดียว (กระจายทั้งระบบ); แตกสินค้า split เป็น composite pseudo-product id (`"<id>:<partKey>"`) ที่เลเยอร์ warehouse/zone โดย renderer (scene.js) ไม่ต้องแก้เลย เพราะ lookup ด้วย string key อยู่แล้ว.

**Tech Stack:** React (JSX), TypeScript utils, vitest, vite.

**Spec:** `docs/superpowers/specs/2026-07-01-split-part-box-sizes-design.md`

---

## File structure

- `src/utils/helpers.ts` — `SplitPart` (เพิ่มมิติ), `partCubicM` (ใหม่), `productCubicM` (แก้ให้รวมส่วน).
- `src/utils/helpers.test.ts` — tests ปริมาตร.
- `src/utils/warehouse3d.js` — `expandProductsForWarehouse` (ใหม่), `buildWarehouseData` (wire + zone bare-id compat).
- `src/utils/warehouse3d.test.ts` — tests การแตกส่วน + zone.
- `src/components/Products.jsx` — ฟอร์ม: ช่องกล่องต่อส่วน, ซ่อนกล่อง product เมื่อ split, บรรทัด "ขนาด" ในลิสต์.
- `src/components/Zones.jsx` — picker ใช้ expanded units.
- `src/components/ui/ProductPicker.jsx` — match id แบบ string (รองรับ composite id).

**Notes สำหรับผู้ทำ:**
- `helpers.ts` เป็น .ts → test import **ไม่ใส่** `.ts` (`from "./helpers"`). `warehouse3d.js` เป็น .js → import **ใส่** `.js`.
- เมื่อแก้ `useMemo`/helper ใน component: ประกาศ helper ทุกตัวที่ deps อ้างถึง **เหนือ** useMemo นั้น.
- อย่านิยาม React component ซ้อนใน render ของอีก component.

---

## Task 1: ปริมาตรต่อส่วน (helpers.ts)

**Files:**
- Modify: `src/utils/helpers.ts` (interface `SplitPart` ~L39-43; `productCubicM` L573-587)
- Test: `src/utils/helpers.test.ts`

- [ ] **Step 1: เพิ่มมิติกล่องใน `SplitPart`**

แก้ interface ที่ `src/utils/helpers.ts` (เดิม L39-43) เป็น:

```ts
export interface SplitPart {
  key: string;            // "hot" | "cold" | future
  name: string;           // display name, e.g. "คอยล์ร้อน"
  priceRatio: number;     // 0..1, all ratios on a product must sum to ~1
  // Per-part physical box (cm) — used for zone/3D arrangement & volume.
  // When splitEnabled, these replace the product-level box entirely.
  widthCm?: number;
  lengthCm?: number;
  heightCm?: number;
  noLayDown?: boolean;    // ห้ามนอน ต่อส่วน
}
```

- [ ] **Step 2: เขียน test ที่ล้มก่อน (partCubicM + productCubicM split)**

เพิ่มใน `src/utils/helpers.test.ts` — เพิ่ม `partCubicM` เข้า import จาก `"./helpers"` แล้วเพิ่ม block:

```ts
describe("partCubicM / productCubicM (split parts)", () => {
  const hot = { key: "hot", name: "คอยล์ร้อน", priceRatio: 0.6, widthCm: 100, lengthCm: 100, heightCm: 50 }; // 0.5 m³
  const cold = { key: "cold", name: "คอยล์เย็น", priceRatio: 0.4, widthCm: 100, lengthCm: 100, heightCm: 30 }; // 0.3 m³

  test("partCubicM = W×L×H/1e6 เมื่อครบ, 0 เมื่อไม่ครบ", () => {
    expect(partCubicM(hot)).toBeCloseTo(0.5, 6);
    expect(partCubicM({ key: "x", name: "x", priceRatio: 1 })).toBe(0);
    expect(partCubicM({ key: "x", name: "x", priceRatio: 1, widthCm: 100, lengthCm: 100, heightCm: 0 })).toBe(0);
    expect(partCubicM(null)).toBe(0);
  });

  test("productCubicM ของ split = ผลรวมส่วน", () => {
    const p = { id: 1, splitEnabled: true, splitParts: [hot, cold], sizeClass: "S", cubicM: 99 };
    expect(productCubicM(p)).toBeCloseTo(0.8, 6); // 0.5 + 0.3 (ชนะทั้ง cubicM override และ sizeClass)
  });

  test("productCubicM ของ split ที่ยังไม่กรอกกล่อง → fallback logic เดิม", () => {
    const p = { id: 2, splitEnabled: true, splitParts: [{ key: "hot", name: "ร้อน", priceRatio: 1 }], sizeClass: "L" };
    expect(productCubicM(p)).toBeCloseTo(1.0, 6); // CLASS_M3.L
  });
});
```

- [ ] **Step 3: รัน test ให้ล้ม**

Run: `npx vitest run src/utils/helpers.test.ts`
Expected: FAIL — `partCubicM is not a function` / ผลรวม split ไม่ตรง

- [ ] **Step 4: implement `partCubicM` + แก้ `productCubicM`**

ใน `src/utils/helpers.ts` **เหนือ** `productCubicM` (ก่อน L571) เพิ่ม:

```ts
// Cubic m³ of one split part from its own box dims; 0 if not fully specified.
export const partCubicM = (part: SplitPart | undefined | null): number => {
  if (!part) return 0;
  const { widthCm: w, lengthCm: l, heightCm: h } = part;
  if (
    typeof w === "number" && typeof l === "number" && typeof h === "number" &&
    w > 0 && l > 0 && h > 0
  ) {
    return (w * l * h) / 1_000_000;
  }
  return 0;
};
```

แล้วแก้ต้น `productCubicM` — แทรก block split ก่อน logic เดิม (หลัง `if (!p) return CLASS_M3.M;`):

```ts
export const productCubicM = (p: Product | undefined | null): number => {
  if (!p) return CLASS_M3.M;
  if (p.splitEnabled && Array.isArray(p.splitParts) && p.splitParts.length) {
    const sum = p.splitParts.reduce((s, part) => s + partCubicM(part), 0);
    if (sum > 0) return sum; // มีส่วนที่กรอกกล่อง → ใช้ผลรวม
    // ยังไม่กรอกกล่องต่อส่วน → ตกลง logic เดิมด้านล่าง
  }
  if (typeof p.cubicM === "number" && p.cubicM > 0) return p.cubicM;
  // ... (ส่วน W×L×H และ CLASS_M3 เดิม คงไว้ไม่เปลี่ยน)
```

- [ ] **Step 5: รัน test ให้ผ่าน + typecheck**

Run: `npx vitest run src/utils/helpers.test.ts && npm run typecheck`
Expected: PASS ทั้งหมด, typecheck ไม่มี error

- [ ] **Step 6: Commit**

```bash
git add src/utils/helpers.ts src/utils/helpers.test.ts
git commit -m "feat(split): per-part box dims on SplitPart + volume sums parts"
```

---

## Task 2: แตกส่วนที่เลเยอร์ warehouse/zone (warehouse3d.js)

**Files:**
- Modify: `src/utils/warehouse3d.js` (`mapProduct` L121-138; `buildWarehouseData` L143-202)
- Test: `src/utils/warehouse3d.test.ts`

- [ ] **Step 1: เขียน test ที่ล้มก่อน**

เพิ่มใน `src/utils/warehouse3d.test.ts` — เพิ่ม `expandProductsForWarehouse` เข้า import จาก `"./warehouse3d.js"` แล้วเพิ่ม:

```ts
const splitProduct = (over = {}) => ({
  id: 7, code: "AC-7", name: "AC", nameT: "แอร์ LG", brand: "LG", stock: 350,
  sizeClass: "M", unit: "ชุด", splitEnabled: true,
  splitParts: [
    { key: "hot", name: "คอยล์ร้อน", priceRatio: 0.6, widthCm: 60, lengthCm: 80, heightCm: 90 },
    { key: "cold", name: "คอยล์เย็น", priceRatio: 0.4, widthCm: 90, lengthCm: 30, heightCm: 30, noLayDown: true },
  ],
  ...over,
});

describe("expandProductsForWarehouse", () => {
  test("non-split ผ่านเหมือนเดิม", () => {
    const out = expandProductsForWarehouse([product()]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(1);
  });

  test("split แตกเป็น pseudo-product ต่อส่วน", () => {
    const out = expandProductsForWarehouse([splitProduct()]);
    expect(out.map((u) => u.id)).toEqual(["7:hot", "7:cold"]);
    expect(out[0].nameT).toBe("แอร์ LG — คอยล์ร้อน");
    expect(out[0].stock).toBe(350);
    expect(out[0].widthCm).toBe(60);
    expect(out[0].splitEnabled).toBeFalsy();
    expect(out[1].noLayDown).toBe(true);
  });
});

describe("buildWarehouseData — split products", () => {
  test("PRODUCTS มี composite id ต่อส่วน", () => {
    const { PRODUCTS } = build([splitProduct()], [{ id: "z1", productIds: [] }], {});
    expect(PRODUCTS.map((p) => p.id)).toEqual(["7:hot", "7:cold"]);
  });

  test("zone ที่อ้าง id เปล่า (ของ split เดิม) → แตกเป็นส่วนอัตโนมัติ", () => {
    const { ZONES } = build([splitProduct()], [{ id: "z1", productIds: [7] }], {});
    expect(ZONES[0].productIds).toEqual(["7:hot", "7:cold"]);
  });

  test("zone ที่อ้าง composite id อยู่แล้ว → คงเดิม", () => {
    const { ZONES } = build([splitProduct()], [{ id: "z1", productIds: ["7:cold"] }], {});
    expect(ZONES[0].productIds).toEqual(["7:cold"]);
  });
});
```

- [ ] **Step 2: รัน test ให้ล้ม**

Run: `npx vitest run src/utils/warehouse3d.test.ts`
Expected: FAIL — `expandProductsForWarehouse is not a function`

- [ ] **Step 3: implement `expandProductsForWarehouse`**

ใน `src/utils/warehouse3d.js` **เหนือ** `mapProduct` (ก่อน L119) เพิ่ม export:

```js
// Expand split products into per-part pseudo-products for warehouse/zone use.
// Non-split products pass through unchanged. Each split part becomes a pseudo-
// product with id "<productId>:<partKey>", carrying that part's own box + name.
export function expandProductsForWarehouse(products = []) {
  const list = Array.isArray(products) ? products : [];
  const out = [];
  for (const p of list) {
    if (p && p.splitEnabled && Array.isArray(p.splitParts) && p.splitParts.length) {
      const base = p.nameT || p.name || "";
      for (const part of p.splitParts) {
        out.push({
          ...p,
          id: `${p.id}:${part.key}`,
          code: p.code || "",
          name: p.name ? `${p.name} — ${part.name}` : part.name,
          nameT: base ? `${base} — ${part.name}` : part.name,
          widthCm: part.widthCm,
          lengthCm: part.lengthCm,
          heightCm: part.heightCm,
          noLayDown: !!part.noLayDown,
          cubicM: undefined,     // ปล่อยให้ปริมาตรมาจาก W×L×H ของส่วน
          splitEnabled: false,   // pseudo-product เป็นชิ้นเดียว
          splitParts: undefined,
        });
      }
    } else {
      out.push(p);
    }
  }
  return out;
}
```

- [ ] **Step 4: wire เข้า `buildWarehouseData`**

ใน `src/utils/warehouse3d.js`:

(4a) เปลี่ยนบรรทัด PRODUCTS (เดิม L199) จาก:
```js
  const PRODUCTS = productList.map(mapProduct);
```
เป็น:
```js
  const PRODUCTS = expandProductsForWarehouse(productList).map(mapProduct);
```

(4b) เพิ่ม backward-compat map ของ zone.productIds — **เหนือ** `const ZONES = baseZones.map(...)` (ก่อน L178) แทรก:
```js
  // Split products เดิมอาจถูกอ้างด้วย id เปล่าใน zone.productIds — แตกเป็นส่วนตอน render
  const splitPartIds = new Map();
  for (const p of productList) {
    if (p && p.splitEnabled && Array.isArray(p.splitParts) && p.splitParts.length) {
      splitPartIds.set(String(p.id), p.splitParts.map((part) => `${p.id}:${part.key}`));
    }
  }
  const expandZoneIds = (ids) =>
    (Array.isArray(ids) ? ids : []).flatMap((id) =>
      splitPartIds.has(String(id)) ? splitPartIds.get(String(id)) : [id]
    );
```

(4c) ใน object ที่ `baseZones.map` return (เดิม L188) เปลี่ยน:
```js
      productIds: Array.isArray(z.productIds) ? z.productIds : [],
```
เป็น:
```js
      productIds: expandZoneIds(z.productIds),
```

- [ ] **Step 5: รัน test ให้ผ่าน**

Run: `npx vitest run src/utils/warehouse3d.test.ts`
Expected: PASS ทั้งหมด (รวม test เดิม)

- [ ] **Step 6: Commit**

```bash
git add src/utils/warehouse3d.js src/utils/warehouse3d.test.ts
git commit -m "feat(split): expand split products into per-part units for zone/3D"
```

---

## Task 3: ฟอร์ม Products — กล่องต่อส่วน + ซ่อนกล่อง product เมื่อ split

**Files:**
- Modify: `src/components/Products.jsx` (cubicM Field L324; box fieldset L325-337; split rows L349-356; list dims L170)

- [ ] **Step 1: ซ่อนช่อง "ปริมาตร override" และ fieldset "ขนาดกล่อง" เมื่อ split**

ห่อ Field ปริมาตร override (เดิม L324) ด้วยเงื่อนไข:
```jsx
        {!form.splitEnabled&&<Field label="ปริมาตร m³ (override)"><input type="number" step="0.01" value={form.cubicM??""} onChange={e=>setF("cubicM",e.target.value===""?undefined:parseFloat(e.target.value))} style={IB} placeholder="เว้นไว้ = ใช้ตามกลุ่ม"/></Field>}
```

ห่อ box fieldset (เดิม L325-337 `<div ...>ขนาดกล่อง...</div>`) ด้วย `{!form.splitEnabled&&(...)}`:
```jsx
        {!form.splitEnabled&&<div style={{gridColumn:"1/-1",background:"var(--hover)",border:"1px solid var(--line)",borderRadius:8,padding:"10px 12px",marginTop:4}}>
          {/* ...เนื้อ fieldset เดิมทั้งหมด (หัวข้อ, W/L/H, ห้ามนอน, บรรทัดคำนวณ)... */}
        </div>}
```

- [ ] **Step 2: เพิ่มช่องกล่องต่อส่วนในแต่ละแถว split**

แทนที่ block `{(form.splitParts||[]).map((p,i)=>(...))}` (เดิม L349-356) ด้วย:

```jsx
            {(form.splitParts||[]).map((p,i)=>{
              const upd=(k,v)=>setF("splitParts",(form.splitParts||[]).map((x,xi)=>xi===i?{...x,[k]:v}:x));
              const num=e=>e.target.value===""?undefined:parseFloat(e.target.value);
              return (
              <div key={i} style={{border:"1px solid var(--line)",borderRadius:6,padding:8,marginBottom:6,background:"var(--bg)"}}>
                <div style={{display:"grid",gridTemplateColumns:"100px 1fr 100px 40px",gap:8}}>
                  <input value={p.key||""} onChange={e=>upd("key",e.target.value)} style={IB} placeholder="hot"/>
                  <input value={p.name||""} onChange={e=>upd("name",e.target.value)} style={IB} placeholder="คอยล์ร้อน"/>
                  <input type="number" step="0.01" min="0" max="1" value={p.priceRatio??""} onChange={e=>upd("priceRatio",e.target.value===""?0:parseFloat(e.target.value))} style={{...IB,textAlign:"right"}} placeholder="0.6"/>
                  <button type="button" onClick={()=>setF("splitParts",(form.splitParts||[]).filter((_,xi)=>xi!==i))} style={{padding:"6px 0",borderRadius:5,border:"1px solid var(--red)",background:"rgba(255,59,48,0.12)",color:"var(--red)",cursor:"pointer",fontSize:14,fontFamily:"inherit"}}>×</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr auto",gap:8,marginTop:6,alignItems:"center"}}>
                  <input type="number" step="0.1" value={p.widthCm??""} onChange={e=>upd("widthCm",num(e))} style={IB} placeholder="กว้าง W"/>
                  <input type="number" step="0.1" value={p.lengthCm??""} onChange={e=>upd("lengthCm",num(e))} style={IB} placeholder="ยาว L"/>
                  <input type="number" step="0.1" value={p.heightCm??""} onChange={e=>upd("heightCm",num(e))} style={IB} placeholder="สูง H"/>
                  <label style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"var(--dim)",whiteSpace:"nowrap",cursor:"pointer"}}>
                    <input type="checkbox" checked={!!p.noLayDown} onChange={e=>upd("noLayDown",e.target.checked)}/>ห้ามนอน
                  </label>
                </div>
              </div>
              );
            })}
```

หมายเหตุ: header row เดิม (`key / ชื่อส่วน / ratio` ที่ L346-348) คงไว้; ปุ่ม "+ เพิ่มส่วน" และแถบผลรวมสัดส่วน (L357-358) คงไว้ไม่แก้.

- [ ] **Step 3: บรรทัด "ขนาด" ในลิสต์รองรับ split**

แทนบรรทัด dims เดิม (L170) — แทรกกรณี split ก่อน:
```jsx
        {pr.splitEnabled&&(pr.splitParts||[]).length>0&&<div><span style={{color:"var(--faint)",textTransform:"uppercase",letterSpacing:"0.05em",fontSize:9,marginRight:5}}>แยกส่วน</span>{(pr.splitParts||[]).map(pt=>`${pt.name} ${pt.widthCm&&pt.lengthCm&&pt.heightCm?`${pt.widthCm}×${pt.lengthCm}×${pt.heightCm}`:"—"}`).join(" · ")} cm</div>}
        {!pr.splitEnabled&&hasDims&&<div><span style={{color:"var(--faint)",textTransform:"uppercase",letterSpacing:"0.05em",fontSize:9,marginRight:5}}>ขนาด</span><span className="num">{pr.widthCm+"×"+pr.lengthCm+"×"+pr.heightCm}</span> cm{pr.noLayDown&&<span style={{color:"var(--orange)",marginLeft:6,fontWeight:600}}>· ห้ามนอน</span>}</div>}
```
(บรรทัด `{!hasDims&&pr.sizeClass&&...}` ที่ L171 คงไว้ — สำหรับ split ที่ยังไม่กรอกกล่องจะยังโชว์กลุ่มขนาดตามเดิม)

- [ ] **Step 4: typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: ไม่มี error

- [ ] **Step 5: Verify ใน preview (ห้าม save/confirm — dev ต่อ prod Supabase)**

- เปิดหน้า Products → แก้ไขสินค้าตัวหนึ่ง → เปิด "ขายแยกส่วน":
  - fieldset "ขนาดกล่อง (cm)" ระดับ product และ "ปริมาตร override" **หายไป**
  - แต่ละแถวส่วนมีช่อง กว้าง/ยาว/สูง + ห้ามนอน
  - ปิด "ขายแยกส่วน" → fieldset กล่อง product กลับมา
- ตรวจ console ไม่มี error

- [ ] **Step 6: Commit**

```bash
git add src/components/Products.jsx
git commit -m "feat(split): per-part box fields in product form, hide product box when split"
```

---

## Task 4: Zones picker เลือกส่วนแยกได้ (Zones.jsx + ProductPicker.jsx)

**Files:**
- Modify: `src/components/ui/ProductPicker.jsx` (L7, L16 — match id แบบ string)
- Modify: `src/components/Zones.jsx` (L29 destructure; L114 nameOf; L162/L185 picker; และ getAvail)

- [ ] **Step 1: ให้ ProductPicker match id แบบ string (รองรับ composite id)**

ใน `src/components/ui/ProductPicker.jsx`:

L7 เปลี่ยนจาก:
```jsx
  const sel=value?products.find(p=>p.id===+value):null;
```
เป็น:
```jsx
  const sel=value!=null&&value!==""?products.find(p=>String(p.id)===String(value)):null;
```

L16 (ในการ map) เปลี่ยน `const isSel=value&&+value===pr.id;` เป็น:
```jsx
const isSel=value!=null&&String(value)===String(pr.id);
```

(String(number)===String(number) ใช้ได้กับ id ตัวเลขเดิมทุกที่ — backward compatible; รองรับ id ตัวเลขและ composite string.)

- [ ] **Step 2: Zones ใช้ expanded units**

ใน `src/components/Zones.jsx`:

(2a) เพิ่ม import ด้านบน:
```jsx
import { useState, useMemo } from "react";
import { expandProductsForWarehouse } from "../utils/warehouse3d.js";
```
(รวม `useMemo` เข้ากับ import `useState` เดิมที่ L1)

(2b) ในตัว component หลัง destructure (หลัง L29) เพิ่ม — **เหนือ** ทุก useMemo/handler ที่อ้างถึงมัน:
```jsx
  const pickUnits = useMemo(() => expandProductsForWarehouse(products), [products]);
```

(2c) เปลี่ยนทุกจุดที่ picker/lookup ใช้ `products` ให้ใช้ `pickUnits`:
- L114 `nameOf`: `const p = pickUnits.find((x) => String(x.id) === String(id));`
- L162 ProductPicker (replace): prop `products={pickUnits}` และ `getAvail={(pid) => { const p = pickUnits.find((x) => String(x.id) === String(pid)); return p ? p.stock : 0; }}`
- L185 ProductPicker (add): prop `products={pickUnits}` และ `getAvail` เดียวกัน (ใช้ `pickUnits`)

หมายเหตุ: `addProduct`, `removeProduct`, `moveProduct`, `replaceProductId`, `boxConfig` ใช้ `String(id)` อยู่แล้ว → composite id ทำงานได้ ไม่ต้องแก้.

- [ ] **Step 3: typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: ไม่มี error

- [ ] **Step 4: Verify ใน preview (ห้าม save จริง)**

- ตั้งค่าสินค้าตัวหนึ่งให้เป็น split + กรอกกล่อง 2 ส่วน (ในฟอร์ม แต่ **ยังไม่กด บันทึก** ถ้าไม่อยากเขียน prod — หรือใช้ข้อมูลที่มีอยู่แล้ว)
- ไปหน้า โซน → แก้ไขโซน → ช่องค้นหาสินค้า: พิมพ์ชื่อแอร์ → เห็น "แอร์ ... — คอยล์ร้อน" และ "— คอยล์เย็น" เป็น 2 รายการแยก เลือกใส่คนละโซนได้
- ตรวจ console/preview_logs ไม่มี error

- [ ] **Step 5: Verify โกดัง 3D**

- เปิดแท็บโกดัง 3D → โซนที่ใส่ส่วนแอร์ควรแสดงกล่องตามขนาดของแต่ละส่วน (hot/cold คนละขนาด), popup โชว์ชื่อ "— คอยล์ร้อน/เย็น" และ ห้ามนอน ตามที่ตั้ง
- ตรวจ console ไม่มี error

- [ ] **Step 6: Commit**

```bash
git add src/components/Zones.jsx src/components/ui/ProductPicker.jsx
git commit -m "feat(split): pick split parts independently per zone"
```

---

## Task 5: Full test sweep + finish

- [ ] **Step 1: รัน test + typecheck ทั้งหมด**

Run: `npm test && npm run typecheck`
Expected: PASS ทั้งหมด, ไม่มี type error

- [ ] **Step 2:** ถ้าทุกอย่างเขียว → พร้อม push (ผู้ใช้เป็นคนสั่ง push เอง; push จะ auto-deploy Vercel)

---

## Self-review notes

- **Spec coverage:** SplitPart dims (T1) · volume ทุกที่ผ่าน productCubicM (T1) · form UI (T3) · zone/3D expansion + backward-compat (T2, T4) · tests (T1, T2). ครบทุกส่วนใน spec.
- **scene.js ไม่ต้องแก้:** `productById` lookup ใช้ string key อยู่แล้ว (scene.js:221) → composite id ทำงานได้.
- **Migration:** split เดิมไม่มีกล่องต่อส่วน → productCubicM fallback + 3D ใช้ sizeClass default จนกว่าจะกรอก; zone ที่อ้าง id เปล่าถูกแตกอัตโนมัติใน buildWarehouseData.
- **ProductPicker เป็น shared component:** เปลี่ยนเป็น String-match backward compatible กับ id ตัวเลขทุกจุดที่ใช้ (SO/PO/Zones).
