-- Key-value store for app data (Phase 1 - JSONB approach)
-- Each key stores the full array/object as JSONB

CREATE TABLE IF NOT EXISTS app_data (
  key TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE app_data ENABLE ROW LEVEL SECURITY;

-- Allow anon read/write for now (Phase 2 will add proper auth)
CREATE POLICY "Allow all access" ON app_data
  FOR ALL USING (true) WITH CHECK (true);

-- Seed empty rows for all data keys
INSERT INTO app_data (key, data) VALUES
  ('products', '[]'::jsonb),
  ('contacts', '[]'::jsonb),
  ('pos', '[]'::jsonb),
  ('sales', '[]'::jsonb),
  ('cats', '[]'::jsonb),
  ('brands', '[]'::jsonb),
  ('users', '[]'::jsonb),
  ('logs', '[]'::jsonb),
  ('payments', '[]'::jsonb),
  ('activity', '[]'::jsonb),
  ('quotes', '[]'::jsonb),
  ('targets', '[]'::jsonb),
  ('audit', '[]'::jsonb),
  ('pricehist', '[]'::jsonb),
  ('cheques', '[]'::jsonb),
  ('bankaccs', '[]'::jsonb),
  ('banktxns', '[]'::jsonb),
  ('cnotes', '[]'::jsonb),
  ('billings', '[]'::jsonb),
  ('defectives', '[]'::jsonb),
  ('supcnotes', '[]'::jsonb),
  ('promos', '[]'::jsonb),
  ('bot_config', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;
