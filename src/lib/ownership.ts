import { supabase } from "@/integrations/supabase/client";

/**
 * A draft owner row used in the OwnerPicker UI before persistence.
 * `id` is a transient UUID (only present on existing DB rows it equals the row id).
 */
export interface OwnerDraft {
  id?: string;                  // db id if loaded from server, otherwise undefined
  person_id: string;            // people.id
  person_name?: string;         // for display only
  person_company?: string | null;
  ownership_percentage: number; // 0.01 .. 100
  is_primary: boolean;
  acquired_on?: string | null;
  notes?: string | null;
}

export type OwnerEntityType = "building" | "unit";

export interface ResolvedOwner extends OwnerDraft {
  source: "unit" | "building";  // where the row was resolved from
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export const sumPercent = (rows: { ownership_percentage: number }[]) =>
  round2(rows.reduce((acc, r) => acc + (Number(r.ownership_percentage) || 0), 0));

export interface OwnerValidation {
  valid: boolean;
  total: number;
  primaryCount: number;
  reason?: string;
}

export const validateOwners = (rows: OwnerDraft[]): OwnerValidation => {
  if (rows.length === 0) {
    return { valid: false, total: 0, primaryCount: 0, reason: "Add at least one owner." };
  }
  const total = sumPercent(rows);
  const primaryCount = rows.filter((r) => r.is_primary).length;
  if (rows.some((r) => !r.person_id)) {
    return { valid: false, total, primaryCount, reason: "Pick a person for every row." };
  }
  if (rows.some((r) => !(r.ownership_percentage > 0 && r.ownership_percentage <= 100))) {
    return { valid: false, total, primaryCount, reason: "Each percentage must be between 0.01 and 100." };
  }
  if (total !== 100) {
    return { valid: false, total, primaryCount, reason: `Total is ${total}% — must equal 100%.` };
  }
  if (primaryCount !== 1) {
    return { valid: false, total, primaryCount, reason: "Mark exactly one primary owner." };
  }
  return { valid: true, total, primaryCount };
};

export interface FetchOwnersResult {
  rows: OwnerDraft[];
}

/**
 * Fetch the explicit owner rows for a given entity (no inheritance fallback).
 */
export async function fetchOwners(
  entityType: OwnerEntityType,
  entityId: string,
): Promise<OwnerDraft[]> {
  const { data, error } = await supabase
    .from("property_owners")
    .select("id, person_id, ownership_percentage, is_primary, acquired_on, notes, people!inner(first_name, last_name, company)")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("is_primary", { ascending: false })
    .order("ownership_percentage", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    person_id: r.person_id,
    person_name: `${r.people?.first_name ?? ""} ${r.people?.last_name ?? ""}`.trim(),
    person_company: r.people?.company ?? null,
    ownership_percentage: Number(r.ownership_percentage),
    is_primary: r.is_primary,
    acquired_on: r.acquired_on,
    notes: r.notes,
  }));
}

/**
 * Resolve owners for a unit:
 * - if the unit has its own rows, return them with source='unit'
 * - else fall back to the parent building's rows with source='building'
 * - else return empty array (no resolvable ownership)
 */
export async function resolveUnitOwners(unitId: string): Promise<ResolvedOwner[]> {
  const own = await fetchOwners("unit", unitId);
  if (own.length > 0) return own.map((o) => ({ ...o, source: "unit" as const }));
  const { data: u, error: uErr } = await supabase
    .from("units")
    .select("building_id")
    .eq("id", unitId)
    .maybeSingle();
  if (uErr || !u?.building_id) return [];
  const inherited = await fetchOwners("building", u.building_id);
  return inherited.map((o) => ({ ...o, source: "building" as const }));
}

/**
 * Replace all explicit owner rows for an entity with the given draft set.
 * Wrapped logically: deletes existing rows then inserts new ones.
 * The DB has a deferred trigger that validates the percentage sum at the end of the transaction.
 * Note: supabase-js does not expose multi-statement transactions, so we rely on the
 * deferred constraint trigger and best-effort sequencing here. A small race window exists
 * if two writers hit the same entity simultaneously; for our app's expected usage this is acceptable.
 */
export async function replaceOwners(
  entityType: OwnerEntityType,
  entityId: string,
  rows: OwnerDraft[],
): Promise<void> {
  const v = validateOwners(rows);
  if (!v.valid) throw new Error(v.reason ?? "Invalid owner set.");

  const { data: u } = await supabase.auth.getUser();
  const uploaderId = u.user?.id ?? null;

  // Delete existing
  const { error: delErr } = await supabase
    .from("property_owners")
    .delete()
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);
  if (delErr) throw delErr;

  // Insert new
  const payload = rows.map((r) => ({
    entity_type: entityType,
    entity_id: entityId,
    person_id: r.person_id,
    ownership_percentage: round2(r.ownership_percentage),
    is_primary: r.is_primary,
    acquired_on: r.acquired_on ?? null,
    notes: r.notes ?? null,
    created_by: uploaderId,
  }));
  const { error: insErr } = await supabase.from("property_owners").insert(payload);
  if (insErr) throw insErr;
}

/**
 * Wipe all explicit owner rows for an entity, returning to inherited / unowned state.
 */
export async function clearOwners(
  entityType: OwnerEntityType,
  entityId: string,
): Promise<void> {
  const { error } = await supabase
    .from("property_owners")
    .delete()
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);
  if (error) throw error;
}

/**
 * Convenience: count units under a building that currently inherit (have zero unit-level rows).
 * Used to drive the cascade-confirmation dialog when adding/removing building owners.
 */
export async function countInheritingUnits(buildingId: string): Promise<number> {
  const { data: units, error: uErr } = await supabase
    .from("units")
    .select("id")
    .eq("building_id", buildingId);
  if (uErr || !units) return 0;
  if (units.length === 0) return 0;
  const { data: rows, error: oErr } = await supabase
    .from("property_owners")
    .select("entity_id")
    .eq("entity_type", "unit")
    .in("entity_id", units.map((u: any) => u.id));
  if (oErr) return 0;
  const explicit = new Set((rows ?? []).map((r: any) => r.entity_id));
  return units.filter((u: any) => !explicit.has(u.id)).length;
}

/**
 * For a person, list every property they own (across building + unit rows).
 * Returns enriched rows with the property name + ref code for display.
 */
export interface OwnedProperty {
  id: string;                     // property_owners row id
  entity_type: OwnerEntityType;
  entity_id: string;
  ownership_percentage: number;
  is_primary: boolean;
  building?: { id: string; name: string; ref_code: string };
  unit?: { id: string; unit_number: string; ref_code: string; building_id: string };
}

export async function fetchOwnershipsByPerson(personId: string): Promise<OwnedProperty[]> {
  const { data, error } = await supabase
    .from("property_owners")
    .select("id, entity_type, entity_id, ownership_percentage, is_primary")
    .eq("person_id", personId);
  if (error || !data) return [];

  const buildingIds = data.filter((r: any) => r.entity_type === "building").map((r: any) => r.entity_id);
  const unitIds = data.filter((r: any) => r.entity_type === "unit").map((r: any) => r.entity_id);

  const [bRes, uRes] = await Promise.all([
    buildingIds.length
      ? supabase.from("buildings").select("id, name, ref_code").in("id", buildingIds)
      : Promise.resolve({ data: [] as any[] }),
    unitIds.length
      ? supabase.from("units").select("id, unit_number, ref_code, building_id").in("id", unitIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const bMap = new Map<string, any>((bRes.data ?? []).map((b: any) => [b.id, b]));
  const uMap = new Map<string, any>((uRes.data ?? []).map((u: any) => [u.id, u]));

  return data.map((r: any) => ({
    id: r.id,
    entity_type: r.entity_type,
    entity_id: r.entity_id,
    ownership_percentage: Number(r.ownership_percentage),
    is_primary: r.is_primary,
    building: r.entity_type === "building" ? bMap.get(r.entity_id) : undefined,
    unit: r.entity_type === "unit" ? uMap.get(r.entity_id) : undefined,
  }));
}

/**
 * Count all units in the system that currently have no resolvable owner.
 * Reads from the units_without_owners view.
 */
export async function countUnitsWithoutOwners(buildingId?: string): Promise<number> {
  let q = supabase.from("units_without_owners").select("id", { count: "exact", head: true });
  if (buildingId) q = q.eq("building_id", buildingId);
  const { count } = await q;
  return count ?? 0;
}