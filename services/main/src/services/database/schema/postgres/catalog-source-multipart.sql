-- A multipart snapshot is never accepted with a missing, duplicate or differently sized part set.
CREATE OR REPLACE FUNCTION public.catalog_source_bundle_check_parts()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE expected_count integer; expected_bytes integer; actual_count integer; actual_bytes integer; maximum_position integer; native_views integer;
BEGIN
 SELECT part_count,total_bytes INTO expected_count,expected_bytes FROM public.catalog_source_snapshot_bundle
  WHERE source_record_id=NEW.source_record_id AND snapshot_id=NEW.snapshot_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Multipart snapshot header is missing' USING ERRCODE='23514'; END IF;
 SELECT count(*),sum(byte_length),max(position),count(*) FILTER(WHERE kind='derived_view' AND key='native_view')
 INTO actual_count,actual_bytes,maximum_position,native_views FROM public.catalog_source_snapshot_part
  WHERE source_record_id=NEW.source_record_id AND snapshot_id=NEW.snapshot_id;
 IF actual_count<>expected_count OR actual_bytes<>expected_bytes OR maximum_position<>actual_count-1 OR native_views<>1 THEN
  RAISE EXCEPTION 'Multipart snapshot part set is incomplete' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION public.catalog_source_bundle_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN RAISE EXCEPTION 'Archived multipart source evidence is immutable' USING ERRCODE='23514'; END $$;
DROP TRIGGER IF EXISTS catalog_source_bundle_parts_check ON public.catalog_source_snapshot_bundle;
CREATE CONSTRAINT TRIGGER catalog_source_bundle_parts_check AFTER INSERT ON public.catalog_source_snapshot_bundle DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_source_bundle_check_parts();
DROP TRIGGER IF EXISTS catalog_source_part_set_check ON public.catalog_source_snapshot_part;
CREATE CONSTRAINT TRIGGER catalog_source_part_set_check AFTER INSERT ON public.catalog_source_snapshot_part DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_source_bundle_check_parts();
DROP TRIGGER IF EXISTS catalog_source_bundle_immutable ON public.catalog_source_snapshot_bundle;
CREATE TRIGGER catalog_source_bundle_immutable BEFORE UPDATE OR DELETE ON public.catalog_source_snapshot_bundle FOR EACH ROW EXECUTE FUNCTION public.catalog_source_bundle_immutable();
DROP TRIGGER IF EXISTS catalog_source_part_immutable ON public.catalog_source_snapshot_part;
CREATE TRIGGER catalog_source_part_immutable BEFORE UPDATE OR DELETE ON public.catalog_source_snapshot_part FOR EACH ROW EXECUTE FUNCTION public.catalog_source_bundle_immutable();
