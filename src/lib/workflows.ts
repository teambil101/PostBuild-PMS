/* =========================================================
 * Workflow definitions for tickets.
 *
 * These are the canonical templates. Each ticket can optionally
 * carry a workflow_key + per-stage and per-step progress tracked
 * in ticket_workflow_stages and ticket_workflow_steps.
 *
 * Labels and descriptions are snapshotted into the DB at
 * initialize_ticket_workflow time so changes here don't silently
 * mutate in-flight tickets. To migrate an existing ticket onto
 * an updated definition, use change_ticket_workflow.
 *
 * See TICKETS.md §Workflows for the add-a-workflow checklist.
 * ========================================================= */

import { supabase } from "@/integrations/supabase/client";

export type WorkflowKey =
  | "lease_renewal"
  | "move_in"
  | "move_out"
  | "vendor_dispatch";

export interface WorkflowStep {
  key: string;
  label: string;
  description?: string;
  required?: boolean; // default true
}

export interface WorkflowStage {
  key: string;
  label: string;
  description?: string;
  steps: WorkflowStep[];
}

export interface Workflow {
  key: WorkflowKey;
  label: string;
  description: string;
  stages: WorkflowStage[];
}

/* ---------- lease_renewal ---------- */
const LEASE_RENEWAL: Workflow = {
  key: "lease_renewal",
  label: "Lease Renewal",
  description: "End-to-end workflow for renewing an existing lease.",
  stages: [
    {
      key: "outreach",
      label: "Outreach",
      steps: [
        { key: "outreach_initial", label: "Send initial renewal offer" },
        { key: "outreach_response", label: "Tenant response received" },
        { key: "outreach_followup", label: "Follow up if no response", required: false },
      ],
    },
    {
      key: "negotiation",
      label: "Negotiation",
      steps: [
        { key: "negotiation_market_comps", label: "Gather market comps" },
        { key: "negotiation_proposal", label: "Propose renewal terms" },
        { key: "negotiation_landlord", label: "Landlord approves terms" },
        { key: "negotiation_tenant", label: "Tenant accepts terms" },
      ],
    },
    {
      key: "documentation",
      label: "Documentation",
      steps: [
        { key: "doc_draft", label: "Draft renewal contract or addendum" },
        { key: "doc_sign_landlord", label: "Landlord signs" },
        { key: "doc_sign_tenant", label: "Tenant signs" },
        { key: "doc_cheques", label: "New cheques collected" },
        { key: "doc_deposit", label: "Deposit top-up collected (if any)", required: false },
      ],
    },
    {
      key: "activation",
      label: "Activation",
      steps: [
        { key: "activation_ejari", label: "Ejari updated" },
        { key: "activation_archive", label: "Old contract archived" },
        { key: "activation_confirm", label: "All parties notified" },
      ],
    },
  ],
};

/* ---------- move_in ---------- */
const MOVE_IN: Workflow = {
  key: "move_in",
  label: "Move-in Onboarding",
  description: "Tenant move-in from signed lease to post-handover.",
  stages: [
    {
      key: "prearrival",
      label: "Pre-arrival",
      steps: [
        { key: "prearrival_deposit", label: "Security deposit received" },
        { key: "prearrival_cheques", label: "Rent cheques collected" },
        {
          key: "prearrival_docs",
          label: "Tenant documents collected (ID, visa, trade license if applicable)",
        },
        { key: "prearrival_contract", label: "Signed contract received" },
        { key: "prearrival_ejari", label: "Ejari submitted" },
      ],
    },
    {
      key: "unit_prep",
      label: "Unit preparation",
      steps: [
        { key: "prep_cleaning", label: "Cleaning completed" },
        { key: "prep_pest", label: "Pest control completed", required: false },
        { key: "prep_inspection", label: "Pre-handover inspection done" },
        { key: "prep_keys", label: "Keys and access cards prepared" },
      ],
    },
    {
      key: "handover",
      label: "Handover",
      steps: [
        { key: "handover_walkthrough", label: "Walkthrough with tenant completed" },
        { key: "handover_keys", label: "Keys handed to tenant" },
        { key: "handover_parking", label: "Parking slot assigned", required: false },
        { key: "handover_contacts", label: "Building contacts shared" },
      ],
    },
    {
      key: "post_move_in",
      label: "Post move-in",
      steps: [
        { key: "postmove_dewa", label: "DEWA transfer confirmed" },
        { key: "postmove_checkin", label: "48-hour check-in completed" },
        { key: "postmove_issues", label: "Initial issues addressed", required: false },
      ],
    },
  ],
};

/* ---------- move_out ---------- */
const MOVE_OUT: Workflow = {
  key: "move_out",
  label: "Move-out",
  description: "Tenant exit from notice to unit ready for re-list.",
  stages: [
    {
      key: "notice",
      label: "Notice",
      steps: [
        { key: "notice_received", label: "Move-out notice received" },
        { key: "notice_end_date", label: "Move-out date confirmed with tenant" },
        { key: "notice_landlord", label: "Landlord informed" },
      ],
    },
    {
      key: "preparation",
      label: "Preparation",
      steps: [
        { key: "prep_inspection_schedule", label: "Move-out inspection scheduled" },
        { key: "prep_utilities", label: "Utility transfer plan agreed" },
        { key: "prep_keys_return", label: "Key return plan agreed" },
      ],
    },
    {
      key: "inspection_settlement",
      label: "Inspection & settlement",
      steps: [
        { key: "inspection_complete", label: "Move-out inspection completed" },
        { key: "inspection_damages", label: "Damages documented", required: false },
        { key: "settlement_calc", label: "Deposit return amount calculated" },
        { key: "settlement_payment", label: "Deposit return processed" },
      ],
    },
    {
      key: "turnover",
      label: "Turnover",
      steps: [
        { key: "turnover_keys", label: "Keys returned to PM" },
        { key: "turnover_utilities", label: "Utilities transferred back" },
        { key: "turnover_status", label: "Unit status set to vacant" },
        { key: "turnover_relist", label: "Unit queued for re-listing", required: false },
      ],
    },
  ],
};

/* ---------- vendor_dispatch ---------- */
const VENDOR_DISPATCH: Workflow = {
  key: "vendor_dispatch",
  label: "Vendor Dispatch",
  description: "End-to-end workflow when an external vendor handles the work.",
  stages: [
    {
      key: "quotation",
      label: "Quotation",
      steps: [
        { key: "vendor_quote_requested", label: "Quote requested from vendor" },
        { key: "vendor_quote_received", label: "Quote received" },
        {
          key: "vendor_quote_landlord_approval",
          label: "Landlord approval obtained",
          description: "Auto-completes when cost approval is granted, or auto-skips when below the repair threshold.",
        },
        { key: "vendor_quote_accepted", label: "Quote accepted by PM" },
      ],
    },
    {
      key: "scheduling",
      label: "Scheduling",
      steps: [
        { key: "vendor_schedule_agreed", label: "Work date agreed with vendor" },
        { key: "vendor_tenant_notified", label: "Tenant notified of schedule" },
        { key: "vendor_tenant_confirmed", label: "Tenant confirmed availability" },
        {
          key: "vendor_access_arranged",
          label: "Access arrangements made (keys, building NOC if needed)",
          required: false,
        },
      ],
    },
    {
      key: "execution",
      label: "Execution",
      steps: [
        { key: "vendor_onsite", label: "Vendor arrived on site" },
        { key: "vendor_work_complete", label: "Work completed" },
        { key: "vendor_inspection_passed", label: "PM inspection passed", required: false },
      ],
    },
    {
      key: "settlement",
      label: "Settlement",
      steps: [
        { key: "vendor_invoice_received", label: "Invoice received from vendor" },
        { key: "vendor_invoice_approved", label: "Invoice approved for payment" },
        { key: "vendor_payment_processed", label: "Payment processed" },
        { key: "vendor_warranty_documented", label: "Warranty / guarantee documented", required: false },
      ],
    },
  ],
};

export const WORKFLOWS: Record<WorkflowKey, Workflow> = {
  lease_renewal: LEASE_RENEWAL,
  move_in: MOVE_IN,
  move_out: MOVE_OUT,
  vendor_dispatch: VENDOR_DISPATCH,
};

/* =========================================================
 * Default workflow per ticket_type. Tickets created with
 * these types get the matching workflow auto-suggested
 * (the app may still let users choose).
 * ========================================================= */
export const DEFAULT_WORKFLOW_BY_TYPE: Record<string, WorkflowKey | null> = {
  request_renewal: "lease_renewal",
  handover_task: "move_in",
  moveout_task: "move_out",
};

export function getDefaultWorkflow(ticketType: string): WorkflowKey | null {
  return DEFAULT_WORKFLOW_BY_TYPE[ticketType] ?? null;
}

/* =========================================================
 * Helpers
 * ========================================================= */

/** Flatten a workflow into the jsonb shape expected by initialize_ticket_workflow. */
export function workflowToStagesPayload(w: Workflow) {
  return w.stages.map((s) => ({
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
}

/** Intersection of step keys between two workflows. Used when switching. */
export function preservedStepKeys(from: WorkflowKey, to: WorkflowKey): string[] {
  const fromKeys = new Set(WORKFLOWS[from].stages.flatMap((s) => s.steps.map((st) => st.key)));
  const toKeys = new Set(WORKFLOWS[to].stages.flatMap((s) => s.steps.map((st) => st.key)));
  return Array.from(fromKeys).filter((k) => toKeys.has(k));
}

/* =========================================================
 * RPC wrappers — thin convenience functions.
 * ========================================================= */

export async function initializeTicketWorkflow(ticketId: string, key: WorkflowKey) {
  const { error } = await supabase.rpc("initialize_ticket_workflow", {
    p_ticket_id: ticketId,
    p_workflow_key: key,
    p_stages: workflowToStagesPayload(WORKFLOWS[key]) as never,
  });
  if (error) throw error;
}

export async function completeTicketStep(
  ticketId: string,
  stageKey: string,
  stepKey: string,
  note?: string,
) {
  const { error } = await supabase.rpc("complete_ticket_step", {
    p_ticket_id: ticketId,
    p_stage_key: stageKey,
    p_step_key: stepKey,
    p_note: note ?? null,
  });
  if (error) throw error;
}

export async function uncompleteTicketStep(
  ticketId: string,
  stageKey: string,
  stepKey: string,
) {
  const { error } = await supabase.rpc("uncomplete_ticket_step", {
    p_ticket_id: ticketId,
    p_stage_key: stageKey,
    p_step_key: stepKey,
  });
  if (error) throw error;
}

export async function skipTicketStep(
  ticketId: string,
  stageKey: string,
  stepKey: string,
  reason: string,
) {
  const { error } = await supabase.rpc("skip_ticket_step", {
    p_ticket_id: ticketId,
    p_stage_key: stageKey,
    p_step_key: stepKey,
    p_reason: reason,
  });
  if (error) throw error;
}

export async function skipTicketStage(
  ticketId: string,
  stageKey: string,
  reason: string,
) {
  const { error } = await supabase.rpc("skip_ticket_stage" as never, {
    p_ticket_id: ticketId,
    p_stage_key: stageKey,
    p_reason: reason,
  } as never);
  if (error) throw error;
}

export async function advanceTicketStage(ticketId: string) {
  const { error } = await supabase.rpc("advance_ticket_stage", {
    p_ticket_id: ticketId,
  });
  if (error) throw error;
}

export async function changeTicketWorkflow(
  ticketId: string,
  fromKey: WorkflowKey | null,
  toKey: WorkflowKey,
) {
  const preserved = fromKey ? preservedStepKeys(fromKey, toKey) : [];
  const { error } = await supabase.rpc("change_ticket_workflow", {
    p_ticket_id: ticketId,
    p_new_workflow_key: toKey,
    p_new_stages: workflowToStagesPayload(WORKFLOWS[toKey]) as never,
    p_preserved_step_keys: preserved,
  });
  if (error) throw error;
}

export async function removeTicketWorkflow(ticketId: string) {
  const { error } = await supabase.rpc("remove_ticket_workflow", {
    p_ticket_id: ticketId,
  });
  if (error) throw error;
}

export async function getTicketWorkflowSummary(ticketId: string) {
  const { data, error } = await supabase.rpc("get_ticket_workflow_summary", {
    p_ticket_id: ticketId,
  });
  if (error) throw error;
  return data as null | {
    workflow_key: WorkflowKey;
    current_stage_key: string | null;
    current_stage_label: string | null;
    stages: Array<{
      key: string;
      label: string;
      order_index: number;
      status: "pending" | "in_progress" | "complete" | "skipped";
      started_at: string | null;
      completed_at: string | null;
      total_steps: number;
      completed_steps: number;
      required_pending_count: number;
    }>;
  };
}
