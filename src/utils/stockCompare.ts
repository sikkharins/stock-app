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
