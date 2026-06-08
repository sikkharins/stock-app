import { createClient } from "@supabase/supabase-js";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase.js";

const sbTemp = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "sb-temp-auth" },
});

// DB row shape (profiles table — snake_case)
interface Profile {
  id: string;
  username: string;
  role: string;
  sales_name?: string | null;
  supplier_name?: string | null;
  supplier_staff_id?: string | number | null;
  staff_name?: string | null;
  role_title?: string | null;
  dashboard_widgets?: string[] | null;
  perms?: Record<string, unknown> | null;
  signature?: string | null;
}

// App-side user shape (camelCase). Optional fields mirror Profile flexibility.
export interface User {
  id: string;
  username: string;
  role: string;
  salesName?: string;
  supplierName?: string;
  supplierStaffId?: string | number | null;
  staffName?: string;
  roleTitle?: string;
  dashboardWidgets?: string[];
  perms?: Record<string, unknown>;
  signature?: string | null;
  password?: string; // only present during create/migrate flows
}

interface ContactStaff {
  id: string | number;
  username?: string;
  password?: string;
  name?: string;
  roleTitle?: string;
  dashboardWidgets?: string[];
  perms?: Record<string, unknown>;
}

interface Contact {
  type?: string;
  name?: string;
  staff?: ContactStaff[];
}

export interface MigrateResult {
  username: string;
  ok: boolean;
  msg?: string;
}

const toEmail = (username: string): string =>
  `${username.toLowerCase().replace(/\s+/g, "_")}@app.local`;

export const profileToUser = (p: Profile): User => ({
  id: p.id,
  username: p.username,
  role: p.role,
  salesName: p.sales_name || "",
  supplierName: p.supplier_name || "",
  supplierStaffId: p.supplier_staff_id || null,
  staffName: p.staff_name || "",
  roleTitle: p.role_title || "",
  dashboardWidgets: p.dashboard_widgets || [],
  perms: p.perms || {},
  signature: p.signature || null,
});

const userToProfile = (u: User): Omit<Profile, "id"> => ({
  username: u.username,
  role: u.role,
  sales_name: u.salesName || "",
  supplier_name: u.supplierName || "",
  supplier_staff_id: u.supplierStaffId || null,
  staff_name: u.staffName || "",
  role_title: u.roleTitle || "",
  dashboard_widgets: u.dashboardWidgets || [],
  perms: u.perms || {},
  signature: u.signature || null,
});

export const signIn = async (username: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: toEmail(username),
    password,
  });
  if (error) throw error;
  return data;
};

export const signOut = async (): Promise<void> => {
  await supabase.auth.signOut();
};

export const getSession = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
};

export const getProfile = async (userId: string): Promise<User> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return profileToUser(data as Profile);
};

export const getAllProfiles = async (): Promise<User[]> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at");
  if (error) throw error;
  return (data || []).map((p) => profileToUser(p as Profile));
};

export const createUser = async (
  username: string,
  password: string,
  userData: Partial<User>
): Promise<string> => {
  const { data, error } = await sbTemp.auth.signUp({
    email: toEmail(username),
    password,
  });
  if (error) {
    if (error.message?.includes("already registered")) {
      const { data: uid, error: rpcErr } = await supabase.rpc("ensure_user", {
        target_email: toEmail(username),
        target_pass: password,
      });
      if (rpcErr) throw rpcErr;
      if (!uid) throw new Error("User not found in auth");
      await supabase
        .from("profiles")
        .upsert({ id: uid, ...userToProfile({ ...userData, username, password } as User) });
      return uid;
    }
    throw error;
  }
  const userId = data.user!.id;
  const { error: pErr } = await sbTemp
    .from("profiles")
    .insert({ id: userId, ...userToProfile({ ...userData, username, password } as User) });
  if (pErr) throw pErr;
  return userId;
};

export const updateProfile = async (userId: string, userData: User): Promise<void> => {
  const { error } = await supabase
    .from("profiles")
    .update(userToProfile(userData))
    .eq("id", userId);
  if (error) throw error;
};

export const adminChangeEmail = async (userId: string, newUsername: string): Promise<void> => {
  const { error } = await supabase.rpc("admin_update_email", {
    target_id: userId,
    new_email: toEmail(newUsername),
  });
  if (error) throw error;
};

export const adminChangePassword = async (userId: string, newPassword: string): Promise<void> => {
  const { error } = await supabase.rpc("admin_update_password", {
    target_id: userId,
    new_pass: newPassword,
  });
  if (error) throw error;
};

export const deleteUser = async (userId: string): Promise<void> => {
  const { error } = await supabase.rpc("delete_user", { target_id: userId });
  if (error) throw error;
};

export const migrateUsers = async (
  existingUsers: User[],
  existingContacts: Contact[] | null | undefined
): Promise<MigrateResult[]> => {
  const results: MigrateResult[] = [];
  for (const u of existingUsers) {
    try {
      const pw = (u.password || "changeme123").padEnd(6, "0");
      const { data, error } = await sbTemp.auth.signUp({
        email: toEmail(u.username),
        password: pw,
      });
      if (error) throw error;
      await sbTemp.from("profiles").insert({
        id: data.user!.id,
        username: u.username,
        role: u.role,
        sales_name: u.salesName || "",
        supplier_name: u.supplierName || "",
        dashboard_widgets: u.dashboardWidgets || [],
        perms: u.perms || {},
        signature: u.signature || null,
      });
      results.push({ username: u.username, ok: true });
    } catch (e) {
      results.push({ username: u.username, ok: false, msg: (e as Error).message });
    }
  }
  for (const c of existingContacts || []) {
    if (c.type !== "supplier") continue;
    for (const s of c.staff || []) {
      if (!s.username || !s.password) continue;
      try {
        const spw = s.password.padEnd(6, "0");
        const { data, error } = await sbTemp.auth.signUp({
          email: toEmail(s.username),
          password: spw,
        });
        if (error) throw error;
        await sbTemp.from("profiles").insert({
          id: data.user!.id,
          username: s.username,
          role: "Supplier",
          supplier_name: c.name,
          supplier_staff_id: s.id,
          staff_name: s.name,
          role_title: s.roleTitle || "",
          dashboard_widgets: s.dashboardWidgets || [
            "products",
            "stock_value",
            "recent_po",
            "recent_log",
          ],
          perms: s.perms || {},
        });
        results.push({ username: s.username, ok: true });
      } catch (e) {
        results.push({ username: s.username, ok: false, msg: (e as Error).message });
      }
    }
  }
  return results;
};
