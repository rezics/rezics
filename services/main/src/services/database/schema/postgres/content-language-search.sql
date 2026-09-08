-- Canonical reverse projection maintenance for content-consumption language discovery.
-- The authoritative JSON document is bounded to 64 entries, so each write performs
-- at most 64 projection inserts in the same transaction.

CREATE OR REPLACE FUNCTION public.maintain_unit_content_language_search() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    DELETE FROM public.unit_content_language_search
    WHERE unit_id = OLD.unit_id;
  END IF;

  IF TG_OP <> 'DELETE' THEN
    INSERT INTO public.unit_content_language_search (
      unit_id,
      unit_kind,
      language_tag,
      channel_mask
    )
    SELECT
      NEW.unit_id,
      NEW.unit_kind,
      entry ->> 'languageTag',
      CASE
        WHEN NOT (entry ? 'channels') THEN 0
        ELSE
          CASE WHEN entry -> 'channels' ? 'text' THEN 1 ELSE 0 END
          + CASE WHEN entry -> 'channels' ? 'audio' THEN 2 ELSE 0 END
          + CASE WHEN entry -> 'channels' ? 'subtitle' THEN 4 ELSE 0 END
          + CASE WHEN entry -> 'channels' ? 'interface' THEN 8 ELSE 0 END
      END
    FROM jsonb_array_elements(NEW.value) AS entry;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS unit_content_language_search_maintain
ON public.unit_content_language_support;

CREATE TRIGGER unit_content_language_search_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.unit_content_language_support
FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_content_language_search();

-- Declarations and their reverse projection use the concrete native owner, never retired kinds.
CREATE OR REPLACE FUNCTION public.guard_content_language_owner() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE target record;
BEGIN
  SELECT * INTO target FROM public.read_unit_state(NEW.unit_id, true);
  IF NOT FOUND OR target.owner <> NEW.unit_kind OR target.owner NOT IN ('publishing','music','program','software','audio','video') THEN
    RAISE EXCEPTION 'Content language declaration does not match its concrete owner' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS content_language_owner_guard ON public.unit_content_language_support;
CREATE TRIGGER content_language_owner_guard BEFORE INSERT OR UPDATE ON public.unit_content_language_support
FOR EACH ROW EXECUTE FUNCTION public.guard_content_language_owner();
DROP TRIGGER IF EXISTS content_language_owner_guard ON public.unit_content_language_search;
CREATE TRIGGER content_language_owner_guard BEFORE INSERT OR UPDATE ON public.unit_content_language_search
FOR EACH ROW EXECUTE FUNCTION public.guard_content_language_owner();
