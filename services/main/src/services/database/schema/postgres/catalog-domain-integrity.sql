CREATE OR REPLACE FUNCTION public.catalog_guard_installment_parent()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE cyclic boolean; beyond_budget boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.id <> OLD.id OR NEW.serialization_id <> OLD.serialization_id) THEN
    RAISE EXCEPTION 'Installment identity and owner are immutable'
      USING ERRCODE = '23514', CONSTRAINT = 'publishing_installment_identity_immutable';
  END IF;
  PERFORM 1 FROM public.publishing_serialization WHERE id = NEW.serialization_id FOR UPDATE;
  IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;
  WITH RECURSIVE ancestors AS (
    SELECT id, parent_id, 1 AS depth FROM public.publishing_installment
      WHERE serialization_id = NEW.serialization_id AND id = NEW.parent_id
    UNION ALL
    SELECT parent.id, parent.parent_id, ancestors.depth + 1
      FROM public.publishing_installment AS parent
      JOIN ancestors ON parent.id = ancestors.parent_id
      WHERE parent.serialization_id = NEW.serialization_id AND ancestors.depth < 256
  ) SELECT coalesce(bool_or(id = NEW.id), false),
           coalesce(bool_or(depth = 256), false)
      INTO cyclic, beyond_budget FROM ancestors;
  IF cyclic OR beyond_budget THEN
    RAISE EXCEPTION 'Installment parent creates a cycle or exceeds the 256-level grammar'
      USING ERRCODE = '23514', CONSTRAINT = 'publishing_installment_acyclic';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS publishing_installment_parent_guard ON public.publishing_installment;
CREATE TRIGGER publishing_installment_parent_guard
BEFORE INSERT OR UPDATE OF id, serialization_id, parent_id ON public.publishing_installment
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_installment_parent();

DROP TRIGGER IF EXISTS reference_area_type_vocab_guard ON public.reference_area;
CREATE TRIGGER reference_area_type_vocab_guard
BEFORE INSERT OR UPDATE OF type_revision_id ON public.reference_area
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('type_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS reference_place_type_vocab_guard ON public.reference_place;
CREATE TRIGGER reference_place_type_vocab_guard
BEFORE INSERT OR UPDATE OF type_revision_id ON public.reference_place
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('type_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS reference_instrument_type_vocab_guard ON public.reference_instrument;
CREATE TRIGGER reference_instrument_type_vocab_guard
BEFORE INSERT OR UPDATE OF type_revision_id ON public.reference_instrument
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('type_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS reference_event_type_vocab_guard ON public.reference_event;
CREATE TRIGGER reference_event_type_vocab_guard
BEFORE INSERT OR UPDATE OF type_revision_id ON public.reference_event
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('type_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS entity_catalog_profile_type_vocab_guard ON public.entity_catalog_profile;
CREATE TRIGGER entity_catalog_profile_type_vocab_guard
BEFORE INSERT OR UPDATE OF type_revision_id ON public.entity_catalog_profile
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('type_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS entity_catalog_profile_gender_vocab_guard ON public.entity_catalog_profile;
CREATE TRIGGER entity_catalog_profile_gender_vocab_guard
BEFORE INSERT OR UPDATE OF gender_revision_id ON public.entity_catalog_profile
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('gender_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS publishing_text_version_method_vocab_guard ON public.publishing_text_version;
CREATE TRIGGER publishing_text_version_method_vocab_guard
BEFORE INSERT OR UPDATE OF method_revision_id ON public.publishing_text_version
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('method_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS publishing_publication_facet_definition_vocab_guard ON public.publishing_publication_facet;
CREATE TRIGGER publishing_publication_facet_definition_vocab_guard
BEFORE INSERT OR UPDATE OF definition_revision_id ON public.publishing_publication_facet
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS publishing_serialization_status_vocab_guard ON public.publishing_serialization;
CREATE TRIGGER publishing_serialization_status_vocab_guard
BEFORE INSERT OR UPDATE OF status_revision_id ON public.publishing_serialization
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('status_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS publishing_installment_kind_vocab_guard ON public.publishing_installment;
CREATE TRIGGER publishing_installment_kind_vocab_guard
BEFORE INSERT OR UPDATE OF kind_revision_id ON public.publishing_installment
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('kind_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS music_work_type_vocab_guard ON public.music_work;
CREATE TRIGGER music_work_type_vocab_guard
BEFORE INSERT OR UPDATE OF type_revision_id ON public.music_work
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('type_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS music_release_group_primary_type_vocab_guard ON public.music_release_group;
CREATE TRIGGER music_release_group_primary_type_vocab_guard
BEFORE INSERT OR UPDATE OF primary_type_revision_id ON public.music_release_group
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('primary_type_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS music_release_group_secondary_type_type_vocab_guard ON public.music_release_group_secondary_type;
CREATE TRIGGER music_release_group_secondary_type_type_vocab_guard
BEFORE INSERT OR UPDATE OF type_revision_id ON public.music_release_group_secondary_type
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('type_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS music_release_status_vocab_guard ON public.music_release;
CREATE TRIGGER music_release_status_vocab_guard
BEFORE INSERT OR UPDATE OF status_revision_id ON public.music_release
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('status_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS music_release_packaging_vocab_guard ON public.music_release;
CREATE TRIGGER music_release_packaging_vocab_guard
BEFORE INSERT OR UPDATE OF packaging_revision_id ON public.music_release
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('packaging_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS music_medium_format_vocab_guard ON public.music_medium;
CREATE TRIGGER music_medium_format_vocab_guard
BEFORE INSERT OR UPDATE OF format_revision_id ON public.music_medium
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('format_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS music_release_presentation_type_vocab_guard ON public.music_release_presentation;
CREATE TRIGGER music_release_presentation_type_vocab_guard
BEFORE INSERT OR UPDATE OF type_revision_id ON public.music_release_presentation
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('type_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS program_work_type_vocab_guard ON public.program_work;
CREATE TRIGGER program_work_type_vocab_guard
BEFORE INSERT OR UPDATE OF type_revision_id ON public.program_work
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('type_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS program_version_version_type_vocab_guard ON public.program_version;
CREATE TRIGGER program_version_version_type_vocab_guard
BEFORE INSERT OR UPDATE OF version_type_revision_id ON public.program_version
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('version_type_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS program_episode_type_vocab_guard ON public.program_episode;
CREATE TRIGGER program_episode_type_vocab_guard
BEFORE INSERT OR UPDATE OF type_revision_id ON public.program_episode
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('type_revision_id', 'vocabulary', 'optional');


DROP TRIGGER IF EXISTS software_release_type_vocab_guard ON public.software_release;
CREATE TRIGGER software_release_type_vocab_guard
BEFORE INSERT OR UPDATE OF type_revision_id ON public.software_release
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('type_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS software_release_content_release_type_vocab_guard ON public.software_release_content;
CREATE TRIGGER software_release_content_release_type_vocab_guard
BEFORE INSERT OR UPDATE OF release_type_revision_id ON public.software_release_content
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('release_type_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS software_release_platform_platform_vocab_guard ON public.software_release_platform;
CREATE TRIGGER software_release_platform_platform_vocab_guard
BEFORE INSERT OR UPDATE OF platform_revision_id ON public.software_release_platform
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('platform_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS software_release_medium_medium_type_vocab_guard ON public.software_release_medium;
CREATE TRIGGER software_release_medium_medium_type_vocab_guard
BEFORE INSERT OR UPDATE OF medium_type_revision_id ON public.software_release_medium
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('medium_type_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS software_release_language_channel_vocab_guard ON public.software_release_language;
CREATE TRIGGER software_release_language_channel_vocab_guard
BEFORE INSERT OR UPDATE OF channel_revision_id ON public.software_release_language
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('channel_revision_id', 'vocabulary', 'optional');
