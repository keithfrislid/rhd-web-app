// supabase/functions/admin-buy-boxes/index.ts
//
// Admin-only endpoint to view buyer buy boxes.
// GET /functions/v1/admin-buy-boxes
//
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
  });
}

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return json({ ok: true }, 200);
    if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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
    if (!token) return json({ error: "Missing Authorization Bearer token" }, 401);

    // Validate user
    const authedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await authedClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401);

    // Service client (bypass RLS)
    const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Confirm admin
    const { data: me, error: meErr } = await service
      .from("profiles")
      .select("user_id,is_admin,role")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (meErr) return json({ error: meErr.message }, 500);
    const isAdmin = !!me && (me.role === "admin" || me.is_admin === true);
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    // Buyers
    const { data: buyers, error: buyersErr } = await service
      .from("profiles")
      .select("user_id,email,first_name,last_name,created_at")
      .eq("role", "buyer")
      .order("created_at", { ascending: false });
    if (buyersErr) return json({ error: buyersErr.message }, 500);

    const buyerIds = (buyers ?? []).map((b: any) => b.user_id);

    const { data: boxes, error: boxesErr } = await service
      .from("buyer_buy_boxes")
      .select("user_id,counties,updated_at")
      .in("user_id", buyerIds);
    if (boxesErr) return json({ error: boxesErr.message }, 500);

    const boxMap = new Map<string, any>();
    for (const bb of boxes ?? []) boxMap.set((bb as any).user_id, bb);

    const rows = (buyers ?? []).map((b: any) => {
      const bb = boxMap.get(b.user_id) ?? null;
      return {
        ...b,
        buy_box: bb
          ? {
              counties: Array.isArray(bb.counties) ? bb.counties : [],
              updated_at: bb.updated_at ?? null,
            }
          : { counties: [], updated_at: null },
      };
    });

    return json({ buyers: rows });
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
