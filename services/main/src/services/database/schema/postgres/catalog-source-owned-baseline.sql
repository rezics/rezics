CREATE OR REPLACE FUNCTION public.catalog_source_guard_owned_baseline() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE matched boolean; source_matched boolean; native_head bigint; source_epoch bigint;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Source/native baselines require reviewed retention, not ad hoc deletion' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.source_record_id <> OLD.source_record_id OR NEW.mapping_key <> OLD.mapping_key OR NEW.correspondence_revision <> OLD.correspondence_revision OR NEW.owner_id <> OLD.owner_id OR to_jsonb(NEW)->'component_key' IS DISTINCT FROM to_jsonb(OLD)->'component_key' OR to_jsonb(NEW)->'component' IS DISTINCT FROM to_jsonb(OLD)->'component' OR to_jsonb(NEW)->'kind' IS DISTINCT FROM to_jsonb(OLD)->'kind') THEN
    RAISE EXCEPTION 'Source/native baseline identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.catalog_source_adoption_proposal WHERE source_record_id=NEW.source_record_id AND id=NEW.last_proposal_id AND mapping_key=NEW.mapping_key) THEN
    RAISE EXCEPTION 'Baseline application belongs to another mapping' USING ERRCODE = '23514';
  END IF;
  SELECT r.correspondence_revision INTO STRICT source_epoch
  FROM public.catalog_source_adoption_proposal p JOIN public.catalog_source_binding_revision r
    ON r.source_record_id=p.source_record_id AND r.mapping_key=p.mapping_key AND r.revision=p.expected_binding_revision
  WHERE p.source_record_id=NEW.source_record_id AND p.id=NEW.last_proposal_id;
  IF source_epoch <> NEW.correspondence_revision OR NOT EXISTS (
    SELECT 1 FROM public.catalog_source_binding_revision WHERE source_record_id=NEW.source_record_id
      AND mapping_key=NEW.mapping_key AND revision=NEW.correspondence_revision AND owner=NEW.mapping_owner
  ) THEN RAISE EXCEPTION 'Baseline requires the proposal exact owner correspondence epoch' USING ERRCODE='23514'; END IF;
  IF TG_OP = 'UPDATE' AND NEW.current_revision <= OLD.current_revision THEN
    RAISE EXCEPTION 'Baseline native history must advance' USING ERRCODE = '23514';
  END IF;
  IF TG_ARGV[0] = 'owned' THEN
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE source_record_id=$1 AND proposal_id=$2 AND action=$3 AND owner_id=$4 AND component_key=$5 AND after_revision=$6)', TG_ARGV[1] || CASE NEW.kind WHEN 'catalog-semantic' THEN '_source_semantic_application_change' WHEN 'catalog-name' THEN '_source_name_application_change' WHEN 'catalog-name-authority' THEN '_source_authority_application_change' WHEN 'catalog-identifier' THEN '_source_identifier_application_change' END)
      INTO matched USING NEW.source_record_id, NEW.last_proposal_id, NEW.last_action, NEW.owner_id, NEW.component_key, NEW.current_revision;
  ELSIF TG_ARGV[0] = 'record' THEN
    SELECT EXISTS (SELECT 1 FROM public.software_source_record_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.last_proposal_id AND action=NEW.last_action AND owner_id=NEW.owner_id AND after_revision=NEW.current_revision) INTO matched;
  ELSIF TG_ARGV[0] = 'component' THEN
    SELECT EXISTS (SELECT 1 FROM public.software_source_component_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.last_proposal_id AND action=NEW.last_action AND owner_id=NEW.owner_id AND component=NEW.component AND component_key=NEW.component_key AND after_revision=NEW.current_revision) INTO matched;
  ELSE
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE source_record_id=$1 AND proposal_id=$2 AND action=$3 AND owner_id=$4 AND component_key=$5 AND after_revision=$6)', 'software_source_' || TG_ARGV[0] || '_application_change')
      INTO matched USING NEW.source_record_id, NEW.last_proposal_id, NEW.last_action, NEW.owner_id, NEW.component_key, NEW.current_revision;
  END IF;
  IF NOT matched THEN RAISE EXCEPTION 'Baseline current head is not backed by its exact native application' USING ERRCODE = '23514'; END IF;
  IF TG_ARGV[0] = 'owned' THEN
    IF NEW.kind = 'catalog-name' THEN
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE source_record_id=$1 AND snapshot_id=$2 AND owner_id=$3 AND name_id=$4 AND name_revision=$5 AND source_path=$6 AND mapping_key=$7 AND correspondence_revision=$8)', TG_ARGV[1] || '_name_source_occurrence') INTO source_matched USING NEW.source_record_id,NEW.source_snapshot_id,NEW.owner_id,NEW.component_key,NEW.source_revision,NEW.source_path,NEW.mapping_key,source_epoch;
    ELSIF NEW.kind = 'catalog-identifier' THEN
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE source_record_id=$1 AND snapshot_id=$2 AND owner_id=$3 AND identifier_id=$4 AND identifier_revision=$5 AND source_path=$6 AND source_mapping_key=$7 AND source_correspondence_revision=$8)', TG_ARGV[1] || '_fact_support') INTO source_matched USING NEW.source_record_id,NEW.source_snapshot_id,NEW.owner_id,NEW.component_key,NEW.source_revision,NEW.source_path,NEW.mapping_key,source_epoch;
    ELSIF NEW.kind = 'catalog-name-authority' THEN
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE source_record_id=$1 AND snapshot_id=$2 AND owner_id=$3 AND id=$4 AND revision=$5 AND source_path=$6)', TG_ARGV[1] || '_name_authority_revision') INTO source_matched USING NEW.source_record_id,NEW.source_snapshot_id,NEW.owner_id,NEW.component_key,NEW.source_revision,NEW.source_path;
    ELSE
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I s JOIN public.%I v ON v.owner_id=s.owner_id AND v.id=s.fact_id WHERE s.source_record_id=$1 AND s.snapshot_id=$2 AND s.owner_id=$3 AND v.semantic_id=$4 AND v.expected_head_version+1=$5 AND s.source_path=$6 AND s.source_mapping_key=$7 AND s.source_correspondence_revision=$8 UNION ALL SELECT 1 FROM public.%I s JOIN public.%I v ON v.owner_id=s.owner_id AND v.id=s.relation_id WHERE s.source_record_id=$1 AND s.snapshot_id=$2 AND s.owner_id=$3 AND v.semantic_id=$4 AND v.expected_head_version+1=$5 AND s.source_path=$6 AND s.source_mapping_key=$7 AND s.source_correspondence_revision=$8)', TG_ARGV[1] || '_fact_support',TG_ARGV[1] || '_fact',TG_ARGV[1] || '_fact_support',TG_ARGV[1] || '_catalog_relation') INTO source_matched USING NEW.source_record_id,NEW.source_snapshot_id,NEW.owner_id,NEW.component_key,NEW.source_revision,NEW.source_path,NEW.mapping_key,source_epoch;
    END IF;
  ELSIF TG_ARGV[0] = 'record' THEN
    SELECT EXISTS (SELECT 1 FROM public.software_record_source_occurrence WHERE source_record_id=NEW.source_record_id AND snapshot_id=NEW.source_snapshot_id AND owner_id=NEW.owner_id AND revision=NEW.source_revision AND source_path=NEW.source_path AND mapping_key=NEW.mapping_key AND correspondence_revision=source_epoch) INTO source_matched;
  ELSIF TG_ARGV[0] = 'component' THEN
    SELECT EXISTS (SELECT 1 FROM public.software_component_source_occurrence WHERE source_record_id=NEW.source_record_id AND snapshot_id=NEW.source_snapshot_id AND owner_id=NEW.owner_id AND component=NEW.component AND component_key=NEW.component_key AND revision=NEW.source_revision AND source_path=NEW.source_path AND mapping_key=NEW.mapping_key AND correspondence_revision=source_epoch) INTO source_matched;
  ELSIF TG_ARGV[0] = 'context' THEN
    SELECT EXISTS (SELECT 1 FROM public.software_participation_source_occurrence WHERE source_record_id=NEW.source_record_id AND snapshot_id=NEW.source_snapshot_id AND content_id=NEW.owner_id AND context_id=NEW.component_key AND context_revision=NEW.source_revision AND source_pointer=NEW.source_path AND mapping_key=NEW.mapping_key AND correspondence_revision=source_epoch) INTO source_matched;
  ELSE
    SELECT EXISTS (SELECT 1 FROM public.software_participation_credit_source_occurrence WHERE source_record_id=NEW.source_record_id AND snapshot_id=NEW.source_snapshot_id AND content_id=NEW.owner_id AND participation_id=NEW.component_key AND participation_revision=NEW.source_revision AND source_path=NEW.source_path AND mapping_key=NEW.mapping_key AND correspondence_revision=source_epoch) INTO source_matched;
  END IF;
  IF NOT source_matched THEN RAISE EXCEPTION 'Baseline originating history is not backed by its exact source occurrence' USING ERRCODE = '23514'; END IF;
  IF TG_ARGV[0] = 'owned' THEN
    EXECUTE format('SELECT %I FROM public.%I WHERE owner_id=$1 AND %I=$2', CASE NEW.kind WHEN 'catalog-semantic' THEN 'version' ELSE 'revision' END, TG_ARGV[1] || CASE NEW.kind WHEN 'catalog-semantic' THEN '_semantic_head' WHEN 'catalog-name' THEN '_named_form' WHEN 'catalog-name-authority' THEN '_name_authority' WHEN 'catalog-identifier' THEN '_identifier_claim' END, CASE NEW.kind WHEN 'catalog-semantic' THEN 'semantic_id' ELSE 'id' END) INTO native_head USING NEW.owner_id,NEW.component_key;
  ELSIF TG_ARGV[0] = 'component' THEN
    SELECT revision INTO native_head FROM public.software_component_revision WHERE release_id=NEW.owner_id AND kind=NEW.component AND component_id=NEW.component_key ORDER BY revision DESC LIMIT 1;
  ELSIF TG_ARGV[0] = 'record' THEN
    SELECT revision INTO native_head FROM public.software_record_revision WHERE owner_id=NEW.owner_id ORDER BY revision DESC LIMIT 1;
  ELSE
    EXECUTE format('SELECT current_revision FROM public.%I WHERE content_id=$1 AND id=$2', CASE TG_ARGV[0] WHEN 'context' THEN 'software_participation_context' ELSE 'software_participation' END) INTO native_head USING NEW.owner_id,NEW.component_key;
  END IF;
  IF native_head IS DISTINCT FROM NEW.current_revision THEN RAISE EXCEPTION 'Baseline native history is no longer current' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
DO $$
DECLARE owner_name text; child text;
BEGIN
  FOREACH owner_name IN ARRAY ARRAY['publishing','music','program','software','entity','grouping','reference','distribution'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_source_baseline_guard ON public.%I', owner_name || '_source_owned_baseline');
    EXECUTE format('CREATE TRIGGER catalog_source_baseline_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_owned_baseline(%L,%L)', owner_name || '_source_owned_baseline', 'owned', owner_name);
  END LOOP;
  FOREACH child IN ARRAY ARRAY['record','component','context','participation'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_source_baseline_guard ON public.%I', 'software_source_' || child || '_baseline');
    EXECUTE format('CREATE TRIGGER catalog_source_baseline_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_owned_baseline(%L)', 'software_source_' || child || '_baseline', child);
  END LOOP;
  FOREACH child IN ARRAY ARRAY['software_component_source_occurrence','software_record_source_occurrence'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS software_source_occurrence_immutable ON public.%I', child);
    EXECUTE format('CREATE TRIGGER software_source_occurrence_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_immutable_evidence()', child);
  END LOOP;
END $$;
