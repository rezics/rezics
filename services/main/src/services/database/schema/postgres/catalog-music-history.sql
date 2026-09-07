CREATE OR REPLACE FUNCTION public.catalog_record_music_component()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE body jsonb; owner_key uuid; native_revision bigint; component_key text; i integer;
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
  component_key := '';
  FOR i IN 1..TG_NARGS - 1 LOOP
    component_key := component_key || CASE WHEN i = 1 THEN '' ELSE '/' END || (body ->> TG_ARGV[i]);
  END LOOP;
  INSERT INTO public.music_component_revision(owner_id, component, component_key, owner_revision, operation, value)
    VALUES (owner_key, TG_TABLE_NAME, component_key, native_revision, TG_OP, body);
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

CREATE OR REPLACE FUNCTION public.catalog_guard_music_history()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  RAISE EXCEPTION 'Native music revisions and sealed TOCs are immutable'
    USING ERRCODE = '23514', CONSTRAINT = 'music_native_revision_immutable';
END $$;

CREATE TRIGGER music_component_revision_immutable BEFORE UPDATE OR DELETE ON public.music_component_revision
  FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_music_history();
CREATE TRIGGER music_disc_toc_immutable BEFORE UPDATE OR DELETE ON public.music_disc_toc
  FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_music_history();
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

CREATE TRIGGER music_medium_toc_complete BEFORE INSERT OR UPDATE ON public.music_medium_toc
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_toc_attachment();
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
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_record_music_component(%L,%L)',
      row.table_name || '_record_revision', row.table_name, row.owner_column, row.key_column);
  END LOOP;
END $$;

CREATE TRIGGER music_medium_attribute_record_revision AFTER INSERT OR UPDATE OR DELETE ON public.music_medium_attribute
  FOR EACH ROW EXECUTE FUNCTION public.catalog_record_music_component('release_id','medium_id','id');
CREATE TRIGGER music_track_presentation_record_revision AFTER INSERT OR UPDATE OR DELETE ON public.music_track_presentation
  FOR EACH ROW EXECUTE FUNCTION public.catalog_record_music_component('release_id','medium_presentation_id','track_id');
CREATE TRIGGER music_medium_toc_record_revision AFTER INSERT OR UPDATE OR DELETE ON public.music_medium_toc
  FOR EACH ROW EXECUTE FUNCTION public.catalog_record_music_component('release_id','medium_id','toc_id');
CREATE TRIGGER music_candidate_toc_record_revision AFTER INSERT OR UPDATE OR DELETE ON public.music_candidate_toc
  FOR EACH ROW EXECUTE FUNCTION public.catalog_record_music_component('candidate_id','toc_id');
