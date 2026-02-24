// supabase/functions/admin-offers/index.ts
//
// Admin-only offers endpoints using the Service Role key so we can join buyer identity
// even if client RLS blocks selecting other users' profiles.
//
// Endpoints:
// - GET  /functions/v1/admin-offers/inbox              -> pending offers + property + buyer
// - GET  /functions/v1/admin-offers/property/:id       -> all offers for property + buyer

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

function parsePath(req: Request) {
  // Edge Functions mount at /functions/v1/<name>
  // We want the path AFTER the function name.
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  // e.g. ["functions","v1","admin-offers","inbox"]
  const idx = parts.findIndex((p) => p === "admin-offers");
  const rest = idx >= 0 ? parts.slice(idx + 1) : [];
  return { url, rest };
}

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return json({ ok: true }, 200);

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

    // Client to validate user token
    const authedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await authedClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401);

    // Service client to bypass RLS
    const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Confirm admin (back-compat: is_admin flag)
    const { data: me, error: meErr } = await service
      .from("profiles")
      .select("user_id,is_admin,role")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (meErr) return json({ error: meErr.message }, 500);
    const isAdmin = !!me && (me.role === "admin" || me.is_admin === true);
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const { rest } = parsePath(req);

    // GET inbox
    if (req.method === "GET" && (rest[0] === "inbox" || rest.length === 0)) {
      const { data, error } = await service
        .from("offers")
        .select(
          "id,property_id,user_id,offer_price,notes,status,created_at,properties!offers_property_id_fkey(id,address,price,status)",
        )
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 500);

      const offers = Array.isArray(data) ? data : [];
      const userIds = Array.from(new Set(offers.map((o: any) => o.user_id).filter(Boolean))) as string[];

      const { data: buyers, error: buyersErr } = await service
        .from("profiles")
        .select("user_id,email,first_name,last_name")
        .in("user_id", userIds);
      if (buyersErr) return json({ error: buyersErr.message }, 500);

      const buyerMap = new Map<string, any>();
      for (const b of buyers ?? []) buyerMap.set((b as any).user_id, b);

      const rows = offers.map((o: any) => ({
        ...o,
        buyer: buyerMap.get(o.user_id) ?? null,
      }));

      return json({ offers: rows });
    }

    // GET offers for a property
    if (req.method === "GET" && rest[0] === "property" && rest[1]) {
      const propertyId = rest[1];

      const { data, error } = await service
        .from("offers")
        .select("id,property_id,user_id,offer_price,notes,status,created_at")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: true });
      if (error) return json({ error: error.message }, 500);

      const offers = Array.isArray(data) ? data : [];
      const userIds = Array.from(new Set(offers.map((o: any) => o.user_id).filter(Boolean))) as string[];

      const { data: buyers, error: buyersErr } = await service
        .from("profiles")
        .select("user_id,email,first_name,last_name")
        .in("user_id", userIds);
      if (buyersErr) return json({ error: buyersErr.message }, 500);

      const buyerMap = new Map<string, any>();
      for (const b of buyers ?? []) buyerMap.set((b as any).user_id, b);

      const rows = offers.map((o: any) => ({
        ...o,
        buyer: buyerMap.get(o.user_id) ?? null,
      }));

      return json({ offers: rows });
    }

    return json({ error: "Not found" }, 404);
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
