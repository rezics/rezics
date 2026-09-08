SET search_path TO public;

-- Modify "entity_profile_source_occurrence" table
ALTER TABLE "entity_profile_source_occurrence" ADD CONSTRAINT "entity_profile_source_interpretation" CHECK ((jsonb_typeof(source_profile) = 'object'::text) AND (octet_length((source_profile)::text) <= 262144) AND ((cardinality(observed_fields) >= 0) AND (cardinality(observed_fields) <= 32))), ADD COLUMN "source_profile" jsonb NOT NULL, ADD COLUMN "observed_fields" text[] NOT NULL;
-- Modify "music_component_source_occurrence" table
ALTER TABLE "music_component_source_occurrence" ADD CONSTRAINT "music_component_source_value_object" CHECK ((jsonb_typeof(source_value) = 'object'::text) AND (octet_length((source_value)::text) <= 524288)), ADD COLUMN "source_value" jsonb NOT NULL;
-- Modify "reference_profile_source_occurrence" table
ALTER TABLE "reference_profile_source_occurrence" ADD CONSTRAINT "reference_profile_source_interpretation" CHECK ((jsonb_typeof(source_profile) = 'object'::text) AND (octet_length((source_profile)::text) <= 262144) AND ((cardinality(observed_fields) >= 0) AND (cardinality(observed_fields) <= 32))), ADD COLUMN "source_profile" jsonb NOT NULL, ADD COLUMN "observed_fields" text[] NOT NULL;

CREATE OR REPLACE FUNCTION public.catalog_record_music_component()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE body jsonb; owner_key uuid; native_revision bigint; native_component_key text; i integer; next_sequence bigint; history_key uuid;
BEGIN
  body := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  owner_key := (body ->> TG_ARGV[0])::uuid;
  IF TG_OP = 'UPDATE' THEN
    FOR i IN 0..TG_NARGS - 1 LOOP
      IF (to_jsonb(OLD) -> TG_ARGV[i]) IS DISTINCT FROM (body -> TG_ARGV[i]) THEN
        RAISE EXCEPTION 'Native music component identity and ownership are immutable'
          USING ERRCODE = '23514', CONSTRAINT = 'music_component_identity_immutable';
      END IF;
    END LOOP;
  END IF;
  SELECT revision INTO STRICT native_revision FROM public.music_identity WHERE id = owner_key;
  native_component_key := '';
  FOR i IN 1..TG_NARGS - 1 LOOP
    native_component_key := native_component_key || CASE WHEN i = 1 THEN '' ELSE '/' END || replace(replace(body ->> TG_ARGV[i], '~', '~0'), '/', '~1');
  END LOOP;
  SELECT head.component_sequence INTO next_sequence FROM public.music_component_head head
    WHERE head.owner_id=owner_key AND head.component=TG_TABLE_NAME AND head.component_key=native_component_key FOR UPDATE;
  next_sequence := coalesce(next_sequence, 0) + 1;
  INSERT INTO public.music_component_revision(owner_id, component, component_key, component_sequence, owner_revision, operation, value)
    VALUES (owner_key, TG_TABLE_NAME, native_component_key, next_sequence, native_revision, TG_OP, body) RETURNING id INTO history_key;
  IF next_sequence=1 THEN
    INSERT INTO public.music_component_head(owner_id,component,component_key,component_sequence,history_id)
      VALUES (owner_key,TG_TABLE_NAME,native_component_key,next_sequence,history_key);
  ELSE
    UPDATE public.music_component_head SET component_sequence=next_sequence,history_id=history_key
      WHERE owner_id=owner_key AND component=TG_TABLE_NAME AND component_key=native_component_key;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

CREATE OR REPLACE FUNCTION public.catalog_guard_music_history()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  RAISE EXCEPTION 'Native music revisions and sealed TOCs are immutable'
    USING ERRCODE = '23514', CONSTRAINT = 'music_native_revision_immutable';
END $$;

DROP TRIGGER IF EXISTS music_component_revision_immutable ON public.music_component_revision;
CREATE TRIGGER music_component_revision_immutable BEFORE UPDATE OR DELETE ON public.music_component_revision
  FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_music_history();
DROP TRIGGER IF EXISTS music_disc_toc_immutable ON public.music_disc_toc;
CREATE TRIGGER music_disc_toc_immutable BEFORE UPDATE OR DELETE ON public.music_disc_toc
  FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_music_history();
DROP TRIGGER IF EXISTS music_disc_toc_offset_immutable ON public.music_disc_toc_offset;
CREATE TRIGGER music_disc_toc_offset_immutable BEFORE UPDATE OR DELETE ON public.music_disc_toc_offset
  FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_music_history();

CREATE OR REPLACE FUNCTION public.catalog_guard_music_toc_offset_append()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM 1 FROM public.music_disc_toc WHERE id = NEW.toc_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.music_medium_toc WHERE toc_id = NEW.toc_id)
    OR EXISTS(SELECT 1 FROM public.music_candidate_toc WHERE toc_id = NEW.toc_id) THEN
    RAISE EXCEPTION 'Attached TOC offsets are sealed' USING ERRCODE = '23514', CONSTRAINT = 'music_toc_offset_sealed';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS music_disc_toc_offset_sealed ON public.music_disc_toc_offset;
CREATE TRIGGER music_disc_toc_offset_sealed BEFORE INSERT ON public.music_disc_toc_offset
  FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_music_toc_offset_append();

CREATE OR REPLACE FUNCTION public.catalog_check_music_toc_attachment()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE expected_count integer; leadout bigint; actual_count bigint; valid boolean;
BEGIN
  SELECT track_count, leadout_offset INTO STRICT expected_count, leadout
    FROM public.music_disc_toc WHERE id = NEW.toc_id FOR UPDATE;
  SELECT count(*), coalesce(bool_and(position = ordinal - 1 AND track_offset < leadout
    AND (previous_offset IS NULL OR previous_offset < track_offset)), false)
    INTO actual_count, valid
    FROM (SELECT position, "offset" AS track_offset, row_number() OVER (ORDER BY position) ordinal,
      lag("offset") OVER (ORDER BY position) previous_offset
      FROM public.music_disc_toc_offset WHERE toc_id = NEW.toc_id ORDER BY position LIMIT 100) offsets;
  IF actual_count <> expected_count OR NOT valid THEN
    RAISE EXCEPTION 'Disc TOC must have the declared contiguous increasing offsets before attachment'
      USING ERRCODE = '23514', CONSTRAINT = 'music_disc_toc_complete';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS music_medium_toc_complete ON public.music_medium_toc;
CREATE TRIGGER music_medium_toc_complete BEFORE INSERT OR UPDATE ON public.music_medium_toc
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_toc_attachment();
DROP TRIGGER IF EXISTS music_candidate_toc_complete ON public.music_candidate_toc;
CREATE TRIGGER music_candidate_toc_complete BEFORE INSERT OR UPDATE ON public.music_candidate_toc
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_toc_attachment();

DO $$
DECLARE row record;
BEGIN
  FOR row IN SELECT * FROM (VALUES
    ('music_work','id','id'), ('music_recording','id','id'),
    ('music_release_group','id','id'), ('music_release','id','id'),
    ('music_release_candidate','id','id'),
    ('music_medium','release_id','id'), ('music_track_occurrence','release_id','id'),
    ('music_release_label','release_id','id'), ('music_release_event','release_id','id'),
    ('music_release_presentation','release_id','id'), ('music_medium_presentation','release_id','id'),
    ('music_candidate_track','candidate_id','id'), ('music_work_language','work_id','language_tag'),
    ('music_release_group_secondary_type','release_group_id','type_revision_id')
  ) items(table_name, owner_column, key_column) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', row.table_name || '_record_revision', row.table_name);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_record_music_component(%L,%L)',
      row.table_name || '_record_revision', row.table_name, row.owner_column, row.key_column);
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS music_medium_attribute_record_revision ON public.music_medium_attribute;
CREATE TRIGGER music_medium_attribute_record_revision AFTER INSERT OR UPDATE OR DELETE ON public.music_medium_attribute
  FOR EACH ROW EXECUTE FUNCTION public.catalog_record_music_component('release_id','medium_id','id');
DROP TRIGGER IF EXISTS music_track_presentation_record_revision ON public.music_track_presentation;
CREATE TRIGGER music_track_presentation_record_revision AFTER INSERT OR UPDATE OR DELETE ON public.music_track_presentation
  FOR EACH ROW EXECUTE FUNCTION public.catalog_record_music_component('release_id','medium_presentation_id','track_id');
DROP TRIGGER IF EXISTS music_medium_toc_record_revision ON public.music_medium_toc;
CREATE TRIGGER music_medium_toc_record_revision AFTER INSERT OR UPDATE OR DELETE ON public.music_medium_toc
  FOR EACH ROW EXECUTE FUNCTION public.catalog_record_music_component('release_id','medium_id','toc_id');
DROP TRIGGER IF EXISTS music_candidate_toc_record_revision ON public.music_candidate_toc;
CREATE TRIGGER music_candidate_toc_record_revision AFTER INSERT OR UPDATE OR DELETE ON public.music_candidate_toc
  FOR EACH ROW EXECUTE FUNCTION public.catalog_record_music_component('candidate_id','toc_id');

DROP TRIGGER IF EXISTS music_medium_identifier_record_revision ON public.music_medium_identifier;
CREATE TRIGGER music_medium_identifier_record_revision AFTER INSERT OR UPDATE OR DELETE ON public.music_medium_identifier
  FOR EACH ROW EXECUTE FUNCTION public.catalog_record_music_component('release_id','medium_id','namespace','value');
DROP TRIGGER IF EXISTS music_track_identifier_record_revision ON public.music_track_identifier;
CREATE TRIGGER music_track_identifier_record_revision AFTER INSERT OR UPDATE OR DELETE ON public.music_track_identifier
  FOR EACH ROW EXECUTE FUNCTION public.catalog_record_music_component('release_id','track_id','namespace','value');

CREATE OR REPLACE FUNCTION public.catalog_check_music_source_occurrence()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE native_value jsonb; normalized_value jsonb; component_table regclass; invalid boolean; checks text;
BEGIN
  SELECT value INTO native_value FROM public.music_component_revision
    WHERE owner_id = NEW.owner_id AND id = NEW.history_id AND component = NEW.component
      AND component_key = NEW.component_key AND operation <> 'DELETE';
  IF native_value IS NULL THEN
    RAISE EXCEPTION 'Music source occurrence must reference the exact native component revision'
      USING ERRCODE = '23514', CONSTRAINT = 'music_source_occurrence_exact_history';
  END IF;
  IF jsonb_typeof(NEW.source_value) IS DISTINCT FROM 'object'
    OR ARRAY(SELECT jsonb_object_keys(NEW.source_value) ORDER BY 1) IS DISTINCT FROM ARRAY(SELECT jsonb_object_keys(native_value) ORDER BY 1)
  THEN RAISE EXCEPTION 'Music interpretation must contain exactly the native component fields' USING ERRCODE='23514'; END IF;
  component_table := to_regclass(format('public.%I',NEW.component));
  EXECUTE format('SELECT to_jsonb(v) FROM jsonb_populate_record(NULL::public.%I,$1) v',NEW.component) INTO normalized_value USING NEW.source_value;
  IF normalized_value IS DISTINCT FROM NEW.source_value THEN
    RAISE EXCEPTION 'Music interpretation has invalid native field types' USING ERRCODE='23514';
  END IF;
  SELECT EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=component_table AND a.attnum>0 AND NOT a.attisdropped AND a.attnotnull AND NEW.source_value->a.attname='null'::jsonb)
    OR EXISTS(SELECT 1 FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=ANY(i.indkey)
      WHERE i.indrelid=component_table AND i.indisprimary AND NEW.source_value->a.attname IS DISTINCT FROM native_value->a.attname)
    INTO invalid;
  IF invalid THEN RAISE EXCEPTION 'Music interpretation changes native identity or required fields' USING ERRCODE='23514'; END IF;
  SELECT string_agg('(' || pg_get_expr(c.conbin,c.conrelid) || ')',' AND ') INTO checks
    FROM pg_constraint c WHERE c.conrelid=component_table AND c.contype='c';
  IF checks IS NOT NULL THEN
    EXECUTE format('SELECT NOT coalesce((%s),true) FROM jsonb_populate_record(NULL::public.%I,$1)', checks, NEW.component) INTO invalid USING NEW.source_value;
    IF invalid THEN RAISE EXCEPTION 'Music interpretation violates native component constraints' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS music_component_source_occurrence_exact_history ON public.music_component_source_occurrence;
CREATE TRIGGER music_component_source_occurrence_exact_history BEFORE INSERT ON public.music_component_source_occurrence
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_source_occurrence();
DROP TRIGGER IF EXISTS music_component_source_occurrence_immutable ON public.music_component_source_occurrence;
CREATE TRIGGER music_component_source_occurrence_immutable BEFORE UPDATE OR DELETE ON public.music_component_source_occurrence
  FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_music_history();


CREATE OR REPLACE FUNCTION public.catalog_validate_profile_source()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE native_snapshot jsonb; expected_keys text[]; field_name text; field_value jsonb; date_part text; date_year integer; date_month integer; date_day integer; maximum_day integer;
BEGIN
  EXECUTE format('SELECT snapshot FROM public.%I WHERE owner_id=$1 AND revision=$2 AND NOT removed',TG_ARGV[0] || '_catalog_profile_revision') INTO native_snapshot USING NEW.owner_id,NEW.revision;
  IF native_snapshot IS NULL THEN RAISE EXCEPTION 'Profile source occurrence requires exact present native history' USING ERRCODE='23514'; END IF;
  IF TG_ARGV[0]='entity' THEN
    expected_keys := ARRAY['typeRevisionId','genderRevisionId','areaId','beginAreaId','endAreaId','begin','end','ended'];
  ELSE
    IF NEW.source_profile->>'shape' IS DISTINCT FROM native_snapshot->>'shape' THEN
      RAISE EXCEPTION 'Source profile cannot reclassify its native history' USING ERRCODE='23514';
    END IF;
    expected_keys := CASE NEW.source_profile->>'shape'
      WHEN 'concept' THEN ARRAY['shape','typeRevisionId']
      WHEN 'instrument' THEN ARRAY['shape','typeRevisionId']
      WHEN 'web_resource' THEN ARRAY['shape','url']
      WHEN 'area' THEN ARRAY['shape','typeRevisionId','begin','end','ended']
      WHEN 'place' THEN ARRAY['shape','typeRevisionId','begin','end','ended','areaId','address','latitude','longitude']
      WHEN 'event' THEN ARRAY['shape','typeRevisionId','placeId','begin','end','localTime','cancelled','ended','setlist']
      ELSE NULL END;
  END IF;
  IF expected_keys IS NULL OR jsonb_typeof(NEW.source_profile) IS DISTINCT FROM 'object'
    OR NOT (NEW.source_profile ?& expected_keys) OR NEW.source_profile - expected_keys <> '{}'::jsonb
    OR array_position(NEW.observed_fields,NULL) IS NOT NULL
    OR coalesce(array_ndims(NEW.observed_fields),1) <> 1
    OR cardinality(NEW.observed_fields) <> (SELECT count(DISTINCT f) FROM unnest(NEW.observed_fields) f)
    OR NOT (NEW.observed_fields <@ expected_keys)
  THEN RAISE EXCEPTION 'Source profile has an unknown shape, field or observation scope' USING ERRCODE='23514'; END IF;
  FOR field_name,field_value IN SELECT key,value FROM jsonb_each(NEW.source_profile) LOOP
    IF field_name <> 'shape' AND NOT (field_name=ANY(NEW.observed_fields)) AND field_value<>'null'::jsonb THEN
      RAISE EXCEPTION 'Unobserved profile fields cannot retain native or human values' USING ERRCODE='23514';
    END IF;
    IF field_value='null'::jsonb THEN
      IF field_name IN ('shape','url') THEN RAISE EXCEPTION 'Source profile requires its native discriminator/resource' USING ERRCODE='23514'; END IF;
      CONTINUE;
    END IF;
    IF field_name ~ 'Id$' THEN
      IF jsonb_typeof(field_value)<>'string' THEN RAISE EXCEPTION 'Source profile reference must be a UUID' USING ERRCODE='23514'; END IF;
      PERFORM (field_value #>> '{}')::uuid;
    ELSIF field_name IN ('ended','cancelled') THEN
      IF jsonb_typeof(field_value)<>'boolean' THEN RAISE EXCEPTION 'Source profile flag must be boolean' USING ERRCODE='23514'; END IF;
    ELSIF field_name IN ('latitude','longitude') THEN
      IF jsonb_typeof(field_value)<>'number' OR abs((field_value #>> '{}')::numeric) > (CASE field_name WHEN 'latitude' THEN 90 ELSE 180 END) THEN
        RAISE EXCEPTION 'Source profile coordinate is invalid' USING ERRCODE='23514';
      END IF;
    ELSIF field_name IN ('begin','end') THEN
      IF jsonb_typeof(field_value)<>'object' OR NOT (field_value ?& ARRAY['year','month','day','text']) OR field_value - ARRAY['year','month','day','text'] <> '{}'::jsonb
        OR jsonb_typeof(field_value->'text') NOT IN ('null','string') THEN
        RAISE EXCEPTION 'Source profile partial date is invalid' USING ERRCODE='23514';
      END IF;
      FOREACH date_part IN ARRAY ARRAY['year','month','day'] LOOP
        IF field_value->date_part <> 'null'::jsonb AND (jsonb_typeof(field_value->date_part)<>'number' OR (field_value->>date_part)::numeric <> trunc((field_value->>date_part)::numeric)) THEN
          RAISE EXCEPTION 'Source profile date part must be an integer' USING ERRCODE='23514';
        END IF;
      END LOOP;
      date_year := (field_value->>'year')::integer; date_month := (field_value->>'month')::integer; date_day := (field_value->>'day')::integer;
      maximum_day := CASE WHEN date_month=2 THEN CASE WHEN date_year IS NULL OR date_year%400=0 OR (date_year%4=0 AND date_year%100<>0) THEN 29 ELSE 28 END WHEN date_month IN (4,6,9,11) THEN 30 ELSE 31 END;
      IF date_month NOT BETWEEN 1 AND 12 OR date_day NOT BETWEEN 1 AND maximum_day OR octet_length(field_value->>'text')>4096 THEN
        RAISE EXCEPTION 'Source profile date precision is invalid' USING ERRCODE='23514';
      END IF;
    ELSE
      IF jsonb_typeof(field_value)<>'string' THEN RAISE EXCEPTION 'Source profile text must be a string' USING ERRCODE='23514'; END IF;
      IF (field_name='url' AND ((field_value #>> '{}') !~ '^[A-Za-z][A-Za-z0-9+.-]*:' OR octet_length(field_value #>> '{}')>8192))
        OR (field_name='localTime' AND (field_value #>> '{}') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9](\.[0-9]{1,6})?)?$')
        OR (field_name='address' AND octet_length(field_value #>> '{}')>16384)
        OR (field_name='setlist' AND octet_length(field_value #>> '{}')>65536)
      THEN RAISE EXCEPTION 'Source profile text violates its native field contract' USING ERRCODE='23514'; END IF;
    END IF;
  END LOOP;
  IF NEW.source_profile->>'shape'='place' AND (NEW.source_profile->'latitude'='null'::jsonb) IS DISTINCT FROM (NEW.source_profile->'longitude'='null'::jsonb) THEN
    RAISE EXCEPTION 'Source profile coordinates must be paired' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.catalog_validate_profile_baseline()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE valid boolean; current_revision bigint;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Profile source baselines are retained correspondence' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND (OLD.source_record_id,OLD.mapping_key,OLD.correspondence_revision,OLD.mapping_owner,OLD.owner_id) IS DISTINCT FROM (NEW.source_record_id,NEW.mapping_key,NEW.correspondence_revision,NEW.mapping_owner,NEW.owner_id) THEN
    RAISE EXCEPTION 'Profile source baseline identity is immutable' USING ERRCODE='23514';
  END IF;
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE source_record_id=$1 AND snapshot_id=$2 AND owner_id=$3 AND source_path=$4 AND revision=$5 AND mapping_key=$6 AND correspondence_revision=$7)',TG_ARGV[0] || '_profile_source_occurrence') INTO valid USING NEW.source_record_id,NEW.source_snapshot_id,NEW.owner_id,NEW.source_path,NEW.source_revision,NEW.mapping_key,NEW.correspondence_revision;
  IF NOT valid THEN RAISE EXCEPTION 'Profile baseline requires exact immutable source occurrence' USING ERRCODE='23514'; END IF;
  EXECUTE format('SELECT revision FROM public.%I WHERE owner_id=$1 ORDER BY revision DESC LIMIT 1',TG_ARGV[0] || '_catalog_profile_revision') INTO current_revision USING NEW.owner_id;
  IF current_revision IS DISTINCT FROM NEW.current_revision THEN RAISE EXCEPTION 'Profile baseline must identify the current native profile head' USING ERRCODE='23514'; END IF;
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I c JOIN public.catalog_source_adoption_proposal p ON p.source_record_id=c.source_record_id AND p.id=c.proposal_id WHERE c.source_record_id=$1 AND c.proposal_id=$2 AND c.action=$3 AND c.owner_id=$4 AND c.after_revision=$5 AND p.mapping_key=$6)',TG_ARGV[0] || '_source_profile_application_change') INTO valid USING NEW.source_record_id,NEW.last_proposal_id,NEW.last_action,NEW.owner_id,NEW.current_revision,NEW.mapping_key;
  IF NOT valid THEN RAISE EXCEPTION 'Profile baseline requires its exact native application' USING ERRCODE='23514'; END IF;
  IF NOT public.catalog_source_application_includes_epoch(NEW.source_record_id,NEW.last_proposal_id,NEW.mapping_key,NEW.correspondence_revision) OR NOT EXISTS (
    SELECT 1 FROM public.catalog_source_binding_revision r WHERE r.source_record_id=NEW.source_record_id AND r.mapping_key=NEW.mapping_key AND r.revision=NEW.correspondence_revision AND r.owner=NEW.mapping_owner)
  THEN RAISE EXCEPTION 'Profile baseline requires its proposal owner correspondence epoch' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;

DO $$ DECLARE owner_name text;
BEGIN
  FOREACH owner_name IN ARRAY ARRAY['entity','reference'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_profile_source_immutable ON public.%I',owner_name || '_profile_source_occurrence');
    EXECUTE format('CREATE TRIGGER catalog_profile_source_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_immutable_evidence()',owner_name || '_profile_source_occurrence');
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_profile_source_exact ON public.%I',owner_name || '_profile_source_occurrence');
    EXECUTE format('CREATE TRIGGER catalog_profile_source_exact BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_validate_profile_source(%L)',owner_name || '_profile_source_occurrence',owner_name);
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_profile_baseline_exact ON public.%I',owner_name || '_source_profile_baseline');
    EXECUTE format('CREATE TRIGGER catalog_profile_baseline_exact BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_validate_profile_baseline(%L)',owner_name || '_source_profile_baseline',owner_name);
  END LOOP;
END $$;
