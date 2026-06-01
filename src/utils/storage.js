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

// Load all data from Supabase in one query (with 5s timeout)
export const loadAllFromSupabase = async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const { data, error } = await supabase
      .from("app_data")
      .select("key, data")
      .abortSignal(controller.signal);
    clearTimeout(timer);
    if (error) throw error;
    const result = {};
    (data || []).forEach((row) => {
      result[row.key] = row.data;
    });
    return result;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
};

// Save one key to Supabase
export const saveToSupabase = async (lsKey, value, userId) => {
  const sbKey = KEY_MAP[lsKey];
  if (!sbKey) return;
  const row = { key: sbKey, data: value, updated_at: new Date().toISOString() };
  if (userId) row.updated_by = userId;
  const { error } = await supabase.from("app_data").upsert(row);
  if (error) console.error("Supabase save error:", sbKey, error.message);
};

// Save multiple keys at once
export const saveAllToSupabase = async (entries, userId) => {
  const rows = entries
    .map(([lsKey, value]) => {
      const sbKey = KEY_MAP[lsKey];
      if (!sbKey) return null;
      const row = { key: sbKey, data: value, updated_at: new Date().toISOString() };
      if (userId) row.updated_by = userId;
      return row;
    })
    .filter(Boolean);
  if (rows.length === 0) return;
  const { error } = await supabase.from("app_data").upsert(rows);
  if (error) console.error("Supabase bulk save error:", error.message);
};

// Reverse map: Supabase key → localStorage key
const SB_TO_LS = Object.fromEntries(Object.entries(KEY_MAP).map(([ls, sb]) => [sb, ls]));

// Realtime subscription
let realtimeChannel = null;

export const subscribeRealtime = (userId, onUpdate) => {
  unsubscribeRealtime();
  realtimeChannel = supabase
    .channel("app_data_changes")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "app_data" },
      (payload) => {
        const row = payload.new;
        if (row.updated_by === userId) return;
        const lsKey = SB_TO_LS[row.key];
        if (!lsKey) return;
        saveData(lsKey, row.data);
        onUpdate(row.key, row.data);
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
