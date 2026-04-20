/* =========================================================
 * Vendors module — shared types, labels, and helpers.
 * ========================================================= */

import {
  Wind, Droplets, Plug, Refrigerator, Construction, Bug, Sparkles,
  Shield, Trees, Brush, Hammer, Cpu, Key, Truck, MoreHorizontal,
  type LucideIcon,
} from "lucide-react";

export type VendorType = "company" | "individual";
export const VENDOR_TYPES: VendorType[] = ["company", "individual"];
export const VENDOR_TYPE_LABELS: Record<VendorType, string> = {
  company: "Company",
  individual: "Individual",
};

export type VendorStatus = "active" | "inactive" | "blacklisted";
export const VENDOR_STATUSES: VendorStatus[] = ["active", "inactive", "blacklisted"];
export const VENDOR_STATUS_LABELS: Record<VendorStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  blacklisted: "Blacklisted",
};
export const VENDOR_STATUS_STYLES: Record<VendorStatus, string> = {
  active: "bg-status-occupied/10 text-status-occupied border-status-occupied/30",
  inactive: "bg-warm-stone/30 text-muted-foreground border-warm-stone",
  blacklisted: "bg-destructive/10 text-destructive border-destructive/30",
};

export type VendorContactRole =
  | "primary" | "operations" | "accounts" | "emergency" | "technical" | "other";
export const VENDOR_CONTACT_ROLES: VendorContactRole[] = [
  "primary", "operations", "accounts", "emergency", "technical", "other",
];
export const VENDOR_CONTACT_ROLE_LABELS: Record<VendorContactRole, string> = {
  primary: "Primary",
  operations: "Operations",
  accounts: "Accounts",
  emergency: "Emergency",
  technical: "Technical",
  other: "Other",
};

export type Specialty =
  | "ac" | "plumbing" | "electrical" | "appliance" | "structural"
  | "pest_control" | "cleaning" | "security" | "landscaping" | "painting"
  | "carpentry" | "it_smart_home" | "locksmith" | "moving" | "other";

export const SPECIALTIES: Specialty[] = [
  "ac", "plumbing", "electrical", "appliance", "structural",
  "pest_control", "cleaning", "security", "landscaping", "painting",
  "carpentry", "it_smart_home", "locksmith", "moving", "other",
];

export const SPECIALTY_LABELS: Record<Specialty, string> = {
  ac: "AC / HVAC",
  plumbing: "Plumbing",
  electrical: "Electrical",
  appliance: "Appliance",
  structural: "Structural",
  pest_control: "Pest control",
  cleaning: "Cleaning",
  security: "Security",
  landscaping: "Landscaping",
  painting: "Painting",
  carpentry: "Carpentry",
  it_smart_home: "IT / Smart home",
  locksmith: "Locksmith",
  moving: "Moving",
  other: "Other",
};

export const SPECIALTY_ICONS: Record<Specialty, LucideIcon> = {
  ac: Wind,
  plumbing: Droplets,
  electrical: Plug,
  appliance: Refrigerator,
  structural: Construction,
  pest_control: Bug,
  cleaning: Sparkles,
  security: Shield,
  landscaping: Trees,
  painting: Brush,
  carpentry: Hammer,
  it_smart_home: Cpu,
  locksmith: Key,
  moving: Truck,
  other: MoreHorizontal,
};

/** Map a maintenance ticket type (e.g. 'maintenance_ac') to a specialty key. */
export function maintenanceTypeToSpecialty(ticketType: string): Specialty | null {
  if (!ticketType.startsWith("maintenance_")) return null;
  const tail = ticketType.replace("maintenance_", "");
  if ((SPECIALTIES as string[]).includes(tail)) return tail as Specialty;
  return null;
}

export function getSpecialtiesLabels(specialties: unknown): string {
  const list = parseSpecialties(specialties);
  return list.map((s) => SPECIALTY_LABELS[s] ?? s).join(", ");
}

export function parseSpecialties(specialties: unknown): Specialty[] {
  if (!Array.isArray(specialties)) return [];
  return specialties.filter((s): s is Specialty =>
    typeof s === "string" && (SPECIALTIES as string[]).includes(s),
  );
}

/* =========================================================
 * Compliance helpers
 * ========================================================= */

export type ComplianceState = "missing" | "valid" | "expiring" | "expired";

export function complianceState(date: string | null | undefined, days = 60): ComplianceState {
  if (!date) return "missing";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diff = (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return "expired";
  if (diff <= days) return "expiring";
  return "valid";
}

export function isComplianceExpiringSoon(date: string | null | undefined, days = 60): boolean {
  return complianceState(date, days) === "expiring";
}
export function isComplianceExpired(date: string | null | undefined): boolean {
  return complianceState(date) === "expired";
}

export const COMPLIANCE_DOT_STYLES: Record<ComplianceState, string> = {
  valid: "bg-status-occupied",
  expiring: "bg-amber-500",
  expired: "bg-destructive",
  missing: "bg-warm-stone",
};

export const COMPLIANCE_LABELS: Record<ComplianceState, string> = {
  valid: "Valid",
  expiring: "Expiring soon",
  expired: "Expired",
  missing: "Not captured",
};

/* =========================================================
 * Currency
 * ========================================================= */
export const VENDOR_CURRENCIES = ["AED", "USD", "EUR", "GBP", "SAR", "INR"] as const;

/* =========================================================
 * Trade license authority suggestions (UAE-centric)
 * ========================================================= */
export const TRADE_LICENSE_AUTHORITIES = [
  "DED Dubai",
  "DED Abu Dhabi",
  "DMCC",
  "ADGM",
  "Sharjah SEDD",
  "Ajman Free Zone",
  "RAK Economic Zone",
  "Fujairah Creative City",
  "Umm Al Quwain Economic Zone",
  "JAFZA",
  "DIFC",
];

/* =========================================================
 * Vendor row shape (subset used by lists)
 * ========================================================= */
export interface VendorRow {
  id: string;
  vendor_number: string;
  legal_name: string;
  display_name: string | null;
  vendor_type: VendorType;
  status: VendorStatus;
  is_preferred: boolean;
  specialties: unknown;
  primary_phone: string | null;
  primary_email: string | null;
  default_hourly_rate: number | null;
  default_call_out_fee: number | null;
  currency: string;
  trade_license_expiry_date: string | null;
  insurance_expiry_date: string | null;
}

export function vendorDisplayName(v: { display_name: string | null; legal_name: string }) {
  return (v.display_name && v.display_name.trim()) || v.legal_name;
}
