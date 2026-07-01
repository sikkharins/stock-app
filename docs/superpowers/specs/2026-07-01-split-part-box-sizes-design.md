# Split-part box sizes — design

**Date:** 2026-07-01
**Status:** Approved (brainstorm)

## Problem

สินค้า "ขายแยกส่วน" (split product, เช่น แอร์ = คอยล์ร้อน + คอยล์เย็น) ปัจจุบันมี
ขนาดกล่องชุดเดียวต่อสินค้า (`Product.widthCm/lengthCm/heightCm/noLayDown`) แต่ในความจริง
แต่ละส่วนเป็นกล่องคนละใบ คนละขนาด ต้องเก็บ/จัดเรียงแยกกัน ทั้งตอนจัดเรียงใน zone และ
ในโกดัง 3D. `splitParts[]` เดิมถือแค่ `{key, name, priceRatio}` (ใช้แบ่งราคาบน SO/ใบเสร็จ)
ไม่มีมิติกล่อง.

## Goal

ให้แต่ละส่วนของสินค้าขายแยกส่วนมีขนาดกล่อง (+ ห้ามนอน) ของตัวเอง และถือว่าเป็น
"เหมือนสินค้าแยก" ในการจัดเรียง zone / โกดัง 3D — วางแยก zone ได้อิสระ — และคิดปริมาตร
ให้ถูกต้องทุกที่ที่ใช้ (delivery planning, capacity รถ, occupancy).

## Decisions (จาก brainstorm)

1. เปิด "ขายแยกส่วน" → กล่องระดับ product **หายไป**, แต่ละส่วนมีกล่องของตัวเอง (option A).
2. โกดัง/zone แสดงแต่ละส่วน **เหมือนสินค้าแยก** (ชื่อ + ขนาดแยกกันอยู่แล้ว).
3. แต่ละส่วน **วางแยก zone ได้อิสระ** (zone อ้างอิงระดับส่วน).
4. คิดปริมาตรให้ถูก **ทุกที่ที่ใช้ปริมาตร** (ไม่ใช่แค่ visual).
5. กลไกอ้างอิงส่วนใน zone/3D = **composite pseudo-product id** (`"<productId>:<partKey>"`)
   เลียนแบบ pattern gap-id เดิม.

## Non-goals

- ไม่แตะการแบ่งราคา (`priceRatio`) และ SO snapshot (`item.parts`) — ทำงานเดิมต่อไป.
- ไม่รองรับ stock ต่อส่วนไม่เท่ากัน — 1 ชุด = 1 กล่องต่อส่วน, stock ของทุกส่วน = `product.stock`.

## Design

### 1. Data model (`src/utils/helpers.ts`)

ขยาย `SplitPart` ให้ถือกล่องต่อส่วน:

```ts
export interface SplitPart {
  key: string;
  name: string;
  priceRatio: number;      // เดิม — แบ่งราคา
  widthCm?: number;        // ใหม่ — กล่องต่อส่วน (cm)
  lengthCm?: number;
  heightCm?: number;
  noLayDown?: boolean;     // ห้ามนอน ต่อส่วน
}
```

เมื่อ `splitEnabled` → ฟิลด์กล่องระดับ product (`widthCm/lengthCm/heightCm/noLayDown/cubicM`)
**ไม่ถูกใช้ในการคิดขนาด/ปริมาตร** (ไม่ลบข้อมูลเดิมออก — non-destructive).

### 2. ปริมาตร (`src/utils/helpers.ts`) — แก้ที่เดียว กระจายทั้งระบบ

เพิ่ม helper:

```ts
export const partCubicM = (part: SplitPart | undefined | null): number => {
  if (!part) return 0;
  const { widthCm: w, lengthCm: l, heightCm: h } = part;
  if (typeof w === "number" && typeof l === "number" && typeof h === "number"
      && w > 0 && l > 0 && h > 0) {
    return (w * l * h) / 1_000_000;
  }
  return 0; // ยังไม่กรอกกล่อง → 0 (ปล่อยให้ productCubicM fallback logic เดิม)
};
```

แก้ `productCubicM`:

```
ถ้า splitEnabled && splitParts?.length:
    sum = Σ partCubicM(part)
    ถ้า sum > 0 → return sum
    // ไม่งั้น (ยังไม่กรอกกล่องต่อส่วน) → ตกลง logic เดิม
logic เดิม: cubicM override (>0) → W×L×H → CLASS_M3[sizeClass]
```

ผลข้างเคียง: `soVolumeM3`, `scoreSO`/capacity รถ, occupancy ถูกต้องอัตโนมัติ (ทุกตัวเรียก
`productCubicM`). สินค้า split ที่ยังไม่กรอกกล่องต่อส่วน → ใช้ค่าปริมาตรเดิมไปก่อน (migration ปลอดภัย).

### 3. ฟอร์ม Products (`src/components/Products.jsx`)

- `splitEnabled` = true → **ซ่อน** fieldset "ขนาดกล่อง (cm)" ระดับ product (W/L/H + ห้ามนอน)
  และช่อง "ปริมาตร m³ (override)". คง "กลุ่มขนาด (จัดส่ง)" (`sizeClass`) ไว้เป็น fallback.
- แต่ละแถวส่วน จาก `[key | ชื่อ | ratio | ×]` → เพิ่มบรรทัดขนาด กว้าง/ยาว/สูง (cm) + checkbox ห้ามนอน
  ของส่วนนั้น. อัปเดตด้วย pattern เดิม (map `splitParts` แก้ index i).
- แถบสรุป "ผลรวมสัดส่วน ✓" คงไว้.
- รายการ Products (บรรทัด "ขนาด" ที่ ~`Products.jsx:170`): split → โชว์ขนาดแต่ละส่วนแบบย่อ.

### 4. โกดัง 3D + zone (`src/utils/warehouse3d.js`, `src/components/Zones.jsx`)

เพิ่ม helper กลาง (ใช้ร่วมกันทั้ง buildWarehouseData และ Zones picker):

```
expandProductsForWarehouse(products) -> WarehouseUnit[]
  - non-split: ผ่านเหมือนเดิม (id เดิม)
  - split: แตกเป็น pseudo-product ต่อส่วน
      id: `${p.id}:${part.key}`
      code: part.name || p.code
      nameT: `${p.nameT || p.name} — ${part.name}`
      stock: p.stock                 // 1 ชุด = 1 กล่องต่อส่วน
      widthCm/lengthCm/heightCm: จากส่วน
      noLayDown: จากส่วน
      unit: p.unit
```

- `buildWarehouseData` (`warehouse3d.js:~199`): map PRODUCTS จาก list ที่ expand แล้ว.
- `Zones.jsx` picker: ใช้ helper เดียวกัน → เลือก "คอยล์ร้อน"/"คอยล์เย็น" แยกใส่คนละ zone ได้.
  `productIds` เก็บ composite id (string) และ `boxConfig` keyed ด้วย String(id) → ทำงานได้เลย
  (รองรับ string id อยู่แล้ว เหมือน gap-id).
- **Backward-compat**: ถ้า zone เดิมอ้าง id เปล่า (`123`) ของสินค้าที่ตอนนี้ split → ตอน resolve
  แตกเป็น composite ต่อส่วนอัตโนมัติ เพื่อ config เก่าไม่พัง.

### 5. Migration / edge cases

- สินค้า split ที่มีอยู่ (แอร์) ยังไม่มีกล่องต่อส่วน → หลัง deploy render ขนาด default (sizeClass)
  และปริมาตรใช้ค่าเดิม จนกว่าผู้ใช้เข้าไปกรอกมิติต่อส่วน. ไม่พัง.
- กล่องต่อส่วนกรอกไม่ครบ (บางส่วนไม่มี W/L/H) → ส่วนนั้น `partCubicM = 0`, render ขนาด default.
- `priceRatio` sum ต้อง ~1 เหมือนเดิม (ไม่เกี่ยวกับกล่อง).

## Testing

- `helpers.test.ts`: `partCubicM` (ครบ/ไม่ครบ), `productCubicM` split (ผลรวม, fallback เมื่อยังไม่กรอก),
  `soVolumeM3` กับ split product.
- `warehouse3d.test.ts`: `expandProductsForWarehouse` (non-split ผ่าน, split แตกถูก id/ชื่อ/มิติ),
  resolve composite id + bare-id backward-compat.
- ตาม pattern เดิมของไฟล์ test ทั้งสอง.

## Files touched

- `src/utils/helpers.ts` — SplitPart, partCubicM, productCubicM.
- `src/components/Products.jsx` — per-part box fields, ซ่อน product box เมื่อ split.
- `src/utils/warehouse3d.js` — expandProductsForWarehouse, buildWarehouseData.
- `src/components/Zones.jsx` — picker ใช้ expanded units, backward-compat resolve.
- `src/utils/helpers.test.ts`, `src/utils/warehouse3d.test.ts` — tests.
