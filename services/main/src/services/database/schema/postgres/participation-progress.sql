CREATE OR REPLACE FUNCTION public.maintain_unit_progress_stats() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = pg_catalog, public
    AS $$
DECLARE row_data unit_progress%ROWTYPE; direction bigint;
signal_kind text; signal_weight double precision;
change record;
BEGIN
  FOR change IN
    SELECT OLD AS row_data, -1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL SELECT NEW AS row_data, 1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    row_data := change.row_data; direction := change.direction;
    IF row_data.deleted_at IS NULL AND row_data.status IN ('active', 'completed', 'dropped') THEN
      PERFORM apply_unit_engagement_stat(
        row_data.unit_id,
        p_active_progress => direction * (row_data.status = 'active')::int,
        p_completions => direction * (row_data.status = 'completed')::int,
        p_negative_progress => direction * (row_data.status = 'dropped')::int
      );
      signal_kind := CASE row_data.status WHEN 'active' THEN 'progress_active'
        WHEN 'completed' THEN 'progress_completed' ELSE 'progress_dropped' END;
      signal_weight := CASE row_data.status WHEN 'active' THEN 3
        WHEN 'completed' THEN 5 ELSE -4 END;
      IF signal_weight > 0 THEN
        PERFORM apply_recommendation_unit_signal(
          row_data.unit_id, row_data.last_seen_at, signal_kind, direction,
          direction * signal_weight
        );
      END IF;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS unit_progress_stats_maintain ON public.unit_progress;
CREATE TRIGGER unit_progress_stats_maintain AFTER INSERT OR DELETE OR UPDATE OF auth_user_id, unit_id, status, last_seen_at, deleted_at ON public.unit_progress FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_progress_stats();
