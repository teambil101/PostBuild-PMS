import { useEffect, useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  Award,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  Plus,
  Send,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import {
  parseSpecialties,
  getSpecialtiesLabels,
  type Specialty,
} from "@/lib/vendors";
import { cn } from "@/lib/utils";

type QuoteStatus =
  | "invited"
  | "submitted"
  | "accepted"
  | "rejected"
  | "withdrawn"
  | "expired";

interface QuoteRow {
  id: string;
  request_id: string;
  vendor_id: string;
  status: QuoteStatus;
  amount: number | null;
  currency: string;
  eta_days: number | null;
  vendor_notes: string | null;
  internal_notes: string | null;
  submission_token: string;
  invited_at: string;
  submitted_at: string | null;
  decided_at: string | null;
  expires_at: string;
}

interface VendorRow {
  id: string;
  legal_name: string;
  display_name: string | null;
  primary_phone: string | null;
  primary_email: string | null;
  specialties: unknown;
  default_hourly_rate: number | null;
  default_call_out_fee: number | null;
  currency: string;
}

const STATUS_LABEL: Record<QuoteStatus, string> = {
  invited: "Invited",
  submitted: "Submitted",
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  expired: "Expired",
};

const STATUS_STYLES: Record<QuoteStatus, string> = {
  invited: "bg-muted text-muted-foreground border-warm-stone/60",
  submitted: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  accepted: "bg-status-occupied/10 text-status-occupied border-status-occupied/30",
  rejected: "bg-destructive/10 text-destructive border-destructive/30 line-through",
  withdrawn: "bg-muted text-muted-foreground border-warm-stone/60 line-through",
  expired: "bg-amber-500/10 text-amber-700 border-amber-500/30",
};

interface Props {
  requestId: string;
  category: string;
  hasAssignedVendor: boolean;
  onChanged: () => void | Promise<void>;
}

export function QuotesCard({ requestId, category, hasAssignedVendor, onChanged }: Props) {
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [vendors, setVendors] = useState<Record<string, VendorRow>>({});
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [working, setWorking] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: qData } = await supabase
      .from("service_request_quotes")
      .select("*")
      .eq("request_id", requestId)
      .order("invited_at", { ascending: true });
    const rows = (qData ?? []) as QuoteRow[];
    setQuotes(rows);

    const vendorIds = Array.from(new Set(rows.map((q) => q.vendor_id)));
    if (vendorIds.length) {
      const { data: vData } = await supabase
        .from("vendors")
        .select(
          "id, legal_name, display_name, primary_phone, primary_email, specialties, default_hourly_rate, default_call_out_fee, currency",
        )
        .in("id", vendorIds);
      const map: Record<string, VendorRow> = {};
      (vData ?? []).forEach((v: any) => (map[v.id] = v));
      setVendors(map);
    } else {
      setVendors({});
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [requestId]);

  const accept = async (quoteId: string) => {
    setWorking(quoteId);
    const { error } = await supabase.rpc("accept_service_request_quote", {
      p_quote_id: quoteId,
      p_notes: null,
    });
    setWorking(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Quote accepted — vendor assigned to request");
    await load();
    await onChanged();
  };

  const remove = async (quoteId: string) => {
    setWorking(quoteId);
    const { error } = await supabase
      .from("service_request_quotes")
      .delete()
      .eq("id", quoteId);
    setWorking(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Quote removed");
    await load();
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/q/${token}`;
    void navigator.clipboard.writeText(url);
    toast.success("Public quote link copied");
  };

  const submitted = quotes.filter((q) => q.status === "submitted");
  const accepted = quotes.find((q) => q.status === "accepted");
  const pending = quotes.filter((q) => q.status === "invited");

  const cheapest = useMemo(() => {
    if (submitted.length === 0) return null;
    return submitted.reduce((min, q) =>
      (q.amount ?? Infinity) < (min.amount ?? Infinity) ? q : min,
    );
  }, [submitted]);

  if (loading) {
    return (
      <Card className="hairline">
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hairline">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Vendor quotes
              {quotes.length > 0 && (
                <span className="text-xs text-muted-foreground font-normal">
                  · {submitted.length} of {quotes.length} responded
                </span>
              )}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Invite multiple vendors to bid. They submit price + ETA via a public link.
            </p>
          </div>
          {!accepted && !hasAssignedVendor && (
            <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Invite vendors
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {quotes.length === 0 && (
          <div className="text-xs text-muted-foreground italic py-2">
            No vendors invited yet.
          </div>
        )}

        {quotes.map((q) => {
          const v = vendors[q.vendor_id];
          const name = v?.display_name || v?.legal_name || "Unknown vendor";
          const isCheapest =
            cheapest?.id === q.id && submitted.length > 1 && q.status === "submitted";
          const expired =
            q.status === "invited" && new Date(q.expires_at) < new Date();

          return (
            <div
              key={q.id}
              className={cn(
                "border hairline rounded-sm p-3 bg-card",
                q.status === "accepted" && "border-status-occupied/40 bg-status-occupied/5",
              )}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-architect">{name}</span>
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] uppercase tracking-wider", STATUS_STYLES[q.status])}
                    >
                      {STATUS_LABEL[q.status]}
                    </Badge>
                    {isCheapest && (
                      <Badge
                        variant="outline"
                        className="text-[10px] uppercase tracking-wider bg-gold/10 text-gold border-gold/40"
                      >
                        <Award className="h-3 w-3" />
                        Lowest
                      </Badge>
                    )}
                    {expired && (
                      <Badge
                        variant="outline"
                        className="text-[10px] uppercase tracking-wider bg-amber-500/10 text-amber-700 border-amber-500/30"
                      >
                        Past SLA
                      </Badge>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    {v && (
                      <div>{getSpecialtiesLabels(v.specialties) || "No specialties listed"}</div>
                    )}
                    {q.status === "invited" && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        Invited {formatDistanceToNow(new Date(q.invited_at), { addSuffix: true })}
                        {" · "}expires {format(new Date(q.expires_at), "d MMM HH:mm")}
                      </div>
                    )}
                    {q.submitted_at && (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3 w-3" />
                        Submitted {formatDistanceToNow(new Date(q.submitted_at), { addSuffix: true })}
                      </div>
                    )}
                  </div>

                  {q.status === "submitted" && (
                    <div className="grid grid-cols-2 gap-3 mt-2 text-sm">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Price
                        </div>
                        <div className="mono tabular-nums text-architect">
                          {q.amount != null
                            ? `${q.currency} ${Number(q.amount).toLocaleString()}`
                            : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          ETA
                        </div>
                        <div className="mono tabular-nums text-architect">
                          {q.eta_days != null ? `${q.eta_days} day${q.eta_days === 1 ? "" : "s"}` : "—"}
                        </div>
                      </div>
                    </div>
                  )}

                  {q.vendor_notes && (
                    <div className="mt-2 text-xs text-architect bg-muted/30 rounded px-2 py-1.5 whitespace-pre-wrap">
                      {q.vendor_notes}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {(q.status === "invited" || q.status === "submitted") && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyLink(q.submission_token)}
                      title="Copy public submission link"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {q.status === "submitted" && !accepted && (
                    <Button
                      size="sm"
                      onClick={() => accept(q.id)}
                      disabled={working === q.id}
                    >
                      {working === q.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      Accept
                    </Button>
                  )}
                  {(q.status === "invited" || q.status === "rejected" || q.status === "withdrawn" || q.status === "expired") && !accepted && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => remove(q.id)}
                      disabled={working === q.id}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {pending.length > 0 && !accepted && (
          <div className="text-[11px] text-muted-foreground italic px-1 pt-1">
            <Send className="h-3 w-3 inline -mt-0.5 mr-1" />
            Share each vendor's public link via WhatsApp/email so they can submit their quote.
          </div>
        )}
      </CardContent>

      <InviteVendorsDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        requestId={requestId}
        category={category}
        existingVendorIds={quotes.map((q) => q.vendor_id)}
        onInvited={async () => {
          await load();
          await onChanged();
        }}
      />
    </Card>
  );
}

/* ====================== Invite dialog ====================== */

const CATEGORY_TO_SPECIALTY: Record<string, Specialty | null> = {
  maintenance: null, // matches all maintenance specialties — handled below
  cleaning: "cleaning",
  inspection: null,
  tenant_lifecycle: null,
  leasing: null,
  compliance: null,
  utilities: null,
  administrative: null,
  other: null,
};

function InviteVendorsDialog({
  open,
  onOpenChange,
  requestId,
  category,
  existingVendorIds,
  onInvited,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  requestId: string;
  category: string;
  existingVendorIds: string[];
  onInvited: () => void | Promise<void>;
}) {
  const [allVendors, setAllVendors] = useState<VendorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [matchingOnly, setMatchingOnly] = useState(true);
  const [working, setWorking] = useState(false);
  const [slaHours, setSlaHours] = useState(48);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setSearch("");
    setMatchingOnly(true);
    setSlaHours(48);
    void (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("vendors")
        .select(
          "id, legal_name, display_name, primary_phone, primary_email, specialties, default_hourly_rate, default_call_out_fee, currency",
        )
        .order("legal_name");
      setAllVendors((data ?? []) as VendorRow[]);
      setLoading(false);
    })();
  }, [open]);

  const matchSpecialty = CATEGORY_TO_SPECIALTY[category] ?? null;

  const filtered = useMemo(() => {
    let list = allVendors.filter((v) => !existingVendorIds.includes(v.id));
    if (matchingOnly && category === "maintenance") {
      // For maintenance, show vendors with ANY specialty (since maintenance covers many)
      list = list.filter((v) => parseSpecialties(v.specialties).length > 0);
    } else if (matchingOnly && matchSpecialty) {
      list = list.filter((v) => parseSpecialties(v.specialties).includes(matchSpecialty));
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((v) =>
        (v.display_name ?? v.legal_name).toLowerCase().includes(q),
      );
    }
    return list;
  }, [allVendors, existingVendorIds, matchingOnly, matchSpecialty, search, category]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const send = async () => {
    if (selected.size === 0) {
      toast.error("Pick at least one vendor");
      return;
    }
    setWorking(true);
    const expiresAt = new Date(Date.now() + slaHours * 3600 * 1000).toISOString();
    const rows = Array.from(selected).map((vendor_id) => ({
      request_id: requestId,
      vendor_id,
      status: "invited" as const,
      expires_at: expiresAt,
    }));
    const { error } = await supabase.from("service_request_quotes").insert(rows);
    if (error) {
      toast.error(error.message);
      setWorking(false);
      return;
    }
    // Audit event
    await supabase.from("service_request_events").insert({
      request_id: requestId,
      event_type: "quotes_invited",
      description: `${rows.length} vendor${rows.length === 1 ? "" : "s"} invited to quote`,
      to_value: String(rows.length),
    });
    toast.success(`Invited ${rows.length} vendor${rows.length === 1 ? "" : "s"}`);
    setWorking(false);
    onOpenChange(false);
    await onInvited();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Invite vendors to quote</DialogTitle>
          <DialogDescription>
            Select vendors. Each gets a unique public link to submit their price &amp; ETA — no login required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search vendors…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1"
            />
            <div className="flex items-center gap-2">
              <Checkbox
                id="matching-only"
                checked={matchingOnly}
                onCheckedChange={(v) => setMatchingOnly(!!v)}
              />
              <Label htmlFor="matching-only" className="text-xs cursor-pointer">
                Matching only
              </Label>
            </div>
          </div>

          <ScrollArea className="h-72 border hairline rounded-sm">
            {loading ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No vendors match. Try unchecking "Matching only".
              </div>
            ) : (
              <div className="divide-y hairline">
                {filtered.map((v) => {
                  const checked = selected.has(v.id);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => toggle(v.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 flex items-start gap-3 hover:bg-muted/40 transition-colors",
                        checked && "bg-muted/60",
                      )}
                    >
                      <Checkbox checked={checked} className="mt-0.5 pointer-events-none" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-architect font-medium">
                          {v.display_name || v.legal_name}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {getSpecialtiesLabels(v.specialties) || "No specialties"}
                          {v.primary_phone && ` · ${v.primary_phone}`}
                        </div>
                      </div>
                      {v.default_call_out_fee != null && (
                        <div className="text-[10px] text-muted-foreground mono tabular-nums whitespace-nowrap">
                          callout {v.currency} {Number(v.default_call_out_fee).toLocaleString()}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          <div className="flex items-center gap-3">
            <Label htmlFor="sla" className="text-xs whitespace-nowrap">
              Response SLA (hours)
            </Label>
            <Input
              id="sla"
              type="number"
              min={1}
              max={336}
              value={slaHours}
              onChange={(e) => setSlaHours(Math.max(1, Number(e.target.value) || 48))}
              className="w-24"
            />
            <span className="text-xs text-muted-foreground">
              {selected.size} selected
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={working}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
          <Button onClick={send} disabled={working || selected.size === 0}>
            {working ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send invitations
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}