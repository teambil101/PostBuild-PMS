// Public webhook for n8n to post feedback into service_feedback.
// Secured via shared secret header `x-n8n-secret`.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-n8n-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SHARED_SECRET = Deno.env.get("N8N_SHARED_SECRET");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!SHARED_SECRET) {
    console.error("N8N_SHARED_SECRET is not configured");
    return new Response(JSON.stringify({ error: "Server not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const provided = req.headers.get("x-n8n-secret");
  if (provided !== SHARED_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Required: service_id (= service_requests.id) and rating (1-5)
  const serviceId = body.service_id ? String(body.service_id) : null;
  const ratingRaw = Number(body.rating);
  if (!serviceId) {
    return new Response(
      JSON.stringify({ error: "Missing required field: service_id" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  if (!Number.isFinite(ratingRaw) || ratingRaw < 1 || ratingRaw > 5) {
    return new Response(
      JSON.stringify({ error: "rating must be a number between 1 and 5" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  const rating = Math.round(ratingRaw);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Look up the service request to snapshot the assignee
  const { data: sr, error: srErr } = await supabase
    .from("service_requests")
    .select("id, assigned_person_id, assigned_vendor_id")
    .eq("id", serviceId)
    .maybeSingle();

  if (srErr) {
    console.error("service_requests lookup error:", srErr);
    return new Response(
      JSON.stringify({ error: "Database error", detail: srErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  if (!sr) {
    return new Response(JSON.stringify({ error: "service_id not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const comment = body.comment ?? body.feedback;
  const payload = {
    service_request_id: sr.id,
    assigned_person_id: sr.assigned_person_id,
    assigned_vendor_id: sr.assigned_vendor_id,
    rating,
    comment: comment ? String(comment).substring(0, 2000) : null,
    submitted_at: new Date().toISOString(),
  };

  const { data: inserted, error: insErr } = await supabase
    .from("service_feedback")
    .insert(payload)
    .select("id")
    .single();

  if (insErr) {
    console.error("service_feedback insert error:", insErr);
    return new Response(
      JSON.stringify({ error: "Database error", detail: insErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ success: true, feedback_id: inserted.id, service_id: sr.id }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});