import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

async function resendSendEmail(args: {
  apiKey: string
  from: string
  to: string | string[]
  subject: string
  html: string
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
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Resend error ${res.status}: ${text}`)
  }

  return await res.json()
}

function emailHtml(args: {
  buyerName: string
  address: string
  county: string
  price?: number | null
  link?: string
  stage: "exclusive" | "vip" | "public"
}) {
  const stageLabel =
    args.stage === "exclusive" ? "EXCLUSIVE FIRST DIBS" : args.stage === "vip" ? "VIP EARLY ACCESS" : "NEW DEAL"

  const priceLine =
    typeof args.price === "number" && Number.isFinite(args.price) ? `<p style="margin:0 0 12px;">Price: <b>$${args.price.toLocaleString()}</b></p>` : ""

  const linkBtn = args.link
    ? `<a href="${args.link}" style="display:inline-block; background:#111; color:#fff; text-decoration:none; padding: 10px 14px; border-radius: 12px; font-weight:700;">View Deal</a>`
    : ""

  return `
  <div style="font-family: ui-sans-serif, system-ui; line-height:1.45; padding: 8px;">
    <div style="max-width: 560px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden;">
      <div style="background:#0b0b0b; color:#fff; padding: 18px 18px 14px;">
        <div style="font-size:12px; letter-spacing: .12em; text-transform: uppercase; opacity:.85;">
          ${stageLabel}
        </div>
        <div style="font-size:18px; font-weight:800; margin-top:6px;">
          ${args.address}
        </div>
        <div style="font-size:12px; opacity:.75; margin-top:6px;">
          County: ${args.county}
        </div>
      </div>

      <div style="padding: 18px;">
        <p style="margin:0 0 12px;">Hi <b>${args.buyerName || "there"}</b>,</p>
        <p style="margin:0 0 12px;">A new deal matches your Buy Box.</p>
        ${priceLine}
        <div style="margin-top: 14px;">${linkBtn}</div>
        <div style="margin-top: 16px; font-size:12px; color:#6b7280;">
          If you weren’t expecting this, you can ignore this email.
        </div>
      </div>
    </div>
  </div>
  `
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders })

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? ""
    const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? ""
    const APP_BASE_URL = (Deno.env.get("APP_BASE_URL") ?? "").replace(/\/+$/, "")

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500)
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 1) Claim due jobs atomically
    const { data: jobs, error: jobsErr } = await admin.rpc("dequeue_property_notify_jobs", {
      max_jobs: 25,
    })

    if (jobsErr) return json({ error: jobsErr.message }, 500)
    const list = (jobs ?? []) as any[]
    if (list.length === 0) return json({ ok: true, processed: 0 })

    let processed = 0

    for (const job of list) {
      const jobId = job.id as number
      const propertyId = job.property_id as string
      const stage = job.stage as "exclusive" | "vip" | "public"

      try {
        // 2) Load property
        const { data: prop, error: propErr } = await admin
          .from("properties")
          .select("id,address,price,county,visibility,exclusive_user_id,auto_notify")
          .eq("id", propertyId)
          .maybeSingle()

        if (propErr) throw new Error(propErr.message)
        if (!prop) throw new Error("Property not found")

        if (!prop.auto_notify || !prop.county) {
          // mark skipped
          await admin.from("property_notify_jobs").update({ status: "skipped", updated_at: new Date().toISOString() }).eq("id", jobId)
          continue
        }

        const county = String(prop.county || "").trim()
        if (!county) {
          await admin.from("property_notify_jobs").update({ status: "skipped", updated_at: new Date().toISOString() }).eq("id", jobId)
          continue
        }

        // 3) Determine recipients by stage
        let recipients: Array<{ user_id: string; email: string; first_name: string | null; last_name: string | null }> = []

        if (stage === "exclusive") {
          const uid = prop.exclusive_user_id as string | null
          if (!uid) {
            await admin.from("property_notify_jobs").update({ status: "skipped", updated_at: new Date().toISOString() }).eq("id", jobId)
            continue
          }

          const { data: p, error } = await admin
            .from("profiles")
            .select("user_id,email,first_name,last_name,role")
            .eq("user_id", uid)
            .maybeSingle()

          if (error) throw new Error(error.message)
          if (!p?.email || p.role !== "buyer") {
            await admin.from("property_notify_jobs").update({ status: "skipped", updated_at: new Date().toISOString() }).eq("id", jobId)
            continue
          }

          recipients = [{ user_id: p.user_id, email: p.email, first_name: p.first_name, last_name: p.last_name }]
        } else if (stage === "vip") {
          // VIP buyers whose buy box contains the county
          const { data: boxes, error: boxErr } = await admin
            .from("buyer_buy_boxes")
            .select("user_id,counties")
            .contains("counties", [county])

          if (boxErr) throw new Error(boxErr.message)

          const ids = (boxes ?? []).map((b: any) => b.user_id)
          if (ids.length === 0) {
            await admin.from("property_notify_jobs").update({ status: "sent", updated_at: new Date().toISOString() }).eq("id", jobId)
            continue
          }

          const { data: profs, error: profErr } = await admin
            .from("profiles")
            .select("user_id,email,first_name,last_name,role,buyer_tier")
            .in("user_id", ids)
            .eq("role", "buyer")
            .eq("buyer_tier", "vip")

          if (profErr) throw new Error(profErr.message)

          recipients = (profs ?? [])
            .filter((p: any) => !!p.email)
            .map((p: any) => ({ user_id: p.user_id, email: p.email, first_name: p.first_name, last_name: p.last_name }))
        } else {
          // public stage: ANY buyer (regular or vip) whose buy box matches
          const { data: boxes, error: boxErr } = await admin
            .from("buyer_buy_boxes")
            .select("user_id,counties")
            .contains("counties", [county])

          if (boxErr) throw new Error(boxErr.message)

          const ids = (boxes ?? []).map((b: any) => b.user_id)
          if (ids.length === 0) {
            await admin.from("property_notify_jobs").update({ status: "sent", updated_at: new Date().toISOString() }).eq("id", jobId)
            continue
          }

          const { data: profs, error: profErr } = await admin
            .from("profiles")
            .select("user_id,email,first_name,last_name,role")
            .in("user_id", ids)
            .eq("role", "buyer")

          if (profErr) throw new Error(profErr.message)

          recipients = (profs ?? [])
            .filter((p: any) => !!p.email)
            .map((p: any) => ({ user_id: p.user_id, email: p.email, first_name: p.first_name, last_name: p.last_name }))
        }

        // 4) Send emails (with de-dupe table)
        if (!RESEND_API_KEY || !RESEND_FROM) {
          throw new Error("Missing RESEND_API_KEY or RESEND_FROM")
        }

        for (const r of recipients) {
          // skip if already sent this stage
          const { data: exists } = await admin
            .from("property_notify_sent")
            .select("id")
            .eq("property_id", propertyId)
            .eq("user_id", r.user_id)
            .eq("stage", stage)
            .maybeSingle()

          if (exists) continue

          const buyerName = `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim()
          const link = APP_BASE_URL ? `${APP_BASE_URL}/dashboard` : undefined

          await resendSendEmail({
            apiKey: RESEND_API_KEY,
            from: RESEND_FROM,
            to: r.email,
            subject: stage === "exclusive" ? "Exclusive deal — first dibs" : stage === "vip" ? "VIP early access deal" : "New deal match",
            html: emailHtml({
              buyerName,
              address: prop.address,
              county,
              price: prop.price ?? null,
              link,
              stage,
            }),
          })

          await admin.from("property_notify_sent").insert({
            property_id: propertyId,
            user_id: r.user_id,
            stage,
          })
        }

        // 5) mark job sent
        await admin.from("property_notify_jobs").update({ status: "sent", updated_at: new Date().toISOString(), last_error: null }).eq("id", jobId)
        processed++
      } catch (e: any) {
        await admin
          .from("property_notify_jobs")
          .update({ status: "error", updated_at: new Date().toISOString(), last_error: e?.message ?? String(e) })
          .eq("id", jobId)
      }
    }

    return json({ ok: true, processed })
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500)
  }
})