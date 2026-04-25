import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { format } from "date-fns";
import { CheckCircle2, Clock, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { getSpecialtiesLabels } from "@/lib/vendors";

interface QuoteContext {
  id: string;
  status: string;
  currency: string;
  amount: number | null;
  eta_days: number | null;
  vendor_notes: string | null;
  expires_at: string;
  request: {
    request_number: string;
    title: string;
    description: string | null;
    category: string;
    priority: string;
    target_label: string;
  };
  vendor: {
    legal_name: string;
    display_name: string | null;
  };
}

export default function PublicQuoteSubmit() {
  const { token } = useParams<{ token: string }>();
  const [ctx, setCtx] = useState<QuoteContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [etaDays, setEtaDays] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    void (async () => {
      if (!token) return;
      setLoading(true);
      const { data: quote, error: qErr } = await supabase
        .from("service_request_quotes")
        .select(
          "id, status, currency, amount, eta_days, vendor_notes, expires_at, request_id, vendor_id",
        )
        .eq("submission_token", token)
        .maybeSingle();
      if (qErr || !quote) {
        setError("This quote link is invalid or has been removed.");
        setLoading(false);
        return;
      }
      const [{ data: req }, { data: vendor }] = await Promise.all([
        supabase
          .from("service_requests")
          .select("request_number, title, description, category, priority, target_type, target_id")
          .eq("id", quote.request_id)
          .maybeSingle(),
        supabase
          .from("vendors")
          .select("legal_name, display_name")
          .eq("id", quote.vendor_id)
          .maybeSingle(),
      ]);
      if (!req || !vendor) {
        setError("This quote could not be loaded.");
        setLoading(false);
        return;
      }

      let targetLabel = "Property";
      if (req.target_type === "unit" && req.target_id) {
        const { data: unit } = await supabase
          .from("units")
          .select("unit_number, buildings(name, city)")
          .eq("id", req.target_id)
          .maybeSingle();
        if (unit) {
          const b = (unit as any).buildings;
          targetLabel = `${b?.name ?? ""} · Unit ${unit.unit_number}${b?.city ? ` · ${b.city}` : ""}`.trim();
        }
      } else if (req.target_type === "building" && req.target_id) {
        const { data: b } = await supabase
          .from("buildings")
          .select("name, city")
          .eq("id", req.target_id)
          .maybeSingle();
        if (b) targetLabel = `${b.name}${b.city ? ` · ${b.city}` : ""}`;
      }

      const c: QuoteContext = {
        id: quote.id,
        status: quote.status,
        currency: quote.currency,
        amount: quote.amount,
        eta_days: quote.eta_days,
        vendor_notes: quote.vendor_notes,
        expires_at: quote.expires_at,
        request: {
          request_number: req.request_number,
          title: req.title,
          description: req.description,
          category: req.category,
          priority: req.priority,
          target_label: targetLabel,
        },
        vendor: {
          legal_name: vendor.legal_name,
          display_name: vendor.display_name,
        },
      };
      setCtx(c);
      if (quote.amount != null) setAmount(String(quote.amount));
      if (quote.eta_days != null) setEtaDays(String(quote.eta_days));
      if (quote.vendor_notes) setNotes(quote.vendor_notes);
      setLoading(false);
    })();
  }, [token]);

  const submit = async () => {
    if (!ctx) return;
    const amountNum = Number(amount);
    const etaNum = Number(etaDays);
    if (!amountNum || amountNum <= 0) {
      toast.error("Please enter a valid price");
      return;
    }
    if (!etaNum || etaNum <= 0) {
      toast.error("Please enter how many days you need");
      return;
    }
    setSubmitting(true);
    const { error: upErr } = await supabase
      .from("service_request_quotes")
      .update({
        amount: amountNum,
        eta_days: etaNum,
        vendor_notes: notes.trim() || null,
        status: "submitted",
        submitted_at: new Date().toISOString(),
      })
      .eq("id", ctx.id);
    if (upErr) {
      toast.error(upErr.message);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    setDone(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="hairline max-w-md w-full">
          <CardContent className="py-10 text-center space-y-2">
            <div className="text-base font-medium text-architect">{error}</div>
            <p className="text-sm text-muted-foreground">
              Please contact the property manager who sent you this link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!ctx) return null;

  const expired = new Date(ctx.expires_at) < new Date();
  const finalised =
    ctx.status === "accepted" || ctx.status === "rejected" || ctx.status === "withdrawn";

  return (
    <div className="min-h-screen bg-muted/20 py-10 px-4">
      <div className="max-w-xl mx-auto space-y-4">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Quote request
          </div>
          <div className="text-lg text-architect mt-1">
            For {ctx.vendor.display_name || ctx.vendor.legal_name}
          </div>
        </div>

        <Card className="hairline">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base">{ctx.request.title}</CardTitle>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                {ctx.request.request_number}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {ctx.request.category.replace(/_/g, " ")} · {ctx.request.priority} priority
            </p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Location
              </div>
              <div className="text-architect">{ctx.request.target_label}</div>
            </div>
            {ctx.request.description && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Details
                </div>
                <p className="text-architect whitespace-pre-wrap">{ctx.request.description}</p>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Quote due by {format(new Date(ctx.expires_at), "d MMM yyyy · HH:mm")}
            </div>
          </CardContent>
        </Card>

        {done || ctx.status === "submitted" ? (
          <Card className="hairline border-status-occupied/40 bg-status-occupied/5">
            <CardContent className="py-8 text-center space-y-2">
              <CheckCircle2 className="h-10 w-10 text-status-occupied mx-auto" strokeWidth={1.5} />
              <div className="text-base font-medium text-architect">
                Your quote has been submitted
              </div>
              <p className="text-sm text-muted-foreground">
                The property manager will review and get back to you. Thank you!
              </p>
              {(amount || ctx.amount) && (
                <div className="text-xs text-muted-foreground pt-2">
                  Submitted: {ctx.currency} {Number(amount || ctx.amount).toLocaleString()} · {etaDays || ctx.eta_days} day{(etaDays || ctx.eta_days) === "1" || ctx.eta_days === 1 ? "" : "s"}
                </div>
              )}
            </CardContent>
          </Card>
        ) : finalised ? (
          <Card className="hairline">
            <CardContent className="py-8 text-center space-y-2">
              <div className="text-base font-medium text-architect">
                This quote request is closed.
              </div>
              <p className="text-sm text-muted-foreground">
                Status: {ctx.status}.
              </p>
            </CardContent>
          </Card>
        ) : expired ? (
          <Card className="hairline border-amber-500/40 bg-amber-500/5">
            <CardContent className="py-8 text-center space-y-2">
              <div className="text-base font-medium text-architect">
                Response window has passed.
              </div>
              <p className="text-sm text-muted-foreground">
                You can still submit, but the manager may have already chosen another vendor.
              </p>
              <Button onClick={submit} disabled={submitting} className="mt-2">
                Submit anyway
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="hairline">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Your quote</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="amount" className="text-xs">
                    Price ({ctx.currency})
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="eta" className="text-xs">
                    ETA (days to complete)
                  </Label>
                  <Input
                    id="eta"
                    type="number"
                    min={1}
                    placeholder="3"
                    value={etaDays}
                    onChange={(e) => setEtaDays(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="notes" className="text-xs">
                  Notes / scope assumptions (optional)
                </Label>
                <Textarea
                  id="notes"
                  rows={4}
                  placeholder="What's included, parts you'll bring, access requirements…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div className="flex justify-end pt-1">
                <Button onClick={submit} disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  Submit quote
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-[10px] text-center text-muted-foreground pt-2">
          This is a one-time link unique to you. Do not share it.
        </p>
      </div>
    </div>
  );
}