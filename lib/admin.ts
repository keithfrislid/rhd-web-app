import { supabase } from "@/lib/supabase";

export async function getUserId(): Promise<string | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) return null;
  return user?.id ?? null;
}

export async function isCurrentUserAdmin(userId?: string): Promise<boolean> {
  const uid = userId ?? (await getUserId());
  if (!uid) return false;

  const { data, error } = await supabase
    .from("profiles")
    .select("role, is_admin")
    .eq("user_id", uid)
    .maybeSingle();

  if (error) {
    console.warn("Admin check failed:", error.message);
    return false;
  }

  // Backwards compatible: role OR old column
  return data?.role === "admin" || data?.is_admin === true;
}