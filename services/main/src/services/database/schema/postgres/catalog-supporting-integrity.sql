CREATE OR REPLACE FUNCTION public.catalog_guard_supporting_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE owner_revision bigint;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Supporting catalog history is append-only'
      USING ERRCODE = '23514', CONSTRAINT = 'catalog_supporting_history_immutable';
  END IF;
  EXECUTE format('SELECT revision FROM public.%I WHERE id = $1', TG_ARGV[0])
    INTO owner_revision USING NEW.owner_id;
  IF owner_revision IS DISTINCT FROM NEW.revision THEN
    RAISE EXCEPTION 'Supporting catalog revision must match its current owner revision'
      USING ERRCODE = '23514', CONSTRAINT = 'catalog_supporting_revision_head_check';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS entity_catalog_profile_revision_guard ON public.entity_catalog_profile_revision;
CREATE TRIGGER entity_catalog_profile_revision_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.entity_catalog_profile_revision
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_supporting_revision('entity_identity');

DROP TRIGGER IF EXISTS reference_catalog_profile_revision_guard ON public.reference_catalog_profile_revision;
CREATE TRIGGER reference_catalog_profile_revision_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.reference_catalog_profile_revision
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_supporting_revision('reference_identity');

DROP TRIGGER IF EXISTS grouping_command_revision_guard ON public.grouping_command_revision;
CREATE TRIGGER grouping_command_revision_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.grouping_command_revision
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_supporting_revision('grouping_identity');

CREATE OR REPLACE FUNCTION public.catalog_guard_supporting_classification()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE field_name text; revision_id uuid; definition_kind text;
BEGIN
  FOREACH field_name IN ARRAY TG_ARGV LOOP
    revision_id := (to_jsonb(NEW) ->> field_name)::uuid;
    IF revision_id IS NULL THEN CONTINUE; END IF;
    SELECT d.kind INTO definition_kind FROM public.catalog_definition_revision r
      JOIN public.catalog_definition d ON d.id = r.definition_id WHERE r.id = revision_id;
    IF definition_kind IS NULL OR
       (field_name = 'class_revision_id' AND definition_kind <> 'class') OR
       (field_name = 'gender_revision_id' AND definition_kind <> 'vocabulary') OR
       (field_name = 'type_revision_id' AND definition_kind NOT IN ('class', 'vocabulary')) THEN
      RAISE EXCEPTION 'Supporting catalog classification has an incompatible definition kind'
        USING ERRCODE = '23514', CONSTRAINT = 'catalog_supporting_classification_kind_check';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS entity_catalog_profile_classification_guard ON public.entity_catalog_profile;
CREATE TRIGGER entity_catalog_profile_classification_guard BEFORE INSERT OR UPDATE ON public.entity_catalog_profile
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_supporting_classification('type_revision_id', 'gender_revision_id');
DROP TRIGGER IF EXISTS reference_area_classification_guard ON public.reference_area;
CREATE TRIGGER reference_area_classification_guard BEFORE INSERT OR UPDATE ON public.reference_area
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_supporting_classification('type_revision_id');
DROP TRIGGER IF EXISTS reference_place_classification_guard ON public.reference_place;
CREATE TRIGGER reference_place_classification_guard BEFORE INSERT OR UPDATE ON public.reference_place
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_supporting_classification('type_revision_id');
DROP TRIGGER IF EXISTS reference_event_classification_guard ON public.reference_event;
CREATE TRIGGER reference_event_classification_guard BEFORE INSERT OR UPDATE ON public.reference_event
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_supporting_classification('type_revision_id');
DROP TRIGGER IF EXISTS reference_instrument_classification_guard ON public.reference_instrument;
CREATE TRIGGER reference_instrument_classification_guard BEFORE INSERT OR UPDATE ON public.reference_instrument
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_supporting_classification('type_revision_id');
DROP TRIGGER IF EXISTS reference_concept_classification_guard ON public.reference_concept;
CREATE TRIGGER reference_concept_classification_guard BEFORE INSERT OR UPDATE ON public.reference_concept
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_supporting_classification('type_revision_id');
DROP TRIGGER IF EXISTS grouping_class_assignment_classification_guard ON public.grouping_class_assignment;
CREATE TRIGGER grouping_class_assignment_classification_guard BEFORE INSERT OR UPDATE ON public.grouping_class_assignment
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_supporting_classification('class_revision_id');
