// 3-way merge for per-array optimistic sync.
// base = value last known in sync with server, mine = local, remote = freshly fetched server value.
// Rule of thumb: never silently drop an insert or an edit. Only honor a delete the other side didn't touch.

type MergeKey = string | number;
type RecordLike = Record<string, unknown>;

// Merge config per Supabase key. `keyOf` identifies records when not using `.id`; cap/ts trim
// capped lists to their original size, newest first.
export interface MergeConfig<T extends RecordLike = RecordLike> {
  keyOf?: (record: T) => MergeKey;
  cap?: number;
  ts?: (record: T) => number;
}

const deepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== "object" || typeof b !== "object") return false;
  const aArr = Array.isArray(a), bArr = Array.isArray(b);
  if (aArr !== bArr) return false;
  if (aArr) {
    const arrA = a as unknown[], arrB = b as unknown[];
    if (arrA.length !== arrB.length) return false;
    for (let i = 0; i < arrA.length; i++) if (!deepEqual(arrA[i], arrB[i])) return false;
    return true;
  }
  const objA = a as RecordLike, objB = b as RecordLike;
  const ak = Object.keys(objA), bk = Object.keys(objB);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!Object.prototype.hasOwnProperty.call(objB, k)) return false;
    if (!deepEqual(objA[k], objB[k])) return false;
  }
  return true;
};

export function mergeByKey<T extends RecordLike>(
  base: T[] | unknown,
  mine: T[] | unknown,
  remote: T[] | unknown,
  keyOf: (record: T) => MergeKey
): T[] {
  const b = (Array.isArray(base) ? base : []) as T[];
  const m = (Array.isArray(mine) ? mine : []) as T[];
  const r = (Array.isArray(remote) ? remote : []) as T[];
  const bMap = new Map<MergeKey, T>(), mMap = new Map<MergeKey, T>(), rMap = new Map<MergeKey, T>();
  for (const x of b) bMap.set(keyOf(x), x);
  for (const x of m) mMap.set(keyOf(x), x);
  for (const x of r) rMap.set(keyOf(x), x);

  // Visit remote order first, then mine-only keys (keeps a stable, predictable order).
  const order: MergeKey[] = [...rMap.keys()];
  for (const k of mMap.keys()) if (!rMap.has(k)) order.push(k);

  const out: T[] = [];
  for (const k of order) {
    const inB = bMap.has(k), inM = mMap.has(k), inR = rMap.has(k);
    const mv = mMap.get(k), rv = rMap.get(k), bv = bMap.get(k);
    if (inM && inR) {
      // I didn't change it but remote did → take remote; otherwise local wins.
      if (inB && deepEqual(mv, bv) && !deepEqual(rv, bv)) out.push(rv as T);
      else out.push(mv as T);
    } else if (inM && !inR) {
      // Absent on remote: honor the delete only if I never touched it; else keep mine.
      if (inB && deepEqual(mv, bv)) continue;
      out.push(mv as T);
    } else if (!inM && inR) {
      // Absent locally: honor my delete only if remote never touched it; else keep remote.
      if (inB && deepEqual(rv, bv)) continue;
      out.push(rv as T);
    }
  }
  return out;
}

const byId = (x: RecordLike): MergeKey => x.id as MergeKey;

// keyOf: how to identify a record. cap/ts: trim capped lists to their original size, newest first.
export const MERGE_CFG: Record<string, MergeConfig> = {
  products: {}, contacts: {}, pos: {}, sales: {}, cats: {}, cashcats: {}, brands: {},
  payments: {}, quotes: {}, targets: {}, cheques: {}, bankaccs: {},
  banktxns: {}, cnotes: {}, billings: {}, defectives: {}, supcnotes: {},
  promos: {}, events: {}, trucks: {}, delivery_runs: {},
  tagmappings: { keyOf: (r) => r.key as MergeKey },
  logs: { keyOf: (x) => (x.id != null ? (x.id as MergeKey) : `${x.date}|${x.type}|${x.productId}|${x.ref}|${x.qty}`) },
  audit: { cap: 500, ts: (x) => (x.id as number) || 0 },
  pricehist: { cap: 500, ts: (x) => (x.id as number) || 0 },
  activity: { keyOf: (x) => `${x.userId ?? ""}|${x.loginTime ?? ""}`, cap: 200, ts: (x) => (x.loginTime as number) || 0 },
};

export function mergeForKey(
  sbKey: string,
  base: unknown,
  mine: unknown,
  remote: unknown
): RecordLike[] {
  const cfg = MERGE_CFG[sbKey] || {};
  let merged = mergeByKey<RecordLike>(base, mine, remote, cfg.keyOf || byId);
  if (cfg.cap && merged.length > cfg.cap) {
    const ts = cfg.ts || ((x: RecordLike) => (x.id as number) || 0);
    merged = [...merged].sort((a, b) => ts(b) - ts(a)).slice(0, cfg.cap);
  }
  return merged;
}
