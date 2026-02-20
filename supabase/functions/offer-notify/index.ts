/// <reference lib="deno.ns" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: any;
  old_record?: any;
};

function money(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
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

Deno.serve(async (req) => {
  try {
    // --- ENV ---
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
    const RESEND_FROM = Deno.env.get("RESEND_FROM")!; // e.g. "RHD Wholesale <onboarding@resend.dev>"
    const ADMIN_NOTIFY_EMAIL = Deno.env.get("ADMIN_NOTIFY_EMAIL")!; // your email to receive new offer alerts
    const APP_BASE_URL = Deno.env.get("APP_BASE_URL") ?? ""; // optional, e.g. https://yourdomain.com

    // Supabase sends a JWT in Authorization header for Edge Functions webhooks. :contentReference[oaicite:1]{index=1}
    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return new Response("Missing Authorization header", { status: 401 });
    }

    const payload = (await req.json()) as WebhookPayload;

    if (payload.schema !== "public" || payload.table !== "offers") {
      return new Response("Ignored", { status: 200 });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Helper: fetch property basics for nicer email
    async function getProperty(propertyId: string) {
      const { data, error } = await supabaseAdmin
        .from("properties")
        .select("id,address,price,status")
        .eq("id", propertyId)
        .maybeSingle();

      if (error) throw new Error(`Property fetch failed: ${error.message}`);
      return data;
    }

    // Helper: fetch buyer email via Admin API
    async function getBuyerEmail(userId: string) {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);

      // Don't crash the whole function if the user lookup fails
      if (error) {
        console.warn("Buyer email lookup failed:", error.message, "userId:", userId);
        return null;
      }

      return data.user?.email ?? null;
    }

    // --- CASE 1: New offer submitted -> email admin ---
    if (payload.type === "INSERT") {
      const offer = payload.record;
      const propertyId = offer.property_id as string;
      const buyerId = offer.user_id as string;

      const property = await getProperty(propertyId);
      const buyerEmail = await getBuyerEmail(buyerId);
      const buyerLabel = buyerEmail ?? `User: ${buyerId.slice(0, 8)}…`;

      const ask = property?.price ?? null;
      const offerPrice = offer.offer_price ?? null;
      const delta = ask !== null && offerPrice !== null ? offerPrice - ask : null;

      const adminLink = APP_BASE_URL ? `${APP_BASE_URL}/admin` : "/admin";

      const subject = `New offer received — ${safeStr(property?.address) || "Property"}`;
      const html = `
        <div style="font-family: ui-sans-serif, system-ui; line-height: 1.45;">
          <h2 style="margin:0 0 8px;">New offer received</h2>
          <div style="color:#444; margin-bottom:14px;">
            ${safeStr(property?.address) || "Unknown address"}
          </div>

          <table style="border-collapse:collapse; width:100%; max-width:560px;">
            <tr><td style="padding:6px 0; color:#666;">Ask</td><td style="padding:6px 0;"><b>${money(ask)}</b></td></tr>
            <tr><td style="padding:6px 0; color:#666;">Offer</td><td style="padding:6px 0;"><b>${money(offerPrice)}</b></td></tr>
            <tr><td style="padding:6px 0; color:#666;">Delta</td><td style="padding:6px 0;"><b>${delta === null ? "—" : (delta >= 0 ? "+" : "") + money(delta)}</b></td></tr>
            <tr><td style="padding:6px 0; color:#666;">Buyer</td><td style="padding:6px 0;"><b>${safeStr(buyerLabel) || "Unknown"}</b></td></tr>
            <tr><td style="padding:6px 0; color:#666;">Notes</td><td style="padding:6px 0;">${safeStr(offer.notes) || "—"}</td></tr>
          </table>

          <div style="margin-top:16px;">
            <a href="${adminLink}" style="display:inline-block; padding:10px 14px; background:#111; color:#fff; border-radius:10px; text-decoration:none;">
              Open Admin
            </a>
          </div>

          <div style="margin-top:12px; color:#888; font-size:12px;">
            Offer ID: ${safeStr(offer.id)}
          </div>
        </div>
      `;
      await resendSendEmail({
        apiKey: RESEND_API_KEY,
        from: RESEND_FROM,
        to: ADMIN_NOTIFY_EMAIL,
        subject,
        html,
      });

      return new Response("OK", { status: 200 });
    }

    // --- CASE 2: Offer status changed -> email buyer ---
    if (payload.type === "UPDATE") {
      const offer = payload.record;
      const oldOffer = payload.old_record ?? {};
      const newStatus = offer.status as string | null;
      const oldStatus = oldOffer.status as string | null;

      // Only react when status changes to accepted/rejected
      if (
        (newStatus !== "accepted" && newStatus !== "rejected") ||
        newStatus === oldStatus
      ) {
        return new Response("Ignored", { status: 200 });
      }

      const property = await getProperty(offer.property_id as string);
      const buyerEmail = await getBuyerEmail(offer.user_id as string);

      if (!buyerEmail) return new Response("No buyer email", { status: 200 });

      const subject =
        newStatus === "accepted"
          ? `Offer accepted — ${safeStr(property?.address) || "Property"}`
          : `Offer update — ${safeStr(property?.address) || "Property"}`;

      const html = `
        <div style="font-family: ui-sans-serif, system-ui; line-height: 1.45;">
          <h2 style="margin:0 0 8px;">Offer update</h2>
          <div style="margin-bottom:14px; color:#444;">
            ${safeStr(property?.address) || "Unknown address"}
          </div>

          <div style="margin-bottom:14px;">
            Status: <b style="text-transform: uppercase;">${safeStr(newStatus)}</b>
          </div>

          <table style="border-collapse:collapse; width:100%; max-width:560px;">
            <tr><td style="padding:6px 0; color:#666;">Your offer</td><td style="padding:6px 0;"><b>${money(offer.offer_price)}</b></td></tr>
            <tr><td style="padding:6px 0; color:#666;">Ask</td><td style="padding:6px 0;"><b>${money(property?.price ?? null)}</b></td></tr>
          </table>

          <div style="margin-top:16px; color:#666; font-size:13px;">
            ${newStatus === "accepted"
              ? "Your offer has been accepted. We will reach out with next steps."
              : "Your offer was not selected. You can continue browsing and submitting offers."}
          </div>
        </div>
      `;
      await resendSendEmail({
        apiKey: RESEND_API_KEY,
        from: RESEND_FROM,
        to: buyerEmail,
        subject,
        html,
      });

      return new Response("OK", { status: 200 });
    }

    return new Response("Ignored", { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response(`Error: ${e?.message ?? "unknown"}`, { status: 500 });
  }
});