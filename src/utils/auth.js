import { createClient } from "@supabase/supabase-js";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase.js";

const sbTemp = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "sb-temp-auth" },
});

const toEmail = (username) =>
  `${username.toLowerCase().replace(/\s+/g, "_")}@app.local`;

export const profileToUser = (p) => ({
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

const userToProfile = (u) => ({
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

export const signIn = async (username, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: toEmail(username),
    password,
  });
  if (error) throw error;
  return data;
};

export const signOut = async () => {
  await supabase.auth.signOut();
};

export const getSession = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
};

export const getProfile = async (userId) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return profileToUser(data);
};

export const getAllProfiles = async () => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at");
  if (error) throw error;
  return (data || []).map(profileToUser);
};

export const createUser = async (username, password, userData) => {
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
      await supabase.from("profiles").upsert({ id: uid, ...userToProfile({ ...userData, username, password }) });
      return uid;
    }
    throw error;
  }
  const userId = data.user.id;
  const { error: pErr } = await sbTemp
    .from("profiles")
    .insert({ id: userId, ...userToProfile({ ...userData, username, password }) });
  if (pErr) throw pErr;
  return userId;
};

export const updateProfile = async (userId, userData) => {
  const { error } = await supabase
    .from("profiles")
    .update(userToProfile(userData))
    .eq("id", userId);
  if (error) throw error;
};

export const adminChangeEmail = async (userId, newUsername) => {
  const { error } = await supabase.rpc("admin_update_email", {
    target_id: userId,
    new_email: toEmail(newUsername),
  });
  if (error) throw error;
};

export const adminChangePassword = async (userId, newPassword) => {
  const { error } = await supabase.rpc("admin_update_password", {
    target_id: userId,
    new_pass: newPassword,
  });
  if (error) throw error;
};

export const deleteUser = async (userId) => {
  const { error } = await supabase.rpc("delete_user", { target_id: userId });
  if (error) throw error;
};

export const migrateUsers = async (existingUsers, existingContacts) => {
  const results = [];
  for (const u of existingUsers) {
    try {
      const pw = (u.password || "changeme123").padEnd(6, "0");
      const { data, error } = await sbTemp.auth.signUp({
        email: toEmail(u.username),
        password: pw,
      });
      if (error) throw error;
      await sbTemp.from("profiles").insert({
        id: data.user.id,
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
      results.push({ username: u.username, ok: false, msg: e.message });
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
          id: data.user.id,
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
        results.push({ username: s.username, ok: false, msg: e.message });
      }
    }
  }
  return results;
};
