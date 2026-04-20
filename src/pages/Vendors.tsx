import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Plus, Search, Star, AlertTriangle, Truck, X, ShieldAlert, ShieldCheck, ShieldX,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { NewVendorDialog } from "@/components/vendors/NewVendorDialog";
import {
  SPECIALTIES,
  SPECIALTY_LABELS,
  SPECIALTY_ICONS,
  VENDOR_STATUSES,
  VENDOR_STATUS_LABELS,
  VENDOR_STATUS_STYLES,
  VENDOR_TYPES,
  VENDOR_TYPE_LABELS,
  COMPLIANCE_DOT_STYLES,
  COMPLIANCE_LABELS,
  complianceState,
  parseSpecialties,
  vendorDisplayName,
  type VendorRow,
  type VendorStatus,
  type VendorType,
  type Specialty,
} from "@/lib/vendors";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

export default function VendorsPage() {
  const { canEdit } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [primaryContacts, setPrimaryContacts] =
    useState<Record<string, { person_id: string; first_name: string; last_name: string }>>({});

  const search = searchParams.get("q") ?? "";
  const statusParam = searchParams.get("status") ?? "active";
  const typeParam = (searchParams.get("type") ?? "all") as VendorType | "all";
  const preferredOnly = searchParams.get("preferred") === "1";
  const complianceParam = searchParams.get("compliance") ?? "all";
  const specialtyParam = searchParams.get("specialty");
  const specialtyFilters: Specialty[] = useMemo(
    () => (specialtyParam ? (specialtyParam.split(",").filter(Boolean) as Specialty[]) : []),
    [specialtyParam],
  );

  const update = (k: string, v: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (v == null || v === "") next.delete(k);
    else next.set(k, v);
    setSearchParams(next, { replace: true });
  };

  const load = async () => {
    setLoading(true);
    const { data: vs } = await supabase
      .from("vendors")
      .select(
        "id, vendor_number, legal_name, display_name, vendor_type, status, is_preferred, specialties, primary_phone, primary_email, default_hourly_rate, default_call_out_fee, currency, trade_license_expiry_date, insurance_expiry_date",
      )
      .order("is_preferred", { ascending: false })
      .order("legal_name", { ascending: true });
    const list = (vs ?? []) as VendorRow[];
    setVendors(list);

    if (list.length > 0) {
      const { data: contacts } = await supabase
        .from("vendor_contacts")
        .select("vendor_id, person_id, is_primary, people:person_id (first_name, last_name)")
        .eq("is_primary", true)
        .in("vendor_id", list.map((v) => v.id));
      const map: Record<string, { person_id: string; first_name: string; last_name: string }> = {};
      for (const c of contacts ?? []) {
        const ppl = (c as any).people;
        if (ppl) {
          map[(c as any).vendor_id] = {
            person_id: (c as any).person_id,
            first_name: ppl.first_name,
            last_name: ppl.last_name,
          };
        }
      }
      setPrimaryContacts(map);
    } else {
      setPrimaryContacts({});
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const kpis = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let total = 0, preferred = 0, expiring = 0, expired = 0;
    for (const v of vendors) {
      if (v.status === "active") total++;
      if (v.is_preferred && v.status === "active") preferred++;
      const tl = complianceState(v.trade_license_expiry_date);
      const ins = complianceState(v.insurance_expiry_date);
      if (tl === "expiring" || ins === "expiring") expiring++;
      if (tl === "expired" || ins === "expired") expired++;
    }
    return { total, preferred, expiring, expired };
  }, [vendors]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vendors.filter((v) => {
      if (statusParam !== "all" && v.status !== statusParam) return false;
      if (typeParam !== "all" && v.vendor_type !== typeParam) return false;
      if (preferredOnly && !v.is_preferred) return false;
      if (specialtyFilters.length > 0) {
        const vs = parseSpecialties(v.specialties);
        if (!specialtyFilters.some((s) => vs.includes(s))) return false;
      }
      if (complianceParam === "expiring") {
        const a = complianceState(v.trade_license_expiry_date);
        const b = complianceState(v.insurance_expiry_date);
        if (a !== "expiring" && b !== "expiring") return false;
      }
      if (complianceParam === "expired") {
        const a = complianceState(v.trade_license_expiry_date);
        const b = complianceState(v.insurance_expiry_date);
        if (a !== "expired" && b !== "expired") return false;
      }
      if (q) {
        const blob = [
          v.vendor_number, v.legal_name, v.display_name ?? "",
          v.primary_phone ?? "", v.primary_email ?? "",
        ].join(" ").toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [vendors, search, statusParam, typeParam, preferredOnly, complianceParam, specialtyFilters]);

  const toggleSpecialty = (s: Specialty) => {
    const next = new Set(specialtyFilters);
    if (next.has(s)) next.delete(s); else next.add(s);
    update("specialty", Array.from(next).join(","));
  };

  const clearAll = () => setSearchParams({}, { replace: true });

  return (
    <>
      <PageHeader
        eyebrow="Module · 06"
        title="Vendors"
        description="Specialists and contractors who keep the portfolio running — with compliance, rates, and contact tracking."
        actions={
          canEdit && (
            <Button variant="gold" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              New vendor
            </Button>
          )
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Kpi label="Active vendors" value={kpis.total} sub="In directory" icon={<Truck className="h-4 w-4" />} />
        <Kpi label="Preferred" value={kpis.preferred} sub="Trusted partners" icon={<Star className="h-4 w-4" />} tone={kpis.preferred > 0 ? "gold" : undefined} />
        <Kpi label="Compliance expiring" value={kpis.expiring} sub="Within 60 days" icon={<ShieldAlert className="h-4 w-4" />} tone={kpis.expiring > 0 ? "amber" : undefined} />
        <Kpi label="Compliance expired" value={kpis.expired} sub="License or insurance" icon={<ShieldX className="h-4 w-4" />} tone={kpis.expired > 0 ? "red" : undefined} />
      </div>

      {/* Filter bar */}
      <div className="border hairline rounded-sm bg-card p-4 mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search name, number, license, phone, email…"
              value={search}
              onChange={(e) => update("q", e.target.value || null)}
              className="h-9 pl-9"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-architect cursor-pointer">
            <input
              type="checkbox"
              checked={preferredOnly}
              onChange={(e) => update("preferred", e.target.checked ? "1" : null)}
            />
            Preferred only
          </label>
          <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs">
            <X className="h-3 w-3 mr-1" />
            Clear all
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="label-eyebrow mr-1">Status</span>
          {(["active", ...VENDOR_STATUSES.filter((s) => s !== "active"), "all"] as (VendorStatus | "all")[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => update("status", s === "active" ? null : s)}
              className={cn(
                "px-2 py-0.5 rounded-sm border text-[10px] uppercase tracking-wider",
                statusParam === s
                  ? "bg-architect text-chalk border-architect"
                  : "bg-card text-muted-foreground border-warm-stone hover:bg-muted/40",
              )}
            >
              {s === "all" ? "All" : VENDOR_STATUS_LABELS[s as VendorStatus]}
            </button>
          ))}
          <span className="label-eyebrow mx-1 ml-3">Type</span>
          {(["all", ...VENDOR_TYPES] as (VendorType | "all")[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => update("type", t === "all" ? null : t)}
              className={cn(
                "px-2 py-0.5 rounded-sm border text-[10px] uppercase tracking-wider",
                typeParam === t
                  ? "bg-architect text-chalk border-architect"
                  : "bg-card text-muted-foreground border-warm-stone hover:bg-muted/40",
              )}
            >
              {t === "all" ? "All" : VENDOR_TYPE_LABELS[t as VendorType]}
            </button>
          ))}
          <span className="label-eyebrow mx-1 ml-3">Compliance</span>
          {[
            { v: "all", l: "All" },
            { v: "expiring", l: "Expiring" },
            { v: "expired", l: "Expired" },
          ].map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => update("compliance", opt.v === "all" ? null : opt.v)}
              className={cn(
                "px-2 py-0.5 rounded-sm border text-[10px] uppercase tracking-wider",
                complianceParam === opt.v
                  ? "bg-architect text-chalk border-architect"
                  : "bg-card text-muted-foreground border-warm-stone hover:bg-muted/40",
              )}
            >
              {opt.l}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="label-eyebrow mr-1">Specialty</span>
          {SPECIALTIES.map((s) => {
            const Icon = SPECIALTY_ICONS[s];
            const active = specialtyFilters.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleSpecialty(s)}
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded-sm border text-[10px] uppercase tracking-wider",
                  active
                    ? "bg-architect text-chalk border-architect"
                    : "bg-card text-muted-foreground border-warm-stone hover:bg-muted/40",
                )}
              >
                <Icon className="h-3 w-3" strokeWidth={1.5} />
                {SPECIALTY_LABELS[s]}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="h-64 bg-muted/40 animate-pulse rounded-sm" />
      ) : vendors.length === 0 ? (
        <EmptyState
          icon={<Truck className="h-8 w-8" strokeWidth={1.2} />}
          title="No vendors yet"
          description="Add your first vendor to start tracking specialists and contractors."
          action={
            canEdit && (
              <Button variant="gold" onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                New vendor
              </Button>
            )
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle className="h-8 w-8" strokeWidth={1.2} />}
          title="No vendors match these filters"
          action={<Button variant="outline" onClick={clearAll}>Clear filters</Button>}
        />
      ) : (
        <div className="border hairline rounded-sm overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b hairline text-left">
                <tr>
                  <th className="px-4 py-3 label-eyebrow">VND #</th>
                  <th className="px-4 py-3 label-eyebrow">Name</th>
                  <th className="px-4 py-3 label-eyebrow">Type</th>
                  <th className="px-4 py-3 label-eyebrow">Specialties</th>
                  <th className="px-4 py-3 label-eyebrow">Primary contact</th>
                  <th className="px-4 py-3 label-eyebrow">Status</th>
                  <th className="px-4 py-3 label-eyebrow">Rate</th>
                  <th className="px-4 py-3 label-eyebrow">Compliance</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <VendorRowItem
                    key={v.id}
                    vendor={v}
                    primaryContact={primaryContacts[v.id]}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <NewVendorDialog
        open={open}
        onOpenChange={setOpen}
        onSaved={() => { setOpen(false); load(); }}
      />
    </>
  );
}

function VendorRowItem({
  vendor: v,
  primaryContact,
}: {
  vendor: VendorRow;
  primaryContact?: { person_id: string; first_name: string; last_name: string };
}) {
  const specs = parseSpecialties(v.specialties);
  const visible = specs.slice(0, 3);
  const overflow = Math.max(0, specs.length - visible.length);
  const tlState = complianceState(v.trade_license_expiry_date);
  const insState = complianceState(v.insurance_expiry_date);
  const blacklisted = v.status === "blacklisted";

  return (
    <tr
      className={cn(
        "border-b hairline last:border-0 hover:bg-muted/30",
        blacklisted && "bg-destructive/[0.04]",
      )}
    >
      <td className="px-4 py-3 mono text-xs text-muted-foreground whitespace-nowrap">
        <Link to={`/vendors/${v.id}`} className="hover:text-architect">{v.vendor_number}</Link>
      </td>
      <td className="px-4 py-3 max-w-[260px]">
        <Link to={`/vendors/${v.id}`} className="block text-architect truncate hover:underline">
          <span className="inline-flex items-center gap-1.5">
            {v.is_preferred && <Star className="h-3.5 w-3.5 fill-gold text-gold" />}
            {vendorDisplayName(v)}
          </span>
        </Link>
        {v.display_name && v.display_name !== v.legal_name && (
          <div className="text-[11px] text-muted-foreground truncate">{v.legal_name}</div>
        )}
      </td>
      <td className="px-4 py-3 text-xs whitespace-nowrap">
        <span className="px-1.5 py-0.5 border hairline rounded-sm text-[10px] uppercase tracking-wider text-true-taupe">
          {VENDOR_TYPE_LABELS[v.vendor_type]}
        </span>
      </td>
      <td className="px-4 py-3 max-w-[220px]">
        <div className="flex flex-wrap items-center gap-1">
          {visible.map((s) => {
            const Icon = SPECIALTY_ICONS[s];
            return (
              <span
                key={s}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-muted/40 text-[10px] text-architect"
              >
                <Icon className="h-3 w-3" strokeWidth={1.5} />
                {SPECIALTY_LABELS[s]}
              </span>
            );
          })}
          {overflow > 0 && (
            <span className="text-[10px] text-muted-foreground">+{overflow}</span>
          )}
          {visible.length === 0 && <span className="text-[11px] text-muted-foreground italic">—</span>}
        </div>
      </td>
      <td className="px-4 py-3 text-xs">
        {primaryContact ? (
          <Link to={`/people/${primaryContact.person_id}`} className="text-architect hover:underline">
            {primaryContact.first_name} {primaryContact.last_name}
          </Link>
        ) : (
          <span className="text-muted-foreground italic">No contact</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs">
        <span className={cn("px-1.5 py-0.5 border rounded-sm text-[10px] uppercase tracking-wider", VENDOR_STATUS_STYLES[v.status])}>
          {VENDOR_STATUS_LABELS[v.status]}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {v.default_hourly_rate != null ? (
          <span className="text-architect">{v.currency} {Number(v.default_hourly_rate).toLocaleString()}/hr</span>
        ) : v.default_call_out_fee != null ? (
          <span className="text-architect">{v.currency} {Number(v.default_call_out_fee).toLocaleString()} call-out</span>
        ) : (
          <span className="italic">Quote-based</span>
        )}
      </td>
      <td className="px-4 py-3">
        <TooltipProvider delayDuration={120}>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger>
                <span className={cn("inline-block h-2 w-2 rounded-full", COMPLIANCE_DOT_STYLES[tlState])} />
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">
                  License: {COMPLIANCE_LABELS[tlState]}
                  {v.trade_license_expiry_date && <div className="text-muted-foreground">{v.trade_license_expiry_date}</div>}
                </div>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger>
                <span className={cn("inline-block h-2 w-2 rounded-full", COMPLIANCE_DOT_STYLES[insState])} />
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">
                  Insurance: {COMPLIANCE_LABELS[insState]}
                  {v.insurance_expiry_date && <div className="text-muted-foreground">{v.insurance_expiry_date}</div>}
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </td>
    </tr>
  );
}

function Kpi({
  label, value, sub, icon, tone,
}: {
  label: string; value: number; sub: string; icon: React.ReactNode;
  tone?: "amber" | "red" | "gold";
}) {
  const toneClass =
    tone === "red"   ? "text-destructive" :
    tone === "amber" ? "text-amber-700" :
    tone === "gold"  ? "text-gold" : "text-architect";
  return (
    <div className="border hairline rounded-sm bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="label-eyebrow">{label}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <div className={cn("font-display text-3xl mt-2", toneClass)}>{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}
