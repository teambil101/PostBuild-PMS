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
