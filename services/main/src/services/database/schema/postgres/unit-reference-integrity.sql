CREATE OR REPLACE FUNCTION public.unit_publish_platform_route()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE ready boolean; affected integer;
BEGIN
  SELECT c.ready INTO ready FROM public.catalog_routing_control c WHERE singleton FOR SHARE;
  IF ready IS DISTINCT FROM true THEN RAISE EXCEPTION 'Identity routing is fenced for repair' USING ERRCODE='55000'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('catalog-identity:' || NEW.id::text,0));
  IF TG_OP='UPDATE' AND (NEW.id<>OLD.id OR NEW.routing_generation<OLD.routing_generation) THEN RAISE EXCEPTION 'Unit identity or routing generation cannot move backwards' USING ERRCODE='23514'; END IF;
  INSERT INTO public.catalog_unit_locator(id,owner,generation) VALUES(NEW.id,TG_ARGV[0],NEW.routing_generation)
    ON CONFLICT(id) DO UPDATE SET generation=EXCLUDED.generation WHERE catalog_unit_locator.owner=EXCLUDED.owner AND catalog_unit_locator.generation<=EXCLUDED.generation;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION 'Identity belongs to another physical owner' USING ERRCODE='23505'; END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.unit_remove_platform_route()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  DELETE FROM public.catalog_unit_locator WHERE id=OLD.id AND owner=TG_ARGV[0] AND generation=OLD.routing_generation;
  RETURN OLD;
END $$;

/** Resolve a logical input ID once; concrete FKs and the row check remain the persisted authority. */
CREATE OR REPLACE FUNCTION public.unit_populate_reference()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE value jsonb; previous jsonb; reference_patch jsonb:='{}'; raw_id uuid; selected_owner text; owner_name text; column_name text;
  present_count integer:=0; supplied_owner text; supplied_id uuid; routing_ready boolean; alternatives_unchanged boolean:=true;
  owners text[]:=ARRAY['publishing','music','program','software','entity','grouping','reference','distribution','video','audio','post','poll','zone','realm','realm_rule','custom_theme','collection','tag','tag_path','label'];
BEGIN
  value:=to_jsonb(NEW); raw_id:=(value->>TG_ARGV[0])::uuid;
  IF TG_OP='UPDATE' THEN previous:=to_jsonb(OLD); END IF;
  FOREACH owner_name IN ARRAY owners LOOP
    column_name:=TG_ARGV[1] || '_' || owner_name || '_id';
    IF NOT value ? column_name THEN RAISE EXCEPTION 'Registered reference column is missing' USING ERRCODE='23514'; END IF;
    IF TG_OP='UPDATE' AND value->column_name IS DISTINCT FROM previous->column_name THEN alternatives_unchanged:=false; END IF;
    IF value->>column_name IS NOT NULL THEN present_count:=present_count+1; supplied_owner:=owner_name; supplied_id:=(value->>column_name)::uuid; END IF;
  END LOOP;
  IF TG_OP='UPDATE' AND alternatives_unchanged AND (previous->>TG_ARGV[0])::uuid IS DISTINCT FROM raw_id THEN
    FOREACH owner_name IN ARRAY owners LOOP reference_patch:=jsonb_set(reference_patch,ARRAY[TG_ARGV[1] || '_' || owner_name || '_id'],'null'::jsonb); END LOOP;
    present_count:=0;
  END IF;
  IF TG_OP='UPDATE' AND TG_ARGV[2]='optional' AND raw_id IS NOT NULL AND present_count=0 THEN
    IF previous->>TG_ARGV[0]=raw_id::text THEN
      -- A concrete FK SET NULL clears its derived logical input in the same row mutation.
      reference_patch:=jsonb_set(reference_patch,ARRAY[TG_ARGV[0]],'null'::jsonb); raw_id:=NULL;
    END IF;
  END IF;
  IF raw_id IS NULL THEN
    IF TG_ARGV[2]<>'optional' OR present_count<>0 THEN RAISE EXCEPTION 'Unit reference requires exactly one target' USING ERRCODE='23514'; END IF;
  ELSE
    IF present_count=1 AND supplied_id=raw_id THEN
      -- Explicit checked references are validated by their concrete FK, independently of routing-cache availability.
      RETURN NEW;
    END IF;
    IF present_count<>0 THEN RAISE EXCEPTION 'Unit reference alternatives disagree with its logical identity' USING ERRCODE='23514'; END IF;
    SELECT ready INTO routing_ready FROM public.catalog_routing_control WHERE singleton FOR SHARE;
    IF routing_ready IS DISTINCT FROM true THEN RAISE EXCEPTION 'Identity routing is fenced for repair' USING ERRCODE='55000'; END IF;
    SELECT owner INTO selected_owner FROM public.catalog_unit_locator WHERE id=raw_id FOR KEY SHARE;
    IF NOT FOUND OR NOT selected_owner=ANY(owners) THEN RAISE EXCEPTION 'Unit reference routing is unavailable' USING ERRCODE='23503'; END IF;
    IF present_count>1 OR (present_count=1 AND (supplied_owner<>selected_owner OR supplied_id<>raw_id)) THEN RAISE EXCEPTION 'Unit reference alternatives disagree with its routed identity' USING ERRCODE='23514'; END IF;
    FOREACH owner_name IN ARRAY owners LOOP
      column_name:=TG_ARGV[1] || '_' || owner_name || '_id';
      reference_patch:=jsonb_set(reference_patch,ARRAY[column_name],CASE WHEN owner_name=selected_owner THEN to_jsonb(raw_id) ELSE 'null'::jsonb END);
    END LOOP;
  END IF;
  -- Copy only reference scalars, never rebuild a potentially large document row twenty times.
  NEW:=jsonb_populate_record(NEW,reference_patch);
  RETURN NEW;
END $$;

DO $$ DECLARE owner_name text;
BEGIN
  FOREACH owner_name IN ARRAY ARRAY['video','audio','post','poll','zone','realm','realm_rule','custom_theme','collection','tag','tag_path','label'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS unit_platform_route_publish ON public.%I',owner_name);
    EXECUTE format('CREATE TRIGGER unit_platform_route_publish AFTER INSERT OR UPDATE OF id,routing_generation ON public.%I FOR EACH ROW EXECUTE FUNCTION public.unit_publish_platform_route(%L)',owner_name,owner_name);
    EXECUTE format('DROP TRIGGER IF EXISTS unit_platform_route_remove ON public.%I',owner_name);
    EXECUTE format('CREATE TRIGGER unit_platform_route_remove AFTER DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.unit_remove_platform_route(%L)',owner_name,owner_name);
  END LOOP;
END $$;

-- Favorites now store canonical reference values, not logical-ID input alternatives.
DROP TRIGGER IF EXISTS unit_reference_target_unit ON public.account_favorite;
DROP TRIGGER IF EXISTS unit_reference_target_unit ON public.account_favorite_revision;

-- Registered logical reference inputs.
DO $$ DECLARE specification text; entry text[]; trigger_name text;
BEGIN
 FOREACH specification IN ARRAY ARRAY[
  'account_unit_tag|unit_id|unit|required',
  'collection_item|unit_id|unit|required',
  'content_report|target_unit_id|target_unit|required',
  'content_review_case|target_unit_id|target_unit|required',
  'content_structure|owner_unit_id|owner_unit|required',
  'content_structure_node|content_unit_id|content_unit|required',
  'content_structure_node|target_unit_id|target_unit|optional',
  'credit_attribution|source_unit_id|source_unit|required',
  'custom_theme_revision|approved_host_unit_id|approved_host_unit|optional',
  'governance_decision|authority_unit_id|authority_unit|optional',
  'governance_decision|target_unit_id|target_unit|optional',
  'notification|subject_unit_id|subject_unit|optional',
  'poll_option|target_unit_id|target_unit|optional',
  'post|subject_unit_id|subject_unit|optional',
  'profile_resource_participation|resource_unit_id|resource_unit|required',
  'realm_pin|unit_id|unit|required',
  'realm_tag_judgment|unit_id|unit|required',
  'realm_tag_judgment_stat|unit_id|unit|required',
  'realm_unit|unit_id|unit|required',
  'realm_unit_status_event|unit_id|unit|required',
  'recommendation_event|target_unit_id|target_unit|required',
  'recommendation_exclusion|unit_id|unit|required',
  'recommendation_unit_signal_hourly|unit_id|unit|required',
  'score|unit_id|unit|required',
  'score_stat|unit_id|unit|required',
  'studio_auth_editor_candidate|unit_id|unit|required',
  'studio_realm_editor_candidate|unit_id|unit|required',
  'studio_resource_visit|resource_unit_id|resource_unit|required',
  'subject_association|unit_id|unit|required',
  'unit_access_grant|unit_id|unit|required',
  'unit_access_invitation|unit_id|unit|required',
  'unit_access_restriction|unit_id|unit|required',
  'unit_alias|unit_id|unit|required',
  'unit_association_proposal|source_unit_id|source_unit|required',
  'unit_association_proposal|target_unit_id|target_unit|required',
  'unit_best_score|unit_id|unit|required',
  'unit_content_language_search|unit_id|unit|required',
  'unit_content_language_support|unit_id|unit|required',
  'unit_custom_theme_installation|host_unit_id|host_unit|required',
  'unit_dock|unit_id|unit|required',
  'unit_effective_tag|unit_id|unit|required',
  'unit_engagement_stat|unit_id|unit|required',
  'unit_expression_assertion|unit_id|unit|required',
  'unit_external_link|unit_id|unit|required',
  'unit_follow|unit_id|unit|required',
  'unit_follow_stat|unit_id|unit|required',
  'unit_license_grant|unit_id|unit|required',
  'unit_localization|unit_id|unit|required',
  'unit_merge_graph_lock|unit_id|unit|required',
  'unit_merge_reconciliation_item|source_unit_id|source_unit|required',
  'unit_merge_reconciliation_item|target_unit_id|target_unit|required',
  'unit_merge_redirect|source_unit_id|source_unit|required',
  'unit_merge_redirect|target_unit_id|target_unit|required',
  'unit_merge_request|source_unit_id|source_unit|required',
  'unit_merge_request|target_unit_id|target_unit|required',
  'unit_ownership|unit_id|unit|required',
  'unit_presentation_document|host_unit_id|host_unit|required',
  'unit_progress|unit_id|unit|required',
  'unit_progress_entry|unit_id|unit|required',
  'unit_reaction|unit_id|unit|required',
  'unit_reaction_global_stat|unit_id|unit|required',
  'unit_reaction_stat|unit_id|unit|required',
  'unit_reference_curation_head|unit_id|unit|required',
  'unit_revision|unit_id|unit|required',
  'unit_revision_head|unit_id|unit|required',
  'unit_search_document|unit_id|unit|required',
  'unit_share|unit_id|unit|required',
  'unit_slug_address|scope_unit_id|scope_unit|optional',
  'unit_slug_address|target_unit_id|target_unit|required',
  'unit_status_event|unit_id|unit|required',
  'unit_tag|unit_id|unit|required',
  'unit_tag_judgment|unit_id|unit|required',
  'unit_tag_path_application|unit_id|unit|required'
 ] LOOP
  entry:=string_to_array(specification,'|'); trigger_name:='unit_reference_'||entry[3];
  EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I',trigger_name,entry[1]);
  EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.unit_populate_reference(%L,%L,%L)',trigger_name,entry[1],entry[2],entry[3],entry[4]);
 END LOOP;
END $$;
