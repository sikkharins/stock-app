// Standalone test for the 3-way merge layer. Run: node src/utils/merge.test.mjs
import assert from "node:assert/strict";
import { mergeByKey, mergeForKey, MERGE_CFG } from "./merge.js";

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log("  ok  -", name); }
  catch (e) { fail++; console.error("FAIL -", name, "\n      ", e.message); }
}
// order-insensitive compare for record arrays
const norm = (arr) => [...arr].sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1));
const sameSet = (got, want) => assert.deepEqual(norm(got), norm(want));
const byId = (r) => r.id;

test("insert/insert different ids → both survive", () => {
  const base = [{ id: 1, v: "a" }];
  const mine = [{ id: 1, v: "a" }, { id: 2, v: "mine" }];
  const remote = [{ id: 1, v: "a" }, { id: 3, v: "remote" }];
  sameSet(mergeByKey(base, mine, remote, byId), [
    { id: 1, v: "a" }, { id: 2, v: "mine" }, { id: 3, v: "remote" },
  ]);
});

test("mine-only edit → mine wins", () => {
  const base = [{ id: 1, v: "a" }];
  const mine = [{ id: 1, v: "A" }];
  const remote = [{ id: 1, v: "a" }];
  sameSet(mergeByKey(base, mine, remote, byId), [{ id: 1, v: "A" }]);
});

test("remote-only edit → remote wins (key-order-insensitive base compare)", () => {
  // mine has same content as base but different key order (jsonb round-trip) → NOT a real edit
  const base = [{ id: 1, x: 1, y: 2 }];
  const mine = [{ id: 1, y: 2, x: 1 }];
  const remote = [{ id: 1, x: 9, y: 2 }];
  sameSet(mergeByKey(base, mine, remote, byId), [{ id: 1, x: 9, y: 2 }]);
});

test("edit/edit same id → mine wins (local priority)", () => {
  const base = [{ id: 1, v: "a" }];
  const mine = [{ id: 1, v: "MINE" }];
  const remote = [{ id: 1, v: "REMOTE" }];
  sameSet(mergeByKey(base, mine, remote, byId), [{ id: 1, v: "MINE" }]);
});

test("remote deleted, mine untouched → honor delete", () => {
  const base = [{ id: 1, v: "a" }, { id: 2, v: "b" }];
  const mine = [{ id: 1, v: "a" }, { id: 2, v: "b" }];
  const remote = [{ id: 1, v: "a" }];
  sameSet(mergeByKey(base, mine, remote, byId), [{ id: 1, v: "a" }]);
});

test("mine deleted, remote untouched → honor delete", () => {
  const base = [{ id: 1, v: "a" }, { id: 2, v: "b" }];
  const mine = [{ id: 1, v: "a" }];
  const remote = [{ id: 1, v: "a" }, { id: 2, v: "b" }];
  sameSet(mergeByKey(base, mine, remote, byId), [{ id: 1, v: "a" }]);
});

test("remote edited an id that mine deleted → keep remote (no data loss)", () => {
  const base = [{ id: 1, v: "a" }, { id: 2, v: "b" }];
  const mine = [{ id: 1, v: "a" }];
  const remote = [{ id: 1, v: "a" }, { id: 2, v: "B" }];
  sameSet(mergeByKey(base, mine, remote, byId), [{ id: 1, v: "a" }, { id: 2, v: "B" }]);
});

test("mine edited an id that remote deleted → keep mine (no data loss)", () => {
  const base = [{ id: 1, v: "a" }, { id: 2, v: "b" }];
  const mine = [{ id: 1, v: "a" }, { id: 2, v: "MINE" }];
  const remote = [{ id: 1, v: "a" }];
  sameSet(mergeByKey(base, mine, remote, byId), [{ id: 1, v: "a" }, { id: 2, v: "MINE" }]);
});

test("null/undefined inputs treated as empty arrays", () => {
  sameSet(mergeByKey(null, [{ id: 1 }], undefined, byId), [{ id: 1 }]);
});

test("mergeForKey('activity') uses composite userId|loginTime key", () => {
  const base = [];
  const mine = [{ userId: "u1", loginTime: 100, a: 1 }];
  const remote = [{ userId: "u2", loginTime: 200, a: 2 }];
  sameSet(mergeForKey("activity", base, mine, remote), [
    { userId: "u1", loginTime: 100, a: 1 },
    { userId: "u2", loginTime: 200, a: 2 },
  ]);
});

test("mergeForKey('logs') falls back to composite key when id missing", () => {
  const base = [];
  const mine = [{ date: "01/01/2569 10:00", type: "out", productId: 5, ref: "SO-1", qty: 2 }];
  const remote = [{ date: "01/01/2569 11:00", type: "in", productId: 5, ref: "PO-1", qty: 3 }];
  const out = mergeForKey("logs", base, mine, remote);
  assert.equal(out.length, 2);
});

test("mergeForKey('audit') caps to 500, keeping newest by id", () => {
  const mine = Array.from({ length: 600 }, (_, i) => ({ id: i, action: "x" }));
  const out = mergeForKey("audit", [], mine, []);
  assert.equal(out.length, 500);
  const ids = new Set(out.map((r) => r.id));
  assert.ok(ids.has(599), "should keep newest id 599");
  assert.ok(ids.has(100), "should keep id 100 (the 500th newest)");
  assert.ok(!ids.has(99), "should drop id 99 (beyond cap)");
});

test("MERGE_CFG covers all 23 synced keys", () => {
  const keys = ["products","contacts","pos","sales","cats","cashcats","brands","logs","payments","activity","quotes","targets","audit","pricehist","cheques","bankaccs","banktxns","cnotes","billings","defectives","supcnotes","promos","events"];
  for (const k of keys) assert.ok(MERGE_CFG[k], `missing MERGE_CFG entry: ${k}`);
});

test("cashcats: concurrent insert different subs survives", () => {
  const base = [{ id: 1, name: "ขาย", type: "in", subs: [{ id: 11, name: "ขายสด (SO)" }] }];
  const mine = [{ id: 1, name: "ขาย", type: "in", subs: [{ id: 11, name: "ขายสด (SO)" }] }, { id: 99, name: "Custom A", type: "out", subs: [] }];
  const remote = [{ id: 1, name: "ขาย", type: "in", subs: [{ id: 11, name: "ขายสด (SO)" }] }, { id: 100, name: "Custom B", type: "out", subs: [] }];
  const merged = mergeForKey("cashcats", base, mine, remote);
  assert.equal(merged.length, 3, "should keep base + both inserts");
  assert.ok(merged.some(c => c.id === 99));
  assert.ok(merged.some(c => c.id === 100));
});

test("banktxns: new catId field merged with deep equality", () => {
  const base = [{ id: 1, accId: 1, type: "in", amount: 100, catId: null, subCatId: null }];
  const mine = [{ id: 1, accId: 1, type: "in", amount: 100, catId: 1, subCatId: 11 }];
  const remote = [{ id: 1, accId: 1, type: "in", amount: 100, catId: null, subCatId: null }];
  const merged = mergeForKey("banktxns", base, mine, remote);
  assert.equal(merged[0].catId, 1);
  assert.equal(merged[0].subCatId, 11);
});

test("bankaccs: isCash flag merged correctly", () => {
  const base = [{ id: 1, name: "บัญชี 1", bank: "กสิกร" }];
  const mine = [{ id: 1, name: "บัญชี 1", bank: "กสิกร" }, { id: 2, name: "เงินสดหน้าร้าน", bank: "เงินสด", isCash: true, openingBalance: 5000 }];
  const remote = [{ id: 1, name: "บัญชี 1", bank: "กสิกร" }];
  const merged = mergeForKey("bankaccs", base, mine, remote);
  assert.equal(merged.length, 2);
  const cash = merged.find(a => a.isCash);
  assert.ok(cash, "cash account should be in merged result");
  assert.equal(cash.openingBalance, 5000);
});

test("tagmappings: keyOf=key correctly merges concurrent edits on different keys", () => {
  const base = [];
  const mine = [{key:"ar_cash", catId:1, subCatId:11}];
  const remote = [{key:"ap_cash", catId:2, subCatId:21}];
  const merged = mergeForKey("tagmappings", base, mine, remote);
  assert.equal(merged.length, 2);
  assert.ok(merged.some(m => m.key === "ar_cash" && m.catId === 1));
  assert.ok(merged.some(m => m.key === "ap_cash" && m.catId === 2));
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
