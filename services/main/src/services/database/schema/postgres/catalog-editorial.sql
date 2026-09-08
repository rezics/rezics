CREATE OR REPLACE FUNCTION public.catalog_editorial_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE language_count integer;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Editorial history requires withdrawal, not deletion' USING ERRCODE='23514'; END IF;
 EXECUTE format('SELECT id FROM public.%I WHERE id=$1 FOR UPDATE',TG_ARGV[0]||'_identity') USING NEW.owner_id;
 IF TG_OP='INSERT' THEN
  IF NEW.revision<>1 THEN RAISE EXCEPTION 'Initial editorial revision must be one' USING ERRCODE='23514'; END IF;
  EXECUTE format('SELECT count(*) FROM (SELECT 1 FROM public.%I WHERE owner_id=$1 LIMIT 32) bounded',TG_ARGV[0]||'_editorial') INTO language_count USING NEW.owner_id;
  IF language_count>=32 THEN RAISE EXCEPTION 'Editorial language capacity exceeded' USING ERRCODE='23514',CONSTRAINT='catalog_editorial_language_capacity'; END IF;
 ELSIF NEW.owner_id<>OLD.owner_id OR NEW.language<>OLD.language OR NEW.created_at<>OLD.created_at OR NEW.revision<>OLD.revision+1 THEN
  RAISE EXCEPTION 'Editorial identity is immutable and revisions advance by one' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_editorial_capture() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 EXECUTE format('INSERT INTO public.%I(owner_id,language,revision,snapshot,created_at) VALUES($1,$2,$3,$4,$5)',TG_ARGV[0]||'_editorial_revision')
 USING NEW.owner_id,NEW.language,NEW.revision,to_jsonb(NEW),NEW.updated_at;
 RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_editorial_history_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE head jsonb;
BEGIN
 IF TG_OP<>'INSERT' OR pg_trigger_depth()<2 THEN RAISE EXCEPTION 'Editorial history is captured from its current head' USING ERRCODE='23514'; END IF;
 EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE owner_id=$1 AND language=$2 AND revision=$3',TG_ARGV[0]||'_editorial') INTO head USING NEW.owner_id,NEW.language,NEW.revision;
 IF head IS NULL OR NEW.snapshot<>head THEN RAISE EXCEPTION 'Editorial history must match its head' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$$;

DO $$ DECLARE owner text; BEGIN
 FOREACH owner IN ARRAY ARRAY['publishing','music','program','software','entity','grouping','reference','distribution'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS catalog_editorial_guard ON public.%I',owner||'_editorial');
  EXECUTE format('DROP TRIGGER IF EXISTS catalog_editorial_capture ON public.%I',owner||'_editorial');
  EXECUTE format('DROP TRIGGER IF EXISTS catalog_editorial_history_guard ON public.%I',owner||'_editorial_revision');
  EXECUTE format('CREATE TRIGGER catalog_editorial_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_editorial_guard(%L)',owner||'_editorial',owner);
  EXECUTE format('CREATE TRIGGER catalog_editorial_capture AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_editorial_capture(%L)',owner||'_editorial',owner);
  EXECUTE format('CREATE TRIGGER catalog_editorial_history_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_editorial_history_guard(%L)',owner||'_editorial_revision',owner);
 END LOOP;
END $$;
