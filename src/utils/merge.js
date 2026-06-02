// 3-way merge for per-array optimistic sync.
// base = value last known in sync with server, mine = local, remote = freshly fetched server value.
// Rule of thumb: never silently drop an insert or an edit. Only honor a delete the other side didn't touch.

const deepEqual = (a, b) => {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== "object" || typeof b !== "object") return false;
  const aArr = Array.isArray(a), bArr = Array.isArray(b);
  if (aArr !== bArr) return false;
  if (aArr) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  const ak = Object.keys(a), bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!deepEqual(a[k], b[k])) return false;
  }
  return true;
};

export function mergeByKey(base, mine, remote, keyOf) {
  const b = Array.isArray(base) ? base : [];
  const m = Array.isArray(mine) ? mine : [];
  const r = Array.isArray(remote) ? remote : [];
  const bMap = new Map(), mMap = new Map(), rMap = new Map();
  for (const x of b) bMap.set(keyOf(x), x);
  for (const x of m) mMap.set(keyOf(x), x);
  for (const x of r) rMap.set(keyOf(x), x);

  // Visit remote order first, then mine-only keys (keeps a stable, predictable order).
  const order = [...rMap.keys()];
  for (const k of mMap.keys()) if (!rMap.has(k)) order.push(k);

  const out = [];
  for (const k of order) {
    const inB = bMap.has(k), inM = mMap.has(k), inR = rMap.has(k);
    const mv = mMap.get(k), rv = rMap.get(k), bv = bMap.get(k);
    if (inM && inR) {
      // I didn't change it but remote did → take remote; otherwise local wins.
      if (inB && deepEqual(mv, bv) && !deepEqual(rv, bv)) out.push(rv);
      else out.push(mv);
    } else if (inM && !inR) {
      // Absent on remote: honor the delete only if I never touched it; else keep mine.
      if (inB && deepEqual(mv, bv)) continue;
      out.push(mv);
    } else if (!inM && inR) {
      // Absent locally: honor my delete only if remote never touched it; else keep remote.
      if (inB && deepEqual(rv, bv)) continue;
      out.push(rv);
    }
  }
  return out;
}

const byId = (x) => x.id;

// keyOf: how to identify a record. cap/ts: trim capped lists to their original size, newest first.
export const MERGE_CFG = {
  products: {}, contacts: {}, pos: {}, sales: {}, cats: {}, cashcats: {}, brands: {},
  payments: {}, quotes: {}, targets: {}, cheques: {}, bankaccs: {},
  banktxns: {}, cnotes: {}, billings: {}, defectives: {}, supcnotes: {},
  promos: {}, events: {},
  logs: { keyOf: (x) => (x.id != null ? x.id : `${x.date}|${x.type}|${x.productId}|${x.ref}|${x.qty}`) },
  audit: { cap: 500, ts: (x) => x.id || 0 },
  pricehist: { cap: 500, ts: (x) => x.id || 0 },
  activity: { keyOf: (x) => `${x.userId ?? ""}|${x.loginTime ?? ""}`, cap: 200, ts: (x) => x.loginTime || 0 },
};

export function mergeForKey(sbKey, base, mine, remote) {
  const cfg = MERGE_CFG[sbKey] || {};
  let merged = mergeByKey(base, mine, remote, cfg.keyOf || byId);
  if (cfg.cap && merged.length > cfg.cap) {
    const ts = cfg.ts || ((x) => x.id || 0);
    merged = [...merged].sort((a, b) => ts(b) - ts(a)).slice(0, cfg.cap);
  }
  return merged;
}
