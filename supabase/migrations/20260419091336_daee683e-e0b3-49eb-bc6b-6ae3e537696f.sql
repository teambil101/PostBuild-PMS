-- ============= ROLES =============
CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'viewer');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id) $$;

CREATE POLICY "Users can read their own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============= UTILS =============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Auto-assign first signup as admin, others as viewer
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_count INT;
BEGIN
  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============= ENUMS =============
CREATE TYPE public.property_status AS ENUM ('vacant', 'occupied', 'maintenance', 'off_market');
CREATE TYPE public.unit_type AS ENUM ('studio', 'apartment', 'house', 'office', 'retail', 'storage', 'other');
CREATE TYPE public.person_role AS ENUM ('tenant', 'owner', 'prospect', 'staff', 'vendor');

-- ============= BUILDINGS =============
CREATE TABLE public.buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  year_built INT,
  total_floors INT,
  cover_image_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER buildings_updated_at BEFORE UPDATE ON public.buildings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Auth users can view buildings" ON public.buildings FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "Staff/admin can insert buildings" ON public.buildings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "Staff/admin can update buildings" ON public.buildings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "Admin can delete buildings" ON public.buildings FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ============= UNITS =============
CREATE TABLE public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  ref_code TEXT NOT NULL UNIQUE,
  unit_number TEXT NOT NULL,
  unit_type public.unit_type NOT NULL DEFAULT 'apartment',
  status public.property_status NOT NULL DEFAULT 'vacant',
  floor INT,
  size_sqm NUMERIC(10, 2),
  bedrooms INT,
  bathrooms NUMERIC(3, 1),
  monthly_rent NUMERIC(12, 2),
  description TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_units_building ON public.units(building_id);
CREATE INDEX idx_units_status ON public.units(status);
CREATE TRIGGER units_updated_at BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Auth users can view units" ON public.units FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "Staff/admin can insert units" ON public.units FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "Staff/admin can update units" ON public.units FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "Admin can delete units" ON public.units FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ============= PROPERTY STATUS HISTORY =============
CREATE TABLE public.property_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  old_status public.property_status,
  new_status public.property_status NOT NULL,
  note TEXT,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.property_status_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_status_hist_unit ON public.property_status_history(unit_id);

CREATE POLICY "Auth users can view status history" ON public.property_status_history FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "Staff/admin can insert status history" ON public.property_status_history FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

-- Auto-record status changes
CREATE OR REPLACE FUNCTION public.record_unit_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.property_status_history (unit_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO public.property_status_history (unit_id, old_status, new_status, changed_by)
    VALUES (NEW.id, NULL, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER units_status_history AFTER INSERT OR UPDATE OF status ON public.units
FOR EACH ROW EXECUTE FUNCTION public.record_unit_status_change();

-- ============= PROPERTY DOCUMENTS =============
CREATE TABLE public.property_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID REFERENCES public.buildings(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  is_image BOOLEAN NOT NULL DEFAULT false,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (building_id IS NOT NULL OR unit_id IS NOT NULL)
);
ALTER TABLE public.property_documents ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_propdocs_building ON public.property_documents(building_id);
CREATE INDEX idx_propdocs_unit ON public.property_documents(unit_id);

CREATE POLICY "Auth users can view property docs" ON public.property_documents FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "Staff/admin can insert property docs" ON public.property_documents FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "Staff/admin can delete property docs" ON public.property_documents FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

-- ============= PEOPLE =============
CREATE TABLE public.people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_code TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  roles public.person_role[] NOT NULL DEFAULT '{}',
  company TEXT,
  address TEXT,
  city TEXT,
  country TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  avatar_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_people_roles ON public.people USING GIN(roles);
CREATE TRIGGER people_updated_at BEFORE UPDATE ON public.people FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Auth users can view people" ON public.people FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "Staff/admin can insert people" ON public.people FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "Staff/admin can update people" ON public.people FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "Admin can delete people" ON public.people FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ============= PEOPLE PROPERTY LINKS =============
CREATE TABLE public.people_property_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  building_id UUID REFERENCES public.buildings(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (building_id IS NOT NULL OR unit_id IS NOT NULL)
);
ALTER TABLE public.people_property_links ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_ppl_person ON public.people_property_links(person_id);
CREATE INDEX idx_ppl_unit ON public.people_property_links(unit_id);

CREATE POLICY "Auth users can view links" ON public.people_property_links FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "Staff/admin can insert links" ON public.people_property_links FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "Staff/admin can update links" ON public.people_property_links FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "Staff/admin can delete links" ON public.people_property_links FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

-- ============= PEOPLE DOCUMENTS =============
CREATE TABLE public.people_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.people_documents ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_peopledocs_person ON public.people_documents(person_id);

CREATE POLICY "Auth users can view people docs" ON public.people_documents FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "Staff/admin can insert people docs" ON public.people_documents FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "Staff/admin can delete people docs" ON public.people_documents FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

-- ============= STORAGE BUCKETS =============
INSERT INTO storage.buckets (id, name, public) VALUES ('property-photos', 'property-photos', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('property-docs', 'property-docs', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('people-docs', 'people-docs', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;

-- Property photos: public read, staff/admin write
CREATE POLICY "Public can view property photos" ON storage.objects FOR SELECT USING (bucket_id = 'property-photos');
CREATE POLICY "Staff can upload property photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'property-photos' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')));
CREATE POLICY "Staff can delete property photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'property-photos' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')));

-- Property docs: auth read, staff/admin write
CREATE POLICY "Auth can view property docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'property-docs' AND public.has_any_role(auth.uid()));
CREATE POLICY "Staff can upload property docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'property-docs' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')));
CREATE POLICY "Staff can delete property docs" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'property-docs' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')));

-- People docs: auth read, staff/admin write
CREATE POLICY "Auth can view people docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'people-docs' AND public.has_any_role(auth.uid()));
CREATE POLICY "Staff can upload people docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'people-docs' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')));
CREATE POLICY "Staff can delete people docs" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'people-docs' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')));

-- Avatars: public read, staff write
CREATE POLICY "Public can view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Staff can upload avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')));
CREATE POLICY "Staff can delete avatars" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')));