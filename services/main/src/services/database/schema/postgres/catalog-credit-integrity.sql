CREATE OR REPLACE FUNCTION public.catalog_guard_credit_member()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE target_id uuid; sealed_time timestamptz; retired_time timestamptz;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Credited names are immutable; create a new credit group'
      USING ERRCODE = '23514', CONSTRAINT = 'music_credit_members_immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN target_id := OLD.credit_id; ELSE target_id := NEW.credit_id; END IF;
  SELECT sealed_at, retired_at INTO sealed_time, retired_time
    FROM public.music_artist_credit WHERE id = target_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Artist credit does not exist' USING ERRCODE = '23503'; END IF;
  IF TG_OP = 'DELETE' THEN
    IF retired_time IS NULL THEN
      RAISE EXCEPTION 'Retire a credit group before erasing member values'
        USING ERRCODE = '23514', CONSTRAINT = 'music_credit_members_immutable';
    END IF;
    RETURN OLD;
  END IF;
  IF sealed_time IS NOT NULL OR retired_time IS NOT NULL THEN
    RAISE EXCEPTION 'Artist credit no longer accepts members'
      USING ERRCODE = '23514', CONSTRAINT = 'music_credit_members_immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_count_credit_members()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE public.music_artist_credit AS credit
    SET member_count = credit.member_count + added.members,
        last_position = greatest(credit.last_position, added.last_position)
    FROM (SELECT credit_id, count(*) AS members, max(position) AS last_position
          FROM inserted_credit_members GROUP BY credit_id) AS added
    WHERE credit.id = added.credit_id;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_guard_credit_header()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.id <> OLD.id THEN RAISE EXCEPTION 'Credit identity is immutable' USING ERRCODE = '23514'; END IF;
  IF (NEW.member_count <> OLD.member_count OR NEW.last_position <> OLD.last_position) AND pg_trigger_depth() < 2 THEN
    RAISE EXCEPTION 'Credit prefix counters are maintained from inserted members'
      USING ERRCODE = '23514', CONSTRAINT = 'music_credit_prefix_projection';
  END IF;
  IF OLD.sealed_at IS NOT NULL AND (
       NEW.sealed_at IS DISTINCT FROM OLD.sealed_at OR NEW.member_count <> OLD.member_count
       OR NEW.last_position <> OLD.last_position
       OR (NEW.rendered_name IS DISTINCT FROM OLD.rendered_name AND NOT (NEW.retired_at IS NOT NULL AND NEW.rendered_name IS NULL))) THEN
    RAISE EXCEPTION 'Sealed artist credit is immutable'
      USING ERRCODE = '23514', CONSTRAINT = 'music_credit_members_immutable';
  END IF;
  IF OLD.retired_at IS NOT NULL AND NEW.retired_at IS DISTINCT FROM OLD.retired_at THEN
    RAISE EXCEPTION 'Retired credit cannot be revived by replay' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_require_sealed_credit()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE target_id uuid; sealed_time timestamptz; retired_time timestamptz;
BEGIN
  target_id := (to_jsonb(NEW) ->> TG_ARGV[0])::uuid;
  IF target_id IS NULL THEN RETURN NEW; END IF;
  SELECT sealed_at, retired_at INTO sealed_time, retired_time FROM public.music_artist_credit
    WHERE id = target_id FOR SHARE;
  IF NOT FOUND OR sealed_time IS NULL OR retired_time IS NOT NULL THEN
    RAISE EXCEPTION 'Only a complete active credit group can be attached'
      USING ERRCODE = '23514', CONSTRAINT = 'music_credit_sealed_target';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS music_credit_member_guard ON public.music_artist_credit_name;
CREATE TRIGGER music_credit_member_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.music_artist_credit_name
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_credit_member();

DROP TRIGGER IF EXISTS music_credit_member_count ON public.music_artist_credit_name;
CREATE TRIGGER music_credit_member_count
AFTER INSERT ON public.music_artist_credit_name
REFERENCING NEW TABLE AS inserted_credit_members
FOR EACH STATEMENT EXECUTE FUNCTION public.catalog_count_credit_members();

DROP TRIGGER IF EXISTS music_credit_header_guard ON public.music_artist_credit;
CREATE TRIGGER music_credit_header_guard
BEFORE UPDATE ON public.music_artist_credit
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_credit_header();

DROP TRIGGER IF EXISTS music_recording_sealed_credit_guard ON public.music_recording;
CREATE TRIGGER music_recording_sealed_credit_guard
BEFORE INSERT OR UPDATE OF artist_credit_id ON public.music_recording
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_sealed_credit('artist_credit_id');

DROP TRIGGER IF EXISTS music_release_group_sealed_credit_guard ON public.music_release_group;
CREATE TRIGGER music_release_group_sealed_credit_guard
BEFORE INSERT OR UPDATE OF artist_credit_id ON public.music_release_group
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_sealed_credit('artist_credit_id');

DROP TRIGGER IF EXISTS music_release_sealed_credit_guard ON public.music_release;
CREATE TRIGGER music_release_sealed_credit_guard
BEFORE INSERT OR UPDATE OF artist_credit_id ON public.music_release
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_sealed_credit('artist_credit_id');

DROP TRIGGER IF EXISTS music_track_occurrence_sealed_credit_guard ON public.music_track_occurrence;
CREATE TRIGGER music_track_occurrence_sealed_credit_guard
BEFORE INSERT OR UPDATE OF artist_credit_id ON public.music_track_occurrence
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_sealed_credit('artist_credit_id');

DROP TRIGGER IF EXISTS music_release_presentation_sealed_credit_guard ON public.music_release_presentation;
CREATE TRIGGER music_release_presentation_sealed_credit_guard
BEFORE INSERT OR UPDATE OF artist_credit_id ON public.music_release_presentation
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_sealed_credit('artist_credit_id');

DROP TRIGGER IF EXISTS music_alternative_track_sealed_credit_guard ON public.music_alternative_track;
CREATE TRIGGER music_alternative_track_sealed_credit_guard
BEFORE INSERT OR UPDATE OF artist_credit_id ON public.music_alternative_track
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_sealed_credit('artist_credit_id');
