CREATE OR REPLACE FUNCTION public.catalog_check_music_source_baseline()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE native public.music_component_revision%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.source_record_id, OLD.mapping_key, OLD.owner_id, OLD.component, OLD.component_key)
    IS DISTINCT FROM (NEW.source_record_id, NEW.mapping_key, NEW.owner_id, NEW.component, NEW.component_key) THEN
    RAISE EXCEPTION 'Music source baseline identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.music_component_source_occurrence
    WHERE source_record_id=NEW.source_record_id AND snapshot_id=NEW.snapshot_id AND owner_id=NEW.owner_id
      AND component=NEW.component AND component_key=NEW.component_key AND source_path=NEW.source_path AND history_id=NEW.source_history_id) THEN
    RAISE EXCEPTION 'Music source baseline requires exact original source support' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO STRICT native FROM public.music_component_revision WHERE owner_id=NEW.owner_id AND id=NEW.current_history_id;
  IF native.component <> NEW.component OR native.component_key <> NEW.component_key OR (native.operation='DELETE') <> NEW.absent THEN
    RAISE EXCEPTION 'Music source baseline current component differs' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.music_source_application_change change
    JOIN public.catalog_source_adoption_proposal proposal ON proposal.source_record_id=change.source_record_id AND proposal.id=change.proposal_id
    WHERE change.source_record_id=NEW.source_record_id AND change.proposal_id=NEW.proposal_id AND change.action=NEW.action
      AND proposal.mapping_key=NEW.mapping_key AND change.owner_id=NEW.owner_id AND change.component=NEW.component
      AND change.component_key=NEW.component_key AND change.after_revision_id=NEW.current_history_id) THEN
    RAISE EXCEPTION 'Music source baseline requires exact native application proof' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS music_source_baseline_proof ON public.music_component_source_baseline;
CREATE TRIGGER music_source_baseline_proof BEFORE INSERT OR UPDATE ON public.music_component_source_baseline
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_source_baseline();
