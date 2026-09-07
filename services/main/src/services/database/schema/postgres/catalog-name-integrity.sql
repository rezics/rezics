CREATE OR REPLACE FUNCTION public.catalog_guard_named_head()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN
  RAISE EXCEPTION 'Named facts retain identity and revision history' USING ERRCODE = '23514';
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
