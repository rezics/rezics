CREATE OR REPLACE FUNCTION public.catalog_capture_structure_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE body jsonb; native_owner uuid; native_revision bigint; component_key text := ''; ordinal integer; next_sequence bigint; history_key uuid;
BEGIN
  body := CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  native_owner := (body ->> TG_ARGV[1])::uuid;
  IF TG_OP='UPDATE' THEN
    FOR ordinal IN 1..TG_NARGS-1 LOOP
      IF (to_jsonb(OLD)->TG_ARGV[ordinal]) IS DISTINCT FROM (body->TG_ARGV[ordinal]) THEN
        RAISE EXCEPTION 'Structural component identity and owner are immutable' USING ERRCODE='23514';
      END IF;
    END LOOP;
  END IF;
  EXECUTE format('SELECT revision FROM public.%I WHERE id=$1', TG_ARGV[0] || '_identity') INTO STRICT native_revision USING native_owner;
  FOR ordinal IN 2..TG_NARGS-1 LOOP
    component_key := component_key || CASE WHEN ordinal=2 THEN '' ELSE '/' END || replace(replace(body->>TG_ARGV[ordinal], '~', '~0'), '/', '~1');
  END LOOP;
  EXECUTE format('SELECT component_sequence FROM public.%I WHERE owner_id=$1 AND component=$2 AND component_key=$3 FOR UPDATE',TG_ARGV[0] || '_component_head') INTO next_sequence USING native_owner,TG_TABLE_NAME,component_key;
  next_sequence := coalesce(next_sequence,0) + 1;
  EXECUTE format('INSERT INTO public.%I(owner_id,component,component_key,component_sequence,owner_revision,operation,value) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',TG_ARGV[0] || '_component_revision') INTO history_key USING native_owner,TG_TABLE_NAME,component_key,next_sequence,native_revision,TG_OP,body;
  IF next_sequence=1 THEN
    EXECUTE format('INSERT INTO public.%I(owner_id,component,component_key,component_sequence,history_id) VALUES($1,$2,$3,$4,$5)',TG_ARGV[0] || '_component_head') USING native_owner,TG_TABLE_NAME,component_key,next_sequence,history_key;
  ELSE
    EXECUTE format('UPDATE public.%I SET component_sequence=$4,history_id=$5 WHERE owner_id=$1 AND component=$2 AND component_key=$3',TG_ARGV[0] || '_component_head') USING native_owner,TG_TABLE_NAME,component_key,next_sequence,history_key;
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;

CREATE OR REPLACE FUNCTION public.catalog_guard_structure_head()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE valid boolean;
BEGIN
  IF TG_OP='DELETE' OR pg_trigger_depth()<2 THEN RAISE EXCEPTION 'Structural heads are maintained by native history capture' USING ERRCODE='23514'; END IF;
  IF TG_OP='INSERT' AND NEW.component_sequence<>1 THEN RAISE EXCEPTION 'Structural sequence must start at one' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND ((OLD.owner_id,OLD.component,OLD.component_key) IS DISTINCT FROM (NEW.owner_id,NEW.component,NEW.component_key) OR NEW.component_sequence<>OLD.component_sequence+1) THEN RAISE EXCEPTION 'Structural sequence must advance exactly once' USING ERRCODE='23514'; END IF;
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE owner_id=$1 AND id=$2 AND component=$3 AND component_key=$4 AND component_sequence=$5)', TG_ARGV[0] || '_component_revision') INTO valid USING NEW.owner_id,NEW.history_id,NEW.component,NEW.component_key,NEW.component_sequence;
  IF NOT valid THEN RAISE EXCEPTION 'Structural head requires exact immutable history' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.catalog_guard_structure_revision_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF pg_trigger_depth()<2 THEN RAISE EXCEPTION 'Structural history is captured from native rows' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.catalog_guard_structure_history()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  RAISE EXCEPTION 'Native structural history and source evidence are immutable' USING ERRCODE='23514';
END $$;

CREATE OR REPLACE FUNCTION public.catalog_validate_structure_source()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE valid boolean;
BEGIN
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE owner_id=$1 AND id=$2 AND component=$3 AND component_key=$4 AND operation <> ''DELETE'')',TG_ARGV[0] || '_component_revision') INTO valid USING NEW.owner_id,NEW.history_id,NEW.component,NEW.component_key;
  IF NOT valid THEN RAISE EXCEPTION 'Structural source support requires the exact native component history' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE row record; owner_name text; relation_name text;
BEGIN
  FOR row IN SELECT * FROM (VALUES
    ('program','program_work','id','id'),('program','program_season','id','id'),('program','program_version','id','id'),('program','program_episode','id','id'),('program','program_episode_occurrence','owner_id','id'),
    ('publishing','publishing_work','id','id'),('publishing','publishing_text_version','id','id'),('publishing','publishing_publication','id','id'),('publishing','publishing_serialization','id','id'),
    ('publishing','publishing_text_work','text_version_id','work_id'),('publishing','publishing_publication_text','publication_id','text_version_id'),('publishing','publishing_publication_work','publication_id','work_id'),('publishing','publishing_publication_facet','publication_id','definition_revision_id'),
    ('publishing','publishing_release_event','publication_id','id'),('publishing','publishing_installment','serialization_id','id')
  ) values(owner_name,table_name,owner_column,key_column) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_capture_structure_revision ON public.%I',row.table_name);
    EXECUTE format('CREATE TRIGGER catalog_capture_structure_revision AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_capture_structure_revision(%L,%L,%L)',row.table_name,row.owner_name,row.owner_column,row.key_column);
  END LOOP;
  FOREACH owner_name IN ARRAY ARRAY['program','publishing'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_structure_head_maintained ON public.%I',owner_name || '_component_head');
    EXECUTE format('CREATE TRIGGER catalog_structure_head_maintained BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_structure_head(%L)',owner_name || '_component_head',owner_name);
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_structure_revision_capture_only ON public.%I',owner_name || '_component_revision');
    EXECUTE format('CREATE TRIGGER catalog_structure_revision_capture_only BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_structure_revision_insert()',owner_name || '_component_revision');
    FOREACH relation_name IN ARRAY ARRAY[owner_name || '_component_revision',owner_name || '_component_source_occurrence'] LOOP
      EXECUTE format('DROP TRIGGER IF EXISTS catalog_structure_history_immutable ON public.%I',relation_name);
      EXECUTE format('CREATE TRIGGER catalog_structure_history_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_structure_history()',relation_name);
    END LOOP;
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_structure_source_exact ON public.%I',owner_name || '_component_source_occurrence');
    EXECUTE format('CREATE TRIGGER catalog_structure_source_exact BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_validate_structure_source(%L)',owner_name || '_component_source_occurrence',owner_name);
  END LOOP;
END $$;
