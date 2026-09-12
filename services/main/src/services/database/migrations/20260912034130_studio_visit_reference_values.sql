SET search_path TO public;

-- Remove input triggers before their referenced native-ID column is dropped.
DROP TRIGGER IF EXISTS unit_reference_resource_unit ON public.studio_resource_visit;
DROP TRIGGER IF EXISTS reject_merged_unit_studio_resource_visit_resource_unit_id ON public.studio_resource_visit;

-- Drop index "studio_resource_visit_auth_recent_idx" from table: "studio_resource_visit"
DROP INDEX "studio_resource_visit_auth_recent_idx";
-- Drop index "studio_resource_visit_resource_merge_idx" from table: "studio_resource_visit"
DROP INDEX "studio_resource_visit_resource_merge_idx";
-- Modify "studio_resource_visit" table
ALTER TABLE "studio_resource_visit" DROP CONSTRAINT "studio_resource_visit_resource_unit_id_check", DROP CONSTRAINT "studio_resource_visit_resource_unit_target_check", DROP CONSTRAINT "studio_resource_visit_pkey", DROP COLUMN "resource_unit_id", DROP COLUMN "resource_unit_publishing_id", DROP COLUMN "resource_unit_music_id", DROP COLUMN "resource_unit_program_id", DROP COLUMN "resource_unit_software_id", DROP COLUMN "resource_unit_entity_id", DROP COLUMN "resource_unit_grouping_id", DROP COLUMN "resource_unit_reference_id", DROP COLUMN "resource_unit_distribution_id", DROP COLUMN "resource_unit_video_id", DROP COLUMN "resource_unit_audio_id", DROP COLUMN "resource_unit_post_id", DROP COLUMN "resource_unit_poll_id", DROP COLUMN "resource_unit_zone_id", DROP COLUMN "resource_unit_realm_id", DROP COLUMN "resource_unit_realm_rule_id", DROP COLUMN "resource_unit_custom_theme_id", DROP COLUMN "resource_unit_collection_id", DROP COLUMN "resource_unit_tag_id", DROP COLUMN "resource_unit_tag_path_id", DROP COLUMN "resource_unit_label_id", ADD COLUMN "target_reference_id" uuid NOT NULL, ADD PRIMARY KEY ("auth_user_id", "target_reference_id"), ADD CONSTRAINT "studio_resource_visit_ksv5pF3wEhvP_fkey" FOREIGN KEY ("target_reference_id") REFERENCES "reference_value" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "studio_resource_visit_auth_recent_idx" to table: "studio_resource_visit"
CREATE INDEX "studio_resource_visit_auth_recent_idx" ON "studio_resource_visit" ("auth_user_id", "last_visited_at" DESC NULLS LAST, "target_reference_id" DESC NULLS LAST);
-- Create index "studio_resource_visit_resource_merge_idx" to table: "studio_resource_visit"
CREATE INDEX "studio_resource_visit_resource_merge_idx" ON "studio_resource_visit" ("target_reference_id", "auth_user_id");

CREATE OR REPLACE FUNCTION public.unit_publish_platform_route()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE ready boolean; affected integer;
BEGIN
  SELECT c.ready INTO ready FROM public.catalog_routing_control c WHERE singleton FOR SHARE;
  IF ready IS DISTINCT FROM true THEN RAISE EXCEPTION 'Identity routing is fenced for repair' USING ERRCODE='55000'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('catalog-identity:' || NEW.id::text,0));
  IF TG_OP='UPDATE' AND (NEW.id<>OLD.id OR NEW.routing_generation<OLD.routing_generation) THEN RAISE EXCEPTION 'Unit identity or routing generation cannot move backwards' USING ERRCODE='23514'; END IF;
  INSERT INTO public.catalog_unit_locator(id,owner,generation) VALUES(NEW.id,TG_ARGV[0],NEW.routing_generation)
    ON CONFLICT(id) DO UPDATE SET generation=EXCLUDED.generation WHERE catalog_unit_locator.owner=EXCLUDED.owner AND catalog_unit_locator.generation<=EXCLUDED.generation;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION 'Identity belongs to another physical owner' USING ERRCODE='23505'; END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.unit_remove_platform_route()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  DELETE FROM public.catalog_unit_locator WHERE id=OLD.id AND owner=TG_ARGV[0] AND generation=OLD.routing_generation;
  RETURN OLD;
END $$;

/** Resolve a logical input ID once; concrete FKs and the row check remain the persisted authority. */
CREATE OR REPLACE FUNCTION public.unit_populate_reference()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE value jsonb; previous jsonb; reference_patch jsonb:='{}'; raw_id uuid; selected_owner text; owner_name text; column_name text;
  present_count integer:=0; supplied_owner text; supplied_id uuid; routing_ready boolean; alternatives_unchanged boolean:=true;
  owners text[]:=ARRAY['publishing','music','program','software','entity','grouping','reference','distribution','video','audio','post','poll','zone','realm','realm_rule','custom_theme','collection','tag','tag_path','label'];
BEGIN
  value:=to_jsonb(NEW); raw_id:=(value->>TG_ARGV[0])::uuid;
  IF TG_OP='UPDATE' THEN previous:=to_jsonb(OLD); END IF;
  FOREACH owner_name IN ARRAY owners LOOP
    column_name:=TG_ARGV[1] || '_' || owner_name || '_id';
    IF NOT value ? column_name THEN RAISE EXCEPTION 'Registered reference column is missing' USING ERRCODE='23514'; END IF;
    IF TG_OP='UPDATE' AND value->column_name IS DISTINCT FROM previous->column_name THEN alternatives_unchanged:=false; END IF;
    IF value->>column_name IS NOT NULL THEN present_count:=present_count+1; supplied_owner:=owner_name; supplied_id:=(value->>column_name)::uuid; END IF;
  END LOOP;
  IF TG_OP='UPDATE' AND alternatives_unchanged AND (previous->>TG_ARGV[0])::uuid IS DISTINCT FROM raw_id THEN
    FOREACH owner_name IN ARRAY owners LOOP reference_patch:=jsonb_set(reference_patch,ARRAY[TG_ARGV[1] || '_' || owner_name || '_id'],'null'::jsonb); END LOOP;
    present_count:=0;
  END IF;
  IF TG_OP='UPDATE' AND TG_ARGV[2]='optional' AND raw_id IS NOT NULL AND present_count=0 THEN
    IF previous->>TG_ARGV[0]=raw_id::text THEN
      -- A concrete FK SET NULL clears its derived logical input in the same row mutation.
      reference_patch:=jsonb_set(reference_patch,ARRAY[TG_ARGV[0]],'null'::jsonb); raw_id:=NULL;
    END IF;
  END IF;
  IF raw_id IS NULL THEN
    IF TG_ARGV[2]<>'optional' OR present_count<>0 THEN RAISE EXCEPTION 'Unit reference requires exactly one target' USING ERRCODE='23514'; END IF;
  ELSE
    IF present_count=1 AND supplied_id=raw_id THEN
      -- Explicit checked references are validated by their concrete FK, independently of routing-cache availability.
      RETURN NEW;
    END IF;
    IF present_count<>0 THEN RAISE EXCEPTION 'Unit reference alternatives disagree with its logical identity' USING ERRCODE='23514'; END IF;
    SELECT ready INTO routing_ready FROM public.catalog_routing_control WHERE singleton FOR SHARE;
    IF routing_ready IS DISTINCT FROM true THEN RAISE EXCEPTION 'Identity routing is fenced for repair' USING ERRCODE='55000'; END IF;
    SELECT owner INTO selected_owner FROM public.catalog_unit_locator WHERE id=raw_id FOR KEY SHARE;
    IF NOT FOUND OR NOT selected_owner=ANY(owners) THEN RAISE EXCEPTION 'Unit reference routing is unavailable' USING ERRCODE='23503'; END IF;
    IF present_count>1 OR (present_count=1 AND (supplied_owner<>selected_owner OR supplied_id<>raw_id)) THEN RAISE EXCEPTION 'Unit reference alternatives disagree with its routed identity' USING ERRCODE='23514'; END IF;
    FOREACH owner_name IN ARRAY owners LOOP
      column_name:=TG_ARGV[1] || '_' || owner_name || '_id';
      reference_patch:=jsonb_set(reference_patch,ARRAY[column_name],CASE WHEN owner_name=selected_owner THEN to_jsonb(raw_id) ELSE 'null'::jsonb END);
    END LOOP;
  END IF;
  -- Copy only reference scalars, never rebuild a potentially large document row twenty times.
  NEW:=jsonb_populate_record(NEW,reference_patch);
  RETURN NEW;
END $$;

DO $$ DECLARE owner_name text;
BEGIN
  FOREACH owner_name IN ARRAY ARRAY['video','audio','post','poll','zone','realm','realm_rule','custom_theme','collection','tag','tag_path','label'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS unit_platform_route_publish ON public.%I',owner_name);
    EXECUTE format('CREATE TRIGGER unit_platform_route_publish AFTER INSERT OR UPDATE OF id,routing_generation ON public.%I FOR EACH ROW EXECUTE FUNCTION public.unit_publish_platform_route(%L)',owner_name,owner_name);
    EXECUTE format('DROP TRIGGER IF EXISTS unit_platform_route_remove ON public.%I',owner_name);
    EXECUTE format('CREATE TRIGGER unit_platform_route_remove AFTER DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.unit_remove_platform_route(%L)',owner_name,owner_name);
  END LOOP;
END $$;

-- Favorites now store canonical reference values, not logical-ID input alternatives.
DROP TRIGGER IF EXISTS unit_reference_target_unit ON public.account_favorite;
DROP TRIGGER IF EXISTS unit_reference_target_unit ON public.account_favorite_revision;

DROP TRIGGER IF EXISTS unit_reference_unit ON public.account_unit_tag;
DROP TRIGGER IF EXISTS unit_reference_unit ON public.recommendation_exclusion;
DROP TRIGGER IF EXISTS unit_reference_target_unit ON public.recommendation_event;
DROP TRIGGER IF EXISTS unit_reference_unit ON public.unit_follow;
DROP TRIGGER IF EXISTS unit_reference_resource_unit ON public.studio_resource_visit;

-- Registered logical reference inputs.
DO $$ DECLARE specification text; entry text[]; trigger_name text;
BEGIN
 FOREACH specification IN ARRAY ARRAY[
  'collection_item|unit_id|unit|required',
  'content_report|target_unit_id|target_unit|required',
  'content_review_case|target_unit_id|target_unit|required',
  'content_structure|owner_unit_id|owner_unit|required',
  'content_structure_node|content_unit_id|content_unit|required',
  'content_structure_node|target_unit_id|target_unit|optional',
  'credit_attribution|source_unit_id|source_unit|required',
  'custom_theme_revision|approved_host_unit_id|approved_host_unit|optional',
  'governance_decision|authority_unit_id|authority_unit|optional',
  'governance_decision|target_unit_id|target_unit|optional',
  'notification|subject_unit_id|subject_unit|optional',
  'poll_option|target_unit_id|target_unit|optional',
  'post|subject_unit_id|subject_unit|optional',
  'profile_resource_participation|resource_unit_id|resource_unit|required',
  'realm_pin|unit_id|unit|required',
  'realm_tag_judgment|unit_id|unit|required',
  'realm_tag_judgment_stat|unit_id|unit|required',
  'realm_unit|unit_id|unit|required',
  'realm_unit_status_event|unit_id|unit|required',
  'recommendation_unit_signal_hourly|unit_id|unit|required',
  'score|unit_id|unit|required',
  'score_stat|unit_id|unit|required',
  'studio_auth_editor_candidate|unit_id|unit|required',
  'studio_realm_editor_candidate|unit_id|unit|required',
  'subject_association|unit_id|unit|required',
  'unit_access_grant|unit_id|unit|required',
  'unit_access_invitation|unit_id|unit|required',
  'unit_access_restriction|unit_id|unit|required',
  'unit_alias|unit_id|unit|required',
  'unit_association_proposal|source_unit_id|source_unit|required',
  'unit_association_proposal|target_unit_id|target_unit|required',
  'unit_best_score|unit_id|unit|required',
  'unit_content_language_search|unit_id|unit|required',
  'unit_content_language_support|unit_id|unit|required',
  'unit_custom_theme_installation|host_unit_id|host_unit|required',
  'unit_dock|unit_id|unit|required',
  'unit_effective_tag|unit_id|unit|required',
  'unit_engagement_stat|unit_id|unit|required',
  'unit_expression_assertion|unit_id|unit|required',
  'unit_external_link|unit_id|unit|required',
  'unit_follow_stat|unit_id|unit|required',
  'unit_license_grant|unit_id|unit|required',
  'unit_localization|unit_id|unit|required',
  'unit_merge_graph_lock|unit_id|unit|required',
  'unit_merge_reconciliation_item|source_unit_id|source_unit|required',
  'unit_merge_reconciliation_item|target_unit_id|target_unit|required',
  'unit_merge_redirect|source_unit_id|source_unit|required',
  'unit_merge_redirect|target_unit_id|target_unit|required',
  'unit_merge_request|source_unit_id|source_unit|required',
  'unit_merge_request|target_unit_id|target_unit|required',
  'unit_ownership|unit_id|unit|required',
  'unit_presentation_document|host_unit_id|host_unit|required',
  'unit_progress|unit_id|unit|required',
  'unit_progress_entry|unit_id|unit|required',
  'unit_reaction|unit_id|unit|required',
  'unit_reaction_global_stat|unit_id|unit|required',
  'unit_reaction_stat|unit_id|unit|required',
  'unit_reference_curation_head|unit_id|unit|required',
  'unit_revision|unit_id|unit|required',
  'unit_revision_head|unit_id|unit|required',
  'unit_search_document|unit_id|unit|required',
  'unit_share|unit_id|unit|required',
  'unit_slug_address|scope_unit_id|scope_unit|optional',
  'unit_slug_address|target_unit_id|target_unit|required',
  'unit_status_event|unit_id|unit|required',
  'unit_tag|unit_id|unit|required',
  'unit_tag_judgment|unit_id|unit|required',
  'unit_tag_path_application|unit_id|unit|required'
 ] LOOP
  entry:=string_to_array(specification,'|'); trigger_name:='unit_reference_'||entry[3];
  EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I',trigger_name,entry[1]);
  EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.unit_populate_reference(%L,%L,%L)',trigger_name,entry[1],entry[2],entry[3],entry[4]);
 END LOOP;
END $$;


-- Native owner integrity and derived state. This file is the canonical forward-maintained source.
CREATE OR REPLACE FUNCTION public.reject_merged_unit_reference()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
DECLARE
    referenced_unit_id uuid;
BEGIN
    referenced_unit_id := NULLIF(to_jsonb(NEW) ->> TG_ARGV[0], '')::uuid;
    IF TG_OP='UPDATE' AND (to_jsonb(NEW)->TG_ARGV[0]) IS NOT DISTINCT FROM (to_jsonb(OLD)->TG_ARGV[0]) THEN RETURN NEW; END IF;
    IF TG_NARGS > 1 AND TG_ARGV[1] = 'reference_value' THEN
        referenced_unit_id := public.reference_value_native_id(referenced_unit_id);
    END IF;
    IF referenced_unit_id IS NOT NULL
       AND EXISTS (
           SELECT 1
           FROM public.unit_merge_redirect
           WHERE source_unit_id = referenced_unit_id
       ) THEN
        RAISE EXCEPTION 'A live reference cannot target a merged Unit identity'
            USING ERRCODE = '23514',
                  CONSTRAINT = 'merged_unit_reference_forbidden',
                  DETAIL = json_build_object(
                      'table', TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME,
                      'column', TG_ARGV[0],
                      'sourceUnitId', referenced_unit_id
                  )::text;
	END IF;
	RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_unit_merge_immutable_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
BEGIN
	RAISE EXCEPTION '% rows are immutable', TG_TABLE_NAME
		USING ERRCODE = '23514', CONSTRAINT = TG_TABLE_NAME || '_immutable';
END;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_canonical_unit_id(input_unit_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE STRICT
 SET search_path TO 'pg_catalog', 'public'
AS $function$
    WITH RECURSIVE chain(unit_id, depth) AS (
        SELECT input_unit_id, 0
        UNION ALL
        SELECT redirect.target_unit_id, chain.depth + 1
        FROM chain
        JOIN public.unit_merge_redirect AS redirect
          ON redirect.source_unit_id = chain.unit_id
        WHERE chain.depth < 32
    )
    SELECT unit_id
    FROM chain
    ORDER BY depth DESC
    LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.validate_unit_merge_redirect()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    affected_unit_id uuid;
    r public.unit_merge_request%ROWTYPE;
    source_state record;
    target_state record;
    upstream_depth smallint;
BEGIN
    SELECT * INTO STRICT r FROM public.unit_merge_request WHERE id=NEW.request_id FOR UPDATE;
    SELECT * INTO STRICT source_state FROM public.read_unit_state(NEW.source_unit_id);
    SELECT * INTO STRICT target_state FROM public.read_unit_state(NEW.target_unit_id);
    IF r.state NOT IN ('accepted','executing') OR r.owner<>NEW.owner OR r.source_unit_id<>NEW.source_unit_id OR r.target_unit_id<>NEW.target_unit_id
       OR source_state.owner<>NEW.owner OR target_state.owner<>NEW.owner OR source_state.shape<>r.shape OR target_state.shape<>r.shape
       OR source_state.status<>'archived' OR source_state.revision<>r.source_revision+1 OR target_state.revision<>r.target_revision
       OR source_state.visibility<>r.visibility_at_request OR target_state.visibility<>r.visibility_at_request
       OR EXISTS(SELECT 1 FROM public.entity_participation WHERE entity_id IN(NEW.source_unit_id,NEW.target_unit_id))
       OR EXISTS(SELECT 1 FROM public.auth_entity WHERE entity_id IN(NEW.source_unit_id,NEW.target_unit_id))
       OR (SELECT count(*) FROM public.unit_merge_review WHERE request_id=r.id AND decision='approve')<>2
       OR EXISTS(SELECT 1 FROM public.unit_merge_review WHERE request_id=r.id AND decision='reject') THEN
      RAISE EXCEPTION 'Canonicalization requires the approved native pair and archive revision' USING ERRCODE='23514',CONSTRAINT='unit_merge_redirect_reviewed_pair';
    END IF;
    NEW.source_was_public := r.status_at_request='published' AND r.visibility_at_request<>'private';
    FOR affected_unit_id IN
        SELECT value
        FROM unnest(ARRAY[NEW.source_unit_id, NEW.target_unit_id]) AS ids(value)
        ORDER BY value
    LOOP
        PERFORM pg_advisory_xact_lock(
            hashtextextended('unit-merge:' || affected_unit_id::text, 0)
        );
    END LOOP;

    IF EXISTS (
        SELECT 1
        FROM public.unit_merge_redirect
        WHERE source_unit_id = NEW.target_unit_id
    ) THEN
        RAISE EXCEPTION 'Unit merge redirect target must be canonical'
            USING ERRCODE = '23514',
                  CONSTRAINT = 'unit_merge_redirect_target_not_canonical';
    END IF;

    SELECT redirect.max_depth
    INTO upstream_depth
    FROM public.unit_merge_redirect AS redirect
    WHERE redirect.target_unit_id = NEW.source_unit_id
    ORDER BY redirect.max_depth DESC, redirect.source_unit_id
    LIMIT 1;

    NEW.max_depth := coalesce(upstream_depth, 0) + 1;
    IF NEW.max_depth > 32 THEN
        RAISE EXCEPTION 'Unit merge redirect chain exceeds 32 edges'
            USING ERRCODE = '23514', CONSTRAINT = 'unit_merge_redirect_depth';
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_unit_merge_review()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO pg_catalog,public AS $function$
DECLARE r public.unit_merge_request%ROWTYPE; n integer;
BEGIN
 SELECT * INTO STRICT r FROM public.unit_merge_request WHERE id=NEW.request_id FOR UPDATE;
 IF r.state<>'pending_review' OR r.expires_at<=clock_timestamp() OR r.proposer_auth_user_id=NEW.reviewer_auth_user_id OR r.request_fingerprint<>NEW.request_fingerprint THEN
 RAISE EXCEPTION 'Review requires a pending pinned request and an independent human' USING ERRCODE='23514',CONSTRAINT='unit_merge_review_admission'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.auth_entity a JOIN public.users u ON u.id=a.auth_user_id WHERE a.entity_id=NEW.reviewer_profile_id AND a.auth_user_id=NEW.reviewer_auth_user_id AND a.state='active' AND a.revision=(NEW.reviewer_authority->>'authorizationRevision')::bigint AND u.erased_at IS NULL AND u.principal_kind='human') THEN
 RAISE EXCEPTION 'Reviewer must have a current human self binding' USING ERRCODE='23514',CONSTRAINT='unit_merge_review_human'; END IF;
 SELECT count(*) INTO n FROM (SELECT 1 FROM public.unit_merge_review WHERE request_id=r.id LIMIT 2) q;
 IF n>=2 THEN RAISE EXCEPTION 'At most two independent reviews are admitted' USING ERRCODE='23514',CONSTRAINT='unit_merge_review_bound'; END IF;
 RETURN NEW;
END;$function$;

DROP TRIGGER IF EXISTS reject_merged_unit_collection_item_unit_id ON public.collection_item;
CREATE TRIGGER reject_merged_unit_collection_item_unit_id BEFORE INSERT OR UPDATE OF unit_id ON public.collection_item FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_content_structure_node_content_unit_id ON public.content_structure_node;
CREATE TRIGGER reject_merged_unit_content_structure_node_content_unit_id BEFORE INSERT OR UPDATE OF content_unit_id ON public.content_structure_node FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('content_unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_content_structure_node_target_unit_id ON public.content_structure_node;
CREATE TRIGGER reject_merged_unit_content_structure_node_target_unit_id BEFORE INSERT OR UPDATE OF target_unit_id ON public.content_structure_node FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('target_unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_credit_attribution_source_unit_id ON public.credit_attribution;
CREATE TRIGGER reject_merged_unit_credit_attribution_source_unit_id BEFORE INSERT OR UPDATE OF source_unit_id ON public.credit_attribution FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('source_unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_notification_subject_unit_id ON public.notification;
CREATE TRIGGER reject_merged_unit_notification_subject_unit_id BEFORE INSERT OR UPDATE OF subject_unit_id ON public.notification FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('subject_unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_poll_option_target_unit_id ON public.poll_option;
CREATE TRIGGER reject_merged_unit_poll_option_target_unit_id BEFORE INSERT OR UPDATE OF target_unit_id ON public.poll_option FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('target_unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_post_subject_unit_id ON public.post;
CREATE TRIGGER reject_merged_unit_post_subject_unit_id BEFORE INSERT OR UPDATE OF subject_unit_id ON public.post FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('subject_unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_profile_resource_participation_resource_unit ON public.profile_resource_participation;
CREATE TRIGGER reject_merged_unit_profile_resource_participation_resource_unit BEFORE INSERT OR UPDATE OF resource_unit_id ON public.profile_resource_participation FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('resource_unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_realm_pin_unit_id ON public.realm_pin;
CREATE TRIGGER reject_merged_unit_realm_pin_unit_id BEFORE INSERT OR UPDATE OF unit_id ON public.realm_pin FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_realm_unit_unit_id ON public.realm_unit;
CREATE TRIGGER reject_merged_unit_realm_unit_unit_id BEFORE INSERT OR UPDATE OF unit_id ON public.realm_unit FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_realm_unit_tag_unit_id ON public.realm_unit_tag;
CREATE TRIGGER reject_merged_unit_realm_unit_tag_unit_id BEFORE INSERT OR UPDATE OF unit_id ON public.realm_unit_tag FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_recommendation_exclusion_unit_id ON public.recommendation_exclusion;
DROP TRIGGER IF EXISTS reject_merged_unit_recommendation_exclusion_target_reference_id ON public.recommendation_exclusion;
CREATE TRIGGER reject_merged_unit_recommendation_exclusion_target_reference_id BEFORE INSERT OR UPDATE OF target_reference_id ON public.recommendation_exclusion FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('target_reference_id', 'reference_value');

DROP TRIGGER IF EXISTS reject_merged_unit_score_unit_id ON public.score;
CREATE TRIGGER reject_merged_unit_score_unit_id BEFORE INSERT OR UPDATE OF unit_id ON public.score FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_studio_realm_editor_candidate_unit_id ON public.studio_realm_editor_candidate;
CREATE TRIGGER reject_merged_unit_studio_realm_editor_candidate_unit_id BEFORE INSERT OR UPDATE OF unit_id ON public.studio_realm_editor_candidate FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_studio_resource_visit_resource_unit_id ON public.studio_resource_visit;
DROP TRIGGER IF EXISTS reject_merged_unit_studio_resource_visit_target_reference_id ON public.studio_resource_visit;
CREATE TRIGGER reject_merged_unit_studio_resource_visit_target_reference_id BEFORE INSERT OR UPDATE OF target_reference_id ON public.studio_resource_visit FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('target_reference_id', 'reference_value');

DROP TRIGGER IF EXISTS reject_merged_unit_subject_association_entity_id ON public.subject_association;
CREATE TRIGGER reject_merged_unit_subject_association_entity_id BEFORE INSERT OR UPDATE OF entity_id ON public.subject_association FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('entity_id');

DROP TRIGGER IF EXISTS reject_merged_unit_subject_association_unit_id ON public.subject_association;
CREATE TRIGGER reject_merged_unit_subject_association_unit_id BEFORE INSERT OR UPDATE OF unit_id ON public.subject_association FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_unit_alias_unit_id ON public.unit_alias;
CREATE TRIGGER reject_merged_unit_unit_alias_unit_id BEFORE INSERT OR UPDATE OF unit_id ON public.unit_alias FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_unit_association_proposal_source_unit_id ON public.unit_association_proposal;
CREATE TRIGGER reject_merged_unit_unit_association_proposal_source_unit_id BEFORE INSERT OR UPDATE OF source_unit_id ON public.unit_association_proposal FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('source_unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_unit_association_proposal_target_unit_id ON public.unit_association_proposal;
CREATE TRIGGER reject_merged_unit_unit_association_proposal_target_unit_id BEFORE INSERT OR UPDATE OF target_unit_id ON public.unit_association_proposal FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('target_unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_unit_best_score_unit_id ON public.unit_best_score;
CREATE TRIGGER reject_merged_unit_unit_best_score_unit_id BEFORE INSERT OR UPDATE OF unit_id ON public.unit_best_score FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_unit_external_link_source_entity_id ON public.unit_external_link;
CREATE TRIGGER reject_merged_unit_unit_external_link_source_entity_id BEFORE INSERT OR UPDATE OF source_entity_id ON public.unit_external_link FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('source_entity_id');

DROP TRIGGER IF EXISTS reject_merged_unit_unit_external_link_unit_id ON public.unit_external_link;
CREATE TRIGGER reject_merged_unit_unit_external_link_unit_id BEFORE INSERT OR UPDATE OF unit_id ON public.unit_external_link FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_unit_follow_unit_id ON public.unit_follow;
DROP TRIGGER IF EXISTS reject_merged_unit_unit_follow_target_reference_id ON public.unit_follow;
CREATE TRIGGER reject_merged_unit_unit_follow_target_reference_id BEFORE INSERT OR UPDATE OF target_reference_id ON public.unit_follow FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('target_reference_id', 'reference_value');

DROP TRIGGER IF EXISTS unit_merge_redirect_immutable ON public.unit_merge_redirect;
CREATE TRIGGER unit_merge_redirect_immutable BEFORE DELETE OR UPDATE ON public.unit_merge_redirect FOR EACH ROW EXECUTE FUNCTION public.reject_unit_merge_immutable_mutation();

DROP TRIGGER IF EXISTS unit_merge_redirect_validate ON public.unit_merge_redirect;
CREATE TRIGGER unit_merge_redirect_validate BEFORE INSERT ON public.unit_merge_redirect FOR EACH ROW EXECUTE FUNCTION public.validate_unit_merge_redirect();

DROP TRIGGER IF EXISTS unit_merge_review_immutable ON public.unit_merge_review;
CREATE TRIGGER unit_merge_review_immutable BEFORE DELETE OR UPDATE ON public.unit_merge_review FOR EACH ROW EXECUTE FUNCTION public.reject_unit_merge_immutable_mutation();

DROP TRIGGER IF EXISTS unit_merge_review_validate ON public.unit_merge_review;
CREATE TRIGGER unit_merge_review_validate BEFORE INSERT ON public.unit_merge_review FOR EACH ROW EXECUTE FUNCTION public.validate_unit_merge_review();

DROP TRIGGER IF EXISTS reject_merged_unit_unit_progress_unit_id ON public.unit_progress;
CREATE TRIGGER reject_merged_unit_unit_progress_unit_id BEFORE INSERT OR UPDATE OF unit_id ON public.unit_progress FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_unit_progress_entry_unit_id ON public.unit_progress_entry;
CREATE TRIGGER reject_merged_unit_unit_progress_entry_unit_id BEFORE INSERT OR UPDATE OF unit_id ON public.unit_progress_entry FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_unit_reaction_unit_id ON public.unit_reaction;
CREATE TRIGGER reject_merged_unit_unit_reaction_unit_id BEFORE INSERT OR UPDATE OF unit_id ON public.unit_reaction FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');

DROP TRIGGER IF EXISTS unit_revision_credit_reject_merged_entity ON public.unit_revision_credit_attribution;
CREATE TRIGGER unit_revision_credit_reject_merged_entity BEFORE INSERT ON public.unit_revision_credit_attribution FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('credited_entity_id');

DROP TRIGGER IF EXISTS reject_merged_unit_unit_search_document_unit_id ON public.unit_search_document;
CREATE TRIGGER reject_merged_unit_unit_search_document_unit_id BEFORE INSERT OR UPDATE OF unit_id ON public.unit_search_document FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_unit_share_unit_id ON public.unit_share;
CREATE TRIGGER reject_merged_unit_unit_share_unit_id BEFORE INSERT OR UPDATE OF unit_id ON public.unit_share FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_unit_slug_address_scope_unit_id ON public.unit_slug_address;
CREATE TRIGGER reject_merged_unit_unit_slug_address_scope_unit_id BEFORE INSERT OR UPDATE OF scope_unit_id ON public.unit_slug_address FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('scope_unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_unit_slug_address_target_unit_id ON public.unit_slug_address;
CREATE TRIGGER reject_merged_unit_unit_slug_address_target_unit_id BEFORE INSERT OR UPDATE OF target_unit_id ON public.unit_slug_address FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('target_unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_unit_tag_unit_id ON public.unit_tag;
CREATE TRIGGER reject_merged_unit_unit_tag_unit_id BEFORE INSERT OR UPDATE OF unit_id ON public.unit_tag FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');

CREATE OR REPLACE FUNCTION public.guard_native_merge_request()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO pg_catalog,public AS $function$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Merge intent is immutable' USING ERRCODE='23514',CONSTRAINT='unit_merge_request_immutable'; END IF;
 IF TG_OP='UPDATE' AND (to_jsonb(NEW)-ARRAY['state','accepted_at','canonicalized_at','completed_at','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','accepted_at','canonicalized_at','completed_at','updated_at']) THEN
 RAISE EXCEPTION 'Reviewed merge intent is immutable' USING ERRCODE='23514',CONSTRAINT='unit_merge_request_immutable'; END IF;
 IF TG_OP='INSERT' AND NOT EXISTS(SELECT 1 FROM public.auth_entity a JOIN public.users u ON u.id=a.auth_user_id WHERE a.entity_id=NEW.proposer_profile_id AND a.auth_user_id=NEW.proposer_auth_user_id AND a.state='active' AND u.erased_at IS NULL AND u.principal_kind='human') THEN
 RAISE EXCEPTION 'Proposer must have a current human self binding' USING ERRCODE='23514',CONSTRAINT='unit_merge_request_human'; END IF;
 IF NEW.state IN ('accepted','executing','completed','action_required','failed') AND (SELECT count(*) FROM public.unit_merge_review WHERE request_id=NEW.id AND decision='approve')<>2 THEN
 RAISE EXCEPTION 'Execution needs two independent approvals' USING ERRCODE='23514',CONSTRAINT='unit_merge_request_approved'; END IF;
 IF NEW.state='completed' AND NOT EXISTS(SELECT 1 FROM public.unit_merge_operation WHERE request_id=NEW.id AND state='completed') THEN
 RAISE EXCEPTION 'Merge has unfinished reconciliation' USING ERRCODE='23514',CONSTRAINT='unit_merge_request_completed'; END IF;
 RETURN NEW;
END;$function$;
DROP TRIGGER IF EXISTS native_merge_request_guard ON public.unit_merge_request;
CREATE TRIGGER native_merge_request_guard BEFORE INSERT OR UPDATE OR DELETE ON public.unit_merge_request FOR EACH ROW EXECUTE FUNCTION public.guard_native_merge_request();

CREATE OR REPLACE FUNCTION public.guard_native_merge_item()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO pg_catalog,public AS $function$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Merge receipts are retained' USING ERRCODE='23514',CONSTRAINT='unit_merge_item_retained'; END IF;
 IF TG_OP='UPDATE' AND (OLD.state IN ('applied','retained') OR (to_jsonb(NEW)-ARRAY['state','decision','target_name_id','target_name_revision','target_identifier_id','target_identifier_revision','target_owner_revision','target_binding_revision','error_code','resolved_at','resolved_by_auth_user_id','source_publishing_owner_id','source_music_owner_id','source_program_owner_id','source_software_owner_id','source_entity_owner_id','source_grouping_owner_id','source_reference_owner_id','source_distribution_owner_id','target_publishing_owner_id','target_music_owner_id','target_program_owner_id','target_software_owner_id','target_entity_owner_id','target_grouping_owner_id','target_reference_owner_id','target_distribution_owner_id']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','decision','target_name_id','target_name_revision','target_identifier_id','target_identifier_revision','target_owner_revision','target_binding_revision','error_code','resolved_at','resolved_by_auth_user_id','source_publishing_owner_id','source_music_owner_id','source_program_owner_id','source_software_owner_id','source_entity_owner_id','source_grouping_owner_id','source_reference_owner_id','source_distribution_owner_id','target_publishing_owner_id','target_music_owner_id','target_program_owner_id','target_software_owner_id','target_entity_owner_id','target_grouping_owner_id','target_reference_owner_id','target_distribution_owner_id'])) THEN
 RAISE EXCEPTION 'Merge source evidence and resolved receipts are immutable' USING ERRCODE='23514',CONSTRAINT='unit_merge_item_immutable'; END IF;
 RETURN NEW;
END;$function$;
DROP TRIGGER IF EXISTS native_merge_item_guard ON public.unit_merge_reconciliation_item;
CREATE TRIGGER native_merge_item_guard BEFORE UPDATE OR DELETE ON public.unit_merge_reconciliation_item FOR EACH ROW EXECUTE FUNCTION public.guard_native_merge_item();

CREATE OR REPLACE FUNCTION public.guard_merged_catalog_identity_write()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO pg_catalog,public AS $function$
BEGIN
 IF EXISTS(SELECT 1 FROM public.unit_merge_redirect WHERE source_unit_id=OLD.id) THEN
 RAISE EXCEPTION 'Merged source identity is retained read-only' USING ERRCODE='23514',CONSTRAINT='merged_catalog_identity_read_only'; END IF;
 IF EXISTS(SELECT 1 FROM public.unit_merge_graph_lock l JOIN public.unit_merge_operation o ON o.id=l.operation_id
   WHERE l.unit_id=OLD.id AND o.source_unit_id=OLD.id
   AND NOT coalesce(o.request_id::text=current_setting('rezics.merge_request_id',true)
    AND o.lease_token::text=current_setting('rezics.merge_lease_token',true)
    AND o.state='processing' AND o.lease_expires_at>clock_timestamp(),false)) THEN
 RAISE EXCEPTION 'Accepted merge source is frozen until its worker canonicalizes it'
 USING ERRCODE='23514',CONSTRAINT='accepted_catalog_merge_source_read_only'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;$function$;

DROP TRIGGER IF EXISTS publishing_merged_identity_write_guard ON public.publishing_identity;
CREATE TRIGGER publishing_merged_identity_write_guard BEFORE UPDATE OR DELETE ON public.publishing_identity FOR EACH ROW EXECUTE FUNCTION public.guard_merged_catalog_identity_write();

DROP TRIGGER IF EXISTS music_merged_identity_write_guard ON public.music_identity;
CREATE TRIGGER music_merged_identity_write_guard BEFORE UPDATE OR DELETE ON public.music_identity FOR EACH ROW EXECUTE FUNCTION public.guard_merged_catalog_identity_write();

DROP TRIGGER IF EXISTS program_merged_identity_write_guard ON public.program_identity;
CREATE TRIGGER program_merged_identity_write_guard BEFORE UPDATE OR DELETE ON public.program_identity FOR EACH ROW EXECUTE FUNCTION public.guard_merged_catalog_identity_write();

DROP TRIGGER IF EXISTS software_merged_identity_write_guard ON public.software_identity;
CREATE TRIGGER software_merged_identity_write_guard BEFORE UPDATE OR DELETE ON public.software_identity FOR EACH ROW EXECUTE FUNCTION public.guard_merged_catalog_identity_write();

DROP TRIGGER IF EXISTS entity_merged_identity_write_guard ON public.entity_identity;
CREATE TRIGGER entity_merged_identity_write_guard BEFORE UPDATE OR DELETE ON public.entity_identity FOR EACH ROW EXECUTE FUNCTION public.guard_merged_catalog_identity_write();

DROP TRIGGER IF EXISTS grouping_merged_identity_write_guard ON public.grouping_identity;
CREATE TRIGGER grouping_merged_identity_write_guard BEFORE UPDATE OR DELETE ON public.grouping_identity FOR EACH ROW EXECUTE FUNCTION public.guard_merged_catalog_identity_write();

DROP TRIGGER IF EXISTS reference_merged_identity_write_guard ON public.reference_identity;
CREATE TRIGGER reference_merged_identity_write_guard BEFORE UPDATE OR DELETE ON public.reference_identity FOR EACH ROW EXECUTE FUNCTION public.guard_merged_catalog_identity_write();

DROP TRIGGER IF EXISTS distribution_merged_identity_write_guard ON public.distribution_identity;
CREATE TRIGGER distribution_merged_identity_write_guard BEFORE UPDATE OR DELETE ON public.distribution_identity FOR EACH ROW EXECUTE FUNCTION public.guard_merged_catalog_identity_write();

CREATE OR REPLACE FUNCTION public.guard_native_merge_operation()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO pg_catalog,public AS $function$
DECLARE r public.unit_merge_request%ROWTYPE;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Merge jobs retain their receipts' USING ERRCODE='23514',CONSTRAINT='unit_merge_operation_retained'; END IF;
 SELECT * INTO STRICT r FROM public.unit_merge_request WHERE id=NEW.request_id;
 IF r.state NOT IN ('accepted','executing','action_required','failed','completed') OR (SELECT count(*) FROM public.unit_merge_review WHERE request_id=r.id AND decision='approve')<>2 THEN
 RAISE EXCEPTION 'Reconciliation requires two accepted reviews' USING ERRCODE='23514',CONSTRAINT='unit_merge_operation_approved'; END IF;
 IF TG_OP='UPDATE' AND (OLD.state='completed' OR ROW(NEW.request_id,NEW.owner,NEW.source_unit_id,NEW.target_unit_id,NEW.shard) IS DISTINCT FROM ROW(OLD.request_id,OLD.owner,OLD.source_unit_id,OLD.target_unit_id,OLD.shard)) THEN
 RAISE EXCEPTION 'Merge job identity and completed state are immutable' USING ERRCODE='23514',CONSTRAINT='unit_merge_operation_immutable'; END IF;
 IF NEW.state='completed' AND (NEW.phase<>'finalize' OR NEW.total_items<>NEW.resolved_items OR EXISTS(SELECT 1 FROM public.unit_merge_reconciliation_item WHERE request_id=NEW.request_id AND state IN('pending','action_required') LIMIT 1)) THEN
 RAISE EXCEPTION 'Unresolved merge items prevent completion' USING ERRCODE='23514',CONSTRAINT='unit_merge_operation_settled'; END IF;
 RETURN NEW;
END;$function$;
DROP TRIGGER IF EXISTS native_merge_operation_guard ON public.unit_merge_operation;
CREATE TRIGGER native_merge_operation_guard BEFORE INSERT OR UPDATE OR DELETE ON public.unit_merge_operation FOR EACH ROW EXECUTE FUNCTION public.guard_native_merge_operation();
