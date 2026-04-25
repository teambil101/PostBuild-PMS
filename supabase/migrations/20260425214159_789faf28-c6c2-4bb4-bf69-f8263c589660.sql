-- Email categories
CREATE TYPE public.email_category AS ENUM (
  'alert',
  'quote',
  'notice',
  'service_request',
  'work_update',
  'confirmation'
);

-- Brand settings (one row per workspace)
CREATE TABLE public.email_brand_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE,
  logo_url text,
  logo_storage_path text,
  primary_color text NOT NULL DEFAULT '#0F172A',
  accent_color text NOT NULL DEFAULT '#3B82F6',
  background_color text NOT NULL DEFAULT '#F8FAFC',
  text_color text NOT NULL DEFAULT '#0F172A',
  muted_text_color text NOT NULL DEFAULT '#64748B',
  font_family text NOT NULL DEFAULT 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
  heading_font_family text,
  border_radius_px int NOT NULL DEFAULT 12,
  company_name text,
  company_address text,
  footer_text text,
  reply_to_email text,
  from_name text,
  social_website text,
  social_linkedin text,
  social_instagram text,
  social_facebook text,
  social_x text,
  unsubscribe_url text,
  show_unsubscribe boolean NOT NULL DEFAULT true,
  show_powered_by boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_brand_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members access email_brand_settings" ON public.email_brand_settings
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT current_user_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT current_user_workspace_ids()));

CREATE TRIGGER email_brand_settings_updated_at
  BEFORE UPDATE ON public.email_brand_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Templates
CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  category public.email_category NOT NULL,
  template_key text NOT NULL,
  name text NOT NULL,
  description text,
  subject text NOT NULL,
  preheader text,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  plain_text_fallback text,
  available_variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  override_brand boolean NOT NULL DEFAULT false,
  brand_overrides jsonb,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  version int NOT NULL DEFAULT 1,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, template_key)
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members select email_templates" ON public.email_templates
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT current_user_workspace_ids()));

CREATE POLICY "Members insert email_templates" ON public.email_templates
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT current_user_workspace_ids()));

CREATE POLICY "Members update email_templates" ON public.email_templates
  FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT current_user_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT current_user_workspace_ids()));

CREATE POLICY "Members delete non-system email_templates" ON public.email_templates
  FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT current_user_workspace_ids()) AND is_system = false);

CREATE TRIGGER email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_email_templates_workspace_category ON public.email_templates(workspace_id, category);

-- Static attachments stored in 'email-attachments' bucket
CREATE TABLE public.email_template_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.email_templates(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  file_size_bytes bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_template_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members access email_template_attachments" ON public.email_template_attachments
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT current_user_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT current_user_workspace_ids()));

-- Dynamic attachment rules (e.g. attach generated invoice PDF)
CREATE TABLE public.email_template_dynamic_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.email_templates(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  generator_key text NOT NULL,
  filename_pattern text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_template_dynamic_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members access dynamic_attachments" ON public.email_template_dynamic_attachments
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT current_user_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT current_user_workspace_ids()));

-- Send log
CREATE TABLE public.email_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  template_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL,
  template_key text,
  category public.email_category,
  to_email text NOT NULL,
  to_name text,
  cc_emails text[],
  bcc_emails text[],
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  provider_message_id text,
  error_message text,
  context jsonb,
  attachment_count int NOT NULL DEFAULT 0,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members select email_send_log" ON public.email_send_log
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT current_user_workspace_ids()));

CREATE POLICY "Members insert email_send_log" ON public.email_send_log
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT current_user_workspace_ids()));

CREATE INDEX idx_email_send_log_workspace_created ON public.email_send_log(workspace_id, created_at DESC);
CREATE INDEX idx_email_send_log_template ON public.email_send_log(template_id);

-- Storage bucket for email attachments + brand assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-attachments', 'email-attachments', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('email-brand', 'email-brand', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: workspace members can manage their own files
CREATE POLICY "Members read email-attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'email-attachments'
  AND (storage.foldername(name))[1]::uuid IN (SELECT current_user_workspace_ids())
);

CREATE POLICY "Members write email-attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'email-attachments'
  AND (storage.foldername(name))[1]::uuid IN (SELECT current_user_workspace_ids())
);

CREATE POLICY "Members delete email-attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'email-attachments'
  AND (storage.foldername(name))[1]::uuid IN (SELECT current_user_workspace_ids())
);

CREATE POLICY "Public read email-brand"
ON storage.objects FOR SELECT
USING (bucket_id = 'email-brand');

CREATE POLICY "Members write email-brand"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'email-brand'
  AND (storage.foldername(name))[1]::uuid IN (SELECT current_user_workspace_ids())
);

CREATE POLICY "Members update email-brand"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'email-brand'
  AND (storage.foldername(name))[1]::uuid IN (SELECT current_user_workspace_ids())
);

CREATE POLICY "Members delete email-brand"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'email-brand'
  AND (storage.foldername(name))[1]::uuid IN (SELECT current_user_workspace_ids())
);