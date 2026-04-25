import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import type { EmailBlock } from "@/lib/email-blocks";
import { SEED_TEMPLATES, type EmailCategory } from "@/lib/email-blocks";

export interface EmailTemplateRow {
  id: string;
  workspace_id: string;
  category: EmailCategory;
  template_key: string;
  name: string;
  description: string | null;
  subject: string;
  preheader: string | null;
  blocks: EmailBlock[];
  plain_text_fallback: string | null;
  available_variables: string[];
  override_brand: boolean;
  brand_overrides: Record<string, unknown> | null;
  is_system: boolean;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export function useEmailTemplates() {
  const { activeWorkspace } = useWorkspace();
  const wsId = activeWorkspace?.id;
  const qc = useQueryClient();

  return useQuery({
    enabled: !!wsId,
    queryKey: ["email_templates", wsId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .eq("workspace_id", wsId!)
        .order("category")
        .order("name");
      if (error) throw error;

      const rows = (data ?? []) as EmailTemplateRow[];
      const existingKeys = new Set(rows.map((r) => r.template_key));
      const missing = SEED_TEMPLATES.filter((s) => !existingKeys.has(s.template_key));

      if (missing.length > 0) {
        const inserts = missing.map((s) => ({
          workspace_id: wsId!,
          category: s.category,
          template_key: s.template_key,
          name: s.name,
          description: s.description,
          subject: s.subject,
          preheader: s.preheader,
          blocks: s.blocks as never,
          available_variables: s.available_variables,
          is_system: true,
        }));
        const { error: insErr } = await supabase.from("email_templates").insert(inserts as never);
        if (!insErr) {
          qc.invalidateQueries({ queryKey: ["email_templates", wsId] });
        }
      }
      return rows;
    },
  });
}

export function useUpdateEmailTemplate() {
  const { activeWorkspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<EmailTemplateRow> }) => {
      const { data, error } = await supabase
        .from("email_templates")
        .update(patch as never)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email_templates", activeWorkspace?.id] }),
  });
}

export function useResetEmailTemplate() {
  const { activeWorkspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (template_key: string) => {
      const seed = SEED_TEMPLATES.find((s) => s.template_key === template_key);
      if (!seed) throw new Error("No seed template found for " + template_key);
      const { error } = await supabase
        .from("email_templates")
        .update({
          subject: seed.subject,
          preheader: seed.preheader,
          blocks: seed.blocks as never,
          available_variables: seed.available_variables,
          override_brand: false,
          brand_overrides: null,
        } as never)
        .eq("workspace_id", activeWorkspace!.id)
        .eq("template_key", template_key);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email_templates", activeWorkspace?.id] }),
  });
}