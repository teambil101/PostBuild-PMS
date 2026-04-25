import { supabase } from "@/integrations/supabase/client";
import { buildLeaseInstallments } from "./financialFormulas";

/**
 * Generate the next document number for a given prefix (INV, BILL, PAY, STMT, QUO).
 * Atomic and per-workspace — concurrent calls cannot collide and counters
 * are not shared across tenants.
 */
export async function nextDocNumber(prefix: string, workspaceId: string): Promise<string> {
  if (!workspaceId) {
    throw new Error("nextDocNumber: workspaceId is required");
  }
  const { data, error } = await supabase.rpc("next_doc_number", {
    _prefix: prefix,
    _workspace_id: workspaceId,
  });
  if (error) throw error;
  return data as string;
}

export const FINANCIAL_DOC_PREFIXES = {
  invoice: "INV",
  bill: "BILL",
  payment: "PAY",
  statement: "STMT",
  quote: "QUO",
} as const;

export type FinancialDocKind = keyof typeof FINANCIAL_DOC_PREFIXES;

export const docPrefix = (kind: FinancialDocKind): string =>
  FINANCIAL_DOC_PREFIXES[kind];

/** Find the GL account id for a system code; null if missing. */
export async function getAccountIdByCode(code: string): Promise<string | null> {
  const { data } = await supabase
    .from("accounts")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  return data?.id ?? null;
}

export interface GenerateLeaseInvoicesArgs {
  leaseContractId: string;
  unitId: string;
  startDate: string;
  rentAmount: number;
  numberOfCheques: number;
  currency: string;
  tenantPersonId: string | null;
}

/**
 * Idempotently generate the rent invoice schedule for an active lease.
 * Skips creation if a `recurring_invoice_schedules` row already exists for this lease.
 * Returns the number of installments created.
 */
export async function generateLeaseInvoiceSchedule(
  args: GenerateLeaseInvoicesArgs,
): Promise<{ created: number; skipped: boolean }> {
  const { data: existing } = await supabase
    .from("recurring_invoice_schedules")
    .select("id")
    .eq("lease_contract_id", args.leaseContractId)
    .limit(1);

  if (existing && existing.length > 0) {
    return { created: 0, skipped: true };
  }

  const installments = buildLeaseInstallments(
    args.startDate,
    args.rentAmount,
    args.numberOfCheques,
  );

  const rentIncomeAccountId = await getAccountIdByCode("4000");

  let created = 0;
  for (const inst of installments) {
    const number = await nextDocNumber(FINANCIAL_DOC_PREFIXES.invoice);
    const { data: inv, error: invErr } = await supabase
      .from("invoices")
      .insert({
        number,
        contract_id: args.leaseContractId,
        lease_contract_id: args.leaseContractId,
        party_person_id: args.tenantPersonId,
        bill_to_role: "tenant",
        issue_date: inst.due_date,
        due_date: inst.due_date,
        currency: args.currency,
        subtotal: inst.amount,
        tax: 0,
        total: inst.amount,
        status: "issued",
        notes: `Rent installment ${inst.installment_number} of ${installments.length}`,
      })
      .select("id")
      .single();
    if (invErr || !inv) continue;

    await supabase.from("invoice_lines").insert({
      invoice_id: inv.id,
      description: `Rent — installment ${inst.installment_number} / ${installments.length}`,
      quantity: 1,
      unit_price: inst.amount,
      amount: inst.amount,
      account_id: rentIncomeAccountId,
      sort_order: 0,
    });

    await supabase.from("recurring_invoice_schedules").insert({
      lease_contract_id: args.leaseContractId,
      installment_number: inst.installment_number,
      total_installments: installments.length,
      due_date: inst.due_date,
      amount: inst.amount,
      invoice_id: inv.id,
      generated_at: new Date().toISOString(),
    });

    created++;
  }

  return { created, skipped: false };
}

/** Status helpers */
export const INVOICE_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  issued: "Issued",
  partial: "Partially paid",
  paid: "Paid",
  void: "Void",
};

export const INVOICE_STATUS_TONE: Record<string, "ok" | "neutral" | "warning" | "danger"> = {
  draft: "neutral",
  issued: "neutral",
  partial: "warning",
  paid: "ok",
  void: "neutral",
};