CREATE OR REPLACE FUNCTION public.catalog_guard_software_participation()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND
      (NEW.content_id <> OLD.content_id OR NEW.id <> OLD.id OR
       NEW.current_revision IS NULL OR
       NEW.current_revision <> coalesce(OLD.current_revision, 0) + 1)) THEN
    RAISE EXCEPTION 'Participation identity is immutable and its head must advance by one'
      USING ERRCODE = '23514', CONSTRAINT = 'software_participation_transition_check';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_require_software_participation_head()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.software_participation
             WHERE content_id = NEW.content_id AND id = NEW.id AND current_revision IS NULL) THEN
    RAISE EXCEPTION 'Participation must have a current revision at commit'
      USING ERRCODE = '23514', CONSTRAINT = 'software_participation_committed_head_check';
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_guard_software_participation_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE current_head bigint;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Participation revisions and source occurrences are immutable'
      USING ERRCODE = '23514', CONSTRAINT = 'software_participation_history_immutable';
  END IF;
  SELECT current_revision INTO current_head FROM public.software_participation
    WHERE content_id = NEW.content_id AND id = NEW.participation_id FOR UPDATE;
  IF FOUND AND NEW.revision <> coalesce(current_head, 0) + 1 THEN
    RAISE EXCEPTION 'Participation revisions must append at the current head'
      USING ERRCODE = '23514', CONSTRAINT = 'software_participation_revision_sequence_check';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS software_participation_guard ON public.software_participation;
CREATE TRIGGER software_participation_guard BEFORE UPDATE OR DELETE ON public.software_participation
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_software_participation();

DROP TRIGGER IF EXISTS software_participation_head_required ON public.software_participation;
CREATE CONSTRAINT TRIGGER software_participation_head_required AFTER INSERT OR UPDATE ON public.software_participation
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_require_software_participation_head();

DROP TRIGGER IF EXISTS software_participation_revision_guard ON public.software_participation_revision;
CREATE TRIGGER software_participation_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON public.software_participation_revision
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_software_participation_revision();

DROP TRIGGER IF EXISTS software_participation_occurrence_guard ON public.software_participation_credit_source_occurrence;
CREATE TRIGGER software_participation_occurrence_guard BEFORE UPDATE OR DELETE ON public.software_participation_credit_source_occurrence
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_software_participation_revision();

CREATE OR REPLACE FUNCTION public.catalog_require_software_participation_revision_head()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.software_participation
             WHERE content_id = NEW.content_id AND id = NEW.participation_id
             AND (current_revision IS NULL OR current_revision < NEW.revision)) THEN
    RAISE EXCEPTION 'Participation appended revision must become current in its transaction'
      USING ERRCODE = '23514', CONSTRAINT = 'software_participation_appended_head_check';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS software_participation_revision_head_required ON public.software_participation_revision;
CREATE CONSTRAINT TRIGGER software_participation_revision_head_required AFTER INSERT ON public.software_participation_revision
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_require_software_participation_revision_head();

CREATE OR REPLACE FUNCTION public.catalog_validate_software_participation() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.entity_identity WHERE id = NEW.entity_id AND shape IN ('person','organization','collective','unresolved','label')) THEN
    RAISE EXCEPTION 'Participation actor must be a person, organization or collective' USING ERRCODE = '23514';
  END IF;
  IF NEW.character_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.entity_identity WHERE id = NEW.character_id AND shape = 'character') THEN
    RAISE EXCEPTION 'Voice participation requires a Character' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.catalog_definition_revision r JOIN public.catalog_definition d ON d.id = r.definition_id WHERE r.id = NEW.role_revision_id AND d.kind = 'vocabulary') THEN
    RAISE EXCEPTION 'Participation role requires a vocabulary revision' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS software_participation_values ON public.software_participation_revision;
CREATE TRIGGER software_participation_values BEFORE INSERT ON public.software_participation_revision
FOR EACH ROW EXECUTE FUNCTION public.catalog_validate_software_participation();
