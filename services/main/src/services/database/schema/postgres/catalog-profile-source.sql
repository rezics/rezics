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
