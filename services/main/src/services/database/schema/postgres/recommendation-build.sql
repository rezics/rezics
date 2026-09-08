CREATE OR REPLACE FUNCTION public.recommendation_partition_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF (NEW.snapshot_id,NEW.bucket) IS DISTINCT FROM (OLD.snapshot_id,OLD.bucket)
   OR NEW.generation<OLD.generation OR NEW.generation>OLD.generation+1
   OR NEW.scanned_rows<OLD.scanned_rows THEN
   RAISE EXCEPTION 'Recommendation partition identity and progress are monotone' USING ERRCODE='23514';
  END IF;
  IF OLD.after_bucket_start IS NOT NULL AND (NEW.after_bucket_start IS NULL OR
   (NEW.after_bucket_start,NEW.after_unit_id,NEW.after_kind::recommendation_signal_kind)<
   (OLD.after_bucket_start,OLD.after_unit_id,OLD.after_kind::recommendation_signal_kind)) THEN
   RAISE EXCEPTION 'Recommendation cursor cannot move backwards' USING ERRCODE='23514';
  END IF;
  IF OLD.state IN ('done','failed') AND NEW IS DISTINCT FROM OLD THEN
   RAISE EXCEPTION 'Recommendation partition is terminal' USING ERRCODE='23514';
  END IF;
  IF NEW.generation>OLD.generation AND NOT(NEW.state='working' AND NEW.lease_token IS NOT NULL AND NEW.lease_token IS DISTINCT FROM OLD.lease_token) THEN
   RAISE EXCEPTION 'Recommendation generation advances only when claiming a lease' USING ERRCODE='23514';
  END IF;
  IF NEW.generation=OLD.generation AND NEW.lease_token IS NOT NULL AND NEW.lease_token IS DISTINCT FROM OLD.lease_token THEN
   RAISE EXCEPTION 'Recommendation token requires a new generation' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS recommendation_snapshot_partition_guard ON public.recommendation_snapshot_partition;
CREATE TRIGGER recommendation_snapshot_partition_guard BEFORE UPDATE ON public.recommendation_snapshot_partition
FOR EACH ROW EXECUTE FUNCTION public.recommendation_partition_guard();

CREATE OR REPLACE FUNCTION public.recommendation_snapshot_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE completed integer;
BEGIN
 IF TG_OP='INSERT' AND (NEW.state<>'building' OR NEW.active OR NEW.source_watermark IS NULL) THEN
  RAISE EXCEPTION 'Recommendation snapshots begin as private builds' USING ERRCODE='23514';
 END IF;
 IF TG_OP='UPDATE' THEN
  IF (NEW.id,NEW.policy_version,NEW.source_watermark,NEW.started_at) IS DISTINCT FROM
     (OLD.id,OLD.policy_version,OLD.source_watermark,OLD.started_at) THEN
   RAISE EXCEPTION 'Recommendation snapshot input is immutable' USING ERRCODE='23514';
  END IF;
  IF OLD.state<>'building' AND (NEW.state,NEW.completed_at,NEW.error) IS DISTINCT FROM (OLD.state,OLD.completed_at,OLD.error) THEN
   RAISE EXCEPTION 'Recommendation snapshot is terminal' USING ERRCODE='23514';
  END IF;
 END IF;
 IF NEW.state='ready' AND (TG_OP='INSERT' OR OLD.state IS DISTINCT FROM NEW.state) THEN
  SELECT count(*) INTO completed FROM public.recommendation_snapshot_partition WHERE snapshot_id=NEW.id AND state='done';
  IF completed<>64 THEN RAISE EXCEPTION 'All recommendation partitions must finish before activation' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS recommendation_snapshot_build_guard ON public.recommendation_snapshot;
CREATE TRIGGER recommendation_snapshot_build_guard BEFORE INSERT OR UPDATE ON public.recommendation_snapshot
FOR EACH ROW EXECUTE FUNCTION public.recommendation_snapshot_guard();

CREATE OR REPLACE FUNCTION public.recommendation_score_build_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM 1 FROM public.recommendation_snapshot WHERE id=NEW.snapshot_id AND state='building' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Only a building snapshot accepts recommendation scores' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS unit_best_score_build_guard ON public.unit_best_score;
CREATE TRIGGER unit_best_score_build_guard BEFORE INSERT OR UPDATE ON public.unit_best_score
FOR EACH ROW EXECUTE FUNCTION public.recommendation_score_build_guard();
