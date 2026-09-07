CREATE OR REPLACE FUNCTION public.catalog_guard_definition_term()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Exact definition terms and their source evidence are immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_TABLE_NAME = 'catalog_definition_term' AND NOT EXISTS (
    SELECT 1 FROM public.catalog_definition_revision r
    JOIN public.catalog_definition d ON d.id = r.definition_id
    WHERE r.id = NEW.definition_revision_id AND d.kind IN ('class', 'vocabulary')
  ) THEN
    RAISE EXCEPTION 'Only governed classes and vocabularies designate definition terms' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS catalog_definition_term_guard ON public.catalog_definition_term;
CREATE TRIGGER catalog_definition_term_guard BEFORE INSERT OR UPDATE OR DELETE ON public.catalog_definition_term
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_definition_term();

DROP TRIGGER IF EXISTS catalog_definition_term_support_guard ON public.catalog_definition_term_support;
CREATE TRIGGER catalog_definition_term_support_guard BEFORE UPDATE OR DELETE ON public.catalog_definition_term_support
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_definition_term();
