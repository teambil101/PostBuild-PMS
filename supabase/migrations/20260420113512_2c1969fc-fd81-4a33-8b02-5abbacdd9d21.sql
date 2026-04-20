ALTER TABLE public.documents DROP CONSTRAINT documents_entity_type_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_entity_type_check CHECK (entity_type = ANY (ARRAY['building'::text, 'unit'::text, 'contract'::text]));

ALTER TABLE public.photos DROP CONSTRAINT IF EXISTS photos_entity_type_check;
ALTER TABLE public.photos ADD CONSTRAINT photos_entity_type_check CHECK (entity_type = ANY (ARRAY['building'::text, 'unit'::text, 'contract'::text]));