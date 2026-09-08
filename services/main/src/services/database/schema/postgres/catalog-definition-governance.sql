CREATE OR REPLACE FUNCTION public.catalog_definition_review_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP <> 'INSERT' THEN
  RAISE EXCEPTION 'Definition review is immutable' USING ERRCODE='55000';
 END IF;
 PERFORM 1 FROM public.platform_capability_grant g
 WHERE g.id=NEW.grant_id AND g.auth_user_id=NEW.auth_user_id
 AND g.capability='catalog.definition.manage' AND g.revoked_at IS NULL
 AND (g.expires_at IS NULL OR g.expires_at>clock_timestamp()) FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Definition review requires its current exact platform grant' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS catalog_definition_review_guard_trigger ON public.catalog_definition_review;
CREATE TRIGGER catalog_definition_review_guard_trigger BEFORE INSERT OR UPDATE OR DELETE ON public.catalog_definition_review
FOR EACH ROW EXECUTE FUNCTION public.catalog_definition_review_guard();
DROP TRIGGER IF EXISTS catalog_definition_label_immutable ON public.catalog_definition_label;
CREATE TRIGGER catalog_definition_label_immutable BEFORE UPDATE OR DELETE ON public.catalog_definition_label
FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();
