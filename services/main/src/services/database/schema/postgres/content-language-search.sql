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
