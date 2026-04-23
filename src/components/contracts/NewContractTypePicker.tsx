import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FileText, Home, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const OPTIONS = [
  {
    type: "management_agreement" as const,
    icon: FileText,
    title: "Management Agreement",
    description: "PM company ↔ Landlord. Defines covered properties, fees, included services, and approval rules.",
    available: true,
    href: "/contracts/new/management-agreement",
  },
  {
    type: "lease" as const,
    icon: Home,
    title: "Lease",
    description: "Landlord ↔ Tenant. One unit, period, rent schedule, security deposit, Ejari.",
    available: true,
    href: "/contracts/new/lease",
  },
  {
    type: "vendor_service_agreement" as const,
    icon: Wrench,
    title: "Vendor Service Agreement",
    description: "PM company ↔ Vendor. Covered services, rate card, SLA terms and payment.",
    available: true,
    href: "/contracts/new/vendor-service-agreement",
  },
];

export function NewContractTypePicker({ open, onOpenChange }: Props) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-architect">New Contract</DialogTitle>
          <DialogDescription>Pick the type of contract you want to draft.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 mt-2">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.type}
                type="button"
                disabled={!opt.available}
                onClick={() => {
                  if (!opt.available) return;
                  onOpenChange(false);
                  navigate(opt.href);
                }}
                className={cn(
                  "flex items-start gap-4 text-left p-4 rounded-sm border hairline transition-colors",
                  opt.available
                    ? "hover:border-architect hover:bg-muted/40 cursor-pointer"
                    : "opacity-50 cursor-not-allowed",
                )}
              >
                <div className="h-10 w-10 shrink-0 rounded-sm bg-muted flex items-center justify-center text-architect">
                  <Icon className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-display text-base text-architect">{opt.title}</div>
                    {!opt.available && (
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground border hairline px-1.5 py-0.5 rounded-sm">
                        Soon
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{opt.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}