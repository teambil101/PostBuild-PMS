import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CONTRACT_TYPE_ICONS, CONTRACT_TYPE_LABELS, type ContractType } from "@/lib/contracts";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (type: ContractType) => void;
}

const AVAILABLE: ContractType[] = ["management_agreement", "other"];
const COMING_SOON: ContractType[] = ["lease", "service_agreement", "brokerage_agreement"];

export function ContractTypePickerDialog({ open, onOpenChange, onSelect }: Props) {
  const renderCard = (t: ContractType, available: boolean) => {
    const Icon = CONTRACT_TYPE_ICONS[t];
    return (
      <button
        key={t}
        type="button"
        disabled={!available}
        onClick={() => available && onSelect(t)}
        className={cn(
          "group relative flex flex-col items-start gap-3 rounded-sm border hairline p-5 text-left transition-all",
          available
            ? "bg-card hover:border-gold-deep hover:shadow-sm cursor-pointer"
            : "bg-muted/30 cursor-not-allowed",
        )}
      >
        <div
          className={cn(
            "h-10 w-10 rounded-sm flex items-center justify-center",
            available ? "bg-architect text-chalk" : "bg-warm-stone/40 text-muted-foreground",
          )}
        >
          <Icon className="h-5 w-5" strokeWidth={1.5} />
        </div>
        <div className="space-y-1">
          <div className="font-display text-lg text-architect leading-tight">
            {CONTRACT_TYPE_LABELS[t]}
          </div>
          {!available && (
            <span className="inline-block text-[9px] uppercase tracking-wider mono text-muted-foreground bg-warm-stone/50 px-1.5 py-0.5 rounded-sm">
              Coming soon
            </span>
          )}
          {available && t === "management_agreement" && (
            <p className="text-xs text-muted-foreground leading-snug">
              Authorize yourself to manage a landlord's properties.
            </p>
          )}
          {available && t === "other" && (
            <p className="text-xs text-muted-foreground leading-snug">
              Generic contract — minimal fields, free-form.
            </p>
          )}
        </div>
      </button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">What type of contract?</DialogTitle>
          <DialogDescription>
            Pick the closest match. Each type has its own structured fields.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {renderCard("management_agreement", true)}
          {COMING_SOON.map((t) => renderCard(t, false))}
          {renderCard("other", true)}
        </div>
      </DialogContent>
    </Dialog>
  );
}