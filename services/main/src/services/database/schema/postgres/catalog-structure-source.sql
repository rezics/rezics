CREATE OR REPLACE FUNCTION public.catalog_structure_source_projection_valid(component_name text, source_value jsonb, observed_fields text[])
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog, public AS $$
DECLARE shape_name text; allowed text[]; uuids text[] := '{}'; integers text[] := '{}'; numbers text[] := '{}'; strings text[] := '{}'; fields jsonb; field_name text; scalar jsonb; numeric_value numeric; yr numeric; mon numeric; dy numeric; maximum_day integer;
BEGIN
  CASE component_name
    WHEN 'program_work' THEN shape_name:='program'; uuids:=ARRAY['typeRevisionId']; integers:=ARRAY['declaredMainEpisodeCount','declaredTotalEpisodeCount'];
    WHEN 'program_season' THEN shape_name:='season'; uuids:=ARRAY['programId']; strings:=ARRAY['number'];
    WHEN 'program_version' THEN shape_name:='program_version'; uuids:=ARRAY['programId','versionTypeRevisionId']; integers:=ARRAY['lengthMilliseconds'];
    WHEN 'program_episode' THEN shape_name:='episode'; uuids:=ARRAY['programId','seasonId','typeRevisionId']; integers:=ARRAY['discNumber','lengthMilliseconds']; numbers:=ARRAY['sortNumber','episodeNumber']; strings:=ARRAY['durationText','dateText'];
    WHEN 'publishing_work' THEN shape_name:='work';
    WHEN 'publishing_text_version' THEN shape_name:='text_version'; uuids:=ARRAY['methodRevisionId']; strings:=ARRAY['languageTag'];
    WHEN 'publishing_publication' THEN shape_name:='publication'; integers:=ARRAY['pageCount']; strings:=ARRAY['paginationText'];
    WHEN 'publishing_serialization' THEN shape_name:='serialization'; uuids:=ARRAY['textVersionId','statusRevisionId'];
    ELSE RETURN false;
  END CASE;
  IF source_value IS NULL OR jsonb_typeof(source_value) IS DISTINCT FROM 'object' OR source_value->>'shape' IS DISTINCT FROM shape_name
    OR source_value-'shape'-'fields'<>'{}'::jsonb OR jsonb_typeof(source_value->'fields') IS DISTINCT FROM 'object' THEN RETURN false; END IF;
  fields:=source_value->'fields'; allowed:=uuids||integers||numbers||strings;
  IF component_name='program_episode' THEN allowed:=allowed||ARRAY['date']; END IF;
  IF NOT fields ?& allowed OR fields-allowed<>'{}'::jsonb OR observed_fields IS NULL OR cardinality(observed_fields)>32
    OR NOT observed_fields<@allowed OR (SELECT count(*)<>count(DISTINCT k) FROM unnest(observed_fields) k) THEN RETURN false; END IF;
  FOREACH field_name IN ARRAY allowed LOOP
    scalar:=fields->field_name;
    IF NOT field_name=ANY(observed_fields) THEN
      IF field_name='date' THEN
        IF scalar<>'{"year":null,"month":null,"day":null}'::jsonb THEN RETURN false; END IF;
      ELSIF scalar<>'null'::jsonb THEN RETURN false; END IF;
    END IF;
    IF scalar='null'::jsonb THEN
      IF field_name='date' THEN RETURN false; END IF;
      CONTINUE;
    END IF;
    IF field_name=ANY(uuids) THEN
      IF jsonb_typeof(scalar)<>'string' OR fields->>field_name !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN false; END IF;
    ELSIF field_name=ANY(integers) OR field_name=ANY(numbers) THEN
      IF jsonb_typeof(scalar)<>'number' THEN RETURN false; END IF;
      numeric_value:=(fields->>field_name)::numeric;
      IF field_name=ANY(integers) AND (numeric_value<0 OR numeric_value>9007199254740991 OR trunc(numeric_value)<>numeric_value) THEN RETURN false; END IF;
      IF abs(numeric_value)>1.7976931348623157e308::numeric THEN RETURN false; END IF;
    ELSIF field_name=ANY(strings) THEN
      IF jsonb_typeof(scalar)<>'string' OR char_length(fields->>field_name)>CASE WHEN field_name IN('number','durationText','dateText') THEN 4096 WHEN field_name='languageTag' THEN 255 ELSE 131072 END THEN RETURN false; END IF;
    ELSE
      IF jsonb_typeof(scalar)<>'object' OR NOT scalar ?& ARRAY['year','month','day'] OR scalar-'year'-'month'-'day'<>'{}'::jsonb THEN RETURN false; END IF;
      IF EXISTS(SELECT 1 FROM jsonb_each(scalar) f WHERE jsonb_typeof(f.value) NOT IN ('number','null')) THEN RETURN false; END IF;
      yr:=(scalar->>'year')::numeric; mon:=(scalar->>'month')::numeric; dy:=(scalar->>'day')::numeric;
      IF yr IS NOT NULL AND (yr<>trunc(yr) OR yr NOT BETWEEN -2147483648 AND 2147483647) THEN RETURN false; END IF;
      IF mon IS NOT NULL AND (mon<>trunc(mon) OR mon NOT BETWEEN 1 AND 12) THEN RETURN false; END IF;
      IF dy IS NOT NULL AND (dy<>trunc(dy) OR dy NOT BETWEEN 1 AND 31) THEN RETURN false; END IF;
      IF mon IS NOT NULL AND dy IS NOT NULL THEN
        maximum_day:=CASE WHEN mon=2 THEN CASE WHEN yr IS NULL OR mod(yr,400)=0 OR (mod(yr,4)=0 AND mod(yr,100)<>0) THEN 29 ELSE 28 END WHEN mon IN(4,6,9,11) THEN 30 ELSE 31 END;
        IF dy>maximum_day THEN RETURN false; END IF;
      END IF;
    END IF;
  END LOOP;
  RETURN true;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN false;
END $$;

CREATE OR REPLACE FUNCTION public.catalog_structure_source_guard_occurrence()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE root public.catalog_source_binding_revision%ROWTYPE; native record; shape_name text; parent_id uuid; definition_id uuid; field_name text; expected_shape text;
BEGIN
  IF TG_ARGV[0] NOT IN ('program','publishing') OR NEW.component NOT LIKE TG_ARGV[0]||'_%' OR NEW.component_key<>NEW.owner_id::text
    OR NOT public.catalog_structure_source_projection_valid(NEW.component,NEW.source_value,NEW.observed_fields) THEN
    RAISE EXCEPTION 'Structure source projection must contain only typed observed values' USING ERRCODE='23514';
  END IF;
  SELECT * INTO STRICT root FROM public.catalog_source_binding_revision WHERE source_record_id=NEW.source_record_id AND mapping_key=NEW.mapping_key AND revision=NEW.correspondence_revision;
  IF root.correspondence_revision<>root.revision OR root.owner<>NEW.mapping_owner THEN RAISE EXCEPTION 'Structure source requires its exact root correspondence epoch' USING ERRCODE='23514'; END IF;
  EXECUTE format('SELECT component,component_key,operation FROM public.%I WHERE owner_id=$1 AND id=$2',TG_ARGV[0]||'_component_revision') INTO STRICT native USING NEW.owner_id,NEW.history_id;
  IF native.component<>NEW.component OR native.component_key<>NEW.component_key OR native.operation='DELETE' THEN RAISE EXCEPTION 'Structure source history belongs to another native component' USING ERRCODE='23514'; END IF;
  FOREACH field_name IN ARRAY CASE WHEN TG_ARGV[0]='program' THEN ARRAY['programId','seasonId'] ELSE ARRAY['textVersionId'] END LOOP
    parent_id:=(NEW.source_value->'fields'->>field_name)::uuid;
    IF parent_id IS NULL THEN CONTINUE; END IF;
    expected_shape:=CASE field_name WHEN 'programId' THEN 'program' WHEN 'seasonId' THEN 'season' ELSE 'text_version' END;
    EXECUTE format('SELECT shape FROM public.%I WHERE id=$1',TG_ARGV[0]||'_identity') INTO STRICT shape_name USING parent_id;
    IF shape_name<>expected_shape THEN RAISE EXCEPTION 'Structure source parent has another native shape' USING ERRCODE='23514'; END IF;
  END LOOP;
  FOREACH field_name IN ARRAY ARRAY['typeRevisionId','versionTypeRevisionId','methodRevisionId','statusRevisionId'] LOOP
    definition_id:=(NEW.source_value->'fields'->>field_name)::uuid;
    IF definition_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.catalog_definition_revision r JOIN public.catalog_definition d ON d.id=r.definition_id WHERE r.id=definition_id AND d.kind='vocabulary') THEN
      RAISE EXCEPTION 'Structure source type or method requires an exact vocabulary revision' USING ERRCODE='23514';
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.catalog_structure_source_guard_application()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE application public.catalog_source_application%ROWTYPE; proposal_state text; before_row record; after_row record; current_id uuid;
BEGIN
  IF TG_ARGV[0] NOT IN ('program','publishing') OR NEW.component NOT LIKE TG_ARGV[0]||'_%' OR NEW.component_key<>NEW.owner_id::text THEN RAISE EXCEPTION 'Structure application owner differs' USING ERRCODE='23514'; END IF;
  SELECT * INTO STRICT application FROM public.catalog_source_application WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action;
  SELECT state INTO STRICT proposal_state FROM public.catalog_source_adoption_proposal WHERE source_record_id=NEW.source_record_id AND id=NEW.proposal_id;
  IF NEW.position>=application.change_count OR (NEW.action='apply' AND proposal_state<>'pending') OR (NEW.action='withdraw' AND proposal_state<>'applied') THEN RAISE EXCEPTION 'Structure change requires its in-progress source application' USING ERRCODE='23514'; END IF;
  EXECUTE format('SELECT component,component_key,component_sequence FROM public.%I WHERE owner_id=$1 AND id=$2',TG_ARGV[0]||'_component_revision') INTO STRICT after_row USING NEW.owner_id,NEW.after_revision_id;
  IF after_row.component<>NEW.component OR after_row.component_key<>NEW.component_key THEN RAISE EXCEPTION 'Structure application after history differs' USING ERRCODE='23514'; END IF;
  IF NEW.before_revision_id IS NOT NULL THEN
    EXECUTE format('SELECT component,component_key,component_sequence FROM public.%I WHERE owner_id=$1 AND id=$2',TG_ARGV[0]||'_component_revision') INTO STRICT before_row USING NEW.owner_id,NEW.before_revision_id;
    IF before_row.component<>NEW.component OR before_row.component_key<>NEW.component_key OR before_row.component_sequence>=after_row.component_sequence THEN RAISE EXCEPTION 'Structure application history order differs' USING ERRCODE='23514'; END IF;
  END IF;
  EXECUTE format('SELECT history_id FROM public.%I WHERE owner_id=$1 AND component=$2 AND component_key=$3',TG_ARGV[0]||'_component_head') INTO STRICT current_id USING NEW.owner_id,NEW.component,NEW.component_key;
  IF current_id<>NEW.after_revision_id THEN RAISE EXCEPTION 'Structure application does not identify the current child head' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.catalog_structure_source_guard_baseline()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE source_row record; native record; previous_sequence bigint; root public.catalog_source_binding_revision%ROWTYPE; matched boolean;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Structure source baselines are retained evidence' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND (NEW.source_record_id,NEW.mapping_key,NEW.correspondence_revision,NEW.mapping_owner,NEW.owner_id,NEW.component,NEW.component_key) IS DISTINCT FROM (OLD.source_record_id,OLD.mapping_key,OLD.correspondence_revision,OLD.mapping_owner,OLD.owner_id,OLD.component,OLD.component_key) THEN RAISE EXCEPTION 'Structure baseline identity is immutable' USING ERRCODE='23514'; END IF;
  SELECT * INTO STRICT root FROM public.catalog_source_binding_revision WHERE source_record_id=NEW.source_record_id AND mapping_key=NEW.mapping_key AND revision=NEW.correspondence_revision;
  IF root.correspondence_revision<>root.revision OR root.owner<>NEW.mapping_owner OR NOT public.catalog_source_application_includes_epoch(NEW.source_record_id,NEW.proposal_id,NEW.mapping_key,NEW.correspondence_revision) THEN RAISE EXCEPTION 'Structure baseline requires an admitted application epoch' USING ERRCODE='23514'; END IF;
  EXECUTE format('SELECT history_id,source_path FROM public.%I WHERE source_record_id=$1 AND mapping_key=$2 AND correspondence_revision=$3 AND snapshot_id=$4 AND owner_id=$5 AND component=$6 AND component_key=$7',TG_ARGV[0]||'_structure_source_occurrence') INTO STRICT source_row USING NEW.source_record_id,NEW.mapping_key,NEW.correspondence_revision,NEW.snapshot_id,NEW.owner_id,NEW.component,NEW.component_key;
  IF source_row.history_id<>NEW.source_history_id OR source_row.source_path<>NEW.source_path THEN RAISE EXCEPTION 'Structure baseline source occurrence differs' USING ERRCODE='23514'; END IF;
  EXECUTE format('SELECT h.id,h.component,h.component_key,h.component_sequence FROM public.%I head JOIN public.%I h ON h.owner_id=head.owner_id AND h.id=head.history_id WHERE head.owner_id=$1 AND head.component=$2 AND head.component_key=$3',TG_ARGV[0]||'_component_head',TG_ARGV[0]||'_component_revision') INTO STRICT native USING NEW.owner_id,NEW.component,NEW.component_key;
  IF native.id<>NEW.current_history_id THEN RAISE EXCEPTION 'Structure baseline current history is stale' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' THEN
    EXECUTE format('SELECT component_sequence FROM public.%I WHERE owner_id=$1 AND id=$2',TG_ARGV[0]||'_component_revision') INTO STRICT previous_sequence USING OLD.owner_id,OLD.current_history_id;
    IF native.component_sequence<=previous_sequence THEN RAISE EXCEPTION 'Structure baseline history must advance' USING ERRCODE='23514'; END IF;
  END IF;
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE source_record_id=$1 AND proposal_id=$2 AND action=$3 AND owner_id=$4 AND component=$5 AND component_key=$6 AND after_revision_id=$7)',TG_ARGV[0]||'_structure_source_application_change') INTO matched USING NEW.source_record_id,NEW.proposal_id,NEW.action,NEW.owner_id,NEW.component,NEW.component_key,NEW.current_history_id;
  IF NOT matched THEN RAISE EXCEPTION 'Structure baseline current history lacks its exact application' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE owner_name text; table_name text;
BEGIN
  FOREACH owner_name IN ARRAY ARRAY['program','publishing'] LOOP
    FOREACH table_name IN ARRAY ARRAY[owner_name||'_structure_source_occurrence',owner_name||'_structure_source_application_change'] LOOP
      EXECUTE format('DROP TRIGGER IF EXISTS catalog_structure_source_immutable ON public.%I',table_name);
      EXECUTE format('CREATE TRIGGER catalog_structure_source_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_immutable_evidence()',table_name);
    END LOOP;
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_structure_source_occurrence_guard ON public.%I',owner_name||'_structure_source_occurrence');
    EXECUTE format('CREATE TRIGGER catalog_structure_source_occurrence_guard BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_structure_source_guard_occurrence(%L)',owner_name||'_structure_source_occurrence',owner_name);
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_structure_source_application_guard ON public.%I',owner_name||'_structure_source_application_change');
    EXECUTE format('CREATE TRIGGER catalog_structure_source_application_guard BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_structure_source_guard_application(%L)',owner_name||'_structure_source_application_change',owner_name);
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_structure_source_baseline_guard ON public.%I',owner_name||'_structure_source_baseline');
    EXECUTE format('CREATE TRIGGER catalog_structure_source_baseline_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_structure_source_guard_baseline(%L)',owner_name||'_structure_source_baseline',owner_name);
  END LOOP;
END $$;
