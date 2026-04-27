// supabase/functions/notify-admin-signup/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const firstName = String(body?.first_name ?? "").trim();
    const lastName  = String(body?.last_name  ?? "").trim();
    const email     = String(body?.email       ?? "").trim();
    const phone     = String(body?.phone       ?? "").trim();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
    const RESEND_FROM    = Deno.env.get("RESEND_FROM")    ?? "";
    const APP_BASE_URL   = (Deno.env.get("APP_BASE_URL")  ?? "").replace(/\/+$/, "");
    const ADMIN_EMAIL    = "keith@realhousedeals.com";

    if (!RESEND_API_KEY || !RESEND_FROM) {
      return json({ error: "Missing RESEND_API_KEY or RESEND_FROM" }, 500);
    }

    const fullName   = [firstName, lastName].filter(Boolean).join(" ") || "Someone";
    const adminUrl   = APP_BASE_URL ? `${APP_BASE_URL}/admin` : "";
    const usersTabUrl = adminUrl; // Users tab is the default for pending approvals

    const html = `
    <div style="font-family: ui-sans-serif, system-ui; line-height:1.45; padding: 8px;">
      <div style="max-width: 560px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden;">
        <div style="background:#0b0b0b; color:#fff; padding: 18px 18px 14px;">
          <div style="font-size:12px; letter-spacing:.12em; text-transform:uppercase; opacity:.8;">
            RHD Wholesale
          </div>
          <div style="font-size:20px; font-weight:800; margin-top:6px;">
            New access request
          </div>
        </div>

        <div style="padding: 18px;">
          <p style="margin:0 0 12px; color:#111;">
            A new user has requested access to the platform:
          </p>

          <table style="width:100%; border-collapse:collapse; font-size:14px; color:#111; margin-bottom:16px;">
            <tr>
              <td style="padding:6px 0; font-weight:600; width:90px;">Name</td>
              <td style="padding:6px 0;">${fullName}</td>
            </tr>
            <tr>
              <td style="padding:6px 0; font-weight:600;">Email</td>
              <td style="padding:6px 0;">${email}</td>
            </tr>
            ${phone ? `
            <tr>
              <td style="padding:6px 0; font-weight:600;">Phone</td>
              <td style="padding:6px 0;">${phone}</td>
            </tr>` : ""}
          </table>

          ${usersTabUrl ? `
          <div style="margin: 16px 0 10px;">
            <a href="${usersTabUrl}"
              style="display:inline-block; background:#111; color:#fff; text-decoration:none; padding:10px 14px; border-radius:12px; font-weight:700;">
              Review in Admin Panel
            </a>
          </div>
          <div style="font-size:12px; color:#6b7280;">
            Go to the Users tab to approve or deny this request.
          </div>
          ` : ""}
        </div>
      </div>
    </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: ADMIN_EMAIL,
        subject: `New access request — ${fullName}`,
        html,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return json({ error: `Resend error ${res.status}: ${text}` }, 500);
    }

    return json({ sent: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
