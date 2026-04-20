import { supabase } from "@/integrations/supabase/client";

/* =========================================================
 * Types
 * ========================================================= */

export type LifecycleStage =
  | "vacant"
  | "not_ready"
  | "in_signing"
  | "active"
  | "ending_soon"
  | "recently_ended";

export const LIFECYCLE_STAGE_LABELS: Record<LifecycleStage, string> = {
  vacant: "Vacant",
  not_ready: "Not ready",
  in_signing: "In signing",
  active: "Active",
  ending_soon: "Ending soon",
  recently_ended: "Recently ended",
};

export const LIFECYCLE_STAGE_SUBLABELS: Record<LifecycleStage, string> = {
  vacant: "Ready to list or place",
  not_ready: "Maintenance, reserved, off-market",
  in_signing: "Draft + pending signature",
  active: "Live tenancies",
  ending_soon: "Within 90 days — renew or turn over",
  recently_ended: "Last 30 days — follow up or re-list",
};

export const LIFECYCLE_STAGE_STYLES: Record<LifecycleStage, string> = {
  vacant: "bg-status-vacant/10 text-status-vacant border-status-vacant/30",
  not_ready: "bg-status-maintenance/10 text-status-maintenance border-status-maintenance/30",
  in_signing: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  active: "bg-status-occupied/10 text-status-occupied border-status-occupied/30",
  ending_soon: "bg-amber-500/15 text-amber-700 border-amber-500/40",
  recently_ended: "bg-warm-stone/40 text-true-taupe border-warm-stone",
};

export const LIFECYCLE_STAGE_ORDER: LifecycleStage[] = [
  "vacant",
  "not_ready",
  "in_signing",
  "active",
  "ending_soon",
  "recently_ended",
];

export interface LifecycleUnit {
  id: string;
  ref_code: string;
  unit_number: string;
  unit_type: string;
  floor: number | null;
  status: string;
  status_locked_by_lease_id: string | null;
  building_id: string;
  building_name: string;
  building_ref: string;
  vacant_since: string | null; // ISO date
  has_mgmt_agreement: boolean;
}

export interface LifecycleLease {
  contract_id: string;
  contract_number: string;
  contract_status: string; // draft|pending_signature|active|expired|terminated|cancelled
  start_date: string | null;
  end_date: string | null;
  terminated_at: string | null;
  terminated_reason: string | null;
  created_at: string;
  updated_at: string;
  annual_rent: number | null;
  currency: string;
  unit_id: string | null;
  tenant_name: string | null;
  tenant_id: string | null;
  // Cheque-derived
  next_pending_cheque?: { amount: number; due_date: string; days_until: number } | null;
  has_overdue_cheque?: boolean;
}

export interface LifecycleCheque {
  id: string;
  lease_id: string;
  contract_id: string;
  contract_number: string;
  sequence_number: number;
  amount: number;
  due_date: string;
  status: string;
  tenant_name: string | null;
  unit_number: string | null;
  building_name: string | null;
  days_overdue: number;
}

export interface LifecycleData {
  units: LifecycleUnit[];
  leases: LifecycleLease[];
  cheques: LifecycleCheque[]; // overdue pending cheques only
  buildings: { id: string; name: string }[];
  // Derived map: unit_id -> stage + payload
  byStage: Record<LifecycleStage, LifecycleCard[]>;
  // Attention lists
  expiringSoon: LifecycleLease[]; // ≤ 90 days
  overdueCheques: LifecycleCheque[];
  dataGaps: LifecycleUnit[]; // occupied without active lease
}

export interface LifecycleCard {
  key: string;
  stage: LifecycleStage;
  unit: LifecycleUnit;
  lease?: LifecycleLease;
}

/* =========================================================
 * Date helpers
 * ========================================================= */

const MS_PER_DAY = 86400000;

export function daysBetween(from: Date | string, to: Date | string): number {
  const a = typeof from === "string" ? new Date(from) : from;
  const b = typeof to === "string" ? new Date(to) : to;
  return Math.ceil((b.getTime() - a.getTime()) / MS_PER_DAY);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysISO(days: number): string {
  return new Date(Date.now() + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/* =========================================================
 * Fetching
 * ========================================================= */

export async function fetchLifecycleData(): Promise<LifecycleData> {
  const today = todayISO();
  const ninetyOut = addDaysISO(90);
  const thirtyAgo = addDaysISO(-30);
  const sixtyAgo = addDaysISO(-60);
  const oneEightyOut = addDaysISO(180);

  // Parallel root queries
  const [
    buildingsRes,
    unitsRes,
    contractsRes,
    chequesRes,
  ] = await Promise.all([
    supabase.from("buildings").select("id, name, ref_code").order("name"),
    supabase
      .from("units")
      .select("id, ref_code, unit_number, unit_type, floor, status, status_locked_by_lease_id, building_id, created_at"),
    supabase
      .from("contracts")
      .select("id, contract_number, contract_type, status, start_date, end_date, terminated_at, terminated_reason, currency, created_at, updated_at")
      .eq("contract_type", "lease"),
    supabase
      .from("lease_cheques")
      .select("id, lease_id, sequence_number, amount, due_date, status")
      .gte("due_date", sixtyAgo)
      .lte("due_date", oneEightyOut),
  ]);

  const buildings = (buildingsRes.data ?? []) as Array<{ id: string; name: string; ref_code: string }>;
  const buildingMap = new Map(buildings.map((b) => [b.id, b]));

  const rawUnits = (unitsRes.data ?? []) as any[];
  const allContracts = (contractsRes.data ?? []) as any[];
  const allCheques = (chequesRes.data ?? []) as any[];

  // Filter to relevant lease contracts (active, drafts, pending_signature, OR ended within 30 days)
  const relevantContracts = allContracts.filter((c) => {
    if (c.status === "active" || c.status === "draft" || c.status === "pending_signature") return true;
    if (c.status === "expired" && c.end_date && c.end_date >= thirtyAgo) return true;
    if ((c.status === "terminated" || c.status === "cancelled") && c.terminated_at && c.terminated_at.slice(0, 10) >= thirtyAgo) return true;
    return false;
  });

  const contractIds = relevantContracts.map((c) => c.id);

  // Fetch parties + subjects + leases in parallel
  const [partiesRes, subjectsRes, leasesRes, mgmtRes] = await Promise.all([
    contractIds.length
      ? supabase
          .from("contract_parties")
          .select("contract_id, person_id, role, people(id, first_name, last_name, company)")
          .in("contract_id", contractIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    contractIds.length
      ? supabase
          .from("contract_subjects")
          .select("contract_id, entity_type, entity_id")
          .in("contract_id", contractIds)
          .eq("entity_type", "unit")
      : Promise.resolve({ data: [] as any[], error: null }),
    contractIds.length
      ? supabase.from("leases").select("id, contract_id, annual_rent").in("contract_id", contractIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    // Active management agreements via active mgmt contracts touching units
    supabase
      .from("contracts")
      .select("id, status, contract_type, contract_subjects(entity_type, entity_id)")
      .eq("contract_type", "management_agreement")
      .eq("status", "active"),
  ]);

  const parties = (partiesRes.data ?? []) as any[];
  const subjects = (subjectsRes.data ?? []) as any[];
  const leases = (leasesRes.data ?? []) as any[];
  const mgmts = (mgmtRes.data ?? []) as any[];

  // Build mgmt-coverage set: unit ids covered by active MA
  const mgmtCoveredUnits = new Set<string>();
  mgmts.forEach((m) => {
    (m.contract_subjects ?? []).forEach((s: any) => {
      if (s.entity_type === "unit") mgmtCoveredUnits.add(s.entity_id);
    });
  });

  // Map subjects by contract → unit
  const contractToUnit = new Map<string, string>();
  subjects.forEach((s) => {
    if (!contractToUnit.has(s.contract_id)) contractToUnit.set(s.contract_id, s.entity_id);
  });

  // Map contract → tenant
  const contractToTenant = new Map<string, { id: string; name: string }>();
  parties.forEach((p) => {
    if (p.role !== "tenant") return;
    if (contractToTenant.has(p.contract_id)) return;
    const person = p.people;
    if (!person) return;
    const name =
      person.company ||
      `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() ||
      "—";
    contractToTenant.set(p.contract_id, { id: person.id, name });
  });

  // Lease child by contract id
  const leaseByContract = new Map<string, any>();
  leases.forEach((l) => leaseByContract.set(l.contract_id, l));
  const leaseIdToContract = new Map<string, { id: string; number: string }>();
  leases.forEach((l) => {
    const c = relevantContracts.find((x) => x.id === l.contract_id);
    if (c) leaseIdToContract.set(l.id, { id: c.id, number: c.contract_number });
  });

  // Build LifecycleLease[] and attach next-cheque data
  const chequesByLease = new Map<string, any[]>();
  allCheques.forEach((ch) => {
    if (!chequesByLease.has(ch.lease_id)) chequesByLease.set(ch.lease_id, []);
    chequesByLease.get(ch.lease_id)!.push(ch);
  });

  const lifecycleLeases: LifecycleLease[] = relevantContracts.map((c) => {
    const lease = leaseByContract.get(c.id);
    const tenant = contractToTenant.get(c.id) ?? null;
    const unitId = contractToUnit.get(c.id) ?? null;
    const myCheques = (lease ? chequesByLease.get(lease.id) ?? [] : []).slice();
    myCheques.sort((a, b) => a.due_date.localeCompare(b.due_date));
    const pending = myCheques.filter((q) => q.status === "pending");
    const nextPending = pending[0];
    const hasOverdue = pending.some((q) => q.due_date < today);

    return {
      contract_id: c.id,
      contract_number: c.contract_number,
      contract_status: c.status,
      start_date: c.start_date,
      end_date: c.end_date,
      terminated_at: c.terminated_at,
      terminated_reason: c.terminated_reason,
      created_at: c.created_at,
      updated_at: c.updated_at,
      annual_rent: lease?.annual_rent ?? null,
      currency: c.currency ?? "AED",
      unit_id: unitId,
      tenant_id: tenant?.id ?? null,
      tenant_name: tenant?.name ?? null,
      next_pending_cheque: nextPending
        ? {
            amount: nextPending.amount,
            due_date: nextPending.due_date,
            days_until: daysBetween(new Date(), nextPending.due_date),
          }
        : null,
      has_overdue_cheque: hasOverdue,
    };
  });

  // Status history → vacant_since for vacant units (best-effort, single query)
  const vacantUnitIds = rawUnits.filter((u) => u.status === "vacant").map((u) => u.id);
  const vacantSinceMap = new Map<string, string>();
  if (vacantUnitIds.length > 0) {
    const { data: histRows } = await supabase
      .from("unit_status_history")
      .select("unit_id, new_status, changed_at")
      .in("unit_id", vacantUnitIds)
      .eq("new_status", "vacant")
      .order("changed_at", { ascending: false });
    (histRows ?? []).forEach((h: any) => {
      if (!vacantSinceMap.has(h.unit_id)) vacantSinceMap.set(h.unit_id, h.changed_at);
    });
  }

  // Build LifecycleUnit[]
  const lifecycleUnits: LifecycleUnit[] = rawUnits.map((u) => {
    const b = buildingMap.get(u.building_id);
    return {
      id: u.id,
      ref_code: u.ref_code,
      unit_number: u.unit_number,
      unit_type: u.unit_type,
      floor: u.floor,
      status: u.status,
      status_locked_by_lease_id: u.status_locked_by_lease_id,
      building_id: u.building_id,
      building_name: b?.name ?? "—",
      building_ref: b?.ref_code ?? "",
      vacant_since: vacantSinceMap.get(u.id) ?? u.created_at,
      has_mgmt_agreement: mgmtCoveredUnits.has(u.id),
    };
  });

  /* ==========================
   * State resolution per unit
   * ========================== */
  const byStage: Record<LifecycleStage, LifecycleCard[]> = {
    vacant: [],
    not_ready: [],
    in_signing: [],
    active: [],
    ending_soon: [],
    recently_ended: [],
  };

  const ninetyOutTs = new Date(ninetyOut).getTime();

  // Group leases by unit for quick lookup
  const leasesByUnit = new Map<string, LifecycleLease[]>();
  lifecycleLeases.forEach((l) => {
    if (!l.unit_id) return;
    if (!leasesByUnit.has(l.unit_id)) leasesByUnit.set(l.unit_id, []);
    leasesByUnit.get(l.unit_id)!.push(l);
  });

  lifecycleUnits.forEach((u) => {
    const myLeases = leasesByUnit.get(u.id) ?? [];

    // 1. Active lease wins
    const activeLease = myLeases.find((l) => l.contract_status === "active");
    if (activeLease) {
      const endTs = activeLease.end_date ? new Date(activeLease.end_date).getTime() : Infinity;
      const stage: LifecycleStage = endTs <= ninetyOutTs ? "ending_soon" : "active";
      byStage[stage].push({ key: activeLease.contract_id, stage, unit: u, lease: activeLease });
      return;
    }
    // 2. Draft / pending_signature
    const signing = myLeases
      .filter((l) => l.contract_status === "draft" || l.contract_status === "pending_signature")
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
    if (signing) {
      byStage.in_signing.push({ key: signing.contract_id, stage: "in_signing", unit: u, lease: signing });
      return;
    }
    // 3. Recently ended (within 30 days)
    const ended = myLeases
      .filter((l) => l.contract_status === "expired" || l.contract_status === "terminated" || l.contract_status === "cancelled")
      .sort((a, b) => {
        const aT = a.terminated_at ?? a.end_date ?? "";
        const bT = b.terminated_at ?? b.end_date ?? "";
        return bT.localeCompare(aT);
      })[0];
    if (ended) {
      byStage.recently_ended.push({ key: ended.contract_id, stage: "recently_ended", unit: u, lease: ended });
      return;
    }
    // 4. Not ready
    if (u.status === "under_maintenance" || u.status === "reserved" || u.status === "off_market") {
      byStage.not_ready.push({ key: u.id, stage: "not_ready", unit: u });
      return;
    }
    // 5. Vacant fallback
    byStage.vacant.push({ key: u.id, stage: "vacant", unit: u });
  });

  /* ==========================
   * Attention lists
   * ========================== */
  const expiringSoon = lifecycleLeases
    .filter(
      (l) =>
        l.contract_status === "active" &&
        l.end_date &&
        new Date(l.end_date).getTime() <= ninetyOutTs,
    )
    .sort((a, b) => (a.end_date ?? "").localeCompare(b.end_date ?? ""));

  // Overdue cheques: pending, due_date < today, lease's contract is active
  const activeLeaseIds = new Set(
    lifecycleLeases
      .filter((l) => l.contract_status === "active")
      .map((l) => {
        const lease = leases.find((ll) => ll.contract_id === l.contract_id);
        return lease?.id;
      })
      .filter(Boolean),
  );
  const unitByContract = contractToUnit;
  const tenantByContract = contractToTenant;

  const overdueCheques: LifecycleCheque[] = allCheques
    .filter((ch) => ch.status === "pending" && ch.due_date < today && activeLeaseIds.has(ch.lease_id))
    .map((ch) => {
      const ctr = leaseIdToContract.get(ch.lease_id);
      const contractId = ctr?.id ?? "";
      const unitId = unitByContract.get(contractId);
      const unit = unitId ? lifecycleUnits.find((u) => u.id === unitId) : undefined;
      const tenant = tenantByContract.get(contractId);
      return {
        id: ch.id,
        lease_id: ch.lease_id,
        contract_id: contractId,
        contract_number: ctr?.number ?? "",
        sequence_number: ch.sequence_number,
        amount: ch.amount,
        due_date: ch.due_date,
        status: ch.status,
        tenant_name: tenant?.name ?? null,
        unit_number: unit?.unit_number ?? null,
        building_name: unit?.building_name ?? null,
        days_overdue: Math.max(0, daysBetween(ch.due_date, new Date())),
      };
    })
    .sort((a, b) => b.days_overdue - a.days_overdue);

  const dataGaps = lifecycleUnits
    .filter((u) => u.status === "occupied" && !u.status_locked_by_lease_id)
    .sort((a, b) => (b.vacant_since ?? "").localeCompare(a.vacant_since ?? ""));

  return {
    units: lifecycleUnits,
    leases: lifecycleLeases,
    cheques: overdueCheques,
    buildings: buildings.map((b) => ({ id: b.id, name: b.name })),
    byStage,
    expiringSoon,
    overdueCheques,
    dataGaps,
  };
}
