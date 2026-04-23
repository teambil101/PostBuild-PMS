/**
 * Single source of truth for financial calculations.
 * Every total displayed in the app — invoice balance, lease balance,
 * statement net, AR/AP aging — must come from a function in this file.
 * Inline arithmetic in components is forbidden.
 */

export type InvoiceLike = {
  total: number | string | null;
  amount_paid?: number | string | null;
  due_date: string;
  status?: string;
};

export type BillLike = InvoiceLike;

export const toNum = (v: number | string | null | undefined): number => {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const round2 = (n: number): number => Math.round(n * 100) / 100;

export const lineAmount = (qty: number, unitPrice: number): number =>
  round2(qty * unitPrice);

export const sumLines = (lines: { amount: number | string | null }[]): number =>
  round2(lines.reduce((sum, l) => sum + toNum(l.amount), 0));

export const invoiceBalance = (inv: InvoiceLike): number =>
  round2(toNum(inv.total) - toNum(inv.amount_paid));

export const billBalance = (bill: BillLike): number =>
  round2(toNum(bill.total) - toNum(bill.amount_paid));

/**
 * Days past due. Negative = not yet due. Zero or positive = days overdue.
 */
export const daysPastDue = (dueDate: string, today = new Date()): number => {
  const due = new Date(dueDate);
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const d = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  return Math.floor((t.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
};

export type AgingBucket = "current" | "1-30" | "31-60" | "60+";

export const agingBucket = (dueDate: string, today = new Date()): AgingBucket => {
  const dpd = daysPastDue(dueDate, today);
  if (dpd <= 0) return "current";
  if (dpd <= 30) return "1-30";
  if (dpd <= 60) return "31-60";
  return "60+";
};

/**
 * Rule for the BalanceBadge color. Driven by days-past-due of the
 * earliest unpaid item.
 */
export type BadgeTone = "ok" | "neutral" | "warning" | "danger";

export const balanceTone = (dpd: number, hasBalance: boolean): BadgeTone => {
  if (!hasBalance) return "ok";
  if (dpd < 0) return "ok";
  if (dpd <= 7) return "neutral";
  if (dpd <= 30) return "warning";
  return "danger";
};

/**
 * Generate the cheque/installment schedule for a lease.
 * Returns one row per installment with due_date and amount.
 */
export const buildLeaseInstallments = (
  startDate: string,
  rentAmount: number,
  numberOfCheques: number,
): { installment_number: number; due_date: string; amount: number }[] => {
  const cheques = Math.max(1, Math.floor(numberOfCheques || 1));
  const per = round2(rentAmount / cheques);
  const start = new Date(startDate);
  const out: { installment_number: number; due_date: string; amount: number }[] = [];
  let running = 0;
  for (let i = 0; i < cheques; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + Math.floor((12 / cheques) * i), start.getDate());
    const isLast = i === cheques - 1;
    const amt = isLast ? round2(rentAmount - running) : per;
    running += amt;
    out.push({
      installment_number: i + 1,
      due_date: d.toISOString().slice(0, 10),
      amount: amt,
    });
  }
  return out;
};

/**
 * Prorate a monthly amount for a partial period.
 */
export const prorate = (
  monthlyAmount: number,
  daysOccupied: number,
  daysInPeriod: number,
): number => {
  if (daysInPeriod <= 0) return 0;
  return round2((monthlyAmount * daysOccupied) / daysInPeriod);
};

/**
 * Owner statement net = gross rent − PM fee − expenses + adjustments.
 */
export const statementNet = (s: {
  gross_rent: number | string | null;
  pm_fee: number | string | null;
  expenses_total: number | string | null;
  other_adjustments: number | string | null;
}): number =>
  round2(
    toNum(s.gross_rent) - toNum(s.pm_fee) - toNum(s.expenses_total) + toNum(s.other_adjustments),
  );