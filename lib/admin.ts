import { supabase } from "@/lib/supabase"

export async function getSessionUser() {
  const { data, error } = await supabase.auth.getSession()
  if (error) return null
  return data.session?.user ?? null
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  const user = await getSessionUser()
  if (!user) return false

  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) {
    console.warn("Admin check failed:", error.message)
    return false
  }

  return data?.is_admin === true
}
