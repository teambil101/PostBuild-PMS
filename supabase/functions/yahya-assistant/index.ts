// Yahya — natural-language Q&A over the True Build database.
// Streams an assistant response, with one tool: run_sql (read-only).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const MODEL = "google/gemini-3-flash-preview";
const MAX_TOOL_ROUNDS = 5;

const SCHEMA_DIGEST = `
You are Yahya, the True Build property-operations assistant.

You answer questions about the live database by writing PostgreSQL SELECT queries
and calling the run_sql tool. NEVER invent numbers — every figure you state must
come from a tool result. If you cannot get the answer with the schema below, say
so plainly.

Currency: AED unless a row says otherwise. Today's date is provided in the system
context. Use thousands separators in numbers (e.g. 12,500 AED).

When showing tabular data back to the user, keep it to the columns that matter
(don't dump UUIDs unless asked). Sort sensibly. Round money to 0 decimals.

==================== SCHEMA ====================
Schema is "public". All timestamps are "timestamptz". Use now(), date_trunc('month', now()), etc.

-- Properties --
buildings(id, ref_code, name, city, country, building_type, community, created_at)
units(id, building_id, ref_code, unit_number, unit_type, status [property_status], floor,
      size_sqm, bedrooms, bathrooms, asking_rent, asking_rent_currency, listed_at)
property_owners(id, entity_type ['building'|'unit'], entity_id, person_id,
                ownership_percentage, is_primary, acquired_on)
property_status_history(id, unit_id, old_status, new_status, changed_at, changed_by)

-- People & vendors --
people(id, ref_code, first_name, last_name, email, phone, roles [person_role[]],
       company, person_type ['individual'|'company'], is_active, created_at)
vendors(id, ...)        -- vendor master record
vendor_contacts(id, vendor_id, person_id, role, is_primary)

-- Contracts (3 sub-types share the contracts table) --
contracts(id, contract_number, contract_type [management_agreement|lease|vendor_service_agreement],
          status [draft|pending_signature|active|expired|terminated|cancelled],
          title, start_date, end_date, signed_date, currency, created_at)
contract_parties(id, contract_id, person_id, role [pm_company|landlord|tenant|broker|guarantor|vendor], is_primary)
contract_subjects(id, contract_id, subject_type ['building'|'unit'], subject_id)
contract_events(id, contract_id, event_type, from_value, to_value, actor_id, created_at)

leases(contract_id PK, unit_id, rent_amount, rent_frequency ['annual'|'monthly'|...],
       number_of_cheques, payment_method, security_deposit, ejari_number,
       ejari_registered_date, auto_renew)
management_agreements(contract_id PK, fee_model [percent_of_rent|flat_annual|flat_per_unit|hybrid],
                      fee_percent, fee_flat_annual, fee_flat_per_unit,
                      approval_rule [auto_threshold|always_required|auto_all],
                      approval_threshold_amount)
vendor_service_agreements(contract_id PK, ...)  -- VSAs per vendor

-- Service requests (work orders) --
service_catalog(id, code, name, category [service_category], default_billing, default_delivery, is_workflow)
service_requests(id, request_number, catalog_id, title, category [service_category],
                 status [open|scheduled|in_progress|blocked|completed|cancelled],
                 priority [low|normal|high|urgent],
                 target_type ['unit'|'building'], target_id,
                 assigned_vendor_id, assigned_person_id, requested_by_person_id,
                 scheduled_date, started_at, completed_at,
                 delivery [vendor|staff|either], billing [free|paid|pass_through],
                 cost_estimate, cost_final, currency,
                 bill_to [landlord|tenant],
                 approval_status [not_required|pending|approved|rejected],
                 tenant_approval_status, tenant_schedule_status,
                 created_at)
service_request_steps(id, request_id, step_key, title, sort_order, status, billing,
                      assigned_vendor_id, assigned_person_id, scheduled_date,
                      cost_estimate, cost_final)
service_request_quotes(id, request_id, vendor_id, status [invited|submitted|accepted|rejected|withdrawn|expired],
                       amount, currency, eta_days, invited_at, submitted_at, decided_at)
vendor_quotes(id, number, service_request_id, vendor_id, total, currency, status, valid_until)
service_feedback(id, service_request_id, rating [1-5], comment, submitted_at)

-- Financials --
invoices(id, number, party_person_id, contract_id, lease_contract_id, service_request_id,
         bill_to_role [landlord|tenant], issue_date, due_date, currency,
         subtotal, tax, total, amount_paid,
         status [draft|issued|partial|paid|void], created_at)
invoice_lines(id, invoice_id, description, quantity, unit_price, amount, account_id)
bills(id, number, vendor_id, party_person_id, contract_id, vsa_contract_id,
      service_request_id, owner_statement_id, issue_date, due_date, currency,
      subtotal, tax, total, amount_paid, status [draft|approved|partial|paid|void])
bill_lines(id, bill_id, description, quantity, unit_price, amount)
payments(id, number, direction [in|out], method, amount, currency, paid_on,
         party_person_id, party_vendor_id, bank_account_id)
payment_allocations(id, payment_id, invoice_id, bill_id, amount)
owner_statements(id, number, ma_contract_id, landlord_person_id, period_start, period_end,
                 gross_rent, pm_fee, expenses_total, net_remittance, status)
journal_entries(id, posted_at, source_type, source_id, memo)
journal_lines(id, entry_id, account_id, debit, credit, party_person_id, party_vendor_id, landlord_person_id)

-- Leads / pipeline --
leads(id, lead_number, primary_contact_id, status, source, estimated_annual_fee, created_at)

==================== JOIN HINTS ====================
- Lease + unit + building:
    leases l JOIN units u ON u.id = l.unit_id JOIN buildings b ON b.id = u.building_id
- Lease tenant name:
    JOIN contract_parties cp ON cp.contract_id = l.contract_id AND cp.role='tenant'
    JOIN people p ON p.id = cp.person_id
- Service request → unit / building:
    sr.target_type='unit'  → JOIN units u ON u.id = sr.target_id
    sr.target_type='building' → JOIN buildings b ON b.id = sr.target_id
- Vendor name:
    JOIN vendors v ON v.id = sr.assigned_vendor_id
- "This month" = date_trunc('month', now()); "this year" = date_trunc('year', now()).
- "Signed this month" on contracts → signed_date >= date_trunc('month', now()) AND signed_date < date_trunc('month', now()) + interval '1 month'.
- "New" usually = created_at; clarify if ambiguous.
- Use COALESCE(cost_final, cost_estimate, 0) when asked about service request value.
- Active service requests = status IN ('open','scheduled','in_progress','blocked').

==================== STYLE ====================
- Be concise. Lead with the answer, then a short table if helpful (markdown table).
- If a query returns >20 rows, summarise + show top 10 by relevance.
- If the user asks something the schema cannot answer, say so and suggest what you CAN show.
- If a query returns an error, read the error, fix the SQL, and retry (max ${MAX_TOOL_ROUNDS} attempts).
`.trim();

const TOOLS = [
  {
    type: "function",
    function: {
      name: "run_sql",
      description:
        "Execute a single read-only SELECT (or WITH ... SELECT) PostgreSQL query against the True Build database. Returns at most 500 rows as JSON. Use this for every factual claim.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "A single PostgreSQL SELECT statement. No semicolons inside. No DDL/DML.",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
];

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
}

async function callGateway(messages: ChatMessage[], stream: boolean) {
  return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: TOOLS,
      stream,
    }),
  });
}

function sseSend(
  controller: ReadableStreamDefaultController,
  event: string,
  data: unknown,
) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(new TextEncoder().encode(payload));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the user
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const userMessage: string = (body.message ?? "").toString().trim();
    let sessionId: string | null = body.session_id ?? null;

    if (!userMessage) {
      return new Response(JSON.stringify({ error: "message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service-role client for DB writes + run_readonly_sql impersonation
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Create session if needed
    if (!sessionId) {
      const title = userMessage.slice(0, 60);
      const { data: newSession, error: sErr } = await adminClient
        .from("ai_chat_sessions")
        .insert({ user_id: userId, title })
        .select("id")
        .single();
      if (sErr) throw sErr;
      sessionId = newSession.id;
    }

    // Load prior conversation
    const { data: priorMsgs } = await adminClient
      .from("ai_chat_messages")
      .select("role, content, tool_calls, tool_results")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    const history: ChatMessage[] = [];
    for (const m of priorMsgs ?? []) {
      if (m.role === "user") {
        history.push({ role: "user", content: m.content });
      } else if (m.role === "assistant") {
        const msg: ChatMessage = { role: "assistant", content: m.content || null };
        if (m.tool_calls) msg.tool_calls = m.tool_calls as ChatMessage["tool_calls"];
        history.push(msg);
      } else if (m.role === "tool") {
        const tr = m.tool_results as { tool_call_id?: string; name?: string } | null;
        history.push({
          role: "tool",
          content: m.content,
          tool_call_id: tr?.tool_call_id,
          name: tr?.name,
        });
      }
    }

    // Save the user message
    await adminClient.from("ai_chat_messages").insert({
      session_id: sessionId,
      role: "user",
      content: userMessage,
    });

    const today = new Date().toISOString().slice(0, 10);
    const systemPrompt = `${SCHEMA_DIGEST}\n\nToday's date: ${today}.`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: userMessage },
    ];

    // User-bound client for the read-only SQL function (so auth.uid() inside it works).
    // We pass the JWT through.
    const sqlClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const stream = new ReadableStream({
      async start(controller) {
        try {
          sseSend(controller, "session", { session_id: sessionId });

          for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            // Non-streaming: we need the full message to know if there's a tool call.
            const resp = await callGateway(messages, false);

            if (resp.status === 429) {
              sseSend(controller, "error", {
                message:
                  "Yahya is rate-limited right now. Please try again in a moment.",
              });
              break;
            }
            if (resp.status === 402) {
              sseSend(controller, "error", {
                message:
                  "AI credits exhausted. Top up in Settings → Workspace → Usage.",
              });
              break;
            }
            if (!resp.ok) {
              const t = await resp.text();
              console.error("Gateway error", resp.status, t);
              sseSend(controller, "error", { message: "AI gateway error." });
              break;
            }

            const data = await resp.json();
            const choice = data.choices?.[0];
            const msg = choice?.message;
            if (!msg) {
              sseSend(controller, "error", { message: "Empty response from model." });
              break;
            }

            const toolCalls = msg.tool_calls as
              | Array<{
                  id: string;
                  type: string;
                  function: { name: string; arguments: string };
                }>
              | undefined;

            if (!toolCalls || toolCalls.length === 0) {
              // Final answer
              const finalText: string = msg.content ?? "";
              sseSend(controller, "delta", { content: finalText });

              await adminClient.from("ai_chat_messages").insert({
                session_id: sessionId,
                role: "assistant",
                content: finalText,
              });

              sseSend(controller, "done", {});
              break;
            }

            // Persist the assistant's tool-call message
            messages.push({
              role: "assistant",
              content: msg.content ?? null,
              tool_calls: toolCalls,
            });
            await adminClient.from("ai_chat_messages").insert({
              session_id: sessionId,
              role: "assistant",
              content: msg.content ?? "",
              tool_calls: toolCalls,
            });

            // Execute every tool call
            for (const tc of toolCalls) {
              if (tc.function.name !== "run_sql") {
                const errPayload = JSON.stringify({ error: "unknown_tool" });
                messages.push({
                  role: "tool",
                  tool_call_id: tc.id,
                  name: tc.function.name,
                  content: errPayload,
                });
                continue;
              }

              let parsed: { query?: string } = {};
              try {
                parsed = JSON.parse(tc.function.arguments || "{}");
              } catch {
                parsed = {};
              }
              const query = (parsed.query ?? "").toString();

              sseSend(controller, "tool_call", {
                id: tc.id,
                query,
              });

              const { data: sqlData, error: sqlErr } = await sqlClient.rpc(
                "run_readonly_sql",
                { query_text: query },
              );

              const resultPayload = sqlErr
                ? { error: sqlErr.message }
                : sqlData;

              const resultStr = JSON.stringify(resultPayload).slice(0, 60_000);

              sseSend(controller, "tool_result", {
                id: tc.id,
                result: resultPayload,
              });

              messages.push({
                role: "tool",
                tool_call_id: tc.id,
                name: "run_sql",
                content: resultStr,
              });

              await adminClient.from("ai_chat_messages").insert({
                session_id: sessionId,
                role: "tool",
                content: resultStr,
                tool_results: { tool_call_id: tc.id, name: "run_sql" },
              });
            }
            // loop again so the model can read tool results and continue
          }
        } catch (e) {
          console.error("yahya error:", e);
          sseSend(controller, "error", {
            message: e instanceof Error ? e.message : "Unknown error",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    console.error("yahya fatal:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
