-- Filter the marketplace catalog by what's actually deliverable in the workspace's cities.
CREATE OR REPLACE FUNCTION public.list_marketplace_catalog_for_workspace(_workspace_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  category text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _has_buildings boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.buildings b WHERE b.workspace_id = _workspace_id
  ) INTO _has_buildings;

  IF NOT _has_buildings THEN
    -- First-time owners with no properties yet: show the full marketplace
    -- so the page isn't empty. The request dialog already blocks submission
    -- until a property exists.
    RETURN QUERY
      SELECT sc.id, sc.name, sc.description, sc.category::text
      FROM public.service_catalog sc
      WHERE sc.is_marketplace = true
        AND sc.is_active = true
      ORDER BY sc.category, sc.name;
    RETURN;
  END IF;

  RETURN QUERY
    SELECT DISTINCT sc.id, sc.name, sc.description, sc.category::text
    FROM public.service_catalog sc
    WHERE sc.is_marketplace = true
      AND sc.is_active = true
      AND EXISTS (
        SELECT 1
        FROM public.vendor_services vs
        JOIN public.buildings b ON b.workspace_id = _workspace_id
        WHERE vs.catalog_id = sc.id
          AND vs.is_active = true
          AND (
            vs.service_area_all_cities = true
            OR b.city = ANY (vs.service_area_cities)
          )
      )
    ORDER BY sc.category, sc.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_marketplace_catalog_for_workspace(uuid) TO authenticated;