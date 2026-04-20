-- ===== Make property-photos bucket private =====
UPDATE storage.buckets SET public = false WHERE id = 'property-photos';

-- ===== PHOTOS table =====
CREATE TABLE public.photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('building', 'unit')),
  entity_id uuid NOT NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  file_size_bytes bigint NOT NULL,
  mime_type text NOT NULL,
  caption text,
  is_cover boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_photos_entity ON public.photos (entity_type, entity_id, sort_order);
-- Only one cover per entity
CREATE UNIQUE INDEX idx_photos_one_cover_per_entity
  ON public.photos (entity_type, entity_id) WHERE is_cover;

ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view photos"
  ON public.photos FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid()));

CREATE POLICY "Staff/admin can insert photos"
  ON public.photos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Staff/admin can update photos"
  ON public.photos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Admin can delete photos"
  ON public.photos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- ===== DOCUMENTS table (new, separate from legacy property_documents) =====
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('building', 'unit')),
  entity_id uuid NOT NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  file_size_bytes bigint NOT NULL,
  mime_type text NOT NULL,
  doc_type text NOT NULL DEFAULT 'other'
    CHECK (doc_type IN ('title_deed','floor_plan','inspection_report','handover_report','ejari','dewa','noc','contract','invoice','other')),
  title text,
  notes text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_documents_entity ON public.documents (entity_type, entity_id, doc_type);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view documents"
  ON public.documents FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid()));

CREATE POLICY "Staff/admin can insert documents"
  ON public.documents FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Staff/admin can update documents"
  ON public.documents FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Admin can delete documents"
  ON public.documents FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- ===== NOTES table =====
CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('building', 'unit')),
  entity_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(body) <= 4000 AND char_length(body) > 0),
  author_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);
CREATE INDEX idx_notes_entity ON public.notes (entity_type, entity_id, created_at DESC);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view notes"
  ON public.notes FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid()));

CREATE POLICY "Staff/admin can insert notes"
  ON public.notes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Authors or admins can update notes"
  ON public.notes FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authors or admins can delete notes"
  ON public.notes FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Auto-update updated_at on notes
CREATE TRIGGER notes_set_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== UNIT_STATUS_HISTORY table (new richer history table — optional reason) =====
-- Note: legacy `property_status_history` already exists; we keep it but add a richer table for the new UI.
CREATE TABLE public.unit_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  old_status public.property_status,
  new_status public.property_status NOT NULL,
  reason text,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_unit_status_history_unit ON public.unit_status_history (unit_id, changed_at DESC);

ALTER TABLE public.unit_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view unit status history"
  ON public.unit_status_history FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid()));

CREATE POLICY "Staff/admin can insert unit status history"
  ON public.unit_status_history FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- ===== STORAGE policies for property-photos (now private) and property-docs =====
-- Drop any existing policies on these buckets first to avoid conflicts
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname IN (
        'Property photos viewable',
        'Property photos staff insert',
        'Property photos staff update',
        'Property photos staff delete',
        'Property docs viewable',
        'Property docs staff insert',
        'Property docs staff update',
        'Property docs staff delete'
      )
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Property photos viewable"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'property-photos' AND public.has_any_role(auth.uid()));

CREATE POLICY "Property photos staff insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'property-photos'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')));

CREATE POLICY "Property photos staff update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'property-photos'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')));

CREATE POLICY "Property photos staff delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'property-photos'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')));

CREATE POLICY "Property docs viewable"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'property-docs' AND public.has_any_role(auth.uid()));

CREATE POLICY "Property docs staff insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'property-docs'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')));

CREATE POLICY "Property docs staff update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'property-docs'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')));

CREATE POLICY "Property docs staff delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'property-docs'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')));