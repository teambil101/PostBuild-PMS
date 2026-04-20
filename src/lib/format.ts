export const formatCurrency = (n: number | null | undefined, currency = "USD") => {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
};

export const formatNumber = (n: number | null | undefined) => {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-US").format(n);
};

export const initials = (first?: string | null, last?: string | null) =>
  `${(first?.[0] ?? "").toUpperCase()}${(last?.[0] ?? "").toUpperCase()}` || "??";

/**
 * Convert a snake_case enum value into a human-readable Title Case label.
 * Examples: "off_market" -> "Off Market", "under_maintenance" -> "Under Maintenance".
 */
export const formatEnumLabel = (value?: string | null): string => {
  if (!value) return "";
  return value
    .split("_")
    .map((w) => (w.length === 0 ? w : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
};

export const SQM_PER_SQFT = 1 / 10.7639;
export const SQFT_PER_SQM = 10.7639;

export const sqftToSqm = (sqft: number) => Math.round((sqft * SQM_PER_SQFT) * 100) / 100;
export const sqmToSqft = (sqm: number) => Math.round((sqm * SQFT_PER_SQM) * 100) / 100;
