export interface AuditChange { label: string; from: string; to: string; }

export interface FieldDef {
  key: string;
  label: string;
  fmt?: (v: unknown) => string;
}

const asStr = (fmt: ((v: unknown) => string) | undefined, v: unknown): string =>
  fmt ? fmt(v) : String(v ?? "");

export function diffFields(
  oldObj: Record<string, unknown>,
  next: Record<string, unknown>,
  defs: FieldDef[]
): AuditChange[] {
  const out: AuditChange[] = [];
  for (const d of defs) {
    const from = asStr(d.fmt, oldObj ? oldObj[d.key] : undefined);
    const to = asStr(d.fmt, next ? next[d.key] : undefined);
    if (from !== to) out.push({ label: d.label, from, to });
  }
  return out;
}

export interface LineItem { productId: number; qty: number; price?: number; cost?: number; }
export interface LineOpts {
  priceKey: "price" | "cost";
  nameOf: (productId: number) => string;
  fmtMoney: (n: number) => string;
}

export function diffLineItems(oldItems: LineItem[], newItems: LineItem[], opts: LineOpts): AuditChange[] {
  const { priceKey, nameOf, fmtMoney } = opts;
  const priceOf = (it: LineItem) => Number(it[priceKey] ?? 0);
  const desc = (it: LineItem) => `${it.qty} × ${fmtMoney(priceOf(it))}`;
  const oldMap = new Map<number, LineItem>();
  for (const it of oldItems || []) oldMap.set(it.productId, it);
  const newMap = new Map<number, LineItem>();
  for (const it of newItems || []) newMap.set(it.productId, it);
  const out: AuditChange[] = [];
  for (const it of newItems || []) {
    const prev = oldMap.get(it.productId);
    if (!prev) out.push({ label: "+ " + nameOf(it.productId), from: "—", to: desc(it) });
    else if (prev.qty !== it.qty || priceOf(prev) !== priceOf(it)) out.push({ label: nameOf(it.productId), from: desc(prev), to: desc(it) });
  }
  for (const it of oldItems || []) {
    if (!newMap.has(it.productId)) out.push({ label: "− " + nameOf(it.productId), from: desc(it), to: "—" });
  }
  return out;
}
