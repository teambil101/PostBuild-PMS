import { supabase } from "@/integrations/supabase/client";
import type { ContractStatus } from "@/lib/contracts";

/* ============================================================
 * Constants & types
 * ============================================================ */

export const PAYMENT_FREQUENCIES = [
  "1_cheque",
  "2_cheques",
  "4_cheques",
  "6_cheques",
  "12_cheques",
  "custom",
] as const;
export type PaymentFrequency = typeof PAYMENT_FREQUENCIES[number];

export const PAYMENT_FREQUENCY_LABELS: Record<PaymentFrequency, string> = {
  "1_cheque": "1 cheque (annual)",
  "2_cheques": "2 cheques (semi-annual)",
  "4_cheques": "4 cheques (quarterly)",
  "6_cheques": "6 cheques (bi-monthly)",
  "12_cheques": "12 cheques (monthly)",
  custom: "Custom",
};

/** How many cheques a fixed frequency produces. `custom` returns null. */
export function chequeCountForFrequency(f: PaymentFrequency): number | null {
  switch (f) {
    case "1_cheque": return 1;
    case "2_cheques": return 2;
    case "4_cheques": return 4;
    case "6_cheques": return 6;
    case "12_cheques": return 12;
    case "custom": return null;
  }
}

export const SECURITY_DEPOSIT_STATUSES = ["pending", "received", "refunded", "forfeited"] as const;
export type SecurityDepositStatus = typeof SECURITY_DEPOSIT_STATUSES[number];

export const SECURITY_DEPOSIT_STATUS_LABELS: Record<SecurityDepositStatus, string> = {
  pending: "Pending",
  received: "Received",
  refunded: "Refunded",
  forfeited: "Forfeited",
};

export const SECURITY_DEPOSIT_STATUS_STYLES: Record<SecurityDepositStatus, string> = {
  pending: "bg-warm-stone/40 text-true-taupe border-warm-stone",
  received: "bg-status-occupied/10 text-status-occupied border-status-occupied/30",
  refunded: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  forfeited: "bg-destructive/10 text-destructive border-destructive/30",
};

export const COMMISSION_PAYERS = ["tenant", "landlord", "split"] as const;
export type CommissionPayer = typeof COMMISSION_PAYERS[number];

export const COMMISSION_PAYER_LABELS: Record<CommissionPayer, string> = {
  tenant: "Tenant",
  landlord: "Landlord",
  split: "Split",
};

export const COMMISSION_STATUSES = ["pending", "paid"] as const;
export type CommissionStatus = typeof COMMISSION_STATUSES[number];

export const COMMISSION_STATUS_LABELS: Record<CommissionStatus, string> = {
  pending: "Pending",
  paid: "Paid",
};

export const COMMISSION_STATUS_STYLES: Record<CommissionStatus, string> = {
  pending: "bg-warm-stone/40 text-true-taupe border-warm-stone",
  paid: "bg-status-occupied/10 text-status-occupied border-status-occupied/30",
};

/* ============================================================
 * Cheque status & lifecycle
 * ============================================================ */

export const CHEQUE_STATUSES = [
  "pending",
  "deposited",
  "cleared",
  "bounced",
  "returned",
  "replaced",
] as const;
export type ChequeStatus = typeof CHEQUE_STATUSES[number];

export const CHEQUE_STATUS_LABELS: Record<ChequeStatus, string> = {
  pending: "Pending",
  deposited: "Deposited",
  cleared: "Cleared",
  bounced: "Bounced",
  returned: "Returned",
  replaced: "Replaced",
};

export const CHEQUE_STATUS_STYLES: Record<ChequeStatus, string> = {
  pending: "bg-warm-stone/40 text-true-taupe border-warm-stone",
  deposited: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  cleared: "bg-status-occupied/10 text-status-occupied border-status-occupied/30",
  bounced: "bg-destructive/10 text-destructive border-destructive/30",
  returned: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  replaced: "bg-warm-stone/30 text-muted-foreground border-warm-stone line-through",
};

export const BOUNCE_REASONS = [
  "nsf",
  "stopped_payment",
  "signature_mismatch",
  "account_closed",
  "other",
] as const;
export type BounceReason = typeof BOUNCE_REASONS[number];

export const BOUNCE_REASON_LABELS: Record<BounceReason, string> = {
  nsf: "Insufficient funds (NSF)",
  stopped_payment: "Stopped payment",
  signature_mismatch: "Signature mismatch",
  account_closed: "Account closed",
  other: "Other",
};

/* ============================================================
 * Cheque schedule generation
 * ============================================================ */

export interface CalculatedCheque {
  sequence_number: number;
  amount: number;
  due_date: string; // YYYY-MM-DD
}

/**
 * Generate an even-split cheque schedule for a fixed frequency.
 * Returns [] for `custom` frequency (caller must build manually).
 *
 * Spacing: cheques are evenly distributed across the lease period.
 * For frequency=N, spacing = floor(months_between(start, end) / N).
 * Falls back to month-spacing if dates are missing.
 */
export function generateChequeSchedule(opts: {
  frequency: PaymentFrequency;
  annualRent: number;
  firstChequeDate: string; // YYYY-MM-DD
  startDate?: string | null;
  endDate?: string | null;
  startSequence?: number; // default 1 — used during regeneration
}): CalculatedCheque[] {
  const count = chequeCountForFrequency(opts.frequency);
  if (count === null) return [];
  const startSeq = opts.startSequence ?? 1;

  const baseAmount = Math.round((opts.annualRent / count) * 100) / 100;
  // Distribute rounding remainder onto the last cheque so the sum is exact.
  const lastAmount = Math.round((opts.annualRent - baseAmount * (count - 1)) * 100) / 100;

  // Spacing: total period in months, divided by count. If period missing, default 12 months.
  let intervalMonths = 12 / count;
  if (opts.startDate && opts.endDate) {
    const sd = new Date(opts.startDate);
    const ed = new Date(opts.endDate);
    const months = (ed.getFullYear() - sd.getFullYear()) * 12 + (ed.getMonth() - sd.getMonth());
    if (months > 0) intervalMonths = months / count;
  }

  const out: CalculatedCheque[] = [];
  const first = new Date(opts.firstChequeDate);
  for (let i = 0; i < count; i++) {
    const due = new Date(first);
    // Use month addition that preserves day-of-month where possible.
    const monthsToAdd = i * intervalMonths;
    const wholeMonths = Math.floor(monthsToAdd);
    const dayShift = Math.round((monthsToAdd - wholeMonths) * 30);
    due.setMonth(due.getMonth() + wholeMonths);
    if (dayShift) due.setDate(due.getDate() + dayShift);
    out.push({
      sequence_number: startSeq + i,
      amount: i === count - 1 ? lastAmount : baseAmount,
      due_date: due.toISOString().slice(0, 10),
    });
  }
  return out;
}

/**
 * Validate a cheque schedule against the lease.
 * Returns { ok, sumDelta, errors[] } — sumDelta is positive if cheques exceed annualRent.
 */
export function validateChequeSchedule(opts: {
  cheques: { amount: number; due_date: string }[];
  annualRent: number;
  startDate?: string | null;
  endDate?: string | null;
}): { ok: boolean; sumDelta: number; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (opts.cheques.length === 0) {
    errors.push("At least one cheque is required.");
    return { ok: false, sumDelta: -opts.annualRent, errors, warnings };
  }

  const sum = opts.cheques.reduce((s, c) => s + (c.amount || 0), 0);
  const delta = sum - opts.annualRent;
  const pctOff = Math.abs(delta) / opts.annualRent;

  if (pctOff > 0.10) {
    errors.push(
      `Cheque total (${sum.toLocaleString()}) is more than 10% off the annual rent (${opts.annualRent.toLocaleString()}). Adjust amounts before continuing.`,
    );
  } else if (pctOff > 0.001) {
    warnings.push(
      `Cheque total is off by ${delta > 0 ? "+" : ""}${delta.toFixed(2)} from annual rent.`,
    );
  }

  if (opts.startDate && opts.endDate) {
    const sd = new Date(opts.startDate).getTime() - 30 * 86400000;
    const ed = new Date(opts.endDate).getTime() + 30 * 86400000;
    opts.cheques.forEach((c, i) => {
      if (!c.due_date) {
        errors.push(`Cheque #${i + 1}: due date is required.`);
        return;
      }
      const t = new Date(c.due_date).getTime();
      if (t < sd || t > ed) {
        errors.push(`Cheque #${i + 1}: due date is outside the lease period (±30 days).`);
      }
    });
  }

  opts.cheques.forEach((c, i) => {
    if (!c.amount || c.amount <= 0) errors.push(`Cheque #${i + 1}: amount must be greater than zero.`);
  });

  return { ok: errors.length === 0, sumDelta: delta, errors, warnings };
}

/* ============================================================
 * Overlap check (frontend mirror of DB trigger)
 * ============================================================ */

/**
 * Returns conflicting active lease info if the proposed dates overlap an existing
 * active lease on the same unit. Pass excludeContractId to ignore the contract being edited.
 */
export async function findOverlappingActiveLease(opts: {
  unitId: string;
  startDate: string;
  endDate: string;
  excludeContractId?: string | null;
}): Promise<{ contract_number: string; start_date: string; end_date: string } | null> {
  const { data: subjects } = await supabase
    .from("contract_subjects")
    .select("contract_id")
    .eq("entity_type", "unit")
    .eq("entity_id", opts.unitId);
  const ids = (subjects ?? []).map((s) => s.contract_id);
  if (ids.length === 0) return null;

  let q = supabase
    .from("contracts")
    .select("id, contract_number, start_date, end_date, status, contract_type")
    .in("id", ids)
    .eq("contract_type", "lease")
    .eq("status", "active");
  if (opts.excludeContractId) q = q.neq("id", opts.excludeContractId);
  const { data: rows } = await q;
  if (!rows || rows.length === 0) return null;

  const sStart = new Date(opts.startDate).getTime();
  const sEnd = new Date(opts.endDate).getTime();
  for (const r of rows) {
    if (!r.start_date || !r.end_date) continue;
    const rStart = new Date(r.start_date).getTime();
    const rEnd = new Date(r.end_date).getTime();
    if (rStart <= sEnd && sStart <= rEnd) {
      return { contract_number: r.contract_number, start_date: r.start_date, end_date: r.end_date };
    }
  }
  return null;
}

/* ============================================================
 * Mgmt agreement precondition (RPC wrapper)
 * ============================================================ */

export async function hasActiveMgmtAgreementForUnit(unitId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_active_mgmt_agreement_for_unit" as never, { p_unit_id: unitId } as never);
  if (error) {
    // Fail open — the precondition is a soft block, not a security gate.
    console.warn("[hasActiveMgmtAgreementForUnit] rpc error", error);
    return true;
  }
  return Boolean(data);
}

/* ============================================================
 * Display helpers
 * ============================================================ */

export function monthlyEquivalent(annualRent: number): number {
  return Math.round((annualRent / 12) * 100) / 100;
}

export function formatRentDisplay(annualRent: number, currency = "AED"): string {
  const m = monthlyEquivalent(annualRent);
  return `${currency} ${annualRent.toLocaleString()}/year · ${currency} ${m.toLocaleString()}/mo`;
}

export function chequeDueCountdown(due: string): { label: string; tone: "neutral" | "amber" | "red" } {
  const days = Math.ceil((new Date(due).getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: `Overdue by ${Math.abs(days)}d`, tone: "red" };
  if (days === 0) return { label: "Due today", tone: "amber" };
  if (days <= 7) return { label: `Due in ${days}d`, tone: "amber" };
  return { label: `Due in ${days}d`, tone: "neutral" };
}

/* ============================================================
 * Duplicate-lease helper
 * ============================================================
 *
 * The base contract duplicate (lib/contracts.ts) already clones contract+
 * parties+subjects+(MA child if present) and resets to draft. For leases
 * we additionally insert a fresh `leases` row carrying selected fields.
 *
 * Strategy (per Pass B prompt):
 *   COPY: annual_rent, payment_frequency, first_cheque_date,
 *         security_deposit_amount, commission_amount, commission_payer
 *   RESET: security_deposit_status='pending', security_deposit_notes=null,
 *          commission_status='pending', ejari_number=null
 *   NO CHEQUES inserted at duplicate time.
 *
 * Caller responsibility: after duplicateLeaseExtras runs against the new
 * contract id, the wizard auto-opens in edit mode and (on user setting
 * start/end + advancing to step 2) auto-generates cheques.
 */
export async function duplicateLeaseExtras(opts: {
  sourceContractId: string;
  newContractId: string;
}): Promise<void> {
  const { data: src, error: sErr } = await supabase
    .from("leases" as never)
    .select("*")
    .eq("contract_id" as never, opts.sourceContractId as never)
    .maybeSingle();
  if (sErr) throw new Error(`Could not read source lease: ${sErr.message}`);
  if (!src) return;

  const s = src as any;
  const { error: iErr } = await supabase.from("leases" as never).insert({
    contract_id: opts.newContractId,
    annual_rent: s.annual_rent,
    payment_frequency: s.payment_frequency,
    first_cheque_date: s.first_cheque_date, // may be stale; user adjusts in wizard
    security_deposit_amount: s.security_deposit_amount,
    security_deposit_status: s.security_deposit_amount ? "pending" : null,
    security_deposit_notes: null,
    commission_amount: s.commission_amount,
    commission_payer: s.commission_payer,
    commission_status: s.commission_amount ? "pending" : null,
    ejari_number: null,
  } as never);
  if (iErr) throw new Error(`Could not duplicate lease child: ${iErr.message}`);
}
