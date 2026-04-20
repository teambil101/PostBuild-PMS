import { supabase } from "@/integrations/supabase/client";

/* =========================================================
 * Ticket types — must match the CHECK constraint in the DB.
 * ========================================================= */
export const TICKET_TYPES = [
  "maintenance_ac",
  "maintenance_plumbing",
  "maintenance_electrical",
  "maintenance_appliance",
  "maintenance_structural",
  "maintenance_pest_control",
  "maintenance_other",
  "admin_ejari",
  "admin_dewa",
  "admin_noc",
  "admin_other",
  "request_renewal",
  "request_early_termination",
  "request_sublease",
  "request_modification",
  "request_other",
  "compliance_reminder",
  "rent_follow_up",
  "handover_task",
  "moveout_task",
  "data_gap",
  "complaint",
  "other",
] as const;
export type TicketType = typeof TICKET_TYPES[number];

/** Display labels formatted as "Category: Specific". */
export const TICKET_TYPE_LABELS: Record<TicketType, string> = {
  maintenance_ac: "Maintenance: AC",
  maintenance_plumbing: "Maintenance: Plumbing",
  maintenance_electrical: "Maintenance: Electrical",
  maintenance_appliance: "Maintenance: Appliance",
  maintenance_structural: "Maintenance: Structural",
  maintenance_pest_control: "Maintenance: Pest control",
  maintenance_other: "Maintenance: Other",
  admin_ejari: "Administrative: Ejari",
  admin_dewa: "Administrative: DEWA",
  admin_noc: "Administrative: NOC",
  admin_other: "Administrative: Other",
  request_renewal: "Tenant Request: Renewal",
  request_early_termination: "Tenant Request: Early termination",
  request_sublease: "Tenant Request: Sublease",
  request_modification: "Tenant Request: Modification",
  request_other: "Tenant Request: Other",
  compliance_reminder: "Compliance: Reminder",
  rent_follow_up: "Rent: Follow-up",
  handover_task: "Onboarding: Handover task",
  moveout_task: "Off-boarding: Move-out task",
  data_gap: "Data Gap",
  complaint: "Complaint",
  other: "Other",
};

export type TicketCategory =
  | "Maintenance"
  | "Administrative"
  | "Tenant Request"
  | "Compliance"
  | "Rent"
  | "Onboarding"
  | "Off-boarding"
  | "Data Gap"
  | "Complaint"
  | "Other";

export function TICKET_TYPE_CATEGORY(type: TicketType | string): TicketCategory {
  if (type.startsWith("maintenance_")) return "Maintenance";
  if (type.startsWith("admin_")) return "Administrative";
  if (type.startsWith("request_")) return "Tenant Request";
  if (type === "compliance_reminder") return "Compliance";
  if (type === "rent_follow_up") return "Rent";
  if (type === "handover_task") return "Onboarding";
  if (type === "moveout_task") return "Off-boarding";
  if (type === "data_gap") return "Data Gap";
  if (type === "complaint") return "Complaint";
  return "Other";
}

/** Grouped picker structure for the New Ticket modal. */
export const TICKET_TYPE_GROUPS: { category: TicketCategory; types: TicketType[] }[] = [
  {
    category: "Maintenance",
    types: [
      "maintenance_ac",
      "maintenance_plumbing",
      "maintenance_electrical",
      "maintenance_appliance",
      "maintenance_structural",
      "maintenance_pest_control",
      "maintenance_other",
    ],
  },
  {
    category: "Administrative",
    types: ["admin_ejari", "admin_dewa", "admin_noc", "admin_other"],
  },
  {
    category: "Tenant Request",
    types: [
      "request_renewal",
      "request_early_termination",
      "request_sublease",
      "request_modification",
      "request_other",
    ],
  },
  { category: "Compliance", types: ["compliance_reminder"] },
  { category: "Rent", types: ["rent_follow_up"] },
  { category: "Onboarding", types: ["handover_task"] },
  { category: "Off-boarding", types: ["moveout_task"] },
  { category: "Data Gap", types: ["data_gap"] },
  { category: "Complaint", types: ["complaint"] },
  { category: "Other", types: ["other"] },
];

/* =========================================================
 * Status
 * ========================================================= */
export const TICKET_STATUSES = [
  "open",
  "in_progress",
  "awaiting",
  "resolved",
  "closed",
  "cancelled",
] as const;
export type TicketStatus = typeof TICKET_STATUSES[number];

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  awaiting: "Awaiting",
  resolved: "Resolved",
  closed: "Closed",
  cancelled: "Cancelled",
};

export const TICKET_STATUS_STYLES: Record<TicketStatus, string> = {
  open: "bg-warm-stone/40 text-true-taupe border-warm-stone",
  in_progress: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  awaiting: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  resolved: "bg-status-occupied/10 text-status-occupied border-status-occupied/30",
  closed: "bg-warm-stone/30 text-muted-foreground border-warm-stone",
  cancelled: "bg-destructive/10 text-destructive/80 border-destructive/20",
};

/** Statuses considered "active work". */
export const ACTIVE_TICKET_STATUSES: TicketStatus[] = ["open", "in_progress", "awaiting"];

/* =========================================================
 * Priority
 * ========================================================= */
export const TICKET_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TicketPriority = typeof TICKET_PRIORITIES[number];

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const TICKET_PRIORITY_STYLES: Record<TicketPriority, string> = {
  low: "bg-warm-stone/30 text-muted-foreground border-warm-stone",
  medium: "bg-warm-stone/40 text-true-taupe border-warm-stone",
  high: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  urgent: "bg-destructive/10 text-destructive border-destructive/30",
};

export const TICKET_PRIORITY_RANK: Record<TicketPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/* =========================================================
 * Waiting on
 * ========================================================= */
export const WAITING_ON = ["tenant", "landlord", "vendor", "internal", "external"] as const;
export type WaitingOn = typeof WAITING_ON[number];

export const WAITING_ON_LABELS: Record<WaitingOn, string> = {
  tenant: "Tenant",
  landlord: "Landlord",
  vendor: "Vendor",
  internal: "Internal",
  external: "External",
};

/* =========================================================
 * Cost approval
 * ========================================================= */
export const COST_APPROVAL_STATUSES = [
  "not_required",
  "pending",
  "approved",
  "rejected",
] as const;
export type CostApprovalStatus = typeof COST_APPROVAL_STATUSES[number];

export const COST_APPROVAL_STATUS_LABELS: Record<CostApprovalStatus, string> = {
  not_required: "Not required",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export const COST_APPROVAL_STATUS_STYLES: Record<CostApprovalStatus, string> = {
  not_required: "bg-warm-stone/30 text-muted-foreground border-warm-stone",
  pending: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  approved: "bg-status-occupied/10 text-status-occupied border-status-occupied/30",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
};

/* =========================================================
 * Target
 * ========================================================= */
export const TICKET_TARGET_TYPES = [
  "unit",
  "building",
  "contract",
  "person",
  "cheque",
  "vendor",
  "lead",
] as const;
export type TicketTargetType = typeof TICKET_TARGET_TYPES[number];

export const TICKET_TARGET_TYPE_LABELS: Record<TicketTargetType, string> = {
  unit: "Unit",
  building: "Building",
  contract: "Contract",
  person: "Person",
  cheque: "Cheque",
  vendor: "Vendor",
  lead: "Lead",
};

/* =========================================================
 * Canonical (type → valid targets) mapping
 *
 * Each ticket_type defines the entity types it can sensibly target.
 * UI enforces this; DB stays permissive for migration safety and
 * historical rows. See TICKETS.md "Target discipline".
 * ========================================================= */
export const VALID_TARGETS_BY_TICKET_TYPE: Record<TicketType, TicketTargetType[]> = {
  maintenance_ac:            ["unit", "building"],
  maintenance_plumbing:      ["unit", "building"],
  maintenance_electrical:    ["unit", "building"],
  maintenance_appliance:     ["unit"],
  maintenance_structural:    ["unit", "building"],
  maintenance_pest_control:  ["unit", "building"],
  maintenance_other:         ["unit", "building"],
  admin_ejari:               ["contract", "unit"],
  admin_dewa:                ["unit", "contract"],
  admin_noc:                 ["building", "unit", "contract"],
  admin_other:               ["unit", "building", "contract", "person", "cheque", "vendor", "lead"],
  request_renewal:           ["contract"],
  request_early_termination: ["contract"],
  request_sublease:          ["contract"],
  request_modification:      ["unit", "contract"],
  request_other:             ["unit", "building", "contract", "person", "cheque", "vendor", "lead"],
  compliance_reminder:       ["vendor", "contract", "building", "lead"],
  rent_follow_up:            ["cheque", "contract"],
  handover_task:             ["unit", "contract"],
  moveout_task:              ["unit", "contract"],
  data_gap:                  ["unit", "building", "contract", "person", "cheque", "vendor", "lead"],
  complaint:                 ["unit", "person", "building"],
  other:                     ["unit", "building", "contract", "person", "cheque", "vendor", "lead"],
};

export function getValidTargetsForType(ticketType: TicketType | string): TicketTargetType[] {
  return VALID_TARGETS_BY_TICKET_TYPE[ticketType as TicketType] ?? [...TICKET_TARGET_TYPES];
}

export function isValidTargetForType(
  ticketType: TicketType | string,
  targetType: TicketTargetType | string,
): boolean {
  return getValidTargetsForType(ticketType).includes(targetType as TicketTargetType);
}

export function getValidTicketTypesForTarget(targetType: TicketTargetType): TicketType[] {
  return TICKET_TYPES.filter((t) =>
    VALID_TARGETS_BY_TICKET_TYPE[t].includes(targetType),
  );
}

/**
 * Resolve a canonical replacement target when a preset target's type doesn't
 * match the picked ticket_type's valid set. Walks: contract → first unit
 * subject; cheque → lease → contract → first unit subject. Returns the
 * resolved entity along with a label, or null if nothing is found.
 */
export async function resolveCanonicalTarget(
  fromType: TicketTargetType,
  fromId: string,
  desiredTypes: TicketTargetType[],
): Promise<{ type: TicketTargetType; id: string; label: string } | null> {
  // Direct match — caller should not have called us, but bail safely.
  if (desiredTypes.includes(fromType)) return null;

  // From a cheque, climb to lease/contract first.
  let contractId: string | null = null;
  let chequeContractId: string | null = null;
  if (fromType === "cheque") {
    const { data: ch } = await supabase
      .from("lease_cheques")
      .select("lease_id, leases:leases(contract_id)")
      .eq("id", fromId)
      .maybeSingle();
    chequeContractId = (ch as any)?.leases?.contract_id ?? null;
    if (desiredTypes.includes("contract") && chequeContractId) {
      const label = await resolveTicketTargetLabel({ type: "contract", id: chequeContractId });
      return { type: "contract", id: chequeContractId, label };
    }
    contractId = chequeContractId;
  }

  if (fromType === "contract") contractId = fromId;

  // From a contract, try to find a unit (or building) subject.
  if (contractId && (desiredTypes.includes("unit") || desiredTypes.includes("building"))) {
    const preferUnit = desiredTypes.includes("unit");
    const wantedTypes = preferUnit
      ? ["unit", "building"]
      : ["building", "unit"];
    const { data: subjects } = await supabase
      .from("contract_subjects")
      .select("entity_type, entity_id, created_at")
      .eq("contract_id", contractId)
      .in("entity_type", wantedTypes)
      .order("created_at", { ascending: true });
    const match = (subjects ?? []).find((s: any) =>
      desiredTypes.includes(s.entity_type as TicketTargetType),
    );
    if (match) {
      const label = await resolveTicketTargetLabel({
        type: match.entity_type as TicketTargetType,
        id: match.entity_id as string,
      });
      return { type: match.entity_type as TicketTargetType, id: match.entity_id as string, label };
    }
  }

  // From a building, try a unit inside it.
  if (fromType === "building" && desiredTypes.includes("unit")) {
    const { data: u } = await supabase
      .from("units")
      .select("id")
      .eq("building_id", fromId)
      .order("unit_number", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (u?.id) {
      const label = await resolveTicketTargetLabel({ type: "unit", id: u.id });
      return { type: "unit", id: u.id, label };
    }
  }

  // From a unit, climb to its building.
  if (fromType === "unit" && desiredTypes.includes("building")) {
    const { data: u } = await supabase
      .from("units")
      .select("building_id")
      .eq("id", fromId)
      .maybeSingle();
    if (u?.building_id) {
      const label = await resolveTicketTargetLabel({ type: "building", id: u.building_id });
      return { type: "building", id: u.building_id, label };
    }
  }

  return null;
}

/* =========================================================
 * Helpers
 * ========================================================= */

export interface TicketLike {
  due_date: string | null;
  status: string;
}

/** True if due_date is past AND ticket status is still active. */
export function isTicketOverdue(t: TicketLike): boolean {
  if (!t.due_date) return false;
  if (!ACTIVE_TICKET_STATUSES.includes(t.status as TicketStatus)) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(t.due_date);
  due.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}

/** Number of days a ticket is overdue (0 if not overdue). */
export function ticketOverdueDays(t: TicketLike): number {
  if (!isTicketOverdue(t)) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(t.due_date as string);
  due.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

function shortId(id: string) {
  return id.slice(0, 8);
}

/**
 * Resolve human-readable label for a target via the SQL helper RPC.
 * Falls back to "{Type} · {short_id}" on error.
 */
export async function resolveTicketTargetLabel(target: {
  type: string;
  id: string;
}): Promise<string> {
  try {
    const { data, error } = await supabase.rpc("resolve_ticket_target_label", {
      p_entity_type: target.type,
      p_entity_id: target.id,
    });
    if (error || !data) {
      return `${TICKET_TARGET_TYPE_LABELS[target.type as TicketTargetType] ?? target.type} · ${shortId(target.id)}`;
    }
    return data as string;
  } catch {
    return `${TICKET_TARGET_TYPE_LABELS[target.type as TicketTargetType] ?? target.type} · ${shortId(target.id)}`;
  }
}

/**
 * Resolve target labels in batch. Returns a map keyed by `${type}:${id}`.
 * Cached at the call-site if needed.
 */
export async function resolveTicketTargetLabels(
  targets: { type: string; id: string }[],
): Promise<Record<string, string>> {
  const unique = new Map<string, { type: string; id: string }>();
  for (const t of targets) {
    unique.set(`${t.type}:${t.id}`, t);
  }
  const entries = await Promise.all(
    Array.from(unique.values()).map(async (t) => {
      const label = await resolveTicketTargetLabel(t);
      return [`${t.type}:${t.id}`, label] as const;
    }),
  );
  return Object.fromEntries(entries);
}

/** Build a click-through path for a ticket target. Returns null if no route exists. */
export function targetPath(target: { type: string; id: string }, opts?: { unitBuildingId?: string | null }): string | null {
  switch (target.type) {
    case "unit":
      if (opts?.unitBuildingId) return `/properties/${opts.unitBuildingId}/units/${target.id}`;
      return `/properties`;
    case "building":
      return `/properties/${target.id}`;
    case "contract":
      return `/contracts/${target.id}`;
    case "person":
      return `/people/${target.id}`;
    case "vendor":
      return `/vendors/${target.id}`;
    case "cheque":
      return null; // no dedicated page; surfaced inside lease detail
    default:
      return null;
  }
}

/** Generate the next TKT-YYYY-NNNN number via the shared sequence RPC. */
export async function nextTicketNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const { data, error } = await supabase.rpc("next_number", {
    p_prefix: "TKT",
    p_year: year,
  });
  if (error || !data) throw new Error(error?.message ?? "Could not generate ticket number.");
  return data as string;
}