import { sqftToSqm } from "@/lib/format";

export type BuildingType =
  | "residential_tower"
  | "villa_compound"
  | "mixed_use"
  | "commercial"
  | "other";

export type UnitTypeValue =
  | "apartment"
  | "studio"
  | "penthouse"
  | "duplex"
  | "villa"
  | "townhouse"
  | "office"
  | "retail"
  | "warehouse"
  | "showroom";

export type UnitStatusValue =
  | "vacant"
  | "occupied"
  | "off_market"
  | "under_maintenance"
  | "reserved";

export const UNIT_STATUS_OPTIONS: UnitStatusValue[] = [
  "vacant",
  "occupied",
  "off_market",
  "under_maintenance",
  "reserved",
];

const RESIDENTIAL_TYPES = new Set<UnitTypeValue>([
  "apartment",
  "studio",
  "penthouse",
  "duplex",
  "villa",
  "townhouse",
]);

export const isResidentialType = (t: string | null | undefined): boolean =>
  !!t && RESIDENTIAL_TYPES.has(t as UnitTypeValue);

export const unitTypesForBuilding = (bt: BuildingType | string | null | undefined): UnitTypeValue[] => {
  switch (bt) {
    case "residential_tower":
      return ["apartment", "studio", "penthouse", "duplex"];
    case "villa_compound":
      return ["villa", "townhouse"];
    case "mixed_use":
      return ["apartment", "studio", "penthouse", "duplex", "office", "retail"];
    case "commercial":
      return ["office", "retail", "warehouse", "showroom"];
    case "other":
    default:
      return [
        "apartment", "studio", "penthouse", "duplex",
        "villa", "townhouse",
        "office", "retail", "warehouse", "showroom",
      ];
  }
};

export type SizeUnit = "sqm" | "sqft";

const SIZE_UNIT_KEY = "unit_form_size_unit_pref";

export const loadSizePref = (): SizeUnit => {
  if (typeof window === "undefined") return "sqm";
  const v = window.localStorage.getItem(SIZE_UNIT_KEY);
  return v === "sqft" ? "sqft" : "sqm";
};

export const saveSizePref = (u: SizeUnit) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SIZE_UNIT_KEY, u);
};

/** Convert an entered size+unit to a canonical sqm value rounded to 2 decimals. */
export const toCanonicalSqm = (value: number, unit: SizeUnit): number =>
  unit === "sqm" ? Math.round(value * 100) / 100 : sqftToSqm(value);

/** Stub — leases table doesn't exist yet. */
export const isStatusLockedByLease = (unit: { status_locked_by_lease_id?: string | null } | null | undefined): boolean =>
  !!unit?.status_locked_by_lease_id;
