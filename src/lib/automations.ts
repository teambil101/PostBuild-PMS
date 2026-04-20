/* =========================================================
 * Client-orchestrated background automations (T3a).
 *
 * These run on a 6h throttle from a few high-traffic pages
 * (/tickets, /contracts, /lifecycle). They are silent — no
 * user-facing UI for results. Failures are swallowed so a
 * partial outage of one automation doesn't break the others.
 *
 * When T3b (n8n) lands, the same functions can be invoked
 * server-side from a cron job; no behaviour change required.
 * ========================================================= */

import { supabase } from "@/integrations/supabase/client";
import { nextTicketNumber } from "@/lib/tickets";
import {
  initializeTicketWorkflow,
  WORKFLOWS,
  type WorkflowKey,
} from "@/lib/workflows";
import { computeNextDueDate, type Frequency } from "@/lib/services";

const THROTTLE_KEY = "lastSystemAutomationsRun";
const THROTTLE_MS = 6 * 60 * 60 * 1000; // 6h

export interface AutomationResult {
  created: number;
  skipped: number;
  errors: number;
}

/* ---------- helpers ---------- */

function daysUntil(dateIso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateIso);
  due.setHours(0, 0, 0, 0);
  return Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function renewalPriority(days: number): "urgent" | "high" | "medium" {
  if (days <= 30) return "urgent";
  if (days <= 60) return "high";
  return "medium";
}

interface AutoTicketBase {
  subject: string;
  description: string;
  ticket_type: string;
  priority: string;
  status: string;
  target_entity_type: string;
  target_entity_id: string;
  due_date?: string | null;
  is_system_generated: boolean;
  created_by: string | null;
  system_dedup_key: string;
}

/** Insert a ticket with retry on ticket_number unique-violation (sequence drift). */
async function insertTicketWithRetry(
  base: AutoTicketBase,
): Promise<{ id: string } | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const ticket_number = await nextTicketNumber();
    const { data, error } = await supabase
      .from("tickets")
      .insert({ ticket_number, ...base })
      .select("id")
      .maybeSingle();
    if (!error && data) return data as { id: string };
    const msg = error?.message ?? "";
    if (!/tickets_ticket_number_key|duplicate key/i.test(msg)) {
      // Non-collision error — bail.
      console.warn("[automations] insert ticket failed", error);
      return null;
    }
  }
  console.warn("[automations] gave up after 5 collision retries");
  return null;
}

/* =========================================================
 * 1. Lease expiry detection
 * ========================================================= */

export async function detectExpiringLeases(): Promise<AutomationResult> {
  const result: AutomationResult = { created: 0, skipped: 0, errors: 0 };

  // Fetch active lease contracts expiring within 90 days, plus their unit subject (for context).
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 90);
  const horizonIso = horizon.toISOString().slice(0, 10);

  const { data: contracts, error } = await supabase
    .from("contracts")
    .select("id, contract_number, end_date")
    .eq("contract_type", "lease")
    .eq("status", "active")
    .not("end_date", "is", null)
    .lte("end_date", horizonIso);

  if (error || !contracts) {
    result.errors++;
    return result;
  }

  if (contracts.length === 0) return result;

  // Bulk-fetch existing dedup keys to avoid one query per lease.
  const dedupKeys = contracts.map((c) => `lease_renewal:${c.id}`);
  const { data: existing } = await supabase
    .from("tickets")
    .select("system_dedup_key")
    .in("system_dedup_key", dedupKeys);
  const existingSet = new Set((existing ?? []).map((r) => r.system_dedup_key));

  const stages = WORKFLOWS.lease_renewal.stages.map((s) => ({
    key: s.key,
    label: s.label,
    description: s.description ?? null,
    steps: s.steps.map((st) => ({
      key: st.key,
      label: st.label,
      description: st.description ?? null,
      required: st.required ?? true,
    })),
  }));

  for (const c of contracts) {
    const dedup = `lease_renewal:${c.id}`;
    if (existingSet.has(dedup)) {
      result.skipped++;
      continue;
    }
    if (!c.end_date) {
      result.skipped++;
      continue;
    }
    const days = Math.max(0, daysUntil(c.end_date));
    const priority = renewalPriority(days);

    const created = await insertTicketWithRetry({
      subject: `Lease renewal: ${c.contract_number}`,
      description:
        `Lease ${c.contract_number} expires ${c.end_date} (${days} days).\n\n` +
        `Begin renewal workflow to contact the tenant, negotiate terms, and prepare documentation.`,
      ticket_type: "request_renewal",
      priority,
      status: "open",
      target_entity_type: "contract",
      target_entity_id: c.id,
      due_date: c.end_date,
      is_system_generated: true,
      created_by: null,
      system_dedup_key: dedup,
    });

    if (!created) {
      result.errors++;
      continue;
    }
    result.created++;

    // Initialize workflow; failure is non-fatal.
    try {
      await initializeTicketWorkflow(created.id, "lease_renewal" as WorkflowKey);
    } catch (wfErr) {
      console.warn("[automations] lease_renewal workflow init failed", wfErr);
    }
    void stages; // keep reference (workflow lib handles payload internally)
  }

  return result;
}

/* =========================================================
 * 2. Data gap sweep
 * ========================================================= */

export async function detectDataGaps(): Promise<AutomationResult> {
  const result: AutomationResult = { created: 0, skipped: 0, errors: 0 };

  /* ----- GAP A: occupied unit without an active lease lock ----- */
  const { data: occupiedNoLease, error: errA } = await supabase
    .from("units")
    .select("id, unit_number, building_id, buildings(name)")
    .eq("status", "occupied")
    .is("status_locked_by_lease_id", null);

  if (errA) {
    result.errors++;
  } else if (occupiedNoLease && occupiedNoLease.length > 0) {
    const keys = occupiedNoLease.map((u) => `data_gap:missing_lease:${u.id}`);
    const { data: existing } = await supabase
      .from("tickets")
      .select("system_dedup_key, status")
      .in("system_dedup_key", keys);
    const blocked = new Set(
      (existing ?? [])
        .filter((r) => r.status !== "closed" && r.status !== "cancelled")
        .map((r) => r.system_dedup_key),
    );

    for (const u of occupiedNoLease as any[]) {
      const dedup = `data_gap:missing_lease:${u.id}`;
      if (blocked.has(dedup)) {
        result.skipped++;
        continue;
      }
      const buildingName = u.buildings?.name ?? "—";
      const created = await insertTicketWithRetry({
        subject: `Occupied unit missing lease record: ${u.unit_number}`,
        description:
          `Unit ${u.unit_number} in ${buildingName} is marked occupied but has no active lease on file. ` +
          `Add lease details so the system reflects reality, or update the unit status if this is incorrect.`,
        ticket_type: "data_gap",
        priority: "medium",
        status: "open",
        target_entity_type: "unit",
        target_entity_id: u.id,
        is_system_generated: true,
        created_by: null,
        system_dedup_key: dedup,
      });
      if (created) result.created++;
      else result.errors++;
    }
  }

  /* ----- GAP B: unit with no resolvable owner ----- */
  const { data: noOwner, error: errB } = await supabase
    .from("units_without_owners")
    .select("id, unit_number, building_id");

  if (errB) {
    result.errors++;
  } else if (noOwner && noOwner.length > 0) {
    // Fetch building names in one go.
    const buildingIds = Array.from(
      new Set(noOwner.map((u) => u.building_id).filter(Boolean) as string[]),
    );
    const { data: buildings } = buildingIds.length
      ? await supabase.from("buildings").select("id, name").in("id", buildingIds)
      : { data: [] as { id: string; name: string }[] };
    const nameById = new Map(
      (buildings ?? []).map((b) => [b.id, b.name] as const),
    );

    const keys = noOwner.map((u) => `data_gap:missing_ownership:${u.id}`);
    const { data: existing } = await supabase
      .from("tickets")
      .select("system_dedup_key, status")
      .in("system_dedup_key", keys);
    const blocked = new Set(
      (existing ?? [])
        .filter((r) => r.status !== "closed" && r.status !== "cancelled")
        .map((r) => r.system_dedup_key),
    );

    for (const u of noOwner) {
      if (!u.id || !u.unit_number) {
        result.skipped++;
        continue;
      }
      const dedup = `data_gap:missing_ownership:${u.id}`;
      if (blocked.has(dedup)) {
        result.skipped++;
        continue;
      }
      const buildingName = (u.building_id && nameById.get(u.building_id)) ?? "—";
      const created = await insertTicketWithRetry({
        subject: `Unit missing ownership: ${u.unit_number}`,
        description:
          `Unit ${u.unit_number} in ${buildingName} has no resolvable owner ` +
          `(no unit-level or building-level ownership records). ` +
          `Set ownership on the unit or on its building.`,
        ticket_type: "data_gap",
        priority: "medium",
        status: "open",
        target_entity_type: "unit",
        target_entity_id: u.id,
        is_system_generated: true,
        created_by: null,
        system_dedup_key: dedup,
      });
      if (created) result.created++;
      else result.errors++;
    }
  }

  return result;
}

/* =========================================================
 * 3. Vendor compliance expiry sweep
 * ========================================================= */

type ComplianceKind = "trade_license" | "insurance";

function compliancePriority(days: number): "urgent" | "high" | "medium" {
  if (days < 0) return "urgent"; // already expired
  if (days <= 30) return "high";
  return "medium";
}

function complianceLabel(kind: ComplianceKind): string {
  return kind === "trade_license" ? "Trade license" : "Insurance";
}

export async function detectVendorComplianceExpiry(): Promise<AutomationResult> {
  const result: AutomationResult = { created: 0, skipped: 0, errors: 0 };

  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 60);
  const horizonIso = horizon.toISOString().slice(0, 10);

  const { data: vendors, error } = await supabase
    .from("vendors")
    .select(
      "id, legal_name, display_name, trade_license_number, trade_license_authority, trade_license_expiry_date, insurance_provider, insurance_policy_number, insurance_expiry_date",
    )
    .eq("status", "active")
    .or(
      `and(trade_license_expiry_date.not.is.null,trade_license_expiry_date.lte.${horizonIso}),and(insurance_expiry_date.not.is.null,insurance_expiry_date.lte.${horizonIso})`,
    );

  if (error || !vendors) {
    result.errors++;
    return result;
  }
  if (vendors.length === 0) return result;

  // Build candidate (vendor, kind, expiry) tuples.
  type Candidate = {
    vendor: (typeof vendors)[number];
    kind: ComplianceKind;
    expiry: string;
  };
  const candidates: Candidate[] = [];
  for (const v of vendors) {
    if (v.trade_license_expiry_date && v.trade_license_expiry_date <= horizonIso) {
      candidates.push({ vendor: v, kind: "trade_license", expiry: v.trade_license_expiry_date });
    }
    if (v.insurance_expiry_date && v.insurance_expiry_date <= horizonIso) {
      candidates.push({ vendor: v, kind: "insurance", expiry: v.insurance_expiry_date });
    }
  }
  if (candidates.length === 0) return result;

  // Bulk dedup: include expiry in the key so renewals after closure can re-fire.
  const dedupKeys = candidates.map(
    (c) => `vendor_compliance:${c.kind}:${c.vendor.id}:${c.expiry}`,
  );
  const { data: existing } = await supabase
    .from("tickets")
    .select("system_dedup_key")
    .in("system_dedup_key", dedupKeys);
  const existingSet = new Set((existing ?? []).map((r) => r.system_dedup_key));

  for (const c of candidates) {
    const dedup = `vendor_compliance:${c.kind}:${c.vendor.id}:${c.expiry}`;
    if (existingSet.has(dedup)) {
      result.skipped++;
      continue;
    }
    const days = daysUntil(c.expiry);
    const priority = compliancePriority(days);
    const label = complianceLabel(c.kind);
    const vendorName = c.vendor.display_name ?? c.vendor.legal_name;
    const isExpired = days < 0;

    const docDetail =
      c.kind === "trade_license"
        ? `${c.vendor.trade_license_number ? `#${c.vendor.trade_license_number}` : "Trade license"}${
            c.vendor.trade_license_authority ? ` with ${c.vendor.trade_license_authority}` : ""
          }`
        : `${c.vendor.insurance_policy_number ? `Policy #${c.vendor.insurance_policy_number}` : "Insurance policy"}${
            c.vendor.insurance_provider ? ` with ${c.vendor.insurance_provider}` : ""
          }`;

    const subject = isExpired
      ? `${label} expired: ${vendorName}`
      : `${label} expiring: ${vendorName}`;

    const description = isExpired
      ? `${docDetail} expired on ${c.expiry} (${Math.abs(days)} days ago). ` +
        `Request a renewed copy from the vendor before scheduling additional work.`
      : `${docDetail} expires on ${c.expiry} (${days} day${days === 1 ? "" : "s"}). ` +
        `Request the renewed copy from the vendor before the current document lapses.`;

    const created = await insertTicketWithRetry({
      subject,
      description,
      ticket_type: "compliance_reminder",
      priority,
      status: "open",
      target_entity_type: "vendor",
      target_entity_id: c.vendor.id,
      due_date: c.expiry,
      is_system_generated: true,
      created_by: null,
      system_dedup_key: dedup,
    });
    if (created) result.created++;
    else result.errors++;
  }

  return result;
}

/* =========================================================
 * 4. Scheduled service sweep
 * ========================================================= */

interface ScheduleRow {
  id: string;
  name: string;
  description: string | null;
  vendor_id: string;
  service_agreement_id: string | null;
  target_entity_type: "unit" | "building";
  target_entity_id: string;
  frequency: Frequency;
  next_due_date: string;
  end_date: string | null;
  lead_time_days: number;
  default_ticket_type: string;
  default_priority: string;
  auto_assign_vendor: boolean;
  auto_init_workflow: boolean;
}

async function logScheduleEvent(
  schedule_id: string,
  event_type: string,
  description: string,
  to_value?: string | null,
) {
  await supabase.from("service_schedule_events").insert({
    schedule_id,
    event_type,
    description,
    to_value: to_value ?? null,
    actor_id: null,
  });
}

export async function processScheduledServices(): Promise<AutomationResult> {
  const result: AutomationResult = { created: 0, skipped: 0, errors: 0 };
  const today = new Date().toISOString().slice(0, 10);

  // Active schedules whose next_due_date - lead_time_days <= today.
  const { data: schedules, error } = await supabase
    .from("service_schedules")
    .select(
      "id, name, description, vendor_id, service_agreement_id, target_entity_type, target_entity_id, frequency, next_due_date, end_date, lead_time_days, default_ticket_type, default_priority, auto_assign_vendor, auto_init_workflow",
    )
    .eq("status", "active");

  if (error || !schedules) {
    result.errors++;
    return result;
  }

  for (const s of schedules as ScheduleRow[]) {
    try {
      // Skip if past end_date.
      if (s.end_date && s.end_date < today) {
        result.skipped++;
        continue;
      }
      // Trigger window: today >= next_due_date - lead_time_days.
      const trigger = new Date(s.next_due_date + "T00:00:00");
      trigger.setDate(trigger.getDate() - s.lead_time_days);
      const triggerIso = trigger.toISOString().slice(0, 10);
      if (today < triggerIso) {
        result.skipped++;
        continue;
      }

      const dedup = `service_schedule:${s.id}:${s.next_due_date}`;
      const { data: existing } = await supabase
        .from("tickets")
        .select("id")
        .eq("system_dedup_key", dedup)
        .maybeSingle();
      if (existing) {
        // Already created for this cycle — advance pointer if not already.
        const newNext = computeNextDueDate(s.next_due_date, s.frequency);
        await supabase
          .from("service_schedules")
          .update({ next_due_date: newNext, updated_at: new Date().toISOString() })
          .eq("id", s.id)
          .eq("next_due_date", s.next_due_date);
        result.skipped++;
        continue;
      }

      // Verify target still exists.
      const targetTable = s.target_entity_type === "unit" ? "units" : "buildings";
      const { data: target } = await supabase
        .from(targetTable)
        .select("id")
        .eq("id", s.target_entity_id)
        .maybeSingle();
      if (!target) {
        await logScheduleEvent(
          s.id,
          "ticket_generation_failed",
          `Target ${s.target_entity_type} ${s.target_entity_id} not found.`,
        );
        result.errors++;
        continue;
      }

      const created = await insertTicketWithRetry({
        subject: `${s.name} — ${s.next_due_date}`,
        description:
          (s.description ? `${s.description}\n\n` : "") +
          `Scheduled service due ${s.next_due_date}. Generated by recurring schedule "${s.name}".`,
        ticket_type: s.default_ticket_type,
        priority: s.default_priority,
        status: "open",
        target_entity_type: s.target_entity_type,
        target_entity_id: s.target_entity_id,
        due_date: s.next_due_date,
        is_system_generated: true,
        created_by: null,
        system_dedup_key: dedup,
      });

      if (!created) {
        await logScheduleEvent(s.id, "ticket_generation_failed", "Insert failed.");
        result.errors++;
        continue;
      }

      // Patch additional fields not handled by base insert.
      const patch: { generated_by_schedule_id: string; vendor_id?: string } = {
        generated_by_schedule_id: s.id,
      };
      if (s.auto_assign_vendor) patch.vendor_id = s.vendor_id;
      await supabase.from("tickets").update(patch).eq("id", created.id);

      // Optional workflow init.
      if (s.auto_init_workflow) {
        try {
          await initializeTicketWorkflow(created.id, "vendor_dispatch" as WorkflowKey);
        } catch (wfErr) {
          console.warn("[automations] vendor_dispatch init failed", wfErr);
        }
      }

      // Advance pointer + log success. Guard with old next_due_date to avoid clobber.
      const newNext = computeNextDueDate(s.next_due_date, s.frequency);
      await supabase
        .from("service_schedules")
        .update({
          next_due_date: newNext,
          last_triggered_at: new Date().toISOString(),
          last_triggered_ticket_id: created.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", s.id)
        .eq("next_due_date", s.next_due_date);

      await logScheduleEvent(
        s.id,
        "ticket_generated",
        `Generated ticket for ${s.next_due_date}.`,
        created.id,
      );

      result.created++;
    } catch (e) {
      console.warn("[automations] schedule sweep error", e);
      result.errors++;
    }
  }

  return result;
}

/* =========================================================
 * 5. Aging lead sweep (proposal/negotiating stuck >14d)
 * ========================================================= */

const STUCK_LEAD_THRESHOLD_DAYS = 14;

/** Stuck stages that warrant a follow-up nudge ticket. */
const STUCK_LEAD_STAGES = ["proposal", "negotiating"] as const;

function leadStuckPriority(days: number): "urgent" | "high" | "medium" {
  if (days > 30) return "urgent";
  if (days > 21) return "high";
  return "medium";
}

export async function detectStuckLeads(): Promise<AutomationResult> {
  const result: AutomationResult = { created: 0, skipped: 0, errors: 0 };

  // Cutoff = leads whose stage_entered_at is older than threshold.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - STUCK_LEAD_THRESHOLD_DAYS);
  const cutoffIso = cutoff.toISOString();

  const { data: leads, error } = await supabase
    .from("leads")
    .select(
      "id, lead_number, status, stage_entered_at, primary_contact_id, assignee_id, " +
        "primary_contact:primary_contact_id(first_name, last_name, company)",
    )
    .in("status", STUCK_LEAD_STAGES as unknown as string[])
    .lt("stage_entered_at", cutoffIso);

  if (error || !leads) {
    result.errors++;
    return result;
  }
  if (leads.length === 0) return result;

  // Bulk-check existing dedup keys (one open ticket per lead-stage entry).
  const dedupKeys = leads.map(
    (l) => `lead_stuck:${l.id}:${l.stage_entered_at}`,
  );
  const { data: existing } = await supabase
    .from("tickets")
    .select("system_dedup_key, status")
    .in("system_dedup_key", dedupKeys);
  const blocked = new Set(
    (existing ?? [])
      .filter((r) => r.status !== "closed" && r.status !== "cancelled")
      .map((r) => r.system_dedup_key),
  );

  for (const l of leads as any[]) {
    const dedup = `lead_stuck:${l.id}:${l.stage_entered_at}`;
    if (blocked.has(dedup)) {
      result.skipped++;
      continue;
    }
    const days = Math.floor(
      (Date.now() - new Date(l.stage_entered_at).getTime()) / (1000 * 60 * 60 * 24),
    );
    const priority = leadStuckPriority(days);
    const contact = l.primary_contact;
    const contactName = contact
      ? contact.company || `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim()
      : "Unknown contact";
    const stageLabel = l.status === "proposal" ? "Proposal" : "Negotiating";

    const created = await insertTicketWithRetry({
      subject: `Lead stuck in ${stageLabel.toLowerCase()}: ${l.lead_number}`,
      description:
        `Lead ${l.lead_number} (${contactName}) has been in ${stageLabel} for ${days} days.\n\n` +
        `Reach out to advance the conversation, or move the lead to On Hold / Lost ` +
        `if it has gone cold.`,
      ticket_type: "compliance_reminder",
      priority,
      status: "open",
      target_entity_type: "lead",
      target_entity_id: l.id,
      is_system_generated: true,
      created_by: null,
      system_dedup_key: dedup,
    });

    if (!created) {
      result.errors++;
      continue;
    }

    // If the lead has an assignee, route the ticket to them.
    if (l.assignee_id) {
      await supabase
        .from("tickets")
        .update({ assignee_id: l.assignee_id })
        .eq("id", created.id);
    }

    result.created++;
  }

  return result;
}

/* =========================================================
 * 6. Orchestrator — throttled, silent.
 * ========================================================= */

export async function processSystemAutomations(force = false): Promise<void> {
  if (!force) {
    const last = localStorage.getItem(THROTTLE_KEY);
    if (last && Date.now() - Number(last) < THROTTLE_MS) return;
  }
  // Mark immediately so concurrent page loads don't double-fire.
  localStorage.setItem(THROTTLE_KEY, String(Date.now()));
  try {
    await Promise.allSettled([
      supabase.rpc("process_contract_lifecycle"),
      detectExpiringLeases(),
      detectDataGaps(),
      detectVendorComplianceExpiry(),
      processScheduledServices(),
      detectStuckLeads(),
    ]);
  } catch (e) {
    console.warn("[automations] sweep failed", e);
  }
}

/** Expose for manual triggering from devtools / debugging. */
if (typeof window !== "undefined") {
  (window as unknown as { __runAutomations?: () => Promise<void> }).__runAutomations =
    () => processSystemAutomations(true);
}