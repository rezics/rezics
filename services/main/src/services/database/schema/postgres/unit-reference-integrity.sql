CREATE OR REPLACE FUNCTION public.unit_publish_platform_route()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE ready boolean; affected integer;
BEGIN
  SELECT c.ready INTO ready FROM public.catalog_routing_control c WHERE singleton FOR SHARE;
  IF ready IS DISTINCT FROM true THEN RAISE EXCEPTION 'Identity routing is fenced for repair' USING ERRCODE='55000'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('catalog-identity:' || NEW.id::text,0));
  IF TG_OP='UPDATE' AND NEW.id<>OLD.id THEN RAISE EXCEPTION 'Unit identity is immutable' USING ERRCODE='23514'; END IF;
  INSERT INTO public.catalog_unit_locator(id,owner,generation) VALUES(NEW.id,TG_ARGV[0],1)
    ON CONFLICT(id) DO UPDATE SET generation=EXCLUDED.generation WHERE catalog_unit_locator.owner=EXCLUDED.owner AND catalog_unit_locator.generation=1;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION 'Identity belongs to another physical owner' USING ERRCODE='23505'; END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.unit_remove_platform_route()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  DELETE FROM public.catalog_unit_locator WHERE id=OLD.id AND owner=TG_ARGV[0] AND generation=1;
  RETURN OLD;
END $$;

/** Resolve a logical input ID once; concrete FKs and the row check remain the persisted authority. */
CREATE OR REPLACE FUNCTION public.unit_populate_reference()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE value jsonb; previous jsonb; raw_id uuid; selected_owner text; owner_name text; column_name text;
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
    FOREACH owner_name IN ARRAY owners LOOP value:=jsonb_set(value,ARRAY[TG_ARGV[1] || '_' || owner_name || '_id'],'null'::jsonb); END LOOP;
    present_count:=0;
  END IF;
  IF TG_OP='UPDATE' AND TG_ARGV[2]='optional' AND raw_id IS NOT NULL AND present_count=0 THEN
    IF previous->>TG_ARGV[0]=raw_id::text THEN
      -- A concrete FK SET NULL clears its derived logical input in the same row mutation.
      value:=jsonb_set(value,ARRAY[TG_ARGV[0]],'null'::jsonb); raw_id:=NULL;
    END IF;
  END IF;
  IF raw_id IS NULL THEN
    IF TG_ARGV[2]<>'optional' OR present_count<>0 THEN RAISE EXCEPTION 'Unit reference requires exactly one target' USING ERRCODE='23514'; END IF;
  ELSE
    IF present_count=1 AND supplied_id=raw_id THEN
      -- Explicit checked references are validated by their concrete FK, independently of routing-cache availability.
      NEW:=jsonb_populate_record(NEW,value); RETURN NEW;
    END IF;
    IF present_count<>0 THEN RAISE EXCEPTION 'Unit reference alternatives disagree with its logical identity' USING ERRCODE='23514'; END IF;
    SELECT ready INTO routing_ready FROM public.catalog_routing_control WHERE singleton FOR SHARE;
    IF routing_ready IS DISTINCT FROM true THEN RAISE EXCEPTION 'Identity routing is fenced for repair' USING ERRCODE='55000'; END IF;
    SELECT owner INTO selected_owner FROM public.catalog_unit_locator WHERE id=raw_id FOR KEY SHARE;
    IF NOT FOUND OR NOT selected_owner=ANY(owners) THEN RAISE EXCEPTION 'Unit reference routing is unavailable' USING ERRCODE='23503'; END IF;
    IF present_count>1 OR (present_count=1 AND (supplied_owner<>selected_owner OR supplied_id<>raw_id)) THEN RAISE EXCEPTION 'Unit reference alternatives disagree with its routed identity' USING ERRCODE='23514'; END IF;
    FOREACH owner_name IN ARRAY owners LOOP
      column_name:=TG_ARGV[1] || '_' || owner_name || '_id';
      value:=jsonb_set(value,ARRAY[column_name],CASE WHEN owner_name=selected_owner THEN to_jsonb(raw_id) ELSE 'null'::jsonb END);
    END LOOP;
  END IF;
  NEW:=jsonb_populate_record(NEW,value);
  RETURN NEW;
END $$;

DO $$ DECLARE owner_name text;
BEGIN
  FOREACH owner_name IN ARRAY ARRAY['video','audio','post','poll','zone','realm','realm_rule','custom_theme','collection','tag','tag_path','label'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS unit_platform_route_publish ON public.%I',owner_name);
    EXECUTE format('CREATE TRIGGER unit_platform_route_publish AFTER INSERT OR UPDATE OF id ON public.%I FOR EACH ROW EXECUTE FUNCTION public.unit_publish_platform_route(%L)',owner_name,owner_name);
    EXECUTE format('DROP TRIGGER IF EXISTS unit_platform_route_remove ON public.%I',owner_name);
    EXECUTE format('CREATE TRIGGER unit_platform_route_remove AFTER DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.unit_remove_platform_route(%L)',owner_name,owner_name);
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS favorite_target_reference ON public.account_favorite;
CREATE TRIGGER favorite_target_reference BEFORE INSERT OR UPDATE ON public.account_favorite
FOR EACH ROW EXECUTE FUNCTION public.unit_populate_reference('target_unit_id','target_unit','required');
DROP TRIGGER IF EXISTS favorite_history_target_reference ON public.account_favorite_revision;
CREATE TRIGGER favorite_history_target_reference BEFORE INSERT OR UPDATE ON public.account_favorite_revision
FOR EACH ROW EXECUTE FUNCTION public.unit_populate_reference('target_unit_id','target_unit','required');
