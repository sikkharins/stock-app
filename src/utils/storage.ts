import { supabase } from "./supabase.js";

// localStorage (sync cache)
export const loadData = <T>(key: string, fallback: T): T => {
  try {
    const r = localStorage.getItem(key);
    return r !== null ? (JSON.parse(r) as T) : fallback;
  } catch {
    return fallback;
  }
};

export const saveData = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota/serialization failures — caller can choose to surface them via a different path
  }
};

// Map localStorage key → Supabase app_data key
const KEY_MAP = {
  v3_products: "products",
  v3_contacts: "contacts",
  v3_pos: "pos",
  v3_sales: "sales",
  v3_cats: "cats",
  v3_cashcats: "cashcats",
  v3_tagmappings: "tagmappings",
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
  v3_trucks: "trucks",
  v3_delivery_runs: "delivery_runs",
  v3_delivery_helpers: "delivery_helpers",
} as const;

type LsKey = keyof typeof KEY_MAP;
type SbKey = typeof KEY_MAP[LsKey];

// Reverse map: Supabase key → localStorage key
const SB_TO_LS: Record<string, string> = Object.fromEntries(
  Object.entries(KEY_MAP).map(([ls, sb]) => [sb, ls])
);

interface AppDataRow {
  key: string;
  data: unknown;
  version: number | null;
  updated_by?: string;
}

interface LoadAllResult {
  values: Record<string, unknown>;
  versions: Record<string, number>;
}

// Load all data + per-key version in one query (with 5s timeout).
// Returns { values: {sbKey: data}, versions: {sbKey: version} }.
export const loadAllFromSupabase = async (): Promise<LoadAllResult> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const { data, error } = await supabase
      .from("app_data")
      .select("key, data, version")
      .abortSignal(controller.signal);
    clearTimeout(timer);
    if (error) throw error;
    const values: Record<string, unknown> = {};
    const versions: Record<string, number> = {};
    ((data as AppDataRow[]) || []).forEach((row) => {
      values[row.key] = row.data;
      versions[row.key] = row.version ?? 0;
    });
    return { values, versions };
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
};

interface RowResult {
  data: unknown;
  version: number;
}

// Fetch a single row's data + version (for conflict refetch).
export const getRow = async (sbKey: string): Promise<RowResult | null> => {
  const { data, error } = await supabase
    .from("app_data")
    .select("data, version")
    .eq("key", sbKey)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { data: unknown; version: number | null };
  return { data: row.data, version: row.version ?? 0 };
};

export type SaveResult =
  | { ok: true; version: number }
  | { conflict: true; remoteData: unknown; remoteVersion: number }
  | { error: string };

// Optimistic per-key save. Conditional UPDATE on version = atomic compare-and-set at the DB.
// Returns { ok, version } on success, { conflict, remoteData, remoteVersion } if another
// writer won, or { error } on transport failure.
export const saveKeyOptimistic = async (
  sbKey: string,
  value: unknown,
  expectedVersion: number,
  userId?: string
): Promise<SaveResult> => {
  const expected = expectedVersion || 0;
  const patch: Record<string, unknown> = {
    data: value,
    updated_at: new Date().toISOString(),
    version: expected + 1,
  };
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
    const row: Record<string, unknown> = {
      key: sbKey,
      data: value,
      updated_at: new Date().toISOString(),
      version: 1,
    };
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
type RealtimeChannel = ReturnType<typeof supabase.channel>;
type RealtimeCallback = (sbKey: string, data: unknown, version: number) => void;

let realtimeChannel: RealtimeChannel | null = null;

export const subscribeRealtime = (userId: string, onUpdate: RealtimeCallback): void => {
  unsubscribeRealtime();
  realtimeChannel = supabase
    .channel("app_data_changes")
    .on(
      // The supabase-js type signature for `.on("postgres_changes", ...)` is awkward to satisfy
      // strictly. Cast through unknown — runtime payload shape is validated below.
      "postgres_changes" as never,
      { event: "*", schema: "public", table: "app_data" } as never,
      (payload: { new?: AppDataRow }) => {
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

export const unsubscribeRealtime = (): void => {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
};

// Re-export key maps for callers (some debugging tools peek at them).
export { KEY_MAP, SB_TO_LS };
export type { LsKey, SbKey };
