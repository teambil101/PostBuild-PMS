// Fires when a service_request_quotes row is inserted with status='invited'.
// Posts vendor + request + tokenized link payload to the n8n webhook URL stored in
// N8N_QUOTE_INVITE_WEBHOOK_URL. n8n then fans out WhatsApp/email to the vendor.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_URL = Deno.env.get("N8N_QUOTE_INVITE_WEBHOOK_URL");
const SHARED_SECRET = Deno.env.get("N8N_SHARED_SECRET");
const PUBLIC_APP_URL = Deno.env.get("PUBLIC_APP_URL") ?? "https://intuitive-home-guide.lovable.app";

function fullName(p: { first_name?: string | null; last_name?: string | null } | null) {
  if (!p) return null;
  return [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!WEBHOOK_URL) {
    console.error("N8N_QUOTE_INVITE_WEBHOOK_URL not configured");
    return new Response(JSON.stringify({ error: "Webhook URL not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { quote_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const quoteId = body.quote_id;
  if (!quoteId) {
    return new Response(JSON.stringify({ error: "Missing quote_id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1. Load quote
  const { data: quote, error: qErr } = await supabase
    .from("service_request_quotes")
    .select(
      "id, request_id, vendor_id, currency, expires_at, submission_token, invited_at, status",
    )
    .eq("id", quoteId)
    .maybeSingle();

  if (qErr || !quote) {
    console.error("Quote lookup failed:", qErr);
    return new Response(
      JSON.stringify({ error: "Quote not found", detail: qErr?.message }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (quote.status !== "invited") {
    return new Response(
      JSON.stringify({ skipped: true, reason: `quote status is ${quote.status}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // 2. Load request + target details
  const { data: sr } = await supabase
    .from("service_requests")
    .select(
      "id, request_number, title, description, category, priority, target_type, target_id",
    )
    .eq("id", quote.request_id)
    .maybeSingle();

  if (!sr) {
    return new Response(
      JSON.stringify({ error: "Service request not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // 3. Resolve target label (unit / building / portfolio)
  let targetLabel = "Property";
  let targetCity: string | null = null;
  if (sr.target_type === "unit" && sr.target_id) {
    const { data: u } = await supabase
      .from("units")
      .select("unit_number, buildings(name, city)")
      .eq("id", sr.target_id)
      .maybeSingle();
    if (u) {
      const b: any = (u as any).buildings;
      targetLabel = `${b?.name ?? ""} · Unit ${u.unit_number}`.trim();
      targetCity = b?.city ?? null;
    }
  } else if (sr.target_type === "building" && sr.target_id) {
    const { data: b } = await supabase
      .from("buildings")
      .select("name, city")
      .eq("id", sr.target_id)
      .maybeSingle();
    if (b) {
      targetLabel = b.name;
      targetCity = b.city ?? null;
    }
  }

  // 4. Load vendor contact info
  const { data: vendor } = await supabase
    .from("vendors")
    .select(
      "id, legal_name, display_name, primary_phone, primary_email, currency",
    )
    .eq("id", quote.vendor_id)
    .maybeSingle();

  if (!vendor) {
    return new Response(
      JSON.stringify({ error: "Vendor not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // 5. Resolve who invited (optional — for personalised messages)
  let invitedByName: string | null = null;
  const { data: invitingUser } = await supabase
    .from("service_request_quotes")
    .select("invited_by")
    .eq("id", quote.id)
    .maybeSingle();
  if (invitingUser?.invited_by) {
    const { data: p } = await supabase
      .from("people")
      .select("first_name, last_name")
      .eq("auth_user_id", invitingUser.invited_by)
      .maybeSingle();
    invitedByName = fullName(p);
  }

  // 6. Build payload
  const submissionUrl = `${PUBLIC_APP_URL}/q/${quote.submission_token}`;

  const payload = {
    event: "quote_invite",
    quote_id: quote.id,
    submission_url: submissionUrl,
    expires_at: quote.expires_at,
    invited_at: quote.invited_at,
    request: {
      id: sr.id,
      number: sr.request_number,
      title: sr.title,
      description: sr.description,
      category: sr.category,
      priority: sr.priority,
      target_label: targetLabel,
      target_city: targetCity,
      currency: vendor.currency ?? "AED",
    },
    vendor: {
      id: vendor.id,
      name: vendor.display_name || vendor.legal_name,
      legal_name: vendor.legal_name,
      phone: vendor.primary_phone,
      email: vendor.primary_email,
    },
    invited_by: invitedByName,
  };

  console.log("Posting quote invite to n8n:", { quote_id: quote.id, vendor: vendor.legal_name });

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (SHARED_SECRET) headers["X-Shared-Secret"] = SHARED_SECRET;

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error("n8n webhook failed", res.status, text);
      return new Response(
        JSON.stringify({ error: "Webhook delivery failed", status: res.status, detail: text }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ success: true, payload }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Fetch to n8n threw:", e);
    return new Response(
      JSON.stringify({ error: "Webhook delivery threw", detail: String(e) }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});