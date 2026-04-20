import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, FilePlus, FileSignature, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ManagementAgreementWizard,
  type LeadPreset,
} from "@/components/contracts/ManagementAgreementWizard";
import type { LeadRow } from "@/lib/leads";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: LeadRow;
  /** Called after a successful conversion (either path). */
  onConverted: () => void;
  /** Called when the user cancels at any point (used by drag-drop to snap back). */
  onCancel?: () => void;
}

type Mode = "intent" | "link";

interface EligibleAgreement {
  id: string;
  contract_number: string;
  title: string;
  status: string;
}

/**
 * Conversion ritual entry point.
 * Step A: choose Create-now vs Link-existing.
 * Step B (create): launches the mgmt agreement wizard with presetFromLead.
 * Step B (link): pick an eligible agreement and atomically mark the lead signed.
 */
export function MarkContractSignedDialog({ open, onOpenChange, lead, onConverted, onCancel }: Props) {
  const [mode, setMode] = useState<Mode>("intent");
  const [choice, setChoice] = useState<"create" | "link">("create");
  const [wizardOpen, setWizardOpen] = useState(false);

  // Reset on close.
  useEffect(() => {
    if (!open) {
      setMode("intent");
      setChoice("create");
    }
  }, [open]);

  const preset: LeadPreset = useMemo(
    () => ({
      lead_id: lead.id,
      lead_number: lead.lead_number,
      primary_contact_id: lead.primary_contact_id,
      company_id: lead.company_id,
      proposed_fee_model: lead.proposed_fee_model,
      proposed_fee_value:
        lead.proposed_fee_value != null ? Number(lead.proposed_fee_value) : null,
      proposed_fee_applies_to: lead.proposed_fee_applies_to,
      proposed_duration_months: lead.proposed_duration_months,
      proposed_scope_of_services: Array.isArray(lead.proposed_scope_of_services)
        ? (lead.proposed_scope_of_services as string[])
        : [],
      proposed_terms_notes: lead.proposed_terms_notes,
    }),
    [lead],
  );

  const handleContinue = () => {
    if (choice === "create") {
      // Hide step A and launch the wizard with presetFromLead.
      setWizardOpen(true);
      onOpenChange(false);
    } else {
      setMode("link");
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    onCancel?.();
  };

  const handleWizardSaved = () => {
    setWizardOpen(false);
    onConverted();
  };

  const handleWizardClose = (v: boolean) => {
    setWizardOpen(v);
    if (!v) onCancel?.();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : handleCancel())}>
        <DialogContent className="max-w-[560px]">
          {mode === "intent" ? (
            <IntentStep
              choice={choice}
              setChoice={setChoice}
              onContinue={handleContinue}
              onCancel={handleCancel}
            />
          ) : (
            <LinkExistingStep
              lead={lead}
              onBack={() => setMode("intent")}
              onLinked={() => {
                onOpenChange(false);
                onConverted();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <ManagementAgreementWizard
        open={wizardOpen}
        onOpenChange={handleWizardClose}
        presetFromLead={preset}
        onSaved={handleWizardSaved}
      />
    </>
  );
}

/* ============== Step A — intent picker ============== */

function IntentStep({
  choice, setChoice, onContinue, onCancel,
}: {
  choice: "create" | "link";
  setChoice: (v: "create" | "link") => void;
  onContinue: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">Mark contract signed</DialogTitle>
        <DialogDescription>
          A management agreement must exist in the system to mark this lead as signed. Choose how to proceed:
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-1 gap-2 pt-2">
        <ChoiceCard
          active={choice === "create"}
          onClick={() => setChoice("create")}
          icon={<FilePlus className="h-5 w-5" />}
          title="Create management agreement now"
          description="Open the management agreement wizard with terms pre-filled from this lead."
        />
        <ChoiceCard
          active={choice === "link"}
          onClick={() => setChoice("link")}
          icon={<FileSignature className="h-5 w-5" />}
          title="Link an existing agreement"
          description="Already created the agreement manually? Pick which one this lead won."
        />
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant="gold" onClick={onContinue}>Continue</Button>
      </DialogFooter>
    </>
  );
}

function ChoiceCard({
  active, onClick, icon, title, description,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left border hairline rounded-sm p-4 transition-colors flex items-start gap-3",
        active
          ? "border-gold/60 bg-gold/[0.05] ring-1 ring-gold/40"
          : "border-warm-stone bg-card hover:bg-muted/40",
      )}
    >
      <div className={cn("mt-0.5 shrink-0", active ? "text-gold-deep" : "text-true-taupe")}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-architect font-medium">{title}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{description}</div>
      </div>
      {active && <CheckCircle2 className="h-4 w-4 text-gold-deep shrink-0 mt-0.5" />}
    </button>
  );
}

/* ============== Step B — link existing ============== */

function LinkExistingStep({
  lead, onBack, onLinked,
}: {
  lead: LeadRow;
  onBack: () => void;
  onLinked: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [eligible, setEligible] = useState<EligibleAgreement[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      // 1) Find management agreement contracts for this landlord (via contract_parties),
      //    in eligible statuses.
      const landlordIds = [lead.primary_contact_id, lead.company_id].filter(
        (x): x is string => !!x,
      );
      if (landlordIds.length === 0) {
        if (!cancelled) {
          setEligible([]);
          setLoading(false);
        }
        return;
      }

      const { data: parties } = await supabase
        .from("contract_parties")
        .select(
          "contract_id, person_id, contract:contract_id(id, contract_number, title, status, contract_type)",
        )
        .in("person_id", landlordIds);

      const candidates = ((parties ?? []) as any[])
        .map((p) => p.contract)
        .filter((c) => !!c && c.contract_type === "management_agreement")
        .filter((c) => ["active", "pending_signature", "draft"].includes(c.status));

      // Deduplicate.
      const dedupMap = new Map<string, EligibleAgreement>();
      for (const c of candidates) dedupMap.set(c.id, {
        id: c.id,
        contract_number: c.contract_number,
        title: c.title,
        status: c.status,
      });

      // 2) Exclude any already linked to a lead (uniqueness sanity check).
      const ids = Array.from(dedupMap.keys());
      if (ids.length > 0) {
        const { data: claimed } = await supabase
          .from("leads")
          .select("won_contract_id")
          .in("won_contract_id", ids);
        for (const row of claimed ?? []) {
          if (row.won_contract_id) dedupMap.delete(row.won_contract_id);
        }
      }

      if (!cancelled) {
        setEligible(Array.from(dedupMap.values()));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lead.id, lead.primary_contact_id, lead.company_id]);

  const submit = async () => {
    if (!selected) {
      toast.error("Pick an agreement first.");
      return;
    }
    setBusy(true);
    const chosen = eligible.find((e) => e.id === selected);
    const { error } = await supabase
      .from("leads")
      .update({
        won_contract_id: selected,
        status: "contract_signed",
      })
      .eq("id", lead.id);
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("lead_events").insert({
      lead_id: lead.id,
      event_type: "marked_contract_signed",
      to_value: chosen?.contract_number ?? null,
      description: "Linked to existing management agreement",
      actor_id: u.user?.id,
    });
    setBusy(false);
    toast.success(`Lead linked to ${chosen?.contract_number ?? "agreement"}.`);
    onLinked();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">Link existing management agreement</DialogTitle>
        <DialogDescription>
          Choose an existing agreement for this landlord to mark this lead as signed.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3 pt-2">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading eligible agreements…
          </div>
        ) : eligible.length === 0 ? (
          <div className="border hairline rounded-sm bg-muted/30 p-4 text-sm text-muted-foreground">
            No eligible agreements found for this landlord. Go back and choose{" "}
            <span className="font-medium text-architect">Create now</span> instead.
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label className="text-xs">Agreement *</Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger><SelectValue placeholder="Pick an agreement…" /></SelectTrigger>
              <SelectContent>
                {eligible.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    <span className="mono text-[11px] mr-1">{e.contract_number}</span>
                    · {e.title} · <span className="uppercase tracking-wider text-[10px]">{e.status}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected && (
              <p className="text-[11px] text-muted-foreground pt-1">
                <Link
                  to={`/contracts/${selected}`}
                  target="_blank"
                  className="underline hover:text-architect"
                >
                  Preview agreement →
                </Link>
              </p>
            )}
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onBack}>Back</Button>
        <Button
          variant="gold"
          onClick={submit}
          disabled={busy || loading || !selected || eligible.length === 0}
        >
          {busy ? "Linking…" : "Link and mark signed"}
        </Button>
      </DialogFooter>
    </>
  );
}