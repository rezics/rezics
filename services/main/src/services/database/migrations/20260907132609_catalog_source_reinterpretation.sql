SET search_path TO public;

-- Modify "software_record_source_occurrence" table
ALTER TABLE "software_record_source_occurrence" ADD CONSTRAINT "software_record_source_value_check" CHECK ((source_shape = ANY (ARRAY['content'::text, 'release'::text])) AND (jsonb_typeof(source_value) = 'object'::text) AND (octet_length((source_value)::text) <= 2097152)), ADD CONSTRAINT "software_record_source_value_shape_check" CHECK (
CASE source_shape
    WHEN 'content'::text THEN ((source_value ?& ARRAY['originalLanguageTag'::text, 'developmentStatus'::text, 'description'::text]) AND ((source_value - ARRAY['originalLanguageTag'::text, 'developmentStatus'::text, 'description'::text]) = '{}'::jsonb) AND (jsonb_typeof((source_value -> 'originalLanguageTag'::text)) = ANY (ARRAY['null'::text, 'string'::text])) AND (jsonb_typeof((source_value -> 'description'::text)) = ANY (ARRAY['null'::text, 'string'::text])) AND ((jsonb_typeof((source_value -> 'developmentStatus'::text)) = 'null'::text) OR ((source_value ->> 'developmentStatus'::text) = ANY (ARRAY['finished'::text, 'in_development'::text, 'cancelled'::text]))))
    WHEN 'release'::text THEN ((source_value ?& ARRAY['typeRevisionId'::text, 'isPatch'::text, 'freeware'::text, 'uncensored'::text, 'hasEroticContent'::text, 'minimumAge'::text, 'resolution'::text, 'engine'::text, 'voicing'::text, 'notes'::text, 'gtin'::text, 'catalogNumber'::text, 'date'::text]) AND ((source_value - ARRAY['typeRevisionId'::text, 'isPatch'::text, 'freeware'::text, 'uncensored'::text, 'hasEroticContent'::text, 'minimumAge'::text, 'resolution'::text, 'engine'::text, 'voicing'::text, 'notes'::text, 'gtin'::text, 'catalogNumber'::text, 'date'::text]) = '{}'::jsonb) AND (jsonb_typeof((source_value -> 'typeRevisionId'::text)) = ANY (ARRAY['null'::text, 'string'::text])) AND (jsonb_typeof((source_value -> 'engine'::text)) = ANY (ARRAY['null'::text, 'string'::text])) AND (jsonb_typeof((source_value -> 'notes'::text)) = ANY (ARRAY['null'::text, 'string'::text])) AND (jsonb_typeof((source_value -> 'gtin'::text)) = ANY (ARRAY['null'::text, 'string'::text])) AND (jsonb_typeof((source_value -> 'catalogNumber'::text)) = ANY (ARRAY['null'::text, 'string'::text])) AND (jsonb_typeof((source_value -> 'isPatch'::text)) = ANY (ARRAY['null'::text, 'boolean'::text])) AND (jsonb_typeof((source_value -> 'freeware'::text)) = ANY (ARRAY['null'::text, 'boolean'::text])) AND (jsonb_typeof((source_value -> 'uncensored'::text)) = ANY (ARRAY['null'::text, 'boolean'::text])) AND (jsonb_typeof((source_value -> 'hasEroticContent'::text)) = ANY (ARRAY['null'::text, 'boolean'::text])) AND (jsonb_typeof((source_value -> 'minimumAge'::text)) = ANY (ARRAY['null'::text, 'number'::text])) AND (jsonb_typeof((source_value -> 'resolution'::text)) = ANY (ARRAY['null'::text, 'object'::text])) AND (jsonb_typeof((source_value -> 'date'::text)) = 'object'::text) AND ((jsonb_typeof((source_value -> 'voicing'::text)) = 'null'::text) OR ((source_value ->> 'voicing'::text) = ANY (ARRAY['none'::text, 'erotic_only'::text, 'partial'::text, 'full'::text]))))
    ELSE false
END), ADD COLUMN "source_shape" text NOT NULL, ADD COLUMN "source_value" jsonb NOT NULL;
-- Modify "music_artist_credit" table
ALTER TABLE "music_artist_credit" ADD COLUMN "created_for_music_id" uuid NULL, ADD CONSTRAINT "music_artist_credit_created_for_music_id_music_identity_id_fkey" FOREIGN KEY ("created_for_music_id") REFERENCES "music_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "music_artist_credit_context_idx" to table: "music_artist_credit"
CREATE INDEX "music_artist_credit_context_idx" ON "music_artist_credit" ("created_for_music_id", "id");

CREATE OR REPLACE FUNCTION public.catalog_source_application_includes_epoch(source_id uuid, requested_proposal_id uuid, mapping_id uuid, epoch_revision bigint)
RETURNS boolean LANGUAGE sql STABLE SET search_path = pg_catalog, public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.catalog_source_adoption_proposal p
    JOIN public.catalog_source_binding_revision r ON r.source_record_id=p.source_record_id AND r.mapping_key=p.mapping_key AND r.revision=p.expected_binding_revision
    WHERE p.source_record_id=source_id AND p.id=requested_proposal_id AND p.mapping_key=mapping_id AND r.correspondence_revision=epoch_revision
    UNION ALL
    SELECT 1 FROM public.catalog_source_application a
    WHERE a.source_record_id=source_id AND a.proposal_id=requested_proposal_id
      AND a.mapping_key=mapping_id AND a.action='apply' AND a.previous_correspondence_revision=epoch_revision
      AND a.previous_observed_snapshot_id IS NOT NULL
  )
$$;

CREATE OR REPLACE FUNCTION public.catalog_source_validate_application_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE history public.music_component_revision%ROWTYPE; application public.catalog_source_application%ROWTYPE; proposal_state text; after_sequence bigint;
BEGIN
  SELECT * INTO STRICT application FROM public.catalog_source_application WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action;
  SELECT state INTO STRICT proposal_state FROM public.catalog_source_adoption_proposal WHERE source_record_id=NEW.source_record_id AND id=NEW.proposal_id;
  IF NEW.position >= application.change_count OR (NEW.action='apply' AND proposal_state <> 'pending') OR (NEW.action='withdraw' AND proposal_state <> 'applied') THEN
    RAISE EXCEPTION 'Native change must belong to its in-progress application' USING ERRCODE = '23514';
  END IF;
  IF TG_ARGV[0] = 'music' THEN
    SELECT * INTO STRICT history FROM public.music_component_revision WHERE owner_id = NEW.owner_id AND id = NEW.after_revision_id;
    IF history.component <> NEW.component OR history.component_key <> NEW.component_key THEN
      RAISE EXCEPTION 'Music application history has a different component key' USING ERRCODE = '23514';
    END IF;
    after_sequence := history.component_sequence;
    IF NEW.before_revision_id IS NOT NULL THEN
      SELECT * INTO STRICT history FROM public.music_component_revision WHERE owner_id = NEW.owner_id AND id = NEW.before_revision_id;
      IF history.component <> NEW.component OR history.component_key <> NEW.component_key OR history.component_sequence >= after_sequence THEN
        RAISE EXCEPTION 'Music application before history has a different component or order' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.catalog_source_require_application_complete()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE application public.catalog_source_application%ROWTYPE; proposal public.catalog_source_adoption_proposal%ROWTYPE;
  actual_count integer; unique_positions integer; first_position integer; last_position integer;
BEGIN
  SELECT * INTO STRICT application FROM public.catalog_source_application
    WHERE source_record_id = NEW.source_record_id AND proposal_id = NEW.proposal_id AND action = NEW.action;
  SELECT * INTO STRICT proposal FROM public.catalog_source_adoption_proposal
    WHERE source_record_id = NEW.source_record_id AND id = NEW.proposal_id;
  IF application.mapping_key <> proposal.mapping_key THEN RAISE EXCEPTION 'Native application must retain the exact proposal mapping' USING ERRCODE='23514'; END IF;
  IF application.previous_correspondence_revision IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.catalog_source_binding_revision b WHERE b.source_record_id=application.source_record_id AND b.mapping_key=application.mapping_key AND b.revision=application.previous_correspondence_revision AND b.correspondence_revision=b.revision
  ) THEN RAISE EXCEPTION 'Previous native source correspondence must reference an epoch anchor' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.catalog_source_binding_revision b WHERE b.source_record_id=proposal.source_record_id AND b.mapping_key=proposal.mapping_key AND b.revision=proposal.expected_binding_revision AND
    application.previous_snapshot_id IS NOT DISTINCT FROM CASE WHEN application.previous_correspondence_revision=b.correspondence_revision THEN application.previous_observed_snapshot_id ELSE NULL END
  ) THEN RAISE EXCEPTION 'Effective previous source snapshot must match the proposal correspondence epoch' USING ERRCODE='23514'; END IF;
  IF (application.action = 'apply' AND proposal.state NOT IN ('applied','withdrawn'))
    OR (application.action = 'withdraw' AND proposal.state <> 'withdrawn') THEN
    RAISE EXCEPTION 'Native application must commit its corresponding proposal decision' USING ERRCODE = '23514';
  END IF;
  SELECT count(*), count(DISTINCT position), min(position), max(position)
    INTO actual_count, unique_positions, first_position, last_position FROM (
      SELECT position FROM public.music_source_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.software_source_component_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.software_source_record_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.publishing_source_semantic_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.publishing_source_name_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.publishing_source_authority_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.music_source_semantic_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.music_source_name_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.music_source_authority_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.program_source_semantic_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.program_source_name_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.program_source_authority_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.software_source_semantic_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.software_source_name_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.software_source_authority_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.entity_source_semantic_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.entity_source_name_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.entity_source_authority_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.grouping_source_semantic_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.grouping_source_name_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.grouping_source_authority_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.reference_source_semantic_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.reference_source_name_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.reference_source_authority_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.distribution_source_semantic_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.distribution_source_name_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.distribution_source_authority_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.software_source_context_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.software_source_participation_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.entity_source_profile_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.reference_source_profile_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.publishing_source_identifier_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.music_source_identifier_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.program_source_identifier_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.software_source_identifier_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.entity_source_identifier_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.grouping_source_identifier_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.reference_source_identifier_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.distribution_source_identifier_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
    ) changes;
  IF actual_count <> application.change_count OR unique_positions <> actual_count
    OR (actual_count > 0 AND (first_position <> 0 OR last_position <> actual_count - 1)) THEN
    RAISE EXCEPTION 'Native application requires a complete contiguous change manifest' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END $$;

DO $$
DECLARE relation_name text; physical record;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY['catalog_source_application','music_source_application_change','software_source_component_application_change','software_source_record_application_change','publishing_source_semantic_application_change','publishing_source_name_application_change','publishing_source_authority_application_change','publishing_source_identifier_application_change','music_source_semantic_application_change','music_source_name_application_change','music_source_authority_application_change','music_source_identifier_application_change','program_source_semantic_application_change','program_source_name_application_change','program_source_authority_application_change','program_source_identifier_application_change','software_source_semantic_application_change','software_source_name_application_change','software_source_authority_application_change','software_source_identifier_application_change','entity_source_semantic_application_change','entity_source_name_application_change','entity_source_authority_application_change','entity_source_identifier_application_change','grouping_source_semantic_application_change','grouping_source_name_application_change','grouping_source_authority_application_change','grouping_source_identifier_application_change','reference_source_semantic_application_change','reference_source_name_application_change','reference_source_authority_application_change','reference_source_identifier_application_change','distribution_source_semantic_application_change','distribution_source_name_application_change','distribution_source_authority_application_change','distribution_source_identifier_application_change','software_source_context_application_change','software_source_participation_application_change','entity_source_profile_application_change','reference_source_profile_application_change'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_source_application_immutable ON public.%I', relation_name);
    EXECUTE format('CREATE TRIGGER catalog_source_application_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_immutable_evidence()', relation_name);
    IF relation_name NOT IN ('catalog_source_application','music_source_application_change') THEN
      EXECUTE format('DROP TRIGGER IF EXISTS catalog_source_application_change_guard ON public.%I', relation_name);
      EXECUTE format('CREATE TRIGGER catalog_source_application_change_guard BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_source_validate_application_change()', relation_name);
    END IF;
  END LOOP;
  FOR physical IN
    WITH RECURSIVE roots AS (
      SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN ('catalog_source_application','music_source_application_change','software_source_component_application_change','software_source_record_application_change','publishing_source_semantic_application_change','publishing_source_name_application_change','publishing_source_authority_application_change','publishing_source_identifier_application_change','music_source_semantic_application_change','music_source_name_application_change','music_source_authority_application_change','music_source_identifier_application_change','program_source_semantic_application_change','program_source_name_application_change','program_source_authority_application_change','program_source_identifier_application_change','software_source_semantic_application_change','software_source_name_application_change','software_source_authority_application_change','software_source_identifier_application_change','entity_source_semantic_application_change','entity_source_name_application_change','entity_source_authority_application_change','entity_source_identifier_application_change','grouping_source_semantic_application_change','grouping_source_name_application_change','grouping_source_authority_application_change','grouping_source_identifier_application_change','reference_source_semantic_application_change','reference_source_name_application_change','reference_source_authority_application_change','reference_source_identifier_application_change','distribution_source_semantic_application_change','distribution_source_name_application_change','distribution_source_authority_application_change','distribution_source_identifier_application_change','software_source_context_application_change','software_source_participation_application_change','entity_source_profile_application_change','reference_source_profile_application_change')
      UNION ALL SELECT i.inhrelid FROM pg_inherits i JOIN roots r ON r.oid=i.inhparent
    ) SELECT c.oid::regclass AS name, c.relname AS local_name FROM roots r JOIN pg_class c ON c.oid=r.oid WHERE c.relkind='r'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_source_application_complete ON %s', physical.name);
    IF physical.local_name LIKE 'catalog_source_application%' THEN
      EXECUTE format('CREATE CONSTRAINT TRIGGER catalog_source_application_complete AFTER INSERT ON %s DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_source_require_application_complete()', physical.name);
    END IF;
  END LOOP;
END $$;
DROP TRIGGER IF EXISTS music_source_application_exact_component ON public.music_source_application_change;
CREATE TRIGGER music_source_application_exact_component BEFORE INSERT ON public.music_source_application_change
  FOR EACH ROW EXECUTE FUNCTION public.catalog_source_validate_application_change('music');

CREATE OR REPLACE FUNCTION public.catalog_source_guard_proposal()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Source proposal decisions are retained evidence' USING ERRCODE='23514'; END IF;
  IF (NEW.source_record_id,NEW.id,NEW.snapshot_id,NEW.mapping_key,NEW.mapping_owner,NEW.mapping_version,NEW.expected_target_revision,NEW.expected_binding_revision,NEW.expected_policy_revision,NEW.created_at)
    IS DISTINCT FROM (OLD.source_record_id,OLD.id,OLD.snapshot_id,OLD.mapping_key,OLD.mapping_owner,OLD.mapping_version,OLD.expected_target_revision,OLD.expected_binding_revision,OLD.expected_policy_revision,OLD.created_at)
    OR (NEW.proposer_auth_user_id IS DISTINCT FROM OLD.proposer_auth_user_id AND NEW.proposer_auth_user_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Source proposal scope and preconditions are immutable' USING ERRCODE='23514';
  END IF;
  IF NEW.state = OLD.state THEN
    IF (NEW.decided_at,NEW.decision_reason,NEW.applied_target_revision) IS DISTINCT FROM (OLD.decided_at,OLD.decision_reason,OLD.applied_target_revision) THEN
      RAISE EXCEPTION 'Source proposal decisions are immutable without an allowed transition' USING ERRCODE='23514';
    END IF;
  ELSIF NOT ((OLD.state='pending' AND NEW.state IN ('applied','rejected','superseded')) OR (OLD.state='applied' AND NEW.state='withdrawn')) THEN
    RAISE EXCEPTION 'Source proposal transition is not allowed' USING ERRCODE='23514';
  END IF;
  IF NEW.state IN ('applied','withdrawn') AND NOT EXISTS (
    SELECT 1 FROM public.catalog_source_application WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.id
      AND action=CASE WHEN NEW.state='applied' THEN 'apply' ELSE 'withdraw' END AND after_revision=NEW.applied_target_revision
  ) THEN
    RAISE EXCEPTION 'Source proposal decision requires its exact native application' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS catalog_source_proposal_guard ON public.catalog_source_adoption_proposal;
CREATE TRIGGER catalog_source_proposal_guard BEFORE UPDATE OR DELETE ON public.catalog_source_adoption_proposal
  FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_proposal();


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
DECLARE anchor public.catalog_source_binding_revision%ROWTYPE; source_mapping uuid; source_epoch bigint; native_shape text;
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
  IF TG_ARGV[0] IN ('software-owner','software-record') THEN
    IF anchor.owner<>'software' OR anchor.software_id IS DISTINCT FROM NEW.owner_id THEN
      RAISE EXCEPTION 'Source scalar or component correspondence must target its exact software owner' USING ERRCODE='23514';
    END IF;
  END IF;
  IF TG_ARGV[0]='software-record' THEN
    SELECT shape INTO STRICT native_shape FROM public.software_record_revision WHERE owner_id=NEW.owner_id AND revision=NEW.revision;
    IF native_shape IS DISTINCT FROM NEW.source_shape THEN RAISE EXCEPTION 'Source scalar interpretation must match its exact native history shape' USING ERRCODE='23514'; END IF;
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
FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_child_correspondence('software-record');
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


CREATE OR REPLACE FUNCTION public.catalog_source_guard_owned_baseline() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE matched boolean; source_matched boolean; native_head bigint; source_epoch bigint;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Source/native baselines require reviewed retention, not ad hoc deletion' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.source_record_id <> OLD.source_record_id OR NEW.mapping_key <> OLD.mapping_key OR NEW.correspondence_revision <> OLD.correspondence_revision OR NEW.owner_id <> OLD.owner_id OR to_jsonb(NEW)->'component_key' IS DISTINCT FROM to_jsonb(OLD)->'component_key' OR to_jsonb(NEW)->'component' IS DISTINCT FROM to_jsonb(OLD)->'component' OR to_jsonb(NEW)->'kind' IS DISTINCT FROM to_jsonb(OLD)->'kind') THEN
    RAISE EXCEPTION 'Source/native baseline identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.catalog_source_adoption_proposal WHERE source_record_id=NEW.source_record_id AND id=NEW.last_proposal_id AND mapping_key=NEW.mapping_key) THEN
    RAISE EXCEPTION 'Baseline application belongs to another mapping' USING ERRCODE = '23514';
  END IF;
  SELECT r.correspondence_revision INTO STRICT source_epoch
  FROM public.catalog_source_adoption_proposal p JOIN public.catalog_source_binding_revision r
    ON r.source_record_id=p.source_record_id AND r.mapping_key=p.mapping_key AND r.revision=p.expected_binding_revision
  WHERE p.source_record_id=NEW.source_record_id AND p.id=NEW.last_proposal_id;
  IF NOT public.catalog_source_application_includes_epoch(NEW.source_record_id,NEW.last_proposal_id,NEW.mapping_key,NEW.correspondence_revision) OR NOT EXISTS (
    SELECT 1 FROM public.catalog_source_binding_revision WHERE source_record_id=NEW.source_record_id
      AND mapping_key=NEW.mapping_key AND revision=NEW.correspondence_revision AND owner=NEW.mapping_owner
  ) THEN RAISE EXCEPTION 'Baseline requires the proposal exact owner correspondence epoch' USING ERRCODE='23514'; END IF;
  source_epoch := NEW.correspondence_revision;
  IF TG_OP = 'UPDATE' AND NEW.current_revision <= OLD.current_revision THEN
    RAISE EXCEPTION 'Baseline native history must advance' USING ERRCODE = '23514';
  END IF;
  IF TG_ARGV[0] = 'owned' THEN
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE source_record_id=$1 AND proposal_id=$2 AND action=$3 AND owner_id=$4 AND component_key=$5 AND after_revision=$6)', TG_ARGV[1] || CASE NEW.kind WHEN 'catalog-semantic' THEN '_source_semantic_application_change' WHEN 'catalog-name' THEN '_source_name_application_change' WHEN 'catalog-name-authority' THEN '_source_authority_application_change' WHEN 'catalog-identifier' THEN '_source_identifier_application_change' END)
      INTO matched USING NEW.source_record_id, NEW.last_proposal_id, NEW.last_action, NEW.owner_id, NEW.component_key, NEW.current_revision;
  ELSIF TG_ARGV[0] = 'record' THEN
    SELECT EXISTS (SELECT 1 FROM public.software_source_record_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.last_proposal_id AND action=NEW.last_action AND owner_id=NEW.owner_id AND after_revision=NEW.current_revision) INTO matched;
  ELSIF TG_ARGV[0] = 'component' THEN
    SELECT EXISTS (SELECT 1 FROM public.software_source_component_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.last_proposal_id AND action=NEW.last_action AND owner_id=NEW.owner_id AND component=NEW.component AND component_key=NEW.component_key AND after_revision=NEW.current_revision) INTO matched;
  ELSE
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE source_record_id=$1 AND proposal_id=$2 AND action=$3 AND owner_id=$4 AND component_key=$5 AND after_revision=$6)', 'software_source_' || TG_ARGV[0] || '_application_change')
      INTO matched USING NEW.source_record_id, NEW.last_proposal_id, NEW.last_action, NEW.owner_id, NEW.component_key, NEW.current_revision;
  END IF;
  IF NOT matched THEN RAISE EXCEPTION 'Baseline current head is not backed by its exact native application' USING ERRCODE = '23514'; END IF;
  IF TG_ARGV[0] = 'owned' THEN
    IF NEW.kind = 'catalog-name' THEN
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE source_record_id=$1 AND snapshot_id=$2 AND owner_id=$3 AND name_id=$4 AND name_revision=$5 AND source_path=$6 AND mapping_key=$7 AND correspondence_revision=$8)', TG_ARGV[1] || '_name_source_occurrence') INTO source_matched USING NEW.source_record_id,NEW.source_snapshot_id,NEW.owner_id,NEW.component_key,NEW.source_revision,NEW.source_path,NEW.mapping_key,source_epoch;
    ELSIF NEW.kind = 'catalog-identifier' THEN
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE source_record_id=$1 AND snapshot_id=$2 AND owner_id=$3 AND identifier_id=$4 AND identifier_revision=$5 AND source_path=$6 AND source_mapping_key=$7 AND source_correspondence_revision=$8)', TG_ARGV[1] || '_fact_support') INTO source_matched USING NEW.source_record_id,NEW.source_snapshot_id,NEW.owner_id,NEW.component_key,NEW.source_revision,NEW.source_path,NEW.mapping_key,source_epoch;
    ELSIF NEW.kind = 'catalog-name-authority' THEN
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I a JOIN public.%I b ON b.owner_id=a.owner_id AND b.name_id=a.name_id WHERE a.source_record_id=$1 AND a.snapshot_id=$2 AND a.owner_id=$3 AND a.id=$4 AND a.revision=$5 AND a.source_path=$6 AND b.source_record_id=$1 AND b.mapping_key=$7 AND b.correspondence_revision=$8)', TG_ARGV[1] || '_name_authority_revision', TG_ARGV[1] || '_name_source_binding') INTO source_matched USING NEW.source_record_id,NEW.source_snapshot_id,NEW.owner_id,NEW.component_key,NEW.source_revision,NEW.source_path,NEW.mapping_key,source_epoch;
    ELSE
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I s JOIN public.%I v ON v.owner_id=s.owner_id AND v.id=s.fact_id WHERE s.source_record_id=$1 AND s.snapshot_id=$2 AND s.owner_id=$3 AND v.semantic_id=$4 AND v.expected_head_version+1=$5 AND s.source_path=$6 AND s.source_mapping_key=$7 AND s.source_correspondence_revision=$8 UNION ALL SELECT 1 FROM public.%I s JOIN public.%I v ON v.owner_id=s.owner_id AND v.id=s.relation_id WHERE s.source_record_id=$1 AND s.snapshot_id=$2 AND s.owner_id=$3 AND v.semantic_id=$4 AND v.expected_head_version+1=$5 AND s.source_path=$6 AND s.source_mapping_key=$7 AND s.source_correspondence_revision=$8)', TG_ARGV[1] || '_fact_support',TG_ARGV[1] || '_fact',TG_ARGV[1] || '_fact_support',TG_ARGV[1] || '_catalog_relation') INTO source_matched USING NEW.source_record_id,NEW.source_snapshot_id,NEW.owner_id,NEW.component_key,NEW.source_revision,NEW.source_path,NEW.mapping_key,source_epoch;
    END IF;
  ELSIF TG_ARGV[0] = 'record' THEN
    SELECT EXISTS (SELECT 1 FROM public.software_record_source_occurrence WHERE source_record_id=NEW.source_record_id AND snapshot_id=NEW.source_snapshot_id AND owner_id=NEW.owner_id AND revision=NEW.source_revision AND source_path=NEW.source_path AND mapping_key=NEW.mapping_key AND correspondence_revision=source_epoch) INTO source_matched;
  ELSIF TG_ARGV[0] = 'component' THEN
    SELECT EXISTS (SELECT 1 FROM public.software_component_source_occurrence WHERE source_record_id=NEW.source_record_id AND snapshot_id=NEW.source_snapshot_id AND owner_id=NEW.owner_id AND component=NEW.component AND component_key=NEW.component_key AND revision=NEW.source_revision AND source_path=NEW.source_path AND mapping_key=NEW.mapping_key AND correspondence_revision=source_epoch) INTO source_matched;
  ELSIF TG_ARGV[0] = 'context' THEN
    SELECT EXISTS (SELECT 1 FROM public.software_participation_source_occurrence WHERE source_record_id=NEW.source_record_id AND snapshot_id=NEW.source_snapshot_id AND content_id=NEW.owner_id AND context_id=NEW.component_key AND context_revision=NEW.source_revision AND source_pointer=NEW.source_path AND mapping_key=NEW.mapping_key AND correspondence_revision=source_epoch) INTO source_matched;
  ELSE
    SELECT EXISTS (SELECT 1 FROM public.software_participation_credit_source_occurrence WHERE source_record_id=NEW.source_record_id AND snapshot_id=NEW.source_snapshot_id AND content_id=NEW.owner_id AND participation_id=NEW.component_key AND participation_revision=NEW.source_revision AND source_path=NEW.source_path AND mapping_key=NEW.mapping_key AND correspondence_revision=source_epoch) INTO source_matched;
  END IF;
  IF NOT source_matched THEN RAISE EXCEPTION 'Baseline originating history is not backed by its exact source occurrence' USING ERRCODE = '23514'; END IF;
  IF TG_ARGV[0] = 'owned' THEN
    EXECUTE format('SELECT %I FROM public.%I WHERE owner_id=$1 AND %I=$2', CASE NEW.kind WHEN 'catalog-semantic' THEN 'version' ELSE 'revision' END, TG_ARGV[1] || CASE NEW.kind WHEN 'catalog-semantic' THEN '_semantic_head' WHEN 'catalog-name' THEN '_named_form' WHEN 'catalog-name-authority' THEN '_name_authority' WHEN 'catalog-identifier' THEN '_identifier_claim' END, CASE NEW.kind WHEN 'catalog-semantic' THEN 'semantic_id' ELSE 'id' END) INTO native_head USING NEW.owner_id,NEW.component_key;
  ELSIF TG_ARGV[0] = 'component' THEN
    SELECT revision INTO native_head FROM public.software_component_revision WHERE release_id=NEW.owner_id AND kind=NEW.component AND component_id=NEW.component_key ORDER BY revision DESC LIMIT 1;
  ELSIF TG_ARGV[0] = 'record' THEN
    SELECT revision INTO native_head FROM public.software_record_revision WHERE owner_id=NEW.owner_id ORDER BY revision DESC LIMIT 1;
  ELSE
    EXECUTE format('SELECT current_revision FROM public.%I WHERE content_id=$1 AND id=$2', CASE TG_ARGV[0] WHEN 'context' THEN 'software_participation_context' ELSE 'software_participation' END) INTO native_head USING NEW.owner_id,NEW.component_key;
  END IF;
  IF native_head IS DISTINCT FROM NEW.current_revision THEN RAISE EXCEPTION 'Baseline native history is no longer current' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
DO $$
DECLARE owner_name text; child text;
BEGIN
  FOREACH owner_name IN ARRAY ARRAY['publishing','music','program','software','entity','grouping','reference','distribution'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_source_baseline_guard ON public.%I', owner_name || '_source_owned_baseline');
    EXECUTE format('CREATE TRIGGER catalog_source_baseline_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_owned_baseline(%L,%L)', owner_name || '_source_owned_baseline', 'owned', owner_name);
  END LOOP;
  FOREACH child IN ARRAY ARRAY['record','component','context','participation'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_source_baseline_guard ON public.%I', 'software_source_' || child || '_baseline');
    EXECUTE format('CREATE TRIGGER catalog_source_baseline_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_owned_baseline(%L)', 'software_source_' || child || '_baseline', child);
  END LOOP;
  FOREACH child IN ARRAY ARRAY['software_component_source_occurrence','software_record_source_occurrence'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS software_source_occurrence_immutable ON public.%I', child);
    EXECUTE format('CREATE TRIGGER software_source_occurrence_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_immutable_evidence()', child);
  END LOOP;
END $$;


CREATE OR REPLACE FUNCTION public.catalog_validate_profile_source()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE valid boolean;
BEGIN
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE owner_id=$1 AND revision=$2 AND NOT removed)',TG_ARGV[0] || '_catalog_profile_revision') INTO valid USING NEW.owner_id,NEW.revision;
  IF NOT valid THEN RAISE EXCEPTION 'Profile source occurrence requires exact present native history' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.catalog_validate_profile_baseline()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE valid boolean; current_revision bigint;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Profile source baselines are retained correspondence' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND (OLD.source_record_id,OLD.mapping_key,OLD.correspondence_revision,OLD.mapping_owner,OLD.owner_id) IS DISTINCT FROM (NEW.source_record_id,NEW.mapping_key,NEW.correspondence_revision,NEW.mapping_owner,NEW.owner_id) THEN
    RAISE EXCEPTION 'Profile source baseline identity is immutable' USING ERRCODE='23514';
  END IF;
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE source_record_id=$1 AND snapshot_id=$2 AND owner_id=$3 AND source_path=$4 AND revision=$5 AND mapping_key=$6 AND correspondence_revision=$7)',TG_ARGV[0] || '_profile_source_occurrence') INTO valid USING NEW.source_record_id,NEW.source_snapshot_id,NEW.owner_id,NEW.source_path,NEW.source_revision,NEW.mapping_key,NEW.correspondence_revision;
  IF NOT valid THEN RAISE EXCEPTION 'Profile baseline requires exact immutable source occurrence' USING ERRCODE='23514'; END IF;
  EXECUTE format('SELECT revision FROM public.%I WHERE owner_id=$1 ORDER BY revision DESC LIMIT 1',TG_ARGV[0] || '_catalog_profile_revision') INTO current_revision USING NEW.owner_id;
  IF current_revision IS DISTINCT FROM NEW.current_revision THEN RAISE EXCEPTION 'Profile baseline must identify the current native profile head' USING ERRCODE='23514'; END IF;
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I c JOIN public.catalog_source_adoption_proposal p ON p.source_record_id=c.source_record_id AND p.id=c.proposal_id WHERE c.source_record_id=$1 AND c.proposal_id=$2 AND c.action=$3 AND c.owner_id=$4 AND c.after_revision=$5 AND p.mapping_key=$6)',TG_ARGV[0] || '_source_profile_application_change') INTO valid USING NEW.source_record_id,NEW.last_proposal_id,NEW.last_action,NEW.owner_id,NEW.current_revision,NEW.mapping_key;
  IF NOT valid THEN RAISE EXCEPTION 'Profile baseline requires its exact native application' USING ERRCODE='23514'; END IF;
  IF NOT public.catalog_source_application_includes_epoch(NEW.source_record_id,NEW.last_proposal_id,NEW.mapping_key,NEW.correspondence_revision) OR NOT EXISTS (
    SELECT 1 FROM public.catalog_source_binding_revision r WHERE r.source_record_id=NEW.source_record_id AND r.mapping_key=NEW.mapping_key AND r.revision=NEW.correspondence_revision AND r.owner=NEW.mapping_owner)
  THEN RAISE EXCEPTION 'Profile baseline requires its proposal owner correspondence epoch' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;

DO $$ DECLARE owner_name text;
BEGIN
  FOREACH owner_name IN ARRAY ARRAY['entity','reference'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_profile_source_immutable ON public.%I',owner_name || '_profile_source_occurrence');
    EXECUTE format('CREATE TRIGGER catalog_profile_source_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_immutable_evidence()',owner_name || '_profile_source_occurrence');
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_profile_source_exact ON public.%I',owner_name || '_profile_source_occurrence');
    EXECUTE format('CREATE TRIGGER catalog_profile_source_exact BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_validate_profile_source(%L)',owner_name || '_profile_source_occurrence',owner_name);
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_profile_baseline_exact ON public.%I',owner_name || '_source_profile_baseline');
    EXECUTE format('CREATE TRIGGER catalog_profile_baseline_exact BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_validate_profile_baseline(%L)',owner_name || '_source_profile_baseline',owner_name);
  END LOOP;
END $$;


CREATE OR REPLACE FUNCTION public.catalog_guard_music_component_head()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP='DELETE' OR pg_trigger_depth()<2 THEN
    RAISE EXCEPTION 'Music component heads are maintained by native history capture' USING ERRCODE='23514';
  END IF;
  IF TG_OP='INSERT' AND NEW.component_sequence<>1 THEN
    RAISE EXCEPTION 'Music component history must start at sequence one' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' AND ((OLD.owner_id,OLD.component,OLD.component_key) IS DISTINCT FROM (NEW.owner_id,NEW.component,NEW.component_key)
    OR NEW.component_sequence<>OLD.component_sequence+1) THEN
    RAISE EXCEPTION 'Music component sequence must advance exactly once' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.music_component_revision WHERE owner_id=NEW.owner_id AND id=NEW.history_id
    AND component=NEW.component AND component_key=NEW.component_key AND component_sequence=NEW.component_sequence) THEN
    RAISE EXCEPTION 'Music component head requires its exact immutable revision' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS music_component_head_maintained ON public.music_component_head;
CREATE TRIGGER music_component_head_maintained BEFORE INSERT OR UPDATE OR DELETE ON public.music_component_head
  FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_music_component_head();

CREATE OR REPLACE FUNCTION public.catalog_guard_music_revision_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF pg_trigger_depth()<2 THEN
    RAISE EXCEPTION 'Music history is captured from native rows, not caller-supplied snapshots' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS music_component_revision_capture_only ON public.music_component_revision;
CREATE TRIGGER music_component_revision_capture_only BEFORE INSERT ON public.music_component_revision
  FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_music_revision_insert();

CREATE OR REPLACE FUNCTION public.catalog_check_music_source_baseline()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE native public.music_component_revision%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.source_record_id, OLD.mapping_key, OLD.correspondence_revision, OLD.owner_id, OLD.component, OLD.component_key)
    IS DISTINCT FROM (NEW.source_record_id, NEW.mapping_key, NEW.correspondence_revision, NEW.owner_id, NEW.component, NEW.component_key) THEN
    RAISE EXCEPTION 'Music source baseline identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.music_component_source_occurrence
    WHERE source_record_id=NEW.source_record_id AND mapping_key=NEW.mapping_key AND correspondence_revision=NEW.correspondence_revision AND snapshot_id=NEW.snapshot_id AND owner_id=NEW.owner_id
      AND component=NEW.component AND component_key=NEW.component_key AND source_path=NEW.source_path AND history_id=NEW.source_history_id) THEN
    RAISE EXCEPTION 'Music source baseline requires exact original source support' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO STRICT native FROM public.music_component_revision WHERE owner_id=NEW.owner_id AND id=NEW.current_history_id;
  IF native.component <> NEW.component OR native.component_key <> NEW.component_key OR (native.operation='DELETE') <> NEW.absent THEN
    RAISE EXCEPTION 'Music source baseline current component differs' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.music_source_application_change change
    JOIN public.catalog_source_adoption_proposal proposal ON proposal.source_record_id=change.source_record_id AND proposal.id=change.proposal_id
    WHERE change.source_record_id=NEW.source_record_id AND change.proposal_id=NEW.proposal_id AND change.action=NEW.action
      AND proposal.mapping_key=NEW.mapping_key AND change.owner_id=NEW.owner_id AND change.component=NEW.component
      AND change.component_key=NEW.component_key AND change.after_revision_id=NEW.current_history_id) THEN
    RAISE EXCEPTION 'Music source baseline requires exact native application proof' USING ERRCODE = '23514';
  END IF;
  IF NOT public.catalog_source_application_includes_epoch(NEW.source_record_id,NEW.proposal_id,NEW.mapping_key,NEW.correspondence_revision) OR NOT EXISTS (
    SELECT 1 FROM public.catalog_source_binding_revision r WHERE r.source_record_id=NEW.source_record_id AND r.mapping_key=NEW.mapping_key AND r.revision=NEW.correspondence_revision AND r.owner=NEW.mapping_owner)
  THEN RAISE EXCEPTION 'Music baseline requires its proposal owner correspondence epoch' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.music_component_head h WHERE h.owner_id=NEW.owner_id AND h.component=NEW.component AND h.component_key=NEW.component_key AND h.history_id=NEW.current_history_id)
  THEN RAISE EXCEPTION 'Music baseline must identify its exact current native head' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS music_source_baseline_proof ON public.music_component_source_baseline;
CREATE TRIGGER music_source_baseline_proof BEFORE INSERT OR UPDATE ON public.music_component_source_baseline
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_source_baseline();

-- Shared alternate text/credit values are replaced through exact occurrence revisions.
DROP TRIGGER IF EXISTS music_alternative_track_immutable ON public.music_alternative_track;
CREATE TRIGGER music_alternative_track_immutable BEFORE UPDATE OR DELETE ON public.music_alternative_track
  FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_music_history();

CREATE OR REPLACE FUNCTION public.catalog_check_music_definition_scope()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE revision_id uuid; policy jsonb;
BEGIN
  revision_id := (to_jsonb(NEW)->>TG_ARGV[0])::uuid;
  IF revision_id IS NULL THEN RETURN NEW; END IF;
  SELECT revision.constraints INTO policy FROM public.catalog_definition_revision revision
    JOIN public.catalog_definition definition ON definition.id=revision.definition_id
    WHERE revision.id=revision_id AND definition.kind='vocabulary';
  IF policy IS NULL OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(policy->'targets','[]'::jsonb)) target
    WHERE target->>'owner'='music' AND coalesce(target->'shapes','[]'::jsonb) ? TG_ARGV[1])
    OR NOT (coalesce(policy->'slots','[]'::jsonb) ? TG_ARGV[2]) THEN
    RAISE EXCEPTION 'Music vocabulary is outside its governed native target or slot'
      USING ERRCODE='23514', CONSTRAINT='music_definition_target_scope';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS music_release_status_scope ON public.music_release;
CREATE TRIGGER music_release_status_scope BEFORE INSERT OR UPDATE ON public.music_release
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_definition_scope('status_revision_id','release','music_release.status_revision_id');
DROP TRIGGER IF EXISTS music_release_packaging_scope ON public.music_release;
CREATE TRIGGER music_release_packaging_scope BEFORE INSERT OR UPDATE ON public.music_release
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_definition_scope('packaging_revision_id','release','music_release.packaging_revision_id');
DROP TRIGGER IF EXISTS music_medium_format_scope ON public.music_medium;
CREATE TRIGGER music_medium_format_scope BEFORE INSERT OR UPDATE ON public.music_medium
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_definition_scope('format_revision_id','release','music_medium.format_revision_id');
DROP TRIGGER IF EXISTS music_work_type_scope ON public.music_work;
CREATE TRIGGER music_work_type_scope BEFORE INSERT OR UPDATE ON public.music_work
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_definition_scope('type_revision_id','work','music_work.type_revision_id');
DROP TRIGGER IF EXISTS music_release_group_primary_scope ON public.music_release_group;
CREATE TRIGGER music_release_group_primary_scope BEFORE INSERT OR UPDATE ON public.music_release_group
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_definition_scope('primary_type_revision_id','release_group','music_release_group.primary_type_revision_id');
DROP TRIGGER IF EXISTS music_release_group_secondary_scope ON public.music_release_group_secondary_type;
CREATE TRIGGER music_release_group_secondary_scope BEFORE INSERT OR UPDATE ON public.music_release_group_secondary_type
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_definition_scope('type_revision_id','release_group','music_release_group_secondary_type.type_revision_id');
DROP TRIGGER IF EXISTS music_release_presentation_type_scope ON public.music_release_presentation;
CREATE TRIGGER music_release_presentation_type_scope BEFORE INSERT OR UPDATE ON public.music_release_presentation
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_definition_scope('type_revision_id','release','music_release_presentation.type_revision_id');


CREATE OR REPLACE FUNCTION public.catalog_require_credit_creation_context()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.created_for_music_id IS NOT NULL THEN
    PERFORM id FROM public.music_identity WHERE id=NEW.created_for_music_id AND deleted_at IS NULL FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Credit creation context must be an existing active music identity' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS music_credit_creation_context ON public.music_artist_credit;
CREATE TRIGGER music_credit_creation_context BEFORE INSERT ON public.music_artist_credit
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_credit_creation_context();

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
  IF NEW.created_for_music_id IS DISTINCT FROM OLD.created_for_music_id THEN
    RAISE EXCEPTION 'Credit creation context is immutable' USING ERRCODE='23514';
  END IF;
  IF NEW.created_by_auth_user_id IS DISTINCT FROM OLD.created_by_auth_user_id
    AND NOT (NEW.created_by_auth_user_id IS NULL AND pg_trigger_depth()>1) THEN
    RAISE EXCEPTION 'Credit creator is immutable except Auth erasure' USING ERRCODE='23514';
  END IF;
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
