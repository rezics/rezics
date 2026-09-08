CREATE OR REPLACE FUNCTION public.catalog_source_guard_dependency()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE proposal public.catalog_source_adoption_proposal%ROWTYPE; binding public.catalog_source_binding_revision%ROWTYPE; root_claim public.catalog_source_mapping_claim%ROWTYPE;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Source dependency evidence is retained' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' THEN
    IF (to_jsonb(NEW)-'revoked_at'-'prepared_by_auth_user_id') IS DISTINCT FROM (to_jsonb(OLD)-'revoked_at'-'prepared_by_auth_user_id')
      OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at)
      OR (NEW.prepared_by_auth_user_id IS DISTINCT FROM OLD.prepared_by_auth_user_id AND NEW.prepared_by_auth_user_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Source dependency target and evidence are immutable' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO STRICT proposal FROM public.catalog_source_adoption_proposal WHERE source_record_id=NEW.source_record_id AND id=NEW.proposal_id FOR SHARE;
  SELECT * INTO STRICT root_claim FROM public.catalog_source_mapping_claim WHERE source_record_id=proposal.source_record_id AND mapping_key=proposal.mapping_key FOR SHARE;
  IF proposal.state<>'pending' OR proposal.expected_binding_revision<>root_claim.binding_revision THEN RAISE EXCEPTION 'Dependency must be prepared for its pending proposal exact binding' USING ERRCODE='23514'; END IF;
  IF NEW.snapshot_id<>proposal.snapshot_id AND (NEW.snapshot_id IS DISTINCT FROM root_claim.observed_snapshot_id OR root_claim.applied_correspondence_revision IS DISTINCT FROM root_claim.correspondence_revision) THEN
    RAISE EXCEPTION 'Previous dependency evidence requires the same root correspondence and exact adopted snapshot' USING ERRCODE='23514';
  END IF;
  SELECT * INTO STRICT binding FROM public.catalog_source_binding_revision WHERE source_record_id=NEW.dependency_source_record_id AND mapping_key=NEW.dependency_mapping_key AND revision=NEW.dependency_binding_revision;
  IF (NEW.publishing_id,NEW.music_id,NEW.program_id,NEW.software_id,NEW.entity_id,NEW.grouping_id,NEW.reference_id,NEW.distribution_id)
    IS DISTINCT FROM (binding.publishing_id,binding.music_id,binding.program_id,binding.software_id,binding.entity_id,binding.grouping_id,binding.reference_id,binding.distribution_id) THEN
    RAISE EXCEPTION 'Dependency target must match its exact source binding' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS catalog_source_dependency_guard ON public.catalog_source_proposal_dependency;
CREATE TRIGGER catalog_source_dependency_guard BEFORE INSERT OR UPDATE OR DELETE ON public.catalog_source_proposal_dependency
FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_dependency();
