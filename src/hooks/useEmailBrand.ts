import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import type { BrandTokens } from "@/lib/email-blocks";
import { DEFAULT_BRAND } from "@/lib/email-blocks";

export interface EmailBrandRow {
  id: string;
  workspace_id: string;
  logo_url: string | null;
  logo_storage_path: string | null;
  primary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;
  muted_text_color: string;
  font_family: string;
  heading_font_family: string | null;
  border_radius_px: number;
  company_name: string | null;
  company_address: string | null;
  footer_text: string | null;
  reply_to_email: string | null;
  from_name: string | null;
  social_website: string | null;
  social_linkedin: string | null;
  social_instagram: string | null;
  social_facebook: string | null;
  social_x: string | null;
  unsubscribe_url: string | null;
  show_unsubscribe: boolean;
  show_powered_by: boolean;
}

export function rowToBrand(row: EmailBrandRow | null): BrandTokens {
  if (!row) return DEFAULT_BRAND;
  return {
    primary: row.primary_color,
    accent: row.accent_color,
    background: row.background_color,
    text: row.text_color,
    mutedText: row.muted_text_color,
    fontFamily: row.font_family,
    headingFontFamily: row.heading_font_family,
    borderRadiusPx: row.border_radius_px,
    logoUrl: row.logo_url,
    companyName: row.company_name,
    companyAddress: row.company_address,
    footerText: row.footer_text,
    socialWebsite: row.social_website,
    socialLinkedin: row.social_linkedin,
    socialInstagram: row.social_instagram,
    socialFacebook: row.social_facebook,
    socialX: row.social_x,
    unsubscribeUrl: row.unsubscribe_url,
    showUnsubscribe: row.show_unsubscribe,
    showPoweredBy: row.show_powered_by,
  };
}

export function useEmailBrand() {
  const { activeWorkspace } = useWorkspace();
  const wsId = activeWorkspace?.id;

  return useQuery({
    enabled: !!wsId,
    queryKey: ["email_brand", wsId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_brand_settings")
        .select("*")
        .eq("workspace_id", wsId!)
        .maybeSingle();
      if (error) throw error;
      return data as EmailBrandRow | null;
    },
  });
}

export function useUpsertEmailBrand() {
  const { activeWorkspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<EmailBrandRow>) => {
      if (!activeWorkspace) throw new Error("No workspace");
      const { data, error } = await supabase
        .from("email_brand_settings")
        .upsert({ workspace_id: activeWorkspace.id, ...patch }, { onConflict: "workspace_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email_brand", activeWorkspace?.id] });
    },
  });
}