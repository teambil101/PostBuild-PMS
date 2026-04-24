-- Customer feedback table for service requests
CREATE TABLE public.service_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id uuid NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  submitted_by_person_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  -- Denormalized assignee snapshot (populated by trigger from parent request)
  assigned_person_id uuid,
  assigned_vendor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One feedback per request
CREATE UNIQUE INDEX service_feedback_request_unique
  ON public.service_feedback(service_request_id);

-- Helpful indexes for leaderboards
CREATE INDEX service_feedback_assigned_person_idx
  ON public.service_feedback(assigned_person_id) WHERE assigned_person_id IS NOT NULL;
CREATE INDEX service_feedback_assigned_vendor_idx
  ON public.service_feedback(assigned_vendor_id) WHERE assigned_vendor_id IS NOT NULL;
CREATE INDEX service_feedback_submitted_at_idx
  ON public.service_feedback(submitted_at DESC);

-- Trigger: copy assigned_person_id / assigned_vendor_id from parent service_request
CREATE OR REPLACE FUNCTION public.service_feedback_copy_assignees()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT assigned_person_id, assigned_vendor_id
    INTO NEW.assigned_person_id, NEW.assigned_vendor_id
  FROM public.service_requests
  WHERE id = NEW.service_request_id;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER service_feedback_copy_assignees_trg
  BEFORE INSERT OR UPDATE OF service_request_id ON public.service_feedback
  FOR EACH ROW EXECUTE FUNCTION public.service_feedback_copy_assignees();

-- Updated-at maintenance
CREATE TRIGGER service_feedback_set_updated_at
  BEFORE UPDATE ON public.service_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.service_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view service_feedback"
  ON public.service_feedback FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert service_feedback"
  ON public.service_feedback FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update service_feedback"
  ON public.service_feedback FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete service_feedback"
  ON public.service_feedback FOR DELETE TO authenticated USING (true);
