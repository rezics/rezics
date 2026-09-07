CREATE OR REPLACE FUNCTION public.catalog_valid_name_date(value jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog, public AS $$
DECLARE y integer; m integer; d integer; maximum integer;
BEGIN
 IF value IS NULL THEN RETURN TRUE; END IF;
 IF jsonb_typeof(value) <> 'object' THEN RETURN FALSE; END IF;
 IF NOT value ?& ARRAY['year','month','day'] OR
    (SELECT count(*) FROM jsonb_object_keys(value)) <> 3 THEN RETURN FALSE; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_each(value) item WHERE item.value <> 'null'::jsonb AND
    (jsonb_typeof(item.value) <> 'number' OR NOT pg_input_is_valid(item.value::text, 'integer'))) THEN RETURN FALSE; END IF;
 y := (value->>'year')::integer; m := (value->>'month')::integer; d := (value->>'day')::integer;
 IF (m IS NOT NULL AND m NOT BETWEEN 1 AND 12) OR (d IS NOT NULL AND d NOT BETWEEN 1 AND 31) THEN RETURN FALSE; END IF;
 IF m IS NULL OR d IS NULL THEN RETURN TRUE; END IF;
 maximum := CASE WHEN m = 2 THEN CASE WHEN y IS NULL OR y % 400 = 0 OR (y % 4 = 0 AND y % 100 <> 0) THEN 29 ELSE 28 END WHEN m IN (4,6,9,11) THEN 30 ELSE 31 END;
 RETURN d <= maximum;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_guard_named_head()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN
  RAISE EXCEPTION 'Named facts retain identity and revision history' USING ERRCODE = '23514';
 END IF;
 IF TG_TABLE_NAME LIKE '%\_named_form' ESCAPE '\' THEN
  IF NOT public.catalog_valid_name_date(NEW."begin") OR NOT public.catalog_valid_name_date(NEW."end") THEN
   RAISE EXCEPTION 'Named-form dates must preserve valid known calendar components' USING ERRCODE = '23514';
  END IF;
 END IF;
 IF (TG_OP = 'INSERT' AND NEW.revision <> 1) OR
    (TG_OP = 'UPDATE' AND (NEW.owner_id <> OLD.owner_id OR NEW.id <> OLD.id OR NEW.created_at <> OLD.created_at OR NEW.revision <> OLD.revision + 1)) THEN
  RAISE EXCEPTION 'Named fact identity is immutable and revisions must advance by one' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_snapshot_named_head()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
 EXECUTE format('INSERT INTO public.%I SELECT ($1).*', TG_TABLE_NAME || '_revision') USING NEW;
 RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_guard_named_history()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE head_value jsonb;
BEGIN
 IF TG_OP <> 'INSERT' THEN
  RAISE EXCEPTION 'Named fact revision history is immutable' USING ERRCODE = '23514';
 END IF;
 EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE owner_id = $1 AND id = $2', TG_ARGV[0])
 INTO head_value USING NEW.owner_id, NEW.id;
 IF head_value IS DISTINCT FROM to_jsonb(NEW) THEN
  RAISE EXCEPTION 'History must be the exact complete current revision' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_guard_name_source_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
 RAISE EXCEPTION 'Named-form source bindings and observations are immutable' USING ERRCODE = '23514';
END;
$$;

DO $$
DECLARE owner text; suffix text; head_name text;
BEGIN
 FOREACH owner IN ARRAY ARRAY['publishing','music','program','software','entity','grouping','reference'] LOOP
  FOREACH suffix IN ARRAY ARRAY['named_form','identifier_claim','name_authority'] LOOP
   head_name := owner || '_' || suffix;
   EXECUTE format('DROP TRIGGER IF EXISTS catalog_named_head_guard ON public.%I', head_name);
   EXECUTE format('CREATE TRIGGER catalog_named_head_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_named_head()', head_name);
   EXECUTE format('DROP TRIGGER IF EXISTS catalog_named_head_snapshot ON public.%I', head_name);
   EXECUTE format('CREATE TRIGGER catalog_named_head_snapshot AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_snapshot_named_head()', head_name);
   EXECUTE format('DROP TRIGGER IF EXISTS catalog_named_history_guard ON public.%I', head_name || '_revision');
   EXECUTE format('CREATE TRIGGER catalog_named_history_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_named_history(%L)', head_name || '_revision', head_name);
  END LOOP;
  FOREACH suffix IN ARRAY ARRAY['name_source_binding','name_source_occurrence'] LOOP
   head_name := owner || '_' || suffix;
   EXECUTE format('DROP TRIGGER IF EXISTS catalog_name_source_guard ON public.%I', head_name);
   EXECUTE format('CREATE TRIGGER catalog_name_source_guard BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_name_source_identity()', head_name);
  END LOOP;
 END LOOP;
END;
$$;
