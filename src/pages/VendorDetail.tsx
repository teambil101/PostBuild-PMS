import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Star, Pencil, ShieldAlert, ShieldCheck, ShieldX,
  Trash2, Plus, ExternalLink, Globe, Phone, Mail, MapPin, History, Loader2,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { NewVendorDialog } from "@/components/vendors/NewVendorDialog";
import { DocumentList } from "@/components/attachments/DocumentList";
import { NotesPanel } from "@/components/notes/NotesPanel";
import { EntityTicketsTab, type TicketSection, type EntityTicketRow } from "@/components/tickets/EntityTicketsTab";
import { NewTicketDialog } from "@/components/tickets/NewTicketDialog";
import { PersonCombobox, type PickedPerson } from "@/components/owners/PersonCombobox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import {
  SPECIALTIES,
  SPECIALTY_LABELS,
  SPECIALTY_ICONS,
  VENDOR_STATUS_LABELS,
  VENDOR_STATUS_STYLES,
  VENDOR_TYPE_LABELS,
  COMPLIANCE_DOT_STYLES,
  COMPLIANCE_LABELS,
  VENDOR_CONTACT_ROLE_LABELS,
  complianceState,
  parseSpecialties,
  vendorDisplayName,
  type VendorContactRole,
  type VendorStatus,
  type VendorType,
} from "@/lib/vendors";

interface Vendor {
  id: string;
  vendor_number: string;
  legal_name: string;
  display_name: string | null;
  vendor_type: VendorType;
  status: VendorStatus;
  is_preferred: boolean;
  blacklist_reason: string | null;
  trade_license_number: string | null;
  trade_license_authority: string | null;
  trade_license_expiry_date: string | null;
  trn: string | null;
  insurance_provider: string | null;
  insurance_policy_number: string | null;
  insurance_expiry_date: string | null;
  insurance_coverage_notes: string | null;
  primary_phone: string | null;
  primary_email: string | null;
  website: string | null;
  address: string | null;
  specialties: unknown;
  specialties_other: string | null;
  default_hourly_rate: number | null;
  default_call_out_fee: number | null;
  currency: string;
  rate_notes: string | null;
  service_area_notes: string | null;
  onboarded_at: string | null;
  onboarded_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ContactRow {
  id: string;
  vendor_id: string;
  person_id: string;
  role: VendorContactRole;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
  people?: { first_name: string; last_name: string; phone: string | null; email: string | null } | null;
}

interface EventRow {
  id: string;
  vendor_id: string;
  event_type: string;
  from_value: string | null;
  to_value: string | null;
  description: string | null;
  actor_id: string | null;
  created_at: string;
}

export default function VendorDetail() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const navigate = useNavigate();
  const { canEdit, hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [docsCount, setDocsCount] = useState(0);
  const [notesCount, setNotesCount] = useState(0);
  const [ticketsCount, setTicketsCount] = useState(0);
  const [newTicketForVendorOpen, setNewTicketForVendorOpen] = useState(false);
  const [newTicketAboutVendorOpen, setNewTicketAboutVendorOpen] = useState(false);

  // Dialogs
  const [editOpen, setEditOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactSeed, setContactSeed] = useState<ContactRow | null>(null);
  const [blacklistOpen, setBlacklistOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  const load = async () => {
    if (!vendorId) return;
    setLoading(true);
    const [v, c, e] = await Promise.all([
      supabase.from("vendors").select("*").eq("id", vendorId).maybeSingle(),
      supabase
        .from("vendor_contacts")
        .select("*, people:person_id (first_name, last_name, phone, email)")
        .eq("vendor_id", vendorId)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true }),
      supabase
        .from("vendor_events")
        .select("*")
        .eq("vendor_id", vendorId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    setVendor((v.data ?? null) as Vendor | null);
    setContacts((c.data ?? []) as ContactRow[]);
    setEvents((e.data ?? []) as EventRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [vendorId]);

  const specs = useMemo(() => parseSpecialties(vendor?.specialties), [vendor]);
  const tlState = complianceState(vendor?.trade_license_expiry_date);
  const insState = complianceState(vendor?.insurance_expiry_date);
  const primaryContact = contacts.find((c) => c.is_primary) ?? contacts[0] ?? null;

  if (loading) return <div className="h-64 bg-muted/40 animate-pulse rounded-sm" />;
  if (!vendor) {
    return (
      <EmptyState
        title="Vendor not found"
        description="It may have been deleted or the link is incorrect."
        action={<Button onClick={() => navigate("/vendors")}>Back to vendors</Button>}
      />
    );
  }

  const togglePreferred = async () => {
    setStatusBusy(true);
    const { error } = await supabase
      .from("vendors")
      .update({ is_preferred: !vendor.is_preferred })
      .eq("id", vendor.id);
    setStatusBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(vendor.is_preferred ? "Removed from preferred." : "Marked as preferred.");
    load();
  };

  const setStatusActive = async () => {
    setStatusBusy(true);
    const { error } = await supabase
      .from("vendors")
      .update({ status: "active", blacklist_reason: null })
      .eq("id", vendor.id);
    setStatusBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Vendor reactivated.");
    load();
  };

  const setStatusInactive = async () => {
    setStatusBusy(true);
    const { error } = await supabase.from("vendors").update({ status: "inactive" }).eq("id", vendor.id);
    setStatusBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Vendor deactivated.");
    load();
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 mono text-[11px] uppercase tracking-wider text-muted-foreground">
        <Link to="/" className="hover:text-architect">Home</Link>
        <span>/</span>
        <Link to="/vendors" className="hover:text-architect">Vendors</Link>
      </div>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="label-eyebrow text-true-taupe">
            Vendor · <span className="mono">{vendor.vendor_number}</span>
          </span>
          <span className="text-[10px] uppercase tracking-wider text-true-taupe border hairline rounded-sm px-1.5">
            {VENDOR_TYPE_LABELS[vendor.vendor_type]}
          </span>
        </div>
        <h1 className="font-display text-4xl text-architect leading-tight inline-flex items-center gap-3">
          {vendorDisplayName(vendor)}
          {vendor.is_preferred && <Star className="h-6 w-6 fill-gold text-gold" />}
        </h1>
        <div className="text-sm text-muted-foreground">
          {specs.length > 0 && <>{specs.map((s) => SPECIALTY_LABELS[s]).join(", ")} · </>}
          <span className={cn("px-1.5 py-0.5 border rounded-sm text-[10px] uppercase tracking-wider", VENDOR_STATUS_STYLES[vendor.status])}>
            {VENDOR_STATUS_LABELS[vendor.status]}
          </span>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2 pb-6 border-b hairline">
        {canEdit && (
          <>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button variant="outline" size="sm" onClick={togglePreferred} disabled={statusBusy}>
              <Star className={cn("h-3.5 w-3.5", vendor.is_preferred && "fill-gold text-gold")} />
              {vendor.is_preferred ? "Remove preferred" : "Mark preferred"}
            </Button>
            {vendor.status === "active" && (
              <Button variant="outline" size="sm" onClick={setStatusInactive} disabled={statusBusy}>
                Deactivate
              </Button>
            )}
            {vendor.status === "inactive" && (
              <Button variant="outline" size="sm" onClick={setStatusActive} disabled={statusBusy}>
                Reactivate
              </Button>
            )}
            {vendor.status !== "blacklisted" && (
              <Button variant="outline" size="sm" onClick={() => setBlacklistOpen(true)}>
                Blacklist
              </Button>
            )}
            {vendor.status === "blacklisted" && (
              <Button variant="outline" size="sm" onClick={setStatusActive} disabled={statusBusy}>
                Lift blacklist
              </Button>
            )}
          </>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto px-2">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isAdmin && (
              <DropdownMenuItem
                onSelect={() => setDeleteOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete vendor
              </DropdownMenuItem>
            )}
            {!isAdmin && <DropdownMenuItem disabled>No actions available</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="ghost" size="sm" onClick={() => navigate("/vendors")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card label="Status">
          <span className={cn("inline-block px-1.5 py-0.5 border rounded-sm text-[10px] uppercase tracking-wider", VENDOR_STATUS_STYLES[vendor.status])}>
            {VENDOR_STATUS_LABELS[vendor.status]}
          </span>
          {vendor.is_preferred && (
            <div className="text-[11px] text-gold mt-1.5 inline-flex items-center gap-1">
              <Star className="h-3 w-3 fill-gold" /> Preferred
            </div>
          )}
          {vendor.status === "blacklisted" && vendor.blacklist_reason && (
            <div className="text-[11px] text-destructive mt-1.5 line-clamp-2">{vendor.blacklist_reason}</div>
          )}
        </Card>
        <Card label="Specialties">
          {specs.length === 0 ? (
            <div className="text-sm text-muted-foreground italic">None set</div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {specs.slice(0, 4).map((s) => {
                const Icon = SPECIALTY_ICONS[s];
                return (
                  <span key={s} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-muted/40 text-[10px] text-architect">
                    <Icon className="h-3 w-3" strokeWidth={1.5} />
                    {SPECIALTY_LABELS[s]}
                  </span>
                );
              })}
              {specs.length > 4 && <span className="text-[10px] text-muted-foreground">+{specs.length - 4}</span>}
            </div>
          )}
        </Card>
        <Card label="Primary contact">
          {primaryContact?.people ? (
            <div>
              <Link to={`/people/${primaryContact.person_id}`} className="text-sm text-architect hover:underline">
                {primaryContact.people.first_name} {primaryContact.people.last_name}
              </Link>
              {primaryContact.people.phone && (
                <div className="text-[11px] text-muted-foreground">{primaryContact.people.phone}</div>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground italic">No primary contact</div>
          )}
        </Card>
        <Card label="Rates">
          {vendor.default_hourly_rate != null || vendor.default_call_out_fee != null ? (
            <div className="text-sm text-architect">
              {vendor.default_hourly_rate != null && <>{vendor.currency} {Number(vendor.default_hourly_rate).toLocaleString()}/hr</>}
              {vendor.default_hourly_rate != null && vendor.default_call_out_fee != null && " · "}
              {vendor.default_call_out_fee != null && <>{vendor.currency} {Number(vendor.default_call_out_fee).toLocaleString()} call-out</>}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground italic">Quote-based</div>
          )}
          {vendor.rate_notes && (
            <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{vendor.rate_notes}</div>
          )}
        </Card>
        <Card label="Compliance">
          <div className="space-y-1 text-xs">
            <ComplianceLine label="License" date={vendor.trade_license_expiry_date} state={tlState} />
            <ComplianceLine label="Insurance" date={vendor.insurance_expiry_date} state={insState} />
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">
            Contacts {contacts.length > 0 && <span className="ml-1 text-muted-foreground">({contacts.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="tickets">
            Tickets {ticketsCount > 0 && <span className="ml-1 text-muted-foreground">({ticketsCount})</span>}
          </TabsTrigger>
          <TabsTrigger value="documents">
            Documents {docsCount > 0 && <span className="ml-1 text-muted-foreground">({docsCount})</span>}
          </TabsTrigger>
          <TabsTrigger value="notes">
            Notes {notesCount > 0 && <span className="ml-1 text-muted-foreground">({notesCount})</span>}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          {(tlState === "expired" || insState === "expired") && (
            <Banner tone="red" icon={<ShieldX className="h-4 w-4" />}>
              Compliance has lapsed: {[
                tlState === "expired" && "trade license",
                insState === "expired" && "insurance",
              ].filter(Boolean).join(" and ")} expired. Update before assigning new work.
            </Banner>
          )}
          {(tlState === "expiring" || insState === "expiring") && tlState !== "expired" && insState !== "expired" && (
            <Banner tone="amber" icon={<ShieldAlert className="h-4 w-4" />}>
              Compliance expires soon. Renew the {[
                tlState === "expiring" && "trade license",
                insState === "expiring" && "insurance",
              ].filter(Boolean).join(" and ")}.
            </Banner>
          )}

          <SectionPanel title="Identity">
            <Field label="Legal name" value={vendor.legal_name} />
            <Field label="Display name" value={vendor.display_name} />
            <Field label="Vendor #" value={vendor.vendor_number} mono />
            <Field label="Type" value={VENDOR_TYPE_LABELS[vendor.vendor_type]} />
            <Field label="Onboarded" value={vendor.onboarded_at ? format(new Date(vendor.onboarded_at), "MMM d, yyyy") : null} />
          </SectionPanel>

          <SectionPanel title="Compliance">
            <Field label="Trade license #" value={vendor.trade_license_number} />
            <Field label="License authority" value={vendor.trade_license_authority} />
            <Field label="License expiry" value={vendor.trade_license_expiry_date} />
            <Field label="TRN" value={vendor.trn} />
            <Field label="Insurance provider" value={vendor.insurance_provider} />
            <Field label="Insurance policy #" value={vendor.insurance_policy_number} />
            <Field label="Insurance expiry" value={vendor.insurance_expiry_date} />
            <Field label="Insurance notes" value={vendor.insurance_coverage_notes} wide />
          </SectionPanel>

          <SectionPanel title="Specialties">
            {specs.length === 0 ? (
              <div className="text-sm text-muted-foreground italic">No specialties set yet.</div>
            ) : (
              <div className="flex flex-wrap gap-2 col-span-full">
                {specs.map((s) => {
                  const Icon = SPECIALTY_ICONS[s];
                  return (
                    <span key={s} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-sm bg-muted/40 text-xs text-architect">
                      <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                      {SPECIALTY_LABELS[s]}
                    </span>
                  );
                })}
              </div>
            )}
            {vendor.specialties_other && (
              <Field label="Other specialty" value={vendor.specialties_other} wide />
            )}
          </SectionPanel>

          <SectionPanel title="Rates">
            <Field
              label="Hourly rate"
              value={vendor.default_hourly_rate != null ? `${vendor.currency} ${Number(vendor.default_hourly_rate).toLocaleString()}` : null}
            />
            <Field
              label="Call-out fee"
              value={vendor.default_call_out_fee != null ? `${vendor.currency} ${Number(vendor.default_call_out_fee).toLocaleString()}` : null}
            />
            <Field label="Currency" value={vendor.currency} />
            <Field label="Rate notes" value={vendor.rate_notes} wide />
          </SectionPanel>

          <SectionPanel title="Contact">
            <Field label="Primary phone" value={vendor.primary_phone} icon={<Phone className="h-3.5 w-3.5" />} />
            <Field label="Primary email" value={vendor.primary_email} icon={<Mail className="h-3.5 w-3.5" />} />
            <Field label="Website" value={vendor.website} icon={<Globe className="h-3.5 w-3.5" />} link />
            <Field label="Address" value={vendor.address} icon={<MapPin className="h-3.5 w-3.5" />} wide />
          </SectionPanel>

          <SectionPanel title="Service area">
            <Field label="Notes" value={vendor.service_area_notes} wide />
          </SectionPanel>

          {vendor.notes && (
            <SectionPanel title="Internal notes">
              <Field label="" value={vendor.notes} wide />
            </SectionPanel>
          )}
        </TabsContent>

        <TabsContent value="contacts" className="mt-6">
          <ContactsTab
            vendorId={vendor.id}
            contacts={contacts}
            canEdit={canEdit}
            onChanged={load}
            onOpenAdd={() => { setContactSeed(null); setContactOpen(true); }}
            onOpenEdit={(c) => { setContactSeed(c); setContactOpen(true); }}
          />
        </TabsContent>

        <TabsContent value="tickets" className="mt-6">
          <VendorTicketsTabSection
            vendor={vendor}
            onCountChange={setTicketsCount}
            onNewForVendor={() => setNewTicketForVendorOpen(true)}
            onNewAboutVendor={() => setNewTicketAboutVendorOpen(true)}
          />
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <DocumentList
            entityType="vendor"
            entityId={vendor.id}
            editable={canEdit}
            onCountChange={setDocsCount}
          />
        </TabsContent>

        <TabsContent value="notes" className="mt-6">
          <NotesPanel
            entityType="vendor"
            entityId={vendor.id}
            onCountChange={setNotesCount}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <HistoryTab events={events} />
        </TabsContent>
      </Tabs>

      <NewVendorDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        vendor={editOpen ? vendor : null}
        onSaved={() => { setEditOpen(false); load(); }}
      />

      <ContactDialog
        open={contactOpen}
        onOpenChange={setContactOpen}
        vendorId={vendor.id}
        existingContactIds={contacts.map((c) => c.person_id)}
        seed={contactSeed}
        onSaved={() => { setContactOpen(false); load(); }}
      />

      <BlacklistDialog
        open={blacklistOpen}
        onOpenChange={setBlacklistOpen}
        vendorId={vendor.id}
        onDone={() => { setBlacklistOpen(false); load(); }}
      />

      <DeleteVendorDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        vendor={vendor}
        onDeleted={() => navigate("/vendors")}
      />

      {/* "About this vendor" — target = the vendor entity */}
      <NewTicketDialog
        open={newTicketAboutVendorOpen}
        onOpenChange={setNewTicketAboutVendorOpen}
        presetTarget={{
          entity_type: "vendor",
          entity_id: vendor.id,
          entity_label: vendorDisplayName(vendor),
        }}
        onCreated={() => setTicketsCount((n) => n + 1)}
        navigateOnCreate={false}
      />

      {/* "For this vendor" — vendor_id pre-filled, target picked freely */}
      <NewTicketDialog
        open={newTicketForVendorOpen}
        onOpenChange={setNewTicketForVendorOpen}
        presetVendor={{ vendor_id: vendor.id, vendor_label: vendorDisplayName(vendor) }}
        onCreated={() => setTicketsCount((n) => n + 1)}
        navigateOnCreate={false}
      />
    </div>
  );
}

/* =========================================================
 * Subcomponents
 * ========================================================= */

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border hairline rounded-sm bg-card p-4">
      <div className="label-eyebrow mb-2">{label}</div>
      {children}
    </div>
  );
}

function ComplianceLine({
  label, date, state,
}: {
  label: string;
  date: string | null;
  state: ReturnType<typeof complianceState>;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", COMPLIANCE_DOT_STYLES[state])} />
      <span className="text-architect">{label}</span>
      <span className="text-muted-foreground">
        {date ? format(new Date(date), "MMM d, yyyy") : COMPLIANCE_LABELS[state]}
      </span>
    </div>
  );
}

function SectionPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border hairline rounded-sm bg-card p-5">
      <h3 className="label-eyebrow mb-4">{title}</h3>
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">{children}</dl>
    </section>
  );
}

function Field({
  label, value, icon, link, mono, wide,
}: {
  label: string;
  value: string | null | undefined;
  icon?: React.ReactNode;
  link?: boolean;
  mono?: boolean;
  wide?: boolean;
}) {
  const display = value && String(value).trim() ? value : null;
  return (
    <div className={cn(wide && "md:col-span-2")}>
      {label && <dt className="label-eyebrow mb-0.5">{label}</dt>}
      <dd className={cn("text-sm flex items-start gap-1.5", display ? "text-architect" : "text-muted-foreground italic", mono && "mono")}>
        {icon && <span className="text-muted-foreground mt-0.5">{icon}</span>}
        {display ? (
          link ? (
            <a href={display.startsWith("http") ? display : `https://${display}`} target="_blank" rel="noreferrer" className="underline decoration-gold/60 underline-offset-2 hover:decoration-gold inline-flex items-center gap-1">
              {display}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <span className="whitespace-pre-wrap break-words">{display}</span>
          )
        ) : (
          <span>—</span>
        )}
      </dd>
    </div>
  );
}

function Banner({
  tone, icon, children,
}: {
  tone: "amber" | "red";
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const styles = tone === "red"
    ? "bg-destructive/10 text-destructive border-destructive/30"
    : "bg-amber-500/10 text-amber-700 border-amber-500/30";
  return (
    <div className={cn("border rounded-sm px-4 py-3 text-sm flex items-start gap-2", styles)}>
      {icon}
      <div className="flex-1">{children}</div>
    </div>
  );
}

function ContactsTab({
  vendorId, contacts, canEdit, onChanged, onOpenAdd, onOpenEdit,
}: {
  vendorId: string;
  contacts: ContactRow[];
  canEdit: boolean;
  onChanged: () => void;
  onOpenAdd: () => void;
  onOpenEdit: (c: ContactRow) => void;
}) {
  const removeContact = async (c: ContactRow) => {
    const { error } = await supabase.from("vendor_contacts").delete().eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Contact removed.");
    onChanged();
  };
  const makePrimary = async (c: ContactRow) => {
    const { error } = await supabase.from("vendor_contacts").update({ is_primary: true }).eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Primary contact updated.");
    onChanged();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canEdit && (
          <Button variant="gold" size="sm" onClick={onOpenAdd}>
            <Plus className="h-3.5 w-3.5" /> Add contact
          </Button>
        )}
      </div>
      {contacts.length === 0 ? (
        <EmptyState
          title="No contacts"
          description="Add someone you work with at this vendor."
          action={canEdit && <Button variant="gold" size="sm" onClick={onOpenAdd}><Plus className="h-3.5 w-3.5" /> Add contact</Button>}
        />
      ) : (
        <div className="border hairline rounded-sm overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b hairline text-left">
              <tr>
                <th className="px-4 py-3 label-eyebrow">Name</th>
                <th className="px-4 py-3 label-eyebrow">Role</th>
                <th className="px-4 py-3 label-eyebrow">Primary</th>
                <th className="px-4 py-3 label-eyebrow">Phone</th>
                <th className="px-4 py-3 label-eyebrow">Email</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="border-b hairline last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link to={`/people/${c.person_id}`} className="text-architect hover:underline">
                      {c.people?.first_name} {c.people?.last_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs">{VENDOR_CONTACT_ROLE_LABELS[c.role]}</td>
                  <td className="px-4 py-3 text-xs">
                    {c.is_primary ? (
                      <span className="text-gold inline-flex items-center gap-1"><Star className="h-3 w-3 fill-gold" /> Primary</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{c.people?.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{c.people?.email ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {canEdit && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="px-2"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => onOpenEdit(c)}>Edit role</DropdownMenuItem>
                          {!c.is_primary && (
                            <DropdownMenuItem onSelect={() => makePrimary(c)}>Make primary</DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() => removeContact(c)}
                            className="text-destructive focus:text-destructive"
                          >
                            Remove from vendor
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ContactDialog({
  open, onOpenChange, vendorId, existingContactIds, seed, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  vendorId: string;
  existingContactIds: string[];
  seed: ContactRow | null;
  onSaved: () => void;
}) {
  const [person, setPerson] = useState<PickedPerson | null>(null);
  const [role, setRole] = useState<VendorContactRole>("primary");
  const [isPrimary, setIsPrimary] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (seed) {
      setPerson(null);
      setRole(seed.role);
      setIsPrimary(seed.is_primary);
    } else {
      setPerson(null);
      setRole("primary");
      setIsPrimary(false);
    }
  }, [open, seed]);

  const handleSubmit = async () => {
    setBusy(true);
    if (seed) {
      const { error } = await supabase
        .from("vendor_contacts")
        .update({ role, is_primary: isPrimary })
        .eq("id", seed.id);
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Contact updated.");
      onSaved();
      return;
    }
    if (!person) { toast.error("Pick a person."); setBusy(false); return; }
    const { error } = await supabase.from("vendor_contacts").insert({
      vendor_id: vendorId,
      person_id: person.id,
      role,
      is_primary: isPrimary,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Contact added.");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{seed ? "Edit contact" : "Add contact"}</DialogTitle>
          <DialogDescription>
            {seed ? "Update role or primary flag." : "Link a person to this vendor."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {!seed && (
            <div className="space-y-1.5">
              <Label>Person *</Label>
              <PersonCombobox
                value={person?.id ?? ""}
                valueLabel={person ? `${person.first_name} ${person.last_name}`.trim() : undefined}
                onChange={setPerson}
                excludeIds={existingContactIds}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as VendorContactRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(VENDOR_CONTACT_ROLE_LABELS).map(([k, l]) => (
                  <SelectItem key={k} value={k}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
            <span className="text-architect">Set as primary contact</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant="gold" onClick={handleSubmit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {seed ? "Save" : "Add contact"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BlacklistDialog({
  open, onOpenChange, vendorId, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  vendorId: string;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) setReason(""); }, [open]);

  const submit = async () => {
    if (!reason.trim()) { toast.error("Reason is required."); return; }
    setBusy(true);
    const { error } = await supabase
      .from("vendors")
      .update({ status: "blacklisted", blacklist_reason: reason.trim() })
      .eq("id", vendorId);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Vendor blacklisted.");
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Blacklist this vendor?</DialogTitle>
          <DialogDescription>
            Blacklisted vendors are hidden from pickers and cannot be assigned to new tickets.
            Existing assignments remain.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5 py-2">
          <Label>Reason *</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-[80px]" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant="gold" onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Blacklist
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteVendorDialog({
  open, onOpenChange, vendor, onDeleted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  vendor: Vendor;
  onDeleted: () => void;
}) {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setConfirm(""); }, [open]);
  const matches = confirm === vendor.vendor_number;

  const submit = async () => {
    if (!matches) { toast.error("Type the vendor number to confirm."); return; }
    setBusy(true);
    const { error } = await supabase.from("vendors").delete().eq("id", vendor.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Vendor deleted.");
    onDeleted();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete vendor permanently?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the vendor and all linked contacts, notes, documents, and photos.
            Linked people records remain intact. Type <strong className="mono">{vendor.vendor_number}</strong> to confirm.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="VND-YYYY-NNNN" />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); submit(); }}
            disabled={!matches || busy}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function HistoryTab({ events }: { events: EventRow[] }) {
  if (events.length === 0) {
    return <EmptyState title="No history yet" description="Events will appear here as the vendor is updated." />;
  }
  return (
    <div className="space-y-2">
      {events.map((e) => (
        <div key={e.id} className="border hairline rounded-sm bg-card px-4 py-3 text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-architect">
              <History className="h-3.5 w-3.5 inline mr-1.5 text-muted-foreground" />
              {humanizeEvent(e.event_type)}
            </span>
            <span className="text-[11px] text-muted-foreground" title={format(new Date(e.created_at), "PPpp")}>
              {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
            </span>
          </div>
          {e.description && <div className="text-xs text-muted-foreground mt-1">{e.description}</div>}
          {(e.from_value || e.to_value) && e.event_type !== "blacklisted" && (
            <div className="text-[11px] text-muted-foreground mt-1">
              {e.from_value ?? "—"} → {e.to_value ?? "—"}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function humanizeEvent(t: string): string {
  switch (t) {
    case "created": return "Vendor created";
    case "status_changed": return "Status changed";
    case "blacklisted": return "Blacklisted";
    case "reactivated": return "Reactivated";
    case "preferred_changed": return "Preferred status changed";
    case "compliance_updated": return "Compliance fields updated";
    case "updated": return "Updated";
    default: return t.replace(/_/g, " ");
  }
}

function VendorTicketsTabSection({
  vendor,
  onCountChange,
  onNewForVendor,
  onNewAboutVendor,
}: {
  vendor: Vendor;
  onCountChange: (n: number) => void;
  onNewForVendor: () => void;
  onNewAboutVendor: () => void;
}) {
  const sections: TicketSection[] = [
    {
      key: "assigned",
      label: "Assigned tickets",
      emptyText: "No tickets currently assigned to this vendor.",
      fetch: async () => {
        const { data } = await supabase
          .from("tickets")
          .select("id, ticket_number, subject, ticket_type, priority, status, assignee_id, due_date, created_at, target_entity_type, target_entity_id, is_system_generated")
          .eq("vendor_id", vendor.id)
          .order("created_at", { ascending: false });
        return (data ?? []) as EntityTicketRow[];
      },
    },
    {
      key: "about",
      label: "Tickets about this vendor",
      emptyText: "No tickets target this vendor.",
      fetch: async () => {
        const { data } = await supabase
          .from("tickets")
          .select("id, ticket_number, subject, ticket_type, priority, status, assignee_id, due_date, created_at, target_entity_type, target_entity_id, is_system_generated")
          .eq("target_entity_type", "vendor")
          .eq("target_entity_id", vendor.id)
          .order("created_at", { ascending: false });
        return (data ?? []) as EntityTicketRow[];
      },
    },
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onNewForVendor}>
          <Plus className="h-3.5 w-3.5" /> New ticket for this vendor
        </Button>
        <Button variant="gold" size="sm" onClick={onNewAboutVendor}>
          <Plus className="h-3.5 w-3.5" /> New ticket about this vendor
        </Button>
      </div>
      <EntityTicketsTab
        entityType="vendor"
        entityId={vendor.id}
        entityLabel={vendorDisplayName(vendor)}
        groupedView
        sections={sections}
        onActiveCountChange={onCountChange}
      />
    </div>
  );
}
