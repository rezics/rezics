-- Domain-local revision authority. No global content/identity insert is required.
CREATE OR REPLACE FUNCTION public.description_revision_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.payload_state='erased' AND (to_jsonb(NEW)-'payload_state')=(to_jsonb(OLD)-'payload_state') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Description revisions only permit payload erasure' USING ERRCODE='23514';
 END IF;
 IF NEW.parent_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.description_revision WHERE object_id=NEW.object_id AND id=NEW.parent_id) THEN
  RAISE EXCEPTION 'Description parent must already exist for this object' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER description_revision_guard BEFORE INSERT OR UPDATE ON public.description_revision FOR EACH ROW EXECUTE FUNCTION public.description_revision_guard();

CREATE OR REPLACE FUNCTION public.description_selection_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM 1 FROM public.description_object WHERE id=NEW.object_id AND state<>'erased' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Description is unavailable' USING ERRCODE='23514'; END IF;
 PERFORM 1 FROM public.description_revision WHERE object_id=NEW.object_id AND id=NEW.revision_id AND payload_state='available' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Description revision is unavailable' USING ERRCODE='23514'; END IF;
 IF (TG_OP='INSERT' AND NEW.version<>1) OR (TG_OP='UPDATE' AND (NEW.object_id<>OLD.object_id OR NEW.version<>OLD.version+1)) THEN
  RAISE EXCEPTION 'Description selection version must advance exactly once' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER description_selection_guard BEFORE INSERT OR UPDATE ON public.description_selection FOR EACH ROW EXECUTE FUNCTION public.description_selection_guard();
CREATE OR REPLACE TRIGGER description_change_immutable BEFORE UPDATE OR DELETE ON public.description_change FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER description_statement_immutable BEFORE UPDATE ON public.description_statement FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER description_type_immutable BEFORE UPDATE ON public.description_type FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();

CREATE OR REPLACE FUNCTION public.wiki_revision_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.parent_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.wiki_revision WHERE page_id=NEW.page_id AND id=NEW.parent_id AND language=NEW.language) THEN
  RAISE EXCEPTION 'Wiki parent must already exist in this page and language' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER wiki_revision_parent BEFORE INSERT ON public.wiki_revision FOR EACH ROW EXECUTE FUNCTION public.wiki_revision_guard();
CREATE OR REPLACE TRIGGER wiki_revision_immutable BEFORE UPDATE ON public.wiki_revision FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER wiki_payload_immutable BEFORE UPDATE ON public.wiki_revision_payload FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();

CREATE OR REPLACE FUNCTION public.wiki_selection_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM 1 FROM public.wiki_page WHERE id=NEW.page_id AND state<>'erased' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Wiki page is unavailable' USING ERRCODE='23514'; END IF;
 PERFORM 1 FROM public.wiki_revision_payload WHERE page_id=NEW.page_id AND revision_id=NEW.revision_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Wiki payload is unavailable' USING ERRCODE='23514'; END IF;
 IF (TG_OP='INSERT' AND NEW.version<>1) OR (TG_OP='UPDATE' AND (NEW.page_id<>OLD.page_id OR NEW.language<>OLD.language OR NEW.version<>OLD.version+1)) THEN
  RAISE EXCEPTION 'Wiki selection version must advance exactly once' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER wiki_head_guard BEFORE INSERT OR UPDATE ON public.wiki_head FOR EACH ROW EXECUTE FUNCTION public.wiki_selection_guard();
CREATE OR REPLACE TRIGGER wiki_selection_guard BEFORE INSERT OR UPDATE ON public.wiki_selection FOR EACH ROW EXECUTE FUNCTION public.wiki_selection_guard();
