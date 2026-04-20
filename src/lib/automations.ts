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

/** Insert a ticket with retry on ticket_number unique-violation (sequence drift). */
async function insertTicketWithRetry(
  base: Record<string, unknown>,
): Promise<{ id: string } | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const ticket_number = await nextTicketNumber();
    const { data, error } = await supabase
      .from("tickets")
      .insert({ ...base, ticket_number })
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
 * 3. Orchestrator — throttled, silent.
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