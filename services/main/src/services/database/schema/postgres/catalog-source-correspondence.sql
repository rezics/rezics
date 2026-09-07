CREATE OR REPLACE FUNCTION public.catalog_source_guard_binding_correspondence()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE previous public.catalog_source_binding_revision%ROWTYPE; anchor public.catalog_source_binding_revision%ROWTYPE; same_meaning boolean;
BEGIN
  IF NEW.revision=1 THEN
    IF NEW.correspondence_revision<>1 THEN RAISE EXCEPTION 'Initial source correspondence must anchor itself' USING ERRCODE='23514'; END IF;
  ELSE
    SELECT * INTO previous FROM public.catalog_source_binding_revision WHERE source_record_id=NEW.source_record_id AND mapping_key=NEW.mapping_key AND revision=NEW.revision-1;
    IF NOT FOUND THEN RAISE EXCEPTION 'Source binding revisions must be contiguous' USING ERRCODE='23514'; END IF;
    same_meaning := (NEW.owner,NEW.mapping_version,NEW.publishing_id,NEW.music_id,NEW.program_id,NEW.software_id,NEW.entity_id,NEW.grouping_id,NEW.reference_id,NEW.distribution_id)
      IS NOT DISTINCT FROM (previous.owner,previous.mapping_version,previous.publishing_id,previous.music_id,previous.program_id,previous.software_id,previous.entity_id,previous.grouping_id,previous.reference_id,previous.distribution_id);
    IF NEW.correspondence_revision <> (CASE WHEN same_meaning THEN previous.correspondence_revision ELSE NEW.revision END) THEN
      RAISE EXCEPTION 'Correspondence changes only with native target or mapping meaning' USING ERRCODE='23514';
    END IF;
  END IF;
  IF NEW.correspondence_revision<>NEW.revision THEN
    SELECT * INTO anchor FROM public.catalog_source_binding_revision WHERE source_record_id=NEW.source_record_id AND mapping_key=NEW.mapping_key AND revision=NEW.correspondence_revision;
    IF NOT FOUND OR anchor.correspondence_revision<>anchor.revision OR
      (NEW.owner,NEW.mapping_version,NEW.publishing_id,NEW.music_id,NEW.program_id,NEW.software_id,NEW.entity_id,NEW.grouping_id,NEW.reference_id,NEW.distribution_id)
      IS DISTINCT FROM (anchor.owner,anchor.mapping_version,anchor.publishing_id,anchor.music_id,anchor.program_id,anchor.software_id,anchor.entity_id,anchor.grouping_id,anchor.reference_id,anchor.distribution_id) THEN
      RAISE EXCEPTION 'Correspondence requires the exact self-anchored target and mapping meaning' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS catalog_source_binding_correspondence_guard ON public.catalog_source_binding_revision;
CREATE TRIGGER catalog_source_binding_correspondence_guard BEFORE INSERT ON public.catalog_source_binding_revision
FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_binding_correspondence();

CREATE OR REPLACE FUNCTION public.catalog_source_guard_child_correspondence()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE anchor public.catalog_source_binding_revision%ROWTYPE; source_mapping uuid; source_epoch bigint;
BEGIN
  IF TG_ARGV[0]='source-support' THEN
    source_mapping := NEW.source_mapping_key; source_epoch := NEW.source_correspondence_revision;
    IF source_mapping IS NULL AND source_epoch IS NULL THEN RETURN NEW; END IF;
  ELSE
    source_mapping := NEW.mapping_key; source_epoch := NEW.correspondence_revision;
  END IF;
  SELECT * INTO anchor FROM public.catalog_source_binding_revision WHERE source_record_id=NEW.source_record_id AND mapping_key=source_mapping AND revision=source_epoch;
  IF NOT FOUND OR anchor.correspondence_revision<>anchor.revision THEN RAISE EXCEPTION 'Source child correspondence requires its exact epoch anchor' USING ERRCODE='23514'; END IF;
  IF TG_ARGV[0]='software-context' THEN
    IF anchor.owner<>'software' OR anchor.software_id IS DISTINCT FROM NEW.content_id THEN
      RAISE EXCEPTION 'Source context correspondence must target its exact software content' USING ERRCODE='23514';
    END IF;
  END IF;
  IF TG_ARGV[0]='software-owner' THEN
    IF anchor.owner<>'software' OR anchor.software_id IS DISTINCT FROM NEW.owner_id THEN
      RAISE EXCEPTION 'Source scalar or component correspondence must target its exact software owner' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS software_context_correspondence_guard ON public.software_participation_source_occurrence;
CREATE TRIGGER software_context_correspondence_guard BEFORE INSERT ON public.software_participation_source_occurrence
FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_child_correspondence('software-context');
DROP TRIGGER IF EXISTS software_credit_correspondence_guard ON public.software_participation_credit_source_occurrence;
CREATE TRIGGER software_credit_correspondence_guard BEFORE INSERT ON public.software_participation_credit_source_occurrence
FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_child_correspondence('software-context');
DROP TRIGGER IF EXISTS software_record_correspondence_guard ON public.software_record_source_occurrence;
CREATE TRIGGER software_record_correspondence_guard BEFORE INSERT ON public.software_record_source_occurrence
FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_child_correspondence('software-owner');
DROP TRIGGER IF EXISTS software_component_correspondence_guard ON public.software_component_source_occurrence;
CREATE TRIGGER software_component_correspondence_guard BEFORE INSERT ON public.software_component_source_occurrence
FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_child_correspondence('software-owner');
DO $$ DECLARE owner_name text; family text;
BEGIN
  FOREACH owner_name IN ARRAY ARRAY['publishing','music','program','software','entity','grouping','reference','distribution'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_support_correspondence_guard ON public.%I',owner_name || '_fact_support');
    EXECUTE format('CREATE TRIGGER catalog_support_correspondence_guard BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_child_correspondence(%L)',owner_name || '_fact_support','source-support');
    FOREACH family IN ARRAY ARRAY['name_source_binding','name_source_occurrence'] LOOP
      EXECUTE format('DROP TRIGGER IF EXISTS catalog_name_correspondence_guard ON public.%I',owner_name || '_' || family);
      EXECUTE format('CREATE TRIGGER catalog_name_correspondence_guard BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_child_correspondence(%L)',owner_name || '_' || family,'name');
    END LOOP;
  END LOOP;
  FOREACH owner_name IN ARRAY ARRAY['entity','reference'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_profile_correspondence_guard ON public.%I',owner_name || '_profile_source_occurrence');
    EXECUTE format('CREATE TRIGGER catalog_profile_correspondence_guard BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_child_correspondence(%L)',owner_name || '_profile_source_occurrence','profile');
  END LOOP;
END $$;
