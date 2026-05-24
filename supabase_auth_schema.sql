-- Phase 2: Supabase Auth — Profiles table + admin helper functions
-- Run this in Supabase SQL Editor AFTER enabling Auth

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'Staff',
  sales_name TEXT DEFAULT '',
  supplier_name TEXT DEFAULT '',
  supplier_staff_id INTEGER,
  staff_name TEXT DEFAULT '',
  role_title TEXT DEFAULT '',
  dashboard_widgets JSONB DEFAULT '[]'::jsonb,
  perms JSONB DEFAULT '{}'::jsonb,
  signature TEXT,
  password TEXT DEFAULT '',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read profiles (login screen needs user list)
CREATE POLICY "Public read" ON profiles
  FOR SELECT USING (true);

-- Authenticated user can insert own profile (used during signUp)
CREATE POLICY "Insert own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Authenticated users can update any profile (app enforces admin-only)
CREATE POLICY "Auth update" ON profiles
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Authenticated users can delete (app enforces admin-only)
CREATE POLICY "Auth delete" ON profiles
  FOR DELETE USING (auth.role() = 'authenticated');

GRANT SELECT ON profiles TO anon;
GRANT ALL ON profiles TO authenticated;

-- Admin helper: delete a user from auth.users (profile deleted via CASCADE)
CREATE OR REPLACE FUNCTION delete_user(target_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;
  DELETE FROM auth.users WHERE id = target_id;
END;
$$;

-- Admin helper: change another user's password
CREATE OR REPLACE FUNCTION admin_update_password(target_id UUID, new_pass TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can change passwords';
  END IF;
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(new_pass, extensions.gen_salt('bf'))
  WHERE id = target_id;
END;
$$;
