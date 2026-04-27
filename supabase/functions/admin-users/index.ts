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

function safeStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v);
}

async function resendSendEmail(args: {
  apiKey: string;
  from: string;
  to: string | string[];
  subject: string;
  html: string;
}) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: args.from,
      to: args.to,
      subject: args.subject,
      html: args.html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend error ${res.status}: ${text}`);
  }

  return await res.json();
}

function approvalEmailHtml(args: {
  firstName?: string | null;
  appBaseUrl?: string;
}) {
  const name = (args.firstName ?? "").trim() || "there";
  const baseUrl = (args.appBaseUrl ?? "").replace(/\/+$/, "");
  const loginUrl = baseUrl ? `${baseUrl}/login` : "";

  return `
  <div style="font-family: ui-sans-serif, system-ui; line-height:1.45; padding: 8px;">
    <div style="max-width: 560px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden;">
      <div style="background:#0b0b0b; color:#fff; padding: 18px 18px 14px;">
        <div style="font-size:12px; letter-spacing: .12em; text-transform: uppercase; opacity:.8;">
          RHD Wholesale
        </div>
        <div style="font-size:20px; font-weight:800; margin-top:6px;">
          You’re approved 🎉
        </div>
      </div>

      <div style="padding: 18px;">
        <p style="margin:0 0 12px; color:#111;">
          Hi <b>${safeStr(name)}</b> —
        </p>

        <p style="margin:0 0 12px; color:#111;">
          Your account has been approved. You can now view deals and submit offers.
        </p>

        ${
          loginUrl
            ? `
          <div style="margin: 16px 0 10px;">
            <a href="${loginUrl}"
              style="display:inline-block; background:#111; color:#fff; text-decoration:none; padding: 10px 14px; border-radius: 12px; font-weight:700;">
              Open RHD Wholesale
            </a>
          </div>
          <div style="font-size:12px; color:#6b7280;">
            If the button doesn’t work, use: ${loginUrl}
          </div>
        `
            : ""
        }

        <div style="margin-top: 16px; font-size:12px; color:#6b7280;">
          If you didn’t request access, you can ignore this email.
        </div>
      </div>
    </div>
  </div>
  `;
}

Deno.serve(async (req) => {
  // ✅ CORS preflight must succeed
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathname = url.pathname || "";
    const isBuyersList = pathname.endsWith("/buyers");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(
        {
          error:
            "Missing env vars. Need SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY",
        },
        500
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
    if (!me || !(me.is_admin === true || me.role === "admin")) return json({ error: "Forbidden" }, 403);

    // GET -> list pending users (default) OR GET /buyers -> list buyers for rankings
    if (req.method === "GET") {
      // GET /buyers -> list approved buyers (for VIP tier / ranking management)
      if (isBuyersList) {
        const { data, error } = await service
          .from("profiles")
          .select(
            "user_id,email,first_name,last_name,phone,role,created_at,buyer_tier,vip_rank"
          )
          .eq("role", "buyer")
          .order("created_at", { ascending: true });

        if (error) return json({ error: error.message }, 500);
        return json({ buyers: data ?? [] });
      }

      // Default GET -> pending + approved users (used by Approve Users tab)
      const [pendingResult, approvedResult] = await Promise.all([
        service
          .from("profiles")
          .select("user_id,email,first_name,last_name,phone,role,created_at")
          .eq("role", "pending")
          .order("created_at", { ascending: true }),
        service
          .from("profiles")
          .select("user_id,email,first_name,last_name,phone,role,created_at,buyer_tier,vip_rank")
          .eq("role", "buyer")
          .order("created_at", { ascending: true }),
      ]);

      if (pendingResult.error) return json({ error: pendingResult.error.message }, 500);
      if (approvedResult.error) return json({ error: approvedResult.error.message }, 500);

      return json({ pending: pendingResult.data ?? [], approved: approvedResult.data ?? [] });
    }

    // POST -> approve / deny / update buyer ranking
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const isDeny = pathname.endsWith("/deny") || body?.action === "deny";

      // POST deny -> set role to 'denied'
      if (isDeny) {
        const targetUserId = body?.user_id;
        if (!targetUserId) return json({ error: "Missing body.user_id" }, 400);

        const { error } = await service
          .from("profiles")
          .update({ role: "denied" })
          .eq("user_id", targetUserId)
          .eq("role", "pending");

        if (error) return json({ error: error.message }, 500);
        return json({ denied: true });
      }

      // POST { action: 'update_buyer', user_id, buyer_tier, vip_rank }
      if (body?.action === "update_buyer") {
        const targetUserId = body?.user_id;
        if (!targetUserId) return json({ error: "Missing body.user_id" }, 400);

        const buyer_tier = body?.buyer_tier;
        const vip_rank = body?.vip_rank;

        const patch: Record<string, unknown> = {};
        if (buyer_tier !== undefined) patch.buyer_tier = buyer_tier;
        if (vip_rank !== undefined) patch.vip_rank = vip_rank;

        if (Object.keys(patch).length === 0) {
          return json({ error: "Nothing to update" }, 400);
        }

        // Only allow updates to approved buyers
        const { data: updated, error } = await service
          .from("profiles")
          .update(patch)
          .eq("user_id", targetUserId)
          .eq("role", "buyer")
          .select(
            "user_id,email,first_name,last_name,phone,role,created_at,buyer_tier,vip_rank"
          )
          .maybeSingle();

        if (error) return json({ error: error.message }, 500);
        if (!updated) return json({ error: "Buyer not found" }, 404);

        return json({ buyer: updated });
      }

      // Default POST -> approve + send approval email
      const targetUserId = body?.user_id;

      if (!targetUserId) {
        return json({ error: "Missing body.user_id" }, 400);
      }

      const { data: approved, error } = await service
        .from("profiles")
        .update({ role: "buyer" })
        .eq("user_id", targetUserId)
        .select("user_id,email,first_name,last_name,phone,role,created_at")
        .maybeSingle();

      if (error) return json({ error: error.message }, 500);

      // Email is best-effort. Approval should succeed even if email fails.
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
      const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "";
      const APP_BASE_URL = Deno.env.get("APP_BASE_URL") ?? "";

      let email_sent = false;
      let email_error: string | null = null;

      try {
        // profiles.email may be null if the trigger didn't copy it; fall back to auth.users
        let to = approved?.email ?? null;
        if (!to) {
          const { data: authUser } = await service.auth.admin.getUserById(targetUserId);
          to = authUser?.user?.email ?? null;
        }

        if (to && RESEND_API_KEY && RESEND_FROM) {
          const subject = "Your account has been approved — RHD Wholesale";
          const html = approvalEmailHtml({
            firstName: approved?.first_name ?? null,
            appBaseUrl: APP_BASE_URL,
          });

          await resendSendEmail({
            apiKey: RESEND_API_KEY,
            from: RESEND_FROM,
            to,
            subject,
            html,
          });

          email_sent = true;
        } else {
          email_sent = false;
          if (!to) email_error = "No user email on profile";
          else if (!RESEND_API_KEY || !RESEND_FROM)
            email_error = "Missing RESEND_API_KEY or RESEND_FROM";
        }
      } catch (e: any) {
        email_sent = false;
        email_error = e?.message ?? String(e);
      }

      return json({ approved, email_sent, email_error });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});