// supabase/functions/due-diligence-check/index.ts
//
// Due diligence = the wholesaler's window to find a buyer and get the deal locked up.
// If a property is still ACTIVE (not Under Contract) when the DD date passes,
// it means we couldn't find a buyer in time → archive as Closed Lost.
// Properties that went Under Contract before DD expired are NOT touched.
//
// Invoke manually:
//   POST /functions/v1/due-diligence-check
//   Authorization: Bearer <service_role_key>   (or admin user JWT)
//
// Schedule via Supabase pg_cron (run once daily at midnight):
//   select cron.schedule(
//     'due-diligence-check',
//     '0 0 * * *',
//     $$
//       select net.http_post(
//         url    := current_setting('app.supabase_url') || '/functions/v1/due-diligence-check',
//         headers := jsonb_build_object(
//           'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
//           'Content-Type',  'application/json'
//         ),
//         body   := '{}'::jsonb
//       );
//     $$
//   );

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  // Use the service role key so we can bypass RLS and update any property.
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceKey);

  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

  // Find active (non-archived, NOT Under Contract) properties where DD date has passed.
  // These are deals we couldn't get locked up in time → Closed Lost.
  const { data: expired, error: fetchErr } = await db
    .from("properties")
    .select("id, address, due_diligence_date")
    .eq("is_archived", false)
    .neq("status", "Under Contract")
    .not("due_diligence_date", "is", null)
    .lte("due_diligence_date", today);

  if (fetchErr) {
    return json({ error: fetchErr.message }, 500);
  }

  if (!expired || expired.length === 0) {
    return json({ archived: 0, message: "No expired due diligence dates found." });
  }

  const ids = expired.map((p: any) => p.id);

  const { error: updateErr } = await db
    .from("properties")
    .update({
      is_archived: true,
      closed_outcome: "lost",
      closed_at: new Date().toISOString(),
      closed_reason: "Due diligence expired",
    })
    .in("id", ids);

  if (updateErr) {
    return json({ error: updateErr.message }, 500);
  }

  return json({
    archived: ids.length,
    properties: expired.map((p: any) => ({ id: p.id, address: p.address, due_diligence_date: p.due_diligence_date })),
  });
});
