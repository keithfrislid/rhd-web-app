import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const GEOAPIFY_API_KEY = Deno.env.get("GEOAPIFY_API_KEY") ?? "";

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(
        { error: "Missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY" },
        500
      );
    }
    if (!GEOAPIFY_API_KEY) return json({ error: "Missing GEOAPIFY_API_KEY" }, 500);

    // Require auth token manually (since verify_jwt is false)
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7)
      : "";

    if (!token) return json({ error: "Missing Authorization Bearer token" }, 401);

    // Validate user session
    const authedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userErr } = await authedClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401);

    // Check admin via service role (bypasses RLS safely)
    const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: me, error: meErr } = await service
      .from("profiles")
      .select("user_id,is_admin,role")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (meErr) return json({ error: meErr.message }, 500);
    if (!me || me.is_admin !== true) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const text = String(body?.text ?? "").trim();
    if (!text) return json({ error: "Missing body.text" }, 400);

    const geoUrl =
      `https://api.geoapify.com/v1/geocode/search?` +
      `text=${encodeURIComponent(text)}` +
      `&format=json` +
      `&limit=1` +
      `&filter=countrycode:us` +
      `&apiKey=${encodeURIComponent(GEOAPIFY_API_KEY)}`;

    const resp = await fetch(geoUrl);
    if (!resp.ok) {
      const msg = await resp.text();
      return json({ error: `Geoapify error ${resp.status}: ${msg}` }, 502);
    }

    const data = await resp.json();
    const first = Array.isArray(data?.results) ? data.results[0] : null;
    if (!first) return json({ error: "No results found for that address." }, 404);

    const lat = first?.lat;
    const lng = first?.lon;
    const formatted = first?.formatted ?? null;

    if (typeof lat !== "number" || typeof lng !== "number") {
      return json({ error: "Geoapify returned no coordinates." }, 502);
    }

    // Strip " County" suffix if present (e.g. "Davidson County" → "Davidson")
    const rawCounty: string = first?.county ?? "";
    const county = rawCounty.replace(/\s+county$/i, "").trim() || null;

    return json({ lat, lng, formatted, county });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});