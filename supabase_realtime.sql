-- Phase 3: Enable Realtime on app_data table
-- Run this in Supabase SQL Editor

-- 1) Add updated_by column to track who made each change
ALTER TABLE app_data ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- 2) Enable Realtime for app_data table
ALTER PUBLICATION supabase_realtime ADD TABLE app_data;
