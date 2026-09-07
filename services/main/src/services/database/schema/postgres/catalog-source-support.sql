CREATE OR REPLACE FUNCTION public.catalog_guard_source_support()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Source occurrence history cannot be deleted' USING ERRCODE = '23514';
  END IF;
  IF (to_jsonb(NEW) - 'withdrawn_at') IS DISTINCT FROM (to_jsonb(OLD) - 'withdrawn_at')
    OR (OLD.withdrawn_at IS NOT NULL AND NEW.withdrawn_at IS DISTINCT FROM OLD.withdrawn_at) THEN
    RAISE EXCEPTION 'Source occurrence target, revision, epoch and evidence are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE owner_name text;
BEGIN
  FOREACH owner_name IN ARRAY ARRAY['publishing','music','program','software','entity','grouping','reference','distribution'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_source_support_guard ON public.%I', owner_name || '_fact_support');
    EXECUTE format('CREATE TRIGGER catalog_source_support_guard BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_source_support()', owner_name || '_fact_support');
  END LOOP;
END $$;
