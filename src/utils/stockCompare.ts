export interface Pile {
  productId: number | string | null;
  guess: string;
  count: number;
  confidence: "low" | "med" | "high" | string;
  note?: string;
}
export interface Product { id: number | string; brand?: string; name?: string; stock?: number; [k: string]: unknown; }
export interface MatchedRow {
  product: Product;
  aiCount: number;
  systemStock: number;
  diff: number;
  confidence: string;
  note: string;
}
export interface UnmatchedRow { idx: number; guess: string; count: number; confidence: string; note: string; }

const CONF_RANK: Record<string, number> = { low: 0, med: 1, high: 2 };
// คืนตัวที่ "แย่กว่า" (rank ต่ำกว่า)
const worse = (a: string, b: string): string => ((CONF_RANK[a] ?? 0) <= (CONF_RANK[b] ?? 0) ? a : b);

// รวม pile ต่อสินค้า แล้วเทียบ aiCount กับ stock ในระบบ (read-only — ไม่แตะ stock)
export function buildComparison(
  piles: Pile[],
  products: Product[],
): { matched: MatchedRow[]; unmatched: UnmatchedRow[] } {
  const agg = new Map<string, { product: Product; aiCount: number; confidence: string; notes: string[] }>();
  const unmatched: UnmatchedRow[] = [];

  (piles || []).forEach((pile, idx) => {
    const prod = pile.productId != null
      ? (products || []).find((p) => String(p.id) === String(pile.productId))
      : undefined;
    if (!prod) {
      unmatched.push({ idx, guess: pile.guess || "", count: pile.count || 0, confidence: pile.confidence || "low", note: pile.note || "" });
      return;
    }
    const key = String(prod.id);
    const cur = agg.get(key);
    if (!cur) {
      agg.set(key, { product: prod, aiCount: pile.count || 0, confidence: pile.confidence || "low", notes: pile.note ? [pile.note] : [] });
    } else {
      cur.aiCount += pile.count || 0;
      cur.confidence = worse(cur.confidence, pile.confidence || "low");
      if (pile.note) cur.notes.push(pile.note);
    }
  });

  const matched: MatchedRow[] = [...agg.values()]
    .map(({ product, aiCount, confidence, notes }) => {
      const systemStock = Number(product.stock) || 0;
      return { product, aiCount, systemStock, diff: aiCount - systemStock, confidence, note: notes.join(" | ") };
    })
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  return { matched, unmatched };
}

export interface Zone { id: number | string; name: string; note?: string; productIds: (number | string)[]; presets?: { token: string; name: string }[]; }
export interface ExpectedSeenRow { product: Product; aiCount: number; systemStock: number; diff: number; confidence: string; note: string; }
export interface ExpectedMissingRow { product: Product; systemStock: number; }
export interface ForeignRow { product: Product; aiCount: number; confidence: string; note: string; }

// เทียบแบบ scope ต่อโซน (read-only). multi-zone → stock เป็นยอดรวมทั้งคลัง,
// สัญญาณหลัก = presence (expectedMissing) + ของแปลกถิ่น (foreignSeen); diff เป็นข้อมูลประกอบ.
export function buildZoneComparison(
  zone: Zone,
  piles: Pile[],
  products: Product[],
): { expectedSeen: ExpectedSeenRow[]; expectedMissing: ExpectedMissingRow[]; foreignSeen: ForeignRow[]; unmatched: UnmatchedRow[] } {
  const agg = new Map<string, { product: Product; aiCount: number; confidence: string; notes: string[] }>();
  const unmatched: UnmatchedRow[] = [];

  (piles || []).forEach((pile, idx) => {
    const prod = pile.productId != null
      ? (products || []).find((p) => String(p.id) === String(pile.productId))
      : undefined;
    if (!prod) {
      unmatched.push({ idx, guess: pile.guess || "", count: pile.count || 0, confidence: pile.confidence || "low", note: pile.note || "" });
      return;
    }
    const key = String(prod.id);
    const cur = agg.get(key);
    if (!cur) agg.set(key, { product: prod, aiCount: pile.count || 0, confidence: pile.confidence || "low", notes: pile.note ? [pile.note] : [] });
    else { cur.aiCount += pile.count || 0; cur.confidence = worse(cur.confidence, pile.confidence || "low"); if (pile.note) cur.notes.push(pile.note); }
  });

  const zoneSet = new Set((zone?.productIds || []).map((id) => String(id)));
  const seen = [...agg.values()].filter((s) => s.aiCount > 0);
  const seenIds = new Set(seen.map((s) => String(s.product.id)));

  const expectedSeen: ExpectedSeenRow[] = seen
    .filter((s) => zoneSet.has(String(s.product.id)))
    .map((s) => {
      const systemStock = Number(s.product.stock) || 0;
      return { product: s.product, aiCount: s.aiCount, systemStock, diff: s.aiCount - systemStock, confidence: s.confidence, note: s.notes.join(" | ") };
    })
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  const foreignSeen: ForeignRow[] = seen
    .filter((s) => !zoneSet.has(String(s.product.id)))
    .map((s) => ({ product: s.product, aiCount: s.aiCount, confidence: s.confidence, note: s.notes.join(" | ") }));

  const expectedMissing: ExpectedMissingRow[] = [...zoneSet]
    .map((id) => (products || []).find((p) => String(p.id) === id))
    .filter((p): p is Product => !!p)
    .filter((p) => (Number(p.stock) || 0) > 0 && !seenIds.has(String(p.id)))
    .map((p) => ({ product: p, systemStock: Number(p.stock) || 0 }));

  return { expectedSeen, expectedMissing, foreignSeen, unmatched };
}
