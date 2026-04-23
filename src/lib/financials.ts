import { supabase } from "@/integrations/supabase/client";

/** Generate the next number for a given prefix (INV, BILL, PAY, STMT, QUO). */
export async function nextDocNumber(prefix: string): Promise<string> {
  const year = new Date().getFullYear();
  const { data: existing } = await supabase
    .from("number_sequences")
    .select("last_seq")
    .eq("prefix", prefix)
    .eq("year", year)
    .maybeSingle();

  const next = (existing?.last_seq ?? 0) + 1;

  if (existing) {
    await supabase
      .from("number_sequences")
      .update({ last_seq: next })
      .eq("prefix", prefix)
      .eq("year", year);
  } else {
    await supabase
      .from("number_sequences")
      .insert({ prefix, year, last_seq: next });
  }

  return `${prefix}-${year}-${String(next).padStart(4, "0")}`;
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