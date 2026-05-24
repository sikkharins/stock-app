import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://lqgvwxyjzpsoflczyzik.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxZ3Z3eHlqenBzb2ZsY3p5emlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyOTgzMzMsImV4cCI6MjA5NDg3NDMzM30.9lqlt-LObeDAoh9jOr00wEZHP9z3iuBcyAkFi7RUtDY";

const DATA_KEYS = [
  "products", "contacts", "pos", "sales", "cats", "brands", "logs",
  "payments", "activity", "quotes", "targets", "audit", "pricehist",
  "cheques", "bankaccs", "banktxns", "cnotes", "billings",
  "defectives", "supcnotes", "promos", "bot_config",
  "ai_memory", "ai_action_log", "ai_product_notes", "ai_customer_notes"
];

const MAX_BACKUPS = 30;

export default async function handler(req, res) {
  // Verify cron secret (Vercel sends this header for cron jobs)
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  try {
    // 1. Load all current data
    const { data: rows, error: loadErr } = await supabase
      .from("app_data")
      .select("key, data")
      .in("key", DATA_KEYS);

    if (loadErr) throw loadErr;

    const snapshot = {};
    (rows || []).forEach(r => { snapshot[r.key] = r.data; });

    // 2. Create backup entry
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const backupKey = `backup_${dateStr}`;

    const backupData = {
      version: "3.0",
      exportDate: now.toISOString(),
      exportBy: "auto-cron",
      dataKeys: Object.keys(snapshot),
      itemCounts: {},
      data: snapshot,
    };

    // Count items per key
    for (const [k, v] of Object.entries(snapshot)) {
      backupData.itemCounts[k] = Array.isArray(v) ? v.length : (v ? 1 : 0);
    }

    // 3. Upsert backup (overwrite if same day)
    const { error: saveErr } = await supabase
      .from("app_data")
      .upsert({
        key: backupKey,
        data: backupData,
        updated_at: now.toISOString(),
        updated_by: "cron-backup",
      });

    if (saveErr) throw saveErr;

    // 4. Cleanup old backups (keep last MAX_BACKUPS)
    const { data: allKeys } = await supabase
      .from("app_data")
      .select("key")
      .like("key", "backup_%")
      .order("key", { ascending: false });

    const backupKeys = (allKeys || []).map(r => r.key);
    if (backupKeys.length > MAX_BACKUPS) {
      const toDelete = backupKeys.slice(MAX_BACKUPS);
      await supabase
        .from("app_data")
        .delete()
        .in("key", toDelete);
    }

    return res.status(200).json({
      ok: true,
      backup: backupKey,
      keys: Object.keys(snapshot).length,
      counts: backupData.itemCounts,
      cleaned: Math.max(0, backupKeys.length - MAX_BACKUPS),
    });
  } catch (e) {
    console.error("Cron backup error:", e.message);
    return res.status(500).json({ error: e.message });
  }
}
