import { useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CompanyProfileForm } from "@/components/settings/CompanyProfileForm";
import { Building2, Loader2 } from "lucide-react";

/**
 * Gates the contracts module. If no self-person is configured yet,
 * renders the onboarding screen instead of the children.
 */
export function CompanyProfileGate({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("self_person_id")
        .maybeSingle();
      setNeedsSetup(!data?.self_person_id);
      setLoading(false);
    })();
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (needsSetup) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="border hairline rounded-sm bg-card p-8 md:p-10">
          <div className="flex items-start gap-4 mb-6 pb-6 border-b hairline">
            <div className="h-12 w-12 rounded-sm bg-architect text-chalk flex items-center justify-center shrink-0">
              <Building2 className="h-6 w-6" strokeWidth={1.4} />
            </div>
            <div className="space-y-1">
              <div className="label-eyebrow">First-run setup</div>
              <h1 className="font-display text-3xl text-architect leading-tight">
                Set up your company profile
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
                This is the entity that will appear as the service provider on every management
                agreement, service agreement, and brokerage agreement you issue. You can edit
                these details anytime from Settings → Company Profile.
              </p>
            </div>
          </div>
          <CompanyProfileForm embedded onSaved={() => setRefreshKey((k) => k + 1)} />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}