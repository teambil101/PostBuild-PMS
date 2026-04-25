import { Link } from "react-router-dom";
import { Scale, AlertTriangle, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Where the marketplace lives — owners go to /owner/services, brokers to /services */
  servicesHref?: string;
}

/**
 * Plain-English overview of what a UAE landlord can do when rent is late.
 * This is informational only — for the actual filing the user is pushed to
 * the services marketplace.
 */
export function LegalOptionsDialog({ open, onOpenChange, servicesHref = "/owner/services" }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-architect" strokeWidth={1.5} />
            <DialogTitle className="font-display text-2xl">Your options when rent is late</DialogTitle>
          </div>
          <DialogDescription>
            A short, plain-English guide. Not legal advice — for any filing, use a qualified service through our marketplace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2 text-sm">
          <Step
            n={1}
            title="Send a friendly reminder (Day 1–7)"
            body="A simple message or call. Most late payments are resolved here — bank delays, cheque bounces, forgotten transfers. Keep proof of contact."
          />
          <Step
            n={2}
            title="Send a formal demand letter (Day 8–14)"
            body="A written notice giving the tenant a final deadline (usually 7 days) before legal escalation. We can draft and notarize one for you."
          />
          <Step
            n={3}
            title="Notarized eviction notice (Day 15–30)"
            body="Under UAE Law No. 26 of 2007 (and Dubai Law No. 33 of 2008, Article 25), if a tenant fails to pay rent within 30 days of a notarized notice, the landlord may seek eviction through the Rental Dispute Centre."
          />
          <Step
            n={4}
            title="File at the Rental Dispute Centre (Day 30+)"
            body="A formal case at the RDC. Outcome is usually a payment order, eviction order, or both. Filing fees are typically 3.5% of annual rent (capped). Hearings are conducted in Arabic — translation and representation matter."
          />

          <div className="border hairline rounded-sm bg-muted/30 p-3 flex gap-3">
            <AlertTriangle className="h-4 w-4 text-gold shrink-0 mt-0.5" strokeWidth={1.8} />
            <div className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-architect">Important:</strong> Eviction laws and timelines differ across emirates and free zones. Always confirm with a licensed legal service before serving notices — the wrong format restarts the clock.
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button asChild>
            <Link to={servicesHref} onClick={() => onOpenChange(false)}>
              Browse legal services
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-7 h-7 rounded-full bg-architect text-chalk flex items-center justify-center text-xs font-display">
        {n}
      </div>
      <div>
        <div className="font-display text-base text-architect">{title}</div>
        <p className="text-muted-foreground mt-0.5 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}