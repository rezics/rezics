CREATE OR REPLACE FUNCTION public.catalog_guard_software_context()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND
      (NEW.content_id <> OLD.content_id OR NEW.id <> OLD.id OR
       NEW.current_revision IS NULL OR
       NEW.current_revision <> coalesce(OLD.current_revision, 0) + 1)) THEN
    RAISE EXCEPTION 'Participation context identity is immutable and its head must advance by one'
      USING ERRCODE = '23514', CONSTRAINT = 'software_context_transition_check';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_require_software_context_head()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.software_participation_context
             WHERE content_id = NEW.content_id AND id = NEW.id AND current_revision IS NULL) THEN
    RAISE EXCEPTION 'Participation context must have a current revision at commit'
      USING ERRCODE = '23514', CONSTRAINT = 'software_context_committed_head_check';
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_guard_software_context_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE current_head bigint;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Participation context revisions and source occurrences are immutable'
      USING ERRCODE = '23514', CONSTRAINT = 'software_context_history_immutable';
  END IF;
  SELECT current_revision INTO current_head FROM public.software_participation_context
    WHERE content_id = NEW.content_id AND id = NEW.context_id FOR UPDATE;
  IF FOUND AND NEW.revision <> coalesce(current_head, 0) + 1 THEN
    RAISE EXCEPTION 'Participation context revisions must append at the current head'
      USING ERRCODE = '23514', CONSTRAINT = 'software_context_revision_sequence_check';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS software_context_guard ON public.software_participation_context;
CREATE TRIGGER software_context_guard BEFORE UPDATE OR DELETE ON public.software_participation_context
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_software_context();

DROP TRIGGER IF EXISTS software_context_head_required ON public.software_participation_context;
CREATE CONSTRAINT TRIGGER software_context_head_required AFTER INSERT OR UPDATE ON public.software_participation_context
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_require_software_context_head();

DROP TRIGGER IF EXISTS software_context_revision_guard ON public.software_participation_context_revision;
CREATE TRIGGER software_context_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON public.software_participation_context_revision
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_software_context_revision();

DROP TRIGGER IF EXISTS software_context_occurrence_guard ON public.software_participation_source_occurrence;
CREATE TRIGGER software_context_occurrence_guard BEFORE UPDATE OR DELETE ON public.software_participation_source_occurrence
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_software_context_revision();

CREATE OR REPLACE FUNCTION public.catalog_require_software_context_revision_head()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.software_participation_context
             WHERE content_id = NEW.content_id AND id = NEW.context_id
             AND (current_revision IS NULL OR current_revision < NEW.revision)) THEN
    RAISE EXCEPTION 'Participation context appended revision must become current in its transaction'
      USING ERRCODE = '23514', CONSTRAINT = 'software_context_appended_head_check';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS software_context_revision_head_required ON public.software_participation_context_revision;
CREATE CONSTRAINT TRIGGER software_context_revision_head_required AFTER INSERT ON public.software_participation_context_revision
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_require_software_context_revision_head();
