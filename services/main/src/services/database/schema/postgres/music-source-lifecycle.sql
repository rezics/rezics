CREATE OR REPLACE FUNCTION public.catalog_guard_music_component_head()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP='DELETE' OR pg_trigger_depth()<2 THEN
    RAISE EXCEPTION 'Music component heads are maintained by native history capture' USING ERRCODE='23514';
  END IF;
  IF TG_OP='INSERT' AND NEW.component_sequence<>1 THEN
    RAISE EXCEPTION 'Music component history must start at sequence one' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' AND ((OLD.owner_id,OLD.component,OLD.component_key) IS DISTINCT FROM (NEW.owner_id,NEW.component,NEW.component_key)
    OR NEW.component_sequence<>OLD.component_sequence+1) THEN
    RAISE EXCEPTION 'Music component sequence must advance exactly once' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.music_component_revision WHERE owner_id=NEW.owner_id AND id=NEW.history_id
    AND component=NEW.component AND component_key=NEW.component_key AND component_sequence=NEW.component_sequence) THEN
    RAISE EXCEPTION 'Music component head requires its exact immutable revision' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS music_component_head_maintained ON public.music_component_head;
CREATE TRIGGER music_component_head_maintained BEFORE INSERT OR UPDATE OR DELETE ON public.music_component_head
  FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_music_component_head();

CREATE OR REPLACE FUNCTION public.catalog_guard_music_revision_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF pg_trigger_depth()<2 THEN
    RAISE EXCEPTION 'Music history is captured from native rows, not caller-supplied snapshots' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS music_component_revision_capture_only ON public.music_component_revision;
CREATE TRIGGER music_component_revision_capture_only BEFORE INSERT ON public.music_component_revision
  FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_music_revision_insert();

CREATE OR REPLACE FUNCTION public.catalog_check_music_source_baseline()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE native public.music_component_revision%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.source_record_id, OLD.mapping_key, OLD.correspondence_revision, OLD.owner_id, OLD.component, OLD.component_key)
    IS DISTINCT FROM (NEW.source_record_id, NEW.mapping_key, NEW.correspondence_revision, NEW.owner_id, NEW.component, NEW.component_key) THEN
    RAISE EXCEPTION 'Music source baseline identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.music_component_source_occurrence
    WHERE source_record_id=NEW.source_record_id AND mapping_key=NEW.mapping_key AND correspondence_revision=NEW.correspondence_revision AND snapshot_id=NEW.snapshot_id AND owner_id=NEW.owner_id
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
  IF NOT public.catalog_source_application_includes_epoch(NEW.source_record_id,NEW.proposal_id,NEW.mapping_key,NEW.correspondence_revision) OR NOT EXISTS (
    SELECT 1 FROM public.catalog_source_binding_revision r WHERE r.source_record_id=NEW.source_record_id AND r.mapping_key=NEW.mapping_key AND r.revision=NEW.correspondence_revision AND r.owner=NEW.mapping_owner)
  THEN RAISE EXCEPTION 'Music baseline requires its proposal owner correspondence epoch' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.music_component_head h WHERE h.owner_id=NEW.owner_id AND h.component=NEW.component AND h.component_key=NEW.component_key AND h.history_id=NEW.current_history_id)
  THEN RAISE EXCEPTION 'Music baseline must identify its exact current native head' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS music_source_baseline_proof ON public.music_component_source_baseline;
CREATE TRIGGER music_source_baseline_proof BEFORE INSERT OR UPDATE ON public.music_component_source_baseline
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_source_baseline();

-- Shared alternate text/credit values are replaced through exact occurrence revisions.
DROP TRIGGER IF EXISTS music_alternative_track_immutable ON public.music_alternative_track;
CREATE TRIGGER music_alternative_track_immutable BEFORE UPDATE OR DELETE ON public.music_alternative_track
  FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_music_history();

CREATE OR REPLACE FUNCTION public.catalog_check_music_definition_scope()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE revision_id uuid; policy jsonb;
BEGIN
  revision_id := (to_jsonb(NEW)->>TG_ARGV[0])::uuid;
  IF revision_id IS NULL THEN RETURN NEW; END IF;
  SELECT revision.constraints INTO policy FROM public.catalog_definition_revision revision
    JOIN public.catalog_definition definition ON definition.id=revision.definition_id
    WHERE revision.id=revision_id AND definition.kind='vocabulary';
  IF policy IS NULL OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(policy->'targets','[]'::jsonb)) target
    WHERE target->>'owner'='music' AND coalesce(target->'shapes','[]'::jsonb) ? TG_ARGV[1])
    OR NOT (coalesce(policy->'slots','[]'::jsonb) ? TG_ARGV[2]) THEN
    RAISE EXCEPTION 'Music vocabulary is outside its governed native target or slot'
      USING ERRCODE='23514', CONSTRAINT='music_definition_target_scope';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS music_release_status_scope ON public.music_release;
CREATE TRIGGER music_release_status_scope BEFORE INSERT OR UPDATE ON public.music_release
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_definition_scope('status_revision_id','release','music_release.status_revision_id');
DROP TRIGGER IF EXISTS music_release_packaging_scope ON public.music_release;
CREATE TRIGGER music_release_packaging_scope BEFORE INSERT OR UPDATE ON public.music_release
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_definition_scope('packaging_revision_id','release','music_release.packaging_revision_id');
DROP TRIGGER IF EXISTS music_medium_format_scope ON public.music_medium;
CREATE TRIGGER music_medium_format_scope BEFORE INSERT OR UPDATE ON public.music_medium
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_definition_scope('format_revision_id','release','music_medium.format_revision_id');
DROP TRIGGER IF EXISTS music_work_type_scope ON public.music_work;
CREATE TRIGGER music_work_type_scope BEFORE INSERT OR UPDATE ON public.music_work
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_definition_scope('type_revision_id','work','music_work.type_revision_id');
DROP TRIGGER IF EXISTS music_release_group_primary_scope ON public.music_release_group;
CREATE TRIGGER music_release_group_primary_scope BEFORE INSERT OR UPDATE ON public.music_release_group
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_definition_scope('primary_type_revision_id','release_group','music_release_group.primary_type_revision_id');
DROP TRIGGER IF EXISTS music_release_group_secondary_scope ON public.music_release_group_secondary_type;
CREATE TRIGGER music_release_group_secondary_scope BEFORE INSERT OR UPDATE ON public.music_release_group_secondary_type
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_definition_scope('type_revision_id','release_group','music_release_group_secondary_type.type_revision_id');
DROP TRIGGER IF EXISTS music_release_presentation_type_scope ON public.music_release_presentation;
CREATE TRIGGER music_release_presentation_type_scope BEFORE INSERT OR UPDATE ON public.music_release_presentation
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_definition_scope('type_revision_id','release','music_release_presentation.type_revision_id');
