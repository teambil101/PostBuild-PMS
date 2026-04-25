// Fires when a service_request transitions to status='completed'.
// Invoked by a Postgres trigger via pg_net.
// Posts a payload to the n8n webhook URL stored in N8N_SERVICE_COMPLETED_WEBHOOK_URL.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_URL = Deno.env.get("N8N_SERVICE_COMPLETED_WEBHOOK_URL");

function fullName(p: { first_name?: string | null; last_name?: string | null } | null) {
  if (!p) return null;
  return [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!WEBHOOK_URL) {
    console.error("N8N_SERVICE_COMPLETED_WEBHOOK_URL not configured");
    return new Response(JSON.stringify({ error: "Webhook URL not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { service_request_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const serviceId = body.service_request_id;
  if (!serviceId) {
    return new Response(JSON.stringify({ error: "Missing service_request_id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1. Load service request
  const { data: sr, error: srErr } = await supabase
    .from("service_requests")
    .select("id, title, target_type, target_id, assigned_person_id, assigned_vendor_id")
    .eq("id", serviceId)
    .maybeSingle();

  if (srErr || !sr) {
    console.error("service_requests lookup failed:", srErr);
    return new Response(
      JSON.stringify({ error: "service_request not found", detail: srErr?.message }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // 2. Resolve staff/vendor name
  let staffName: string | null = null;
  let staffId: string | null = null;
  if (sr.assigned_person_id) {
    staffId = sr.assigned_person_id;
    const { data: p } = await supabase
      .from("people")
      .select("first_name, last_name")
      .eq("id", sr.assigned_person_id)
      .maybeSingle();
    staffName = fullName(p);
  } else if (sr.assigned_vendor_id) {
    staffId = sr.assigned_vendor_id;
    const { data: v } = await supabase
      .from("vendors")
      .select("name")
      .eq("id", sr.assigned_vendor_id)
      .maybeSingle();
    staffName = v?.name ?? null;
  }

  // 3. Resolve tenant from active lease on the unit (if applicable)
  let tenantName: string | null = null;
  let tenantPhone: string | null = null;
  if (sr.target_type === "unit" && sr.target_id) {
    const today = new Date().toISOString().slice(0, 10);
    const { data: leases } = await supabase
      .from("leases")
      .select("contract_id, contracts!inner(start_date, end_date, status)")
      .eq("unit_id", sr.target_id);

    // Pick the active one
    const active = (leases ?? []).find((l: any) => {
      const c = l.contracts;
      if (!c) return false;
      if (c.status && !["active", "signed"].includes(c.status)) return false;
      if (c.start_date && c.start_date > today) return false;
      if (c.end_date && c.end_date < today) return false;
      return true;
    });

    if (active) {
      const { data: parties } = await supabase
        .from("contract_parties")
        .select("person_id, is_primary, role")
        .eq("contract_id", active.contract_id)
        .eq("role", "tenant");

      const primary = parties?.find((p) => p.is_primary) ?? parties?.[0];
      if (primary) {
        const { data: person } = await supabase
          .from("people")
          .select("first_name, last_name, phone")
          .eq("id", primary.person_id)
          .maybeSingle();
        tenantName = fullName(person);
        tenantPhone = person?.phone ?? null;
      }
    }
  }

  const payload = {
    service_id: sr.id,
    tenant_name: tenantName,
    tenant_phone: tenantPhone,
    service_name: sr.title,
    staff_name: staffName,
    staff_id: staffId,
  };

  console.log("Posting to n8n:", payload);

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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