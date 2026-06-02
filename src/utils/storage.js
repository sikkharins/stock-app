import { supabase } from "./supabase.js";

// localStorage (sync cache)
export const loadData = (key, fallback) => {
  try {
    const r = localStorage.getItem(key);
    return r !== null ? JSON.parse(r) : fallback;
  } catch {
    return fallback;
  }
};

export const saveData = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

// Map localStorage key → Supabase app_data key
const KEY_MAP = {
  v3_products: "products",
  v3_contacts: "contacts",
  v3_pos: "pos",
  v3_sales: "sales",
  v3_cats: "cats",
  v3_brands: "brands",
  v3_logs: "logs",
  v3_payments: "payments",
  v3_activity: "activity",
  v3_quotes: "quotes",
  v3_targets: "targets",
  v3_audit: "audit",
  v3_pricehist: "pricehist",
  v3_cheques: "cheques",
  v3_bankaccs: "bankaccs",
  v3_banktxns: "banktxns",
  v3_cnotes: "cnotes",
  v3_billings: "billings",
  v3_defectives: "defectives",
  v3_supcnotes: "supcnotes",
  v3_promos: "promos",
  v3_events: "events",
  v3_bot_config: "bot_config",
};

// Reverse map: Supabase key → localStorage key
const SB_TO_LS = Object.fromEntries(Object.entries(KEY_MAP).map(([ls, sb]) => [sb, ls]));

// Load all data + per-key version in one query (with 5s timeout).
// Returns { values: {sbKey: data}, versions: {sbKey: version} }.
export const loadAllFromSupabase = async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const { data, error } = await supabase
      .from("app_data")
      .select("key, data, version")
      .abortSignal(controller.signal);
    clearTimeout(timer);
    if (error) throw error;
    const values = {};
    const versions = {};
    (data || []).forEach((row) => {
      values[row.key] = row.data;
      versions[row.key] = row.version ?? 0;
    });
    return { values, versions };
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
};

// Fetch a single row's data + version (for conflict refetch).
export const getRow = async (sbKey) => {
  const { data, error } = await supabase
    .from("app_data")
    .select("data, version")
    .eq("key", sbKey)
    .maybeSingle();
  if (error || !data) return null;
  return { data: data.data, version: data.version ?? 0 };
};

// Optimistic per-key save. Conditional UPDATE on version = atomic compare-and-set at the DB.
// Returns { ok, version } on success, { conflict, remoteData, remoteVersion } if another
// writer won, or { error } on transport failure.
export const saveKeyOptimistic = async (sbKey, value, expectedVersion, userId) => {
  const expected = expectedVersion || 0;
  const patch = { data: value, updated_at: new Date().toISOString(), version: expected + 1 };
  if (userId) patch.updated_by = userId;

  const { data, error } = await supabase
    .from("app_data")
    .update(patch)
    .eq("key", sbKey)
    .eq("version", expected)
    .select("version");
  if (error) return { error: error.message };
  if (data && data.length === 1) return { ok: true, version: expected + 1 };

  // No row matched: either the row doesn't exist yet, or our version is stale.
  const cur = await getRow(sbKey);
  if (!cur) {
    const row = { key: sbKey, data: value, updated_at: new Date().toISOString(), version: 1 };
    if (userId) row.updated_by = userId;
    const { error: insErr } = await supabase.from("app_data").insert(row);
    if (!insErr) return { ok: true, version: 1 };
    const after = await getRow(sbKey);
    if (after) return { conflict: true, remoteData: after.data, remoteVersion: after.version };
    return { error: insErr.message };
  }
  return { conflict: true, remoteData: cur.data, remoteVersion: cur.version };
};

// Realtime subscription
let realtimeChannel = null;

export const subscribeRealtime = (userId, onUpdate) => {
  unsubscribeRealtime();
  realtimeChannel = supabase
    .channel("app_data_changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "app_data" },
      (payload) => {
        const row = payload.new;
        if (!row || !row.key) return;
        if (row.updated_by === userId) return;
        const lsKey = SB_TO_LS[row.key];
        if (!lsKey) return;
        saveData(lsKey, row.data);
        onUpdate(row.key, row.data, row.version ?? 0);
      }
    )
    .subscribe((status, err) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error("Realtime subscription error:", status, err?.message);
      }
    });
};

export const unsubscribeRealtime = () => {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
};
