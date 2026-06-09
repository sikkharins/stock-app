import { STOCK_STATUS } from "./constants.js";

// --- Minimal interfaces (duck-typed; only fields helpers actually read) ------

interface StockStatusEntry {
  key: string;
  label: string;
  color: string;
  bg: string;
  icon: string;
  maxDays: number;
}

export interface SaleItem {
  productId: number | string;
  qty: number;
  price: number;
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

export interface Product {
  id: number | string;
  brand?: string;
  name?: string;
  nameT?: string;
  categoryId?: number | string;
  stock?: number;
  minStock?: number;
  sizeClass?: SizeClass;
  cubicM?: number;
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
}

export interface Promo {
  id: number | string;
  mode?: string;
  measureBy?: "qty" | string;
  brands?: string[];
  categoryIds?: (number | string)[];
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

export const mkAudit = (action: string, detail: string, user?: string): Audit => ({
  id: Date.now() + Math.random(),
  date: nowStr(),
  action,
  detail,
  user: user || "system",
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
      ["completed", "pending_delivery"].includes(s.status || "")
  );
  return validSOs.reduce((sum, so) => {
    const matchItems = (so.items || []).filter((it) => {
      const prod = (products || []).find((p) => +p.id === +it.productId);
      if (!prod) return false;
      if ((promo.brands || []).length && !promo.brands!.includes(prod.brand || ""))
        return false;
      if (
        (promo.categoryIds || []).length &&
        !promo.categoryIds!.includes(prod.categoryId as number)
      )
        return false;
      return true;
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
    if (!prod) return false;
    if ((promo.brands || []).length && !promo.brands!.includes(prod.brand || ""))
      return false;
    if (
      (promo.categoryIds || []).length &&
      !promo.categoryIds!.includes(prod.categoryId as number)
    )
      return false;
    return true;
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

// Resolve effective cubic m³ for a product. Override (cubicM) wins; otherwise
// fall back to per-class default; default class = M.
export const productCubicM = (p: Product | undefined | null): number => {
  if (!p) return CLASS_M3.M;
  if (typeof p.cubicM === "number" && p.cubicM > 0) return p.cubicM;
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
  name: string;
  totalQty: number;
  sources: string[]; // SO numbers contributing
}

// Group items across multiple SOs by productId, sum qty, track contributing SO numbers.
// Sort by product display name for stable warehouse picking order.
export const consolidatePickList = (
  sos: Sale[] | undefined | null,
  products: Product[] | undefined | null
): PickListEntry[] => {
  const prodMap = new Map<string | number, Product>(
    (products || []).map((p) => [p.id, p])
  );
  const acc = new Map<string | number, PickListEntry>();
  for (const so of sos || []) {
    for (const it of so.items || []) {
      const existing = acc.get(it.productId);
      const p = prodMap.get(it.productId);
      const name = p?.nameT || p?.name || String(it.productId);
      if (existing) {
        existing.totalQty += +it.qty || 0;
        if (so.soNum && !existing.sources.includes(so.soNum))
          existing.sources.push(so.soNum);
      } else {
        acc.set(it.productId, {
          productId: it.productId,
          name,
          totalQty: +it.qty || 0,
          sources: so.soNum ? [so.soNum] : [],
        });
      }
    }
  }
  return Array.from(acc.values()).sort((a, b) => a.name.localeCompare(b.name));
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

// Parse Google Maps URL (or plain "lat,lng") → {lat, lng} | null
export const parseGmapsUrl = (
  input: string | undefined | null
): { lat: number; lng: number } | null => {
  if (!input) return null;
  const s = input.trim();
  // /maps/@LAT,LNG,ZOOM
  let m = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m) return { lat: +m[1], lng: +m[2] };
  // ?q=LAT,LNG  or  &q=LAT,LNG
  m = s.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m) return { lat: +m[1], lng: +m[2] };
  // embed format: !3dLAT!4dLNG
  m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (m) return { lat: +m[1], lng: +m[2] };
  // plain "LAT, LNG"
  m = s.match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/);
  if (m) return { lat: +m[1], lng: +m[2] };
  return null;
};
