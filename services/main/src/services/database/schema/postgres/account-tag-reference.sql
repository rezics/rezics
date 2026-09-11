CREATE OR REPLACE FUNCTION public.guard_account_tag_reference()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF public.reference_value_native_id(NEW.target_reference_id) = NEW.tag_id THEN
    RAISE EXCEPTION 'A Tag cannot label itself'
      USING ERRCODE = '23514', CONSTRAINT = 'account_unit_tag_not_self_check';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS account_tag_reference_guard ON public.account_unit_tag;
CREATE TRIGGER account_tag_reference_guard
BEFORE INSERT OR UPDATE OF target_reference_id, tag_id ON public.account_unit_tag
FOR EACH ROW EXECUTE FUNCTION public.guard_account_tag_reference();
