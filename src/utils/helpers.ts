import { STOCK_STATUS } from "./constants.js";
import type { AuditChange } from "./auditDiff.js";

// --- Minimal interfaces (duck-typed; only fields helpers actually read) ------

interface StockStatusEntry {
  key: string;
  label: string;
  color: string;
  bg: string;
  icon: string;
  maxDays: number;
}

export interface SaleItemPart {
  key: string;            // matches Product.splitParts[i].key at snapshot time
  name: string;           // denormalized — survives product rename after sale
  price: number;          // per-unit price for this part (= item.price * ratio)
}

export interface SaleItem {
  productId: number | string;
  qty: number;
  price: number;          // per-unit price total. parts price sums to this.
  parts?: SaleItemPart[]; // present only when the product had splitEnabled at sale time
}

export interface Sale {
  soNum?: string;
  customerId?: number | string;
  status?: string;
  date?: string;
  items?: SaleItem[];
  discountAmt?: number;
}

export type SizeClass = "S" | "M" | "L" | "XL";

export interface SplitPart {
  key: string;            // "hot" | "cold" | future
  name: string;           // display name, e.g. "คอยล์ร้อน"
  priceRatio: number;     // 0..1, all ratios on a product must sum to ~1
}

export interface Product {
  id: number | string;
  brand?: string;
  name?: string;
  nameT?: string;
  categoryId?: number | string;
  subcategoryId?: number | string;
  stock?: number;
  minStock?: number;
  price?: number;
  sizeClass?: SizeClass;
  cubicM?: number;
  // Physical dimensions in centimeters — for AI bin-packing optimizer
  widthCm?: number;
  lengthCm?: number;
  heightCm?: number;
  // If true, item cannot be laid on its side (e.g., fridges, water dispensers)
  noLayDown?: boolean;
  // Sold-as-set parts (e.g., AC = hot coil + cold coil). When splitEnabled,
  // SO items snapshot splitParts into `item.parts` at sale time so the SO
  // remains valid even if the product config later changes.
  splitEnabled?: boolean;
  splitParts?: SplitPart[];
}

export interface CategorySub {
  id: number | string;
  name: string;
}

export interface Category {
  id: number | string;
  name: string;
  subs?: CategorySub[];
}

export interface Contact {
  id: number | string;
  type?: string;
  name?: string;
  nameT?: string;
  address?: string;
  lat?: number;
  lng?: number;
  geoNote?: string;
}

export interface Truck {
  id: number;
  name: string;
  capacityM3: number;
  isActive?: boolean;
  note?: string;
  // Physical cargo dimensions in centimeters — for AI bin-packing optimizer
  widthCm?: number;
  lengthCm?: number;
  heightCm?: number;
  // Driver permanently assigned to this truck (changes rarely; not per-run)
  driverName?: string;
}

// Delivery helper pool (พนักงานส่งของ) — small fixed set (typically ≤ 8).
// 1-2 helpers ride each run alongside the driver.
export interface DeliveryHelper {
  id: number;
  name: string;
  phone?: string;
  isActive?: boolean;
  note?: string;
}

export const MAX_HELPERS_PER_RUN = 2;
export const MAX_HELPER_POOL = 8;

// A finalized delivery run — created when dispatcher commits a pick to a truck/date.
// Driver and helper names are denormalized so history stays readable after rename/delete.
export interface DeliveryRun {
  id: number;
  date: string;          // YYYY-MM-DD — the planned delivery date
  truckId: number;
  truckName: string;
  driverName?: string;   // denormalized from truck at commit time
  helperIds?: number[];  // 0-2 helpers from the pool
  helperNames?: string[];
  soNums: string[];
  customerNames: string[];
  revenue: number;
  volumeM3: number;
  driverNote?: string;
  createdAt: number;     // Date.now() — when the run was committed
  createdBy?: string;    // username
}

// Default cubic m³ per size class — used when product has no explicit cubicM
export const CLASS_M3: Record<SizeClass, number> = {
  S: 0.05,
  M: 0.3,
  L: 1.0,
  XL: 2.5,
};

// Default scoring weights (tunable). Phase 2 may move these into user config.
export const SCORE_WEIGHTS = {
  proximity: 0.4,
  capacityFit: 0.2,
  revenue: 0.4,
};
export const REVENUE_THRESHOLD = 30000; // ฿ — "worth a trip"
export const PROXIMITY_RADIUS_KM = 50;

interface PO {
  poNum?: string;
  date?: string;
  status?: string;
}

interface Quote {
  qtNum?: string;
  status?: string;
  validUntil?: string;
}

export interface PromoTier {
  id: number | string;
  threshold: number;
  rewardType?: "percent" | "fixed" | "product" | "special_price" | string;
  rewardValue?: number;
  rewardProductId?: number | string;
  specialPrice?: number;     // ใช้คู่กับ rewardType "special_price" — override ราคา/หน่วย
  scaleReward?: boolean;     // เมื่อ true (รางวัล product) → giftQty = floor(matchedQty / threshold)
}

export interface Promo {
  id: number | string;
  mode?: string;
  measureBy?: "qty" | string;
  brands?: string[];
  categoryIds?: (number | string)[];
  productIds?: (number | string)[];  // qualifying pool โดยระบุ product ID (OR กับ brands + categoryIds)
  tiers?: PromoTier[];
}

interface Customer {
  promoClaims?: Record<string | number, { claimedTierIds?: (number | string)[] }>;
}

export interface Notif {
  type: "warning" | "danger" | "info";
  icon: string;
  msg: string;
}

export interface Log {
  id: number;
  date: string;
  productId: number;
  type: string;
  qty: number;
  qtyBefore: number;
  qtyAfter: number;
  ref: string;
  note: string;
  user: string;
}

export interface Audit {
  id: number;
  date: string;
  action: string;
  detail: string;
  user: string;
  changes?: AuditChange[];
}

export type StockStatusResult = StockStatusEntry & { days: number | null };

// --- Formatters --------------------------------------------------------------

export const fmt = (n: number | string): string =>
  Number(n).toLocaleString("th-TH");

export const round2 = (n: number | string): number =>
  Math.round((+n + Number.EPSILON) * 100) / 100;

export const todayStr = (): string => {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
};

export const nowStr = (): string => {
  const d = new Date();
  return (
    String(d.getDate()).padStart(2, "0") +
    "/" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "/" +
    (d.getFullYear() + 543) +
    " " +
    String(d.getHours()).padStart(2, "0") +
    ":" +
    String(d.getMinutes()).padStart(2, "0")
  );
};

export const toBE = (d: string | undefined | null): string => {
  if (!d) return "-";
  const p = (d || "").split("-");
  if (p.length !== 3) return d;
  return p[2] + "/" + p[1] + "/" + (+p[0] + 543);
};

// Next doc number in format "{prefix}-{yyyy}-{mm}-{xxx}", counter resets monthly.
// On the first-ever transition month (no new-format records yet this year),
// continues from the legacy "{prefix}-{yyyy}-{xxx}" max so numbers don't restart.
export const nextDocNum = (
  prefix: string,
  items: Array<{ [k: string]: unknown }>,
  field: string
): string => {
  const d = new Date();
  const yr = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const reNew = new RegExp("^" + prefix + "-(\\d+)-(\\d+)-(\\d+)$");
  const reOld = new RegExp("^" + prefix + "-(\\d+)-(\\d+)$");
  let mxMonth = 0;
  let mxLegacyYear = 0;
  let hasNewThisYear = false;
  for (const it of items) {
    const v = ((it[field] as string) || "");
    const mN = v.match(reNew);
    if (mN) {
      if (+mN[1] === yr) {
        hasNewThisYear = true;
        if (+mN[2] === +mm) mxMonth = Math.max(mxMonth, +mN[3]);
      }
      continue;
    }
    const mO = v.match(reOld);
    if (mO && +mO[1] === yr) mxLegacyYear = Math.max(mxLegacyYear, +mO[2]);
  }
  const mx = hasNewThisYear ? mxMonth : Math.max(mxMonth, mxLegacyYear);
  return prefix + "-" + yr + "-" + mm + "-" + String(mx + 1).padStart(3, "0");
};

// Legacy SO No. prefix — format "IV{YYYY}/{MM}" based on date string "YYYY-MM-DD"
export const legacyPrefix = (dateStr?: string): string => {
  const s = dateStr || todayStr();
  const [y, m] = s.split("-");
  return "IV" + (y || "") + "/" + (m || "");
};

// Split full legacyNum "IV2026/05003" → {prefix:"IV2026/05", suffix:"003"}
export const splitLegacyNum = (
  full?: string
): { prefix: string; suffix: string } => {
  const m = (full || "").match(/^(IV\d{4}\/\d{2})(.*)$/);
  return m ? { prefix: m[1], suffix: m[2] } : { prefix: full || "", suffix: "" };
};

export const fmtD = (s: string | undefined | null): string => {
  if (!s || s === "-") return "-";
  if (s.includes("-") && s.split("-").length === 3) return toBE(s);
  const [datePart, timePart] = (s + " ").split(" ");
  const dp = datePart.split("/");
  if (dp.length === 3) {
    let y = +dp[2];
    if (y < 100) y += 2500;
    dp[0] = dp[0].padStart(2, "0");
    dp[1] = dp[1].padStart(2, "0");
    return (
      dp[0] + "/" + dp[1] + "/" + y + (timePart.trim() ? " " + timePart.trim() : "")
    );
  }
  return s;
};

export const mkLog = (
  pid: number | string,
  type: string,
  qty: number | string,
  before: number | string,
  after: number | string,
  ref?: string,
  note?: string,
  user?: string
): Log => ({
  id: Date.now() + Math.random(),
  date: nowStr(),
  productId: +pid,
  type,
  qty: +qty,
  qtyBefore: +before,
  qtyAfter: +after,
  ref: ref || "-",
  note: note || "",
  user: user || "system",
});

export const mkAudit = (action: string, detail: string, user?: string, changes?: AuditChange[]): Audit => ({
  id: Date.now() + Math.random(),
  date: nowStr(),
  action,
  detail,
  user: user || "system",
  ...(changes && changes.length ? { changes } : {}),
});

export const AddDue = (d: string | undefined, n: number): string => {
  const p = (d || "").split("-");
  if (p.length !== 3) return d || "";
  const x = new Date(+p[0], +p[1] - 1, +p[2]);
  x.setDate(x.getDate() + n);
  return (
    x.getFullYear() +
    "-" +
    String(x.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(x.getDate()).padStart(2, "0")
  );
};

export const fmtDur = (s: number | undefined | null): string => {
  if (!s || s < 0) return "-";
  if (s < 60) return s + "วิ";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "น.";
  return Math.floor(m / 60) + "ชม. " + (m % 60) + "น.";
};

export const getSS = (
  pid: number | string,
  sales: Sale[] | undefined | null
): StockStatusResult => {
  let last: number | null = null;
  (sales || [])
    .filter((s) => s.status === "completed")
    .forEach((so) =>
      (so.items || []).forEach((i) => {
        if (i.productId === pid) {
          const d = new Date(so.date || "").getTime();
          if (last === null || d > last) last = d;
        }
      })
    );
  if (last === null)
    return {
      key: "fossil",
      label: "Fossil",
      color: "#666",
      bg: "#e8e8e8",
      icon: "F",
      maxDays: Infinity,
      days: null,
    };
  const days = Math.floor((Date.now() - last) / 864e5);
  const entry =
    (STOCK_STATUS as StockStatusEntry[]).find((s) => days <= s.maxDays) ||
    (STOCK_STATUS as StockStatusEntry[])[3];
  return { ...entry, days };
};

export const getNotifs = (
  products: Product[] | undefined | null,
  sales: Sale[] | undefined | null,
  pos: PO[] | undefined | null,
  // payments param kept for backward-compat signature; not used by current rules
  _payments: unknown,
  quotes: Quote[] | undefined | null
): Notif[] => {
  const n: Notif[] = [];
  const now = new Date();
  (products || [])
    .filter((p) => (p.minStock || 0) > 0 && (p.stock || 0) <= (p.minStock || 0))
    .forEach((p) =>
      n.push({
        type: "warning",
        icon: "!",
        msg:
          (p.brand || "") +
          " — " +
          (p.nameT || p.name || "") +
          " สต็อกต่ำ (เหลือ " +
          (p.stock || 0) +
          ")",
      })
    );
  (pos || []).forEach((po) => {
    const d = Math.floor((+now - +new Date(po.date || "")) / 864e5);
    if (po.status === "pending" && d > 14)
      n.push({ type: "warning", icon: "PO", msg: po.poNum + " ค้าง " + d + " วัน" });
    else if (po.status === "pending_approval")
      n.push({ type: "info", icon: "!", msg: po.poNum + " รอการอนุมัติ" });
    else if (po.status === "approved" && d > 14)
      n.push({
        type: "warning",
        icon: "PO",
        msg: po.poNum + " อนุมัติแล้ว ค้าง " + d + " วัน",
      });
  });
  (quotes || [])
    .filter((q) => q.status === "sent" && q.validUntil)
    .forEach((q) => {
      const d = Math.floor((+new Date(q.validUntil || "") - +now) / 864e5);
      if (d < 0)
        n.push({ type: "danger", icon: "QT", msg: q.qtNum + " หมดอายุ" });
      else if (d <= 3)
        n.push({
          type: "warning",
          icon: "QT",
          msg: q.qtNum + " หมดอายุใน " + d + "d",
        });
    });
  return n;
};

// Promo qualifying check — productIds / brands / categoryIds ทำงานแบบ OR
// (ตรงข้อใดข้อหนึ่งก็เข้าเงื่อนไข). ถ้าทั้ง 3 ว่าง → match ทุกสินค้า.
export const productQualifiesForPromo = (
  prod: Product | undefined | null,
  promo: Promo | undefined | null
): boolean => {
  if (!prod || !promo) return false;
  const hasBrands = (promo.brands || []).length > 0;
  const hasCats = (promo.categoryIds || []).length > 0;
  const hasProds = (promo.productIds || []).length > 0;
  if (!hasBrands && !hasCats && !hasProds) return true;
  if (hasProds && promo.productIds!.some((id) => +id === +prod.id)) return true;
  if (hasBrands && promo.brands!.includes(prod.brand || "")) return true;
  if (
    hasCats &&
    promo.categoryIds!.some((id) => +id === +((prod.categoryId as number) ?? 0))
  )
    return true;
  return false;
};

// Promo helpers (accumulate mode) — sum ยอดสะสมของลูกค้าจาก SO ที่จัดส่ง/รอส่ง
export const calcAccumulatedTotal = (
  customerId: number | string | undefined | null,
  promo: Promo | undefined | null,
  sales: Sale[] | undefined | null,
  products: Product[] | undefined | null
): number => {
  if (!promo || promo.mode !== "accumulate" || !customerId) return 0;
  const validSOs = (sales || []).filter(
    (s) =>
      +(s.customerId ?? 0) === +customerId &&
      ["completed", "pending_delivery", "out_for_delivery"].includes(s.status || "")
  );
  return validSOs.reduce((sum, so) => {
    const matchItems = (so.items || []).filter((it) => {
      const prod = (products || []).find((p) => +p.id === +it.productId);
      return productQualifiesForPromo(prod, promo);
    });
    return (
      sum +
      matchItems.reduce(
        (s, it) =>
          promo.measureBy === "qty"
            ? s + (+it.qty || 0)
            : s + (+it.qty || 0) * (+it.price || 0),
        0
      )
    );
  }, 0);
};

// คำนวณยอด match ของ items ใน SO ปัจจุบัน (สำหรับ accumulate mode — เพิ่มยอดสะสม)
export const calcCurrentMatchTotal = (
  items: SaleItem[] | undefined | null,
  promo: Promo | undefined | null,
  products: Product[] | undefined | null
): number => {
  if (!promo) return 0;
  const matchItems = (items || []).filter((it) => {
    if (!it.productId || !(+it.qty > 0)) return false;
    const prod = (products || []).find((p) => +p.id === +it.productId);
    return productQualifiesForPromo(prod, promo);
  });
  return matchItems.reduce(
    (s, it) =>
      promo.measureBy === "qty"
        ? s + (+it.qty || 0)
        : s + (+it.qty || 0) * (+it.price || 0),
    0
  );
};

// หา tier ที่ลูกค้าสามารถ claim ได้ (ครบขั้น + ยังไม่เคย claim)
export const findClaimableTiers = (
  customer: Customer | undefined | null,
  promo: Promo,
  totalAccumulated: number
): PromoTier[] => {
  const claimed = customer?.promoClaims?.[promo.id]?.claimedTierIds || [];
  return (promo.tiers || [])
    .filter((t) => totalAccumulated >= t.threshold && !claimed.includes(t.id))
    .slice()
    .sort((a, b) => a.threshold - b.threshold);
};

// --- Delivery planning helpers ---------------------------------------------

// Great-circle distance in kilometers between two geo points (haversine formula).
export const haversineKm = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371; // Earth radius in km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
};

// Resolve effective cubic m³ for a product. Priority: explicit cubicM override →
// computed from W×L×H (cm) → per-class default. Default class = M.
export const productCubicM = (p: Product | undefined | null): number => {
  if (!p) return CLASS_M3.M;
  if (typeof p.cubicM === "number" && p.cubicM > 0) return p.cubicM;
  if (
    typeof p.widthCm === "number" &&
    typeof p.lengthCm === "number" &&
    typeof p.heightCm === "number" &&
    p.widthCm > 0 &&
    p.lengthCm > 0 &&
    p.heightCm > 0
  ) {
    return (p.widthCm * p.lengthCm * p.heightCm) / 1_000_000;
  }
  return CLASS_M3[p.sizeClass ?? "M"];
};

// Sum cubic m³ of all items in an SO.
export const soVolumeM3 = (
  so: Sale | undefined | null,
  products: Product[] | undefined | null
): number => {
  if (!so) return 0;
  const prodMap = new Map<string | number, Product>(
    (products || []).map((p) => [p.id, p])
  );
  return (so.items || []).reduce((sum, it) => {
    const p = prodMap.get(it.productId);
    return sum + productCubicM(p) * (+it.qty || 0);
  }, 0);
};

// SO revenue = sum(items.qty * items.price) - discountAmt (matches existing arList math)
export const soRevenue = (so: Sale | undefined | null): number => {
  if (!so) return 0;
  const itemsTotal = (so.items || []).reduce(
    (s, it) => s + (+it.qty || 0) * (+it.price || 0),
    0
  );
  return itemsTotal - (so.discountAmt || 0);
};

export interface PickListEntry {
  productId: number | string;
  partKey: string;        // "" when the item is not split
  partName?: string;      // present only for split rows; e.g. "คอยล์ร้อน"
  name: string;           // full display name (incl. " — partName" for split rows)
  totalQty: number;
  sources: string[];      // SO numbers contributing
}

// Default split (AC): hot 60%, cold 40%. Cloneable when the user first enables
// the toggle on a Product so they can edit ratios per-SKU without mutating
// this constant.
export const DEFAULT_SPLIT_PARTS: SplitPart[] = [
  { key: "hot", name: "คอยล์ร้อน", priceRatio: 0.6 },
  { key: "cold", name: "คอยล์เย็น", priceRatio: 0.4 },
];

// Build a SaleItem.parts snapshot from a product config + the chosen unit price.
// Returns undefined when the product doesn't have a valid split config, so
// caller (Sales.doSave) can leave .parts off the item entirely.
export const snapshotItemParts = (
  product: Product | undefined | null,
  unitPrice: number
): SaleItemPart[] | undefined => {
  if (!product || !product.splitEnabled) return undefined;
  const parts = product.splitParts;
  if (!parts || parts.length === 0) return undefined;
  const ratioSum = parts.reduce((s, p) => s + (+p.priceRatio || 0), 0);
  if (Math.abs(ratioSum - 1) > 0.001) return undefined; // misconfigured
  const safePrice = +unitPrice || 0;
  return parts.map((p) => ({
    key: p.key,
    name: p.name,
    price: round2(safePrice * (+p.priceRatio || 0)),
  }));
};

// --- Quick SO builder -------------------------------------------------------
// Pure construction of a Sales Order object identical in shape to Sales.doSave
// (src/components/Sales.jsx), so the Quick SO wizard produces SOs that are
// interchangeable with the full form: same fields → same stock reservation,
// doc numbering, and special-approval rule. Supports claim-now rewards + wallet
// redemption (the "brief promo" subset). "Save reward to wallet for later"
// intentionally stays in the full form only.

export interface SelectedReward {
  promoId: number | string;
  tierId: number | string;
  tier: PromoTier;
  promo?: Promo | null;
  source: "claim" | "wallet";
  walletId?: number | string;
  matchedTotal?: number;
}

export interface SavedReward {
  id: number | string;
  promoId: number | string;
  promoName?: string;
  tier: PromoTier;
  promo?: Promo | null;
  matchedTotal?: number;
  savedAt?: string;
  savedFromSO?: string;
}

export interface VatRep {
  id: number | string;
  name: string;
  address?: string;
  idCard?: string;
}

export interface SaleCustomer {
  id: number | string;
  vatReps?: VatRep[];
  savedRewards?: SavedReward[];
  promoClaims?: Record<
    string | number,
    {
      claimedTierIds?: (number | string)[];
      lastClaimedAt?: string;
      lastClaimedSO?: string;
    }
  >;
}

export interface BuildSOInput {
  customerId: number | string;
  date: string;
  items: { productId: number | string; qty: number | string; price: number | string }[];
  payType: string;
  discPct?: number;
  creditDays?: number;
  includeVat?: boolean;
  extraDiscPct?: number | string;
  extraDiscAmt?: number | string;
  note?: string;
  legacyNum?: string;
  useVatRep?: boolean;
  vatRepId?: number | string;
  eventId?: number | string;
  eventPackPurchases?: unknown[];
  selectedRewards?: SelectedReward[];
}

export interface BuildSOCtx {
  sales: Sale[];
  products: Product[];
  contacts: SaleCustomer[];
  hasApv?: boolean;
}

export interface BuiltSaleItem {
  productId: number;
  qty: number;
  price: number;
  parts?: SaleItemPart[];
  unitPrice?: number;
}

export interface AppliedReward {
  promoId: number | string;
  tierId: number | string;
  source: string;
  walletId?: number | string;
}

export interface BuiltSale {
  id: number;
  soNum: string;
  status: string;
  fromQuote: string;
  customerId: number;
  date: string;
  items: BuiltSaleItem[];
  origPrices: number[];
  includeVat: boolean;
  vatAmount: number;
  payType: string;
  discountAmt: number;
  discPct: number;
  extraDiscPct: number;
  extraDiscAmt: number;
  rewardDiscPct: number;
  rewardDiscAmt: number;
  appliedRewards: AppliedReward[];
  creditDays: number;
  useVatRep: boolean;
  vatRepName: string;
  vatRepAddress: string;
  vatRepIdCard: string;
  note: string;
  legacyNum: string;
  eventId: number | string;
  eventPackPurchases: unknown[];
}

export interface BuildSOResult {
  so: BuiltSale;
  customerPatch: SaleCustomer | null;
  logLabel: string;
}

export const buildSalesOrder = (
  input: BuildSOInput,
  ctx: BuildSOCtx
): BuildSOResult => {
  const { sales, products, hasApv } = ctx;
  const findProduct = (id: number | string) =>
    products.find((p) => +p.id === +id);

  const baseItems: BuiltSaleItem[] = input.items.map((i) => {
    const p = findProduct(i.productId);
    const parts = snapshotItemParts(p, +i.price);
    return parts
      ? { productId: +i.productId, qty: +i.qty, price: +i.price, parts }
      : { productId: +i.productId, qty: +i.qty, price: +i.price };
  });

  const customer =
    ctx.contacts.find((c) => +c.id === +input.customerId) || null;

  let rewardDiscPct = 0;
  let rewardDiscAmt = 0;
  const extraItems: BuiltSaleItem[] = [];
  const appliedRewards: AppliedReward[] = [];
  const promoOverriddenIdx = new Set<number>();

  const applyReward = (
    t: PromoTier,
    src: { promoId: number | string; promo?: Promo | null; matchedTotal?: number },
    source: string,
    walletId?: number | string
  ) => {
    if (t.rewardType === "percent") {
      rewardDiscPct += +(t.rewardValue || 0);
    } else if (t.rewardType === "fixed") {
      rewardDiscAmt += +(t.rewardValue || 0);
    } else if (t.rewardType === "product" && t.rewardProductId) {
      const p = findProduct(t.rewardProductId);
      const scale = t.scaleReward !== false;
      const giftQty =
        scale && src.matchedTotal && t.threshold > 0
          ? Math.max(1, Math.floor(+src.matchedTotal / +t.threshold))
          : 1;
      extraItems.push({
        productId: +t.rewardProductId,
        qty: giftQty,
        price: 0,
        unitPrice: p ? +(p.price || 0) : 0,
      });
    } else if (
      t.rewardType === "special_price" &&
      +(t.specialPrice || 0) > 0 &&
      src.promo
    ) {
      const sp = +(t.specialPrice || 0);
      baseItems.forEach((bi, idx) => {
        const pr = findProduct(bi.productId);
        if (!pr) return;
        if (!productQualifiesForPromo(pr, src.promo)) return;
        if (+bi.price > sp) {
          baseItems[idx] = { ...bi, price: sp };
          promoOverriddenIdx.add(idx);
        }
      });
    }
    appliedRewards.push({
      promoId: src.promoId,
      tierId: t.id,
      source,
      ...(walletId != null ? { walletId } : {}),
    });
  };

  const selected = input.selectedRewards || [];
  // claim-now first, then wallet — mirrors Sales.doSave ordering
  selected
    .filter((r) => r.source === "claim")
    .forEach((r) =>
      applyReward(
        r.tier,
        { promoId: r.promoId, promo: r.promo, matchedTotal: r.matchedTotal },
        "claim"
      )
    );
  selected
    .filter((r) => r.source === "wallet")
    .forEach((r) =>
      applyReward(
        r.tier,
        { promoId: r.promoId, promo: r.promo, matchedTotal: r.matchedTotal },
        "wallet",
        r.walletId
      )
    );

  const items = [...baseItems, ...extraItems];
  const sub = items.reduce((s, i) => s + i.qty * i.price, 0);
  const cash = input.payType === "cash";
  const discPctVal = +(input.discPct || 0);
  const disc = cash ? round2((sub * discPctVal) / 100) : 0;
  const ep = +(input.extraDiscPct || 0);
  const ea = +(input.extraDiscAmt || 0);
  const extraDisc = (ep > 0 ? round2((sub * ep) / 100) : 0) + ea;
  const baseSubForReward = baseItems.reduce((s, i) => s + i.qty * i.price, 0);
  const rewardDiscFromPct =
    rewardDiscPct > 0 ? round2((baseSubForReward * rewardDiscPct) / 100) : 0;
  const totalRewardDisc = rewardDiscFromPct + rewardDiscAmt;
  const totalDisc = disc + extraDisc + totalRewardDisc;
  const incVat = input.includeVat !== false;
  const vatAmt = incVat ? round2(((sub - totalDisc) * 7) / 107) : 0;

  const vatReps = customer?.vatReps || [];
  const selRep =
    input.useVatRep && input.vatRepId != null
      ? vatReps.find((r) => +r.id === +(input.vatRepId as number | string))
      : null;

  const origPrices = items.map((i) => {
    const p = findProduct(i.productId);
    return p ? +(p.price || 0) : +i.price;
  });
  const priceChanged = baseItems.some((i, idx) => {
    if (promoOverriddenIdx.has(idx)) return false;
    const p = findProduct(i.productId);
    return !!p && +i.price !== +(p.price || 0);
  });
  const needsApproval = !hasApv && (priceChanged || ep > 0 || ea > 0);

  const soNum = nextDocNum(
    "SO",
    sales as unknown as Array<{ [k: string]: unknown }>,
    "soNum"
  );
  const status = needsApproval ? "pending_special_approval" : "pending_delivery";

  const so: BuiltSale = {
    id: Date.now(),
    soNum,
    status,
    fromQuote: "",
    customerId: +input.customerId,
    date: input.date,
    items,
    origPrices,
    includeVat: incVat,
    vatAmount: vatAmt,
    payType: input.payType,
    discountAmt: totalDisc,
    discPct: cash ? discPctVal : 0,
    extraDiscPct: ep || 0,
    extraDiscAmt: ea || 0,
    rewardDiscPct,
    rewardDiscAmt: totalRewardDisc,
    appliedRewards,
    creditDays: input.payType === "credit" ? +(input.creditDays || 0) : 0,
    useVatRep: !!input.useVatRep,
    vatRepName: selRep ? selRep.name : "",
    vatRepAddress: selRep ? selRep.address || "" : "",
    vatRepIdCard: selRep ? selRep.idCard || "" : "",
    note: input.note || "",
    legacyNum: input.legacyNum || "",
    eventId: input.eventId || "",
    eventPackPurchases: [...(input.eventPackPurchases || [])],
  };

  // Customer promo bookkeeping: mark claimed tiers + remove redeemed wallet
  // items. No "save to wallet" branch in quick mode (full form only).
  let customerPatch: SaleCustomer | null = null;
  const claims = selected.filter((r) => r.source === "claim");
  const usedWalletIds = selected
    .filter((r) => r.source === "wallet" && r.walletId != null)
    .map((r) => r.walletId as number | string);
  if (customer && (claims.length || usedWalletIds.length)) {
    const newClaims: NonNullable<SaleCustomer["promoClaims"]> = {
      ...(customer.promoClaims || {}),
    };
    claims.forEach((c) => {
      const entry = newClaims[c.promoId] || { claimedTierIds: [] };
      const tierIds = entry.claimedTierIds || [];
      newClaims[c.promoId] = {
        ...entry,
        claimedTierIds: tierIds.includes(c.tierId)
          ? tierIds
          : [...tierIds, c.tierId],
        lastClaimedAt: todayStr(),
        lastClaimedSO: soNum,
      };
    });
    const finalRewards = (customer.savedRewards || []).filter(
      (r) => !usedWalletIds.includes(r.id)
    );
    customerPatch = {
      ...customer,
      promoClaims: newClaims,
      savedRewards: finalRewards,
    };
  }

  const logLabel = "สร้าง SO" + (needsApproval ? " (รออนุมัติ)" : "");
  return { so, customerPatch, logLabel };
};

// ───────────────── Drop-ship partial shipment / backorder ─────────────────
// A drop-ship PO can now be shipped in multiple partial rounds. Each round
// records a `shipment` and spawns a right-sized SO; the PO stays open until
// every ordered unit is both shipped and delivered. Pure helpers below drive
// the per-line roll-up, the PO status, and the per-round SO.

export interface POShipmentItem {
  productId: number | string;
  qty: number;
}

export interface POShipment {
  id?: number;
  date?: string;
  by?: string;
  soNum: string;
  items: POShipmentItem[];
  delivered?: boolean;
}

export interface DropshipPOItem {
  productId: number | string;
  qty: number | string;
  cost?: number;
  sellPrice?: number;
}

export interface DropshipPO {
  poNum?: string;
  status?: string;
  linkedSO?: string;
  dropShipCustomerId?: number | string | null;
  items: DropshipPOItem[];
  shipments?: POShipment[];
}

export interface POLineRollup {
  productId: number;
  ordered: number;
  committed: number;
  received: number;
  remaining: number;
}

// Per-product roll-up across a PO's shipments.
//   committed = Σ qty of every shipment (drives "remaining" + blocks double entry)
//   received  = Σ qty of shipments already delivered (drives status + AP)
export const shipmentTotals = (po: DropshipPO): POLineRollup[] => {
  const shipments = po.shipments || [];
  const qtyIn = (keep: (s: POShipment) => boolean, pid: number) =>
    shipments
      .filter(keep)
      .reduce(
        (sum, s) =>
          sum +
          (s.items || [])
            .filter((it) => +it.productId === pid)
            .reduce((a, it) => a + (+it.qty || 0), 0),
        0
      );
  return (po.items || []).map((line) => {
    const pid = +line.productId;
    const ordered = +line.qty || 0;
    const committed = qtyIn(() => true, pid);
    const received = qtyIn((s) => !!s.delivered, pid);
    return {
      productId: pid,
      ordered,
      committed,
      received,
      remaining: Math.max(0, ordered - committed),
    };
  });
};

// Items in a PO whose product (code / name / Thai name) matches a search term.
// Powers the PO search so a delivered product can be traced to its open order.
export const poMatchedItems = (
  po: DropshipPO,
  term: string,
  products: { id: number | string; code?: string; name?: string; nameT?: string }[]
): DropshipPOItem[] => {
  const t = (term || "").trim().toLowerCase();
  if (!t) return [];
  return (po.items || []).filter((it) => {
    const p = products.find((x) => +x.id === +it.productId);
    if (!p) return false;
    return [p.code, p.name, p.nameT].some((v) => (v || "").toLowerCase().includes(t));
  });
};

// Drop-ship PO status derived from its shipments:
//   no shipments → "approved" (awaiting first shipment)
//   fully committed AND every shipment delivered → "received"
//   otherwise → "partial"
export const poStatusFromShipments = (po: DropshipPO): string => {
  const shipments = po.shipments || [];
  if (shipments.length === 0) return "approved";
  const roll = shipmentTotals(po);
  const fullyCommitted = roll.every((r) => r.committed >= r.ordered);
  const allDelivered = shipments.every((s) => !!s.delivered);
  return fullyCommitted && allDelivered ? "received" : "partial";
};

// When editing a PO that already has receipts, you may not drop a received
// product or set its ordered qty below what's already been received. Returns
// the first offending {productId, received}, or null if the edit is allowed.
export const poEditViolation = (
  po: DropshipPO,
  newItems: { productId: number | string; qty: number | string }[]
): { productId: number; received: number } | null => {
  if (!(po.shipments || []).length) return null;
  for (const r of shipmentTotals(po)) {
    if (r.received <= 0) continue;
    const line = newItems.find((i) => +i.productId === r.productId);
    const newQty = line ? +line.qty || 0 : 0;
    if (newQty < r.received)
      return { productId: r.productId, received: r.received };
  }
  return null;
};

export interface BuildDropshipSOContact {
  id: number | string;
  defaultCreditDays?: number;
  defaultVat?: boolean;
}

export interface BuildDropshipSOCtx {
  sales: Array<{ [k: string]: unknown }>;
  products: Product[];
  contacts: BuildDropshipSOContact[];
}

export interface DropshipShipmentSO {
  id: number;
  soNum: string;
  customerId: number;
  date: string;
  status: string;
  items: { productId: number; qty: number; price: number }[];
  origPrices: number[];
  includeVat: boolean;
  vatAmount: number;
  payType: string;
  discountAmt: number;
  discPct: number;
  extraDiscPct: number;
  extraDiscAmt: number;
  creditDays: number;
  useVatRep: boolean;
  vatRepName: string;
  vatRepAddress: string;
  vatRepIdCard: string;
  note: string;
  fromQuote: string;
  linkedPO: string;
  dropShip: boolean;
}

// Build a right-sized pending_delivery SO for one drop-ship shipment round.
// Mirrors the original auto-SO shape but uses the actually-shipped qty per line
// (skipping 0-qty lines) and tags the round number in the note.
export const buildDropshipShipmentSO = (
  po: DropshipPO,
  shipped: POShipmentItem[],
  ctx: BuildDropshipSOCtx,
  roundNo: number
): DropshipShipmentSO => {
  const findProduct = (id: number | string) =>
    ctx.products.find((p) => +p.id === +id);
  const soItems = shipped
    .filter((s) => (+s.qty || 0) > 0)
    .map((s) => {
      const line = (po.items || []).find((i) => +i.productId === +s.productId);
      const product = findProduct(s.productId);
      const price = (line && line.sellPrice) || (product && product.price) || 0;
      return { productId: +s.productId, qty: +s.qty, price: +price };
    });
  const cust = ctx.contacts.find(
    (c) => +c.id === +(po.dropShipCustomerId as number)
  );
  const sub = soItems.reduce((s, i) => s + i.qty * i.price, 0);
  const defCredit = cust?.defaultCreditDays || 45;
  const defVat = cust?.defaultVat !== false;
  const vatAmt = defVat ? round2((sub * 7) / 107) : 0;
  return {
    id: Date.now(),
    soNum: nextDocNum("SO", ctx.sales, "soNum"),
    customerId: +(po.dropShipCustomerId as number),
    date: todayStr(),
    status: "pending_delivery",
    items: soItems,
    origPrices: soItems.map((i) => +i.price),
    includeVat: defVat,
    vatAmount: vatAmt,
    payType: "credit",
    discountAmt: 0,
    discPct: 0,
    extraDiscPct: 0,
    extraDiscAmt: 0,
    creditDays: defCredit,
    useVatRep: false,
    vatRepName: "",
    vatRepAddress: "",
    vatRepIdCard: "",
    note:
      "สร้างจาก " +
      (po.poNum || "") +
      " (ส่งนอกสถานที่ — รอบที่ " +
      roundNo +
      ")",
    fromQuote: "",
    linkedPO: po.poNum || "",
    dropShip: true,
  };
};

export interface ExpandedPart {
  productId: number | string;
  partKey: string;            // "" for non-split
  partName?: string;
  displayName: string;        // "AC LG 12000 — คอยล์ร้อน" or just product name
  qty: number;
  unitPrice: number;
}

// Flatten one SO line item into one or many warehouse pick units. Non-split
// items return a single entry with partKey "". Split items return N entries
// (one per part), each carrying the same qty (since parts ship together).
export const expandItemParts = (
  item: SaleItem,
  product: Product | undefined | null
): ExpandedPart[] => {
  const baseName = product?.nameT || product?.name || String(item.productId);
  if (!item.parts || item.parts.length === 0) {
    return [
      {
        productId: item.productId,
        partKey: "",
        displayName: baseName,
        qty: +item.qty || 0,
        unitPrice: +item.price || 0,
      },
    ];
  }
  return item.parts.map((p) => ({
    productId: item.productId,
    partKey: p.key,
    partName: p.name,
    displayName: `${baseName} — ${p.name}`,
    qty: +item.qty || 0,
    unitPrice: +p.price || 0,
  }));
};

// Group items across multiple SOs by (productId, partKey), sum qty, track
// contributing SO numbers. Sort by product display name for stable warehouse
// picking order. Split items show as 2+ rows so the warehouse picks each part
// as its own box.
export const consolidatePickList = (
  sos: Sale[] | undefined | null,
  products: Product[] | undefined | null
): PickListEntry[] => {
  const prodMap = new Map<string | number, Product>(
    (products || []).map((p) => [p.id, p])
  );
  const acc = new Map<string, PickListEntry>();
  for (const so of sos || []) {
    for (const it of so.items || []) {
      const p = prodMap.get(it.productId);
      const expanded = expandItemParts(it, p);
      for (const e of expanded) {
        const key = `${e.productId}|${e.partKey}`;
        const existing = acc.get(key);
        if (existing) {
          existing.totalQty += e.qty;
          if (so.soNum && !existing.sources.includes(so.soNum))
            existing.sources.push(so.soNum);
        } else {
          acc.set(key, {
            productId: e.productId,
            partKey: e.partKey,
            partName: e.partName,
            name: e.displayName,
            totalQty: e.qty,
            sources: so.soNum ? [so.soNum] : [],
          });
        }
      }
    }
  }
  return Array.from(acc.values()).sort((a, b) => a.name.localeCompare(b.name));
};

export interface RecomputedRun {
  truckId: number | string | null;
  truckName: string;
  driverName: string;
  helperIds: (number | string)[];
  helperNames: string[];
  customerNames: string[];
  revenue: number;
  volumeM3: number;
}

// Recompute a delivery run's denormalized fields for a new SO membership / truck /
// helpers. Pure — no stock or status side effects (the caller flips SO status).
// customerNames is built parallel to soNums (one entry per SO, never deduped) — see
// the warning in DeliveryPlanning.commitRun.
export const recomputeRunRecord = ({
  soNums,
  truck,
  helperIds,
  helpers,
  sales,
  contacts,
  products,
  cN,
}: {
  soNums: string[];
  truck: { id: number | string; name?: string; driverName?: string } | null;
  helperIds: (number | string)[];
  helpers: { id: number | string; name: string }[];
  sales: Sale[] | null | undefined;
  contacts: Contact[] | null | undefined;
  products: Product[] | null | undefined;
  cN: (c: Contact) => string;
}): RecomputedRun => {
  const soByNum = new Map((sales || []).map((s) => [s.soNum, s]));
  const custById = new Map((contacts || []).map((c) => [c.id, c]));
  const helperById = new Map((helpers || []).map((h) => [h.id, h]));

  const customerNames: string[] = [];
  let revenue = 0;
  let volumeM3 = 0;
  for (const sn of soNums) {
    const so = soByNum.get(sn);
    if (!so) {
      customerNames.push("");
      continue;
    }
    const cust = so.customerId != null ? custById.get(so.customerId) : null;
    customerNames.push(cust ? cN(cust) : "—");
    revenue += soRevenue(so);
    volumeM3 += soVolumeM3(so, products);
  }

  const helperNames = (helperIds || [])
    .map((id) => helperById.get(id)?.name)
    .filter((n): n is string => Boolean(n));

  return {
    truckId: truck?.id ?? null,
    truckName: truck?.name || "",
    driverName: truck?.driverName || "",
    helperIds: [...(helperIds || [])],
    helperNames,
    customerNames,
    revenue,
    volumeM3,
  };
};

// Bell-curve-ish score: peak at 0.15–0.25, drops outside 0.05..0.6
const capacityFitScore = (ratio: number): number => {
  if (ratio <= 0 || ratio > 1) return 0;
  if (ratio < 0.05) return ratio / 0.05 * 0.4; // too small
  if (ratio <= 0.25) return 1; // ideal — fits well alongside others
  if (ratio <= 0.6) return 1 - (ratio - 0.25) / 0.35 * 0.6; // shrinks
  return 0.1; // too big to combine
};

// Heuristic score 0-100 for a candidate SO given the pool + truck. See plan doc.
export const scoreSO = (
  so: Sale,
  candidates: Sale[],
  contacts: Contact[] | undefined | null,
  products: Product[] | undefined | null,
  truckCapacityM3: number
): number => {
  const contactMap = new Map<number | string, Contact>(
    (contacts || []).map((c) => [c.id, c])
  );

  // 1. Proximity: density of OTHER candidates within RADIUS km of this SO's customer
  const mine = so.customerId != null ? contactMap.get(so.customerId) : null;
  let proximity = 0.3; // neutral fallback when no lat/lng
  if (mine && typeof mine.lat === "number" && typeof mine.lng === "number") {
    const others = candidates.filter((s) => s.soNum !== so.soNum);
    if (others.length === 0) {
      proximity = 0.3;
    } else {
      let withRadius = 0;
      let othersWithGeo = 0;
      for (const o of others) {
        const oc = o.customerId != null ? contactMap.get(o.customerId) : null;
        if (!oc || typeof oc.lat !== "number" || typeof oc.lng !== "number") continue;
        othersWithGeo++;
        const d = haversineKm(mine.lat, mine.lng, oc.lat, oc.lng);
        if (d <= PROXIMITY_RADIUS_KM) withRadius++;
      }
      proximity = othersWithGeo > 0 ? withRadius / othersWithGeo : 0.3;
    }
  }

  // 2. Capacity fit
  const vol = soVolumeM3(so, products);
  const capacityFit = truckCapacityM3 > 0 ? capacityFitScore(vol / truckCapacityM3) : 0;

  // 3. Revenue normalized
  const rev = soRevenue(so);
  const revenue = Math.min(1, rev / REVENUE_THRESHOLD);

  const w = SCORE_WEIGHTS;
  const score =
    100 *
    (w.proximity * proximity + w.capacityFit * capacityFit + w.revenue * revenue);
  return Math.round(score);
};

export interface CategoryGroup {
  catId: number | string | undefined;
  subId: number | string | undefined;
  catName: string;
  subName: string;
  qty: number;
  totalVolM3: number;
  hasNoLayDown: boolean;
}

// Group SO items by (category, subcategory) — returns sorted by total volume DESC
// so the largest types lead. Used to render a quick "what's in this SO" breakdown.
export const soItemsByCategory = (
  so: Sale | undefined | null,
  products: Product[] | undefined | null,
  categories: Category[] | undefined | null
): CategoryGroup[] => {
  if (!so) return [];
  const productMap = new Map<string | number, Product>(
    (products || []).map((p) => [p.id, p])
  );
  const categoryMap = new Map<string | number, Category>(
    (categories || []).map((c) => [c.id, c])
  );
  const subcategoryNameByPair = new Map<string, string>();
  for (const c of categories || []) {
    for (const s of c.subs || []) {
      subcategoryNameByPair.set(`${c.id}|${s.id}`, s.name);
    }
  }

  const groups = new Map<string, CategoryGroup>();
  for (const it of so.items || []) {
    const p = productMap.get(it.productId);
    if (!p) continue;
    const catId = p.categoryId;
    const subId = p.subcategoryId;
    const cat = catId != null ? categoryMap.get(catId) : undefined;
    const key = `${catId ?? ""}|${subId ?? ""}`;
    const qty = +it.qty || 0;
    const vol = productCubicM(p) * qty;
    const existing = groups.get(key);
    if (existing) {
      existing.qty += qty;
      existing.totalVolM3 += vol;
      if (p.noLayDown) existing.hasNoLayDown = true;
    } else {
      groups.set(key, {
        catId,
        subId,
        catName: cat?.name || "?",
        subName: subcategoryNameByPair.get(key) || "",
        qty,
        totalVolM3: vol,
        hasNoLayDown: !!p.noLayDown,
      });
    }
  }
  return Array.from(groups.values()).sort(
    (a, b) => b.totalVolM3 - a.totalVolM3
  );
};

// Parse Google Maps URL (or plain "lat,lng") → {lat, lng} | null.
// Priority matters: !3d!4d is the place pin (authoritative); ?q= is a shared
// pin; @lat,lng is only the viewport center and is often offset from the
// actual shop. We try precise sources first and fall back to viewport last.
export const parseGmapsUrl = (
  input: string | undefined | null
): { lat: number; lng: number } | null => {
  if (!input) return null;
  const s = input.trim();
  // Place pin (most accurate): /data=...!3dLAT!4dLNG
  let m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (m) return { lat: +m[1], lng: +m[2] };
  // Shared pin: ?q=LAT,LNG or &q=LAT,LNG
  m = s.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m) return { lat: +m[1], lng: +m[2] };
  // Plain "LAT, LNG"
  m = s.match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/);
  if (m) return { lat: +m[1], lng: +m[2] };
  // Viewport center (least accurate — only camera position): /@LAT,LNG,ZOOM
  m = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m) return { lat: +m[1], lng: +m[2] };
  return null;
};

// --- AR payment matcher: find subsets of outstanding SOs summing near a target -
// Pure subset-sum over ONE customer's outstanding SOs (small N). Works in integer
// satang to avoid float drift. Used by ARAP "รับชำระรวม" auto-match.
export interface ComboSO {
  soNum: string;
  remaining: number; // baht
  date?: string;
}

export interface SOCombo {
  soNums: string[];
  sumSatang: number;
  diffSatang: number; // signed: sum - target
}

export const findSOCombos = (
  sos: ComboSO[],
  targetSatang: number,
  tolSatang: number,
  maxResults = 5,
): SOCombo[] => {
  // positive remaining only, integer satang, sorted desc for branch-and-bound
  const items = sos
    .filter((s) => s.remaining > 0)
    .map((s) => ({
      soNum: s.soNum,
      sat: Math.round(s.remaining * 100),
      date: s.date || "",
    }))
    .sort((a, b) => b.sat - a.sat);

  const hi = targetSatang + tolSatang;
  const found: { soNums: string[]; sat: number; date: string }[] = [];
  let nodes = 0;
  const NODE_CAP = 200000;

  const dfs = (i: number, sumSat: number, picked: number[]) => {
    if (nodes++ > NODE_CAP) return;
    if (sumSat > hi) return; // all items positive -> adding more only grows sum
    if (picked.length > 0 && Math.abs(sumSat - targetSatang) <= tolSatang) {
      found.push({
        soNums: picked.map((idx) => items[idx].soNum),
        sat: sumSat,
        date: picked.reduce(
          (m, idx) => (items[idx].date > m ? items[idx].date : m),
          "",
        ),
      });
    }
    for (let j = i; j < items.length; j++) {
      dfs(j + 1, sumSat + items[j].sat, [...picked, j]);
    }
  };
  dfs(0, 0, []);

  found.sort((a, b) => {
    const da = Math.abs(a.sat - targetSatang);
    const db = Math.abs(b.sat - targetSatang);
    if (da !== db) return da - db; // closest first
    if (a.soNums.length !== b.soNums.length)
      return a.soNums.length - b.soNums.length; // fewer SOs first
    return b.date.localeCompare(a.date); // more recent first
  });

  return found.slice(0, maxResults).map((c) => ({
    soNums: c.soNums,
    sumSatang: c.sat,
    diffSatang: c.sat - targetSatang,
  }));
};

// --- SO draft / autosave helpers ---------------------------------------------

export const soFormHasContent = (form: {
  customerId?: unknown;
  items?: Array<{ productId?: unknown } | null>;
}): boolean => {
  if (!form) return false;
  if (form.customerId) return true;
  return (form.items || []).some((it) => !!it && !!it.productId);
};

export const parseSoAutosave = (
  raw: string | null
): null | { form: Record<string, unknown>; [k: string]: unknown } => {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object" || !o.form || typeof o.form !== "object") return null;
    return o;
  } catch {
    return null;
  }
};

export const resolveSaveSoNum = (
  oldSO: { status?: string; soNum?: string } | null | undefined,
  sales: Array<{ [k: string]: unknown }>
): string => {
  if (!oldSO || oldSO.status === "draft") return nextDocNum("SO", sales, "soNum");
  return oldSO.soNum || "";
};

export const resolveSaveStatus = (
  oldSO: { status?: string } | null | undefined,
  needsApproval: boolean
): string => {
  if (!oldSO || oldSO.status === "draft") {
    return needsApproval ? "pending_special_approval" : "pending_delivery";
  }
  if (needsApproval) return "pending_special_approval";
  return oldSO.status || "pending_delivery";
};

export const draftFromForm = (
  form: {
    customerId?: string | number;
    date?: string;
    items?: Array<{ productId?: string | number; qty?: string | number; price?: string | number }>;
    useVatRep?: boolean;
    note?: string;
    legacyNum?: string;
    eventId?: string;
    eventPackPurchases?: unknown[];
  },
  ui: {
    incVat: boolean;
    payType: string;
    discPct: number;
    creditDays: number;
    extraDiscPct?: string | number;
    extraDiscAmt?: string | number;
    vatRepName?: string;
    vatRepAddress?: string;
    vatRepIdCard?: string;
  }
) => ({
  customerId: form.customerId ? +form.customerId : "",
  date: form.date || "",
  items: (form.items || [])
    .filter((i) => i && i.productId)
    .map((i) => ({ productId: +(i.productId as string), qty: +(i.qty ?? 0), price: +(i.price ?? 0) })),
  includeVat: ui.incVat,
  payType: ui.payType,
  discPct: ui.discPct,
  creditDays: ui.creditDays,
  extraDiscPct: +(ui.extraDiscPct || 0),
  extraDiscAmt: +(ui.extraDiscAmt || 0),
  useVatRep: !!form.useVatRep,
  vatRepName: ui.vatRepName || "",
  vatRepAddress: ui.vatRepAddress || "",
  vatRepIdCard: ui.vatRepIdCard || "",
  note: form.note || "",
  legacyNum: form.legacyNum || "",
  eventId: form.eventId || "",
  eventPackPurchases: [...(form.eventPackPurchases || [])],
});
