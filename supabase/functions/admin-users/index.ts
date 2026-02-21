// supabase/functions/admin-users/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  // ✅ CORS preflight must succeed
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(
        {
          error:
            "Missing env vars. Need SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY",
        },
        500,
      );
    }

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7)
      : "";

    if (!token) {
      return json({ error: "Missing Authorization Bearer token" }, 401);
    }

    // Client to validate the user token
    const authedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userErr } = await authedClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: "Invalid session" }, 401);
    }

    const userId = userData.user.id;

    // Service client to read/update rows regardless of RLS
    const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Confirm admin
    const { data: me, error: meErr } = await service
      .from("profiles")
      .select("user_id,is_admin,role,email,first_name,last_name,phone")
      .eq("user_id", userId)
      .maybeSingle();

    if (meErr) return json({ error: meErr.message }, 500);
    if (!me || !me.is_admin) return json({ error: "Forbidden" }, 403);

    // Routes
    const url = new URL(req.url);

    // GET /admin-users  -> list pending users
    if (req.method === "GET") {
      const { data, error } = await service
        .from("profiles")
        .select("user_id,email,first_name,last_name,phone,role,created_at")
        .eq("role", "pending")
        .order("created_at", { ascending: true });

      if (error) return json({ error: error.message }, 500);
      return json({ users: data ?? [] });
    }

    // POST /admin-users -> approve a user
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const targetUserId = body?.user_id;

      if (!targetUserId) {
        return json({ error: "Missing body.user_id" }, 400);
      }

      const { data, error } = await service
        .from("profiles")
        .update({ role: "buyer" })
        .eq("user_id", targetUserId)
        .select("user_id,email,first_name,last_name,phone,role,created_at")
        .maybeSingle();

      if (error) return json({ error: error.message }, 500);
      return json({ approved: data });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});