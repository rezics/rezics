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
 IF NOT EXISTS(SELECT 1 FROM public.auth_entity a JOIN public.users u ON u.id=a.auth_user_id WHERE a.entity_id=NEW.reviewer_profile_id AND a.auth_user_id=NEW.reviewer_auth_user_id AND a.state='active' AND u.erased_at IS NULL AND u.principal_kind='human') THEN
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
CREATE TRIGGER reject_merged_unit_recommendation_exclusion_unit_id BEFORE INSERT OR UPDATE OF unit_id ON public.recommendation_exclusion FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_score_unit_id ON public.score;
CREATE TRIGGER reject_merged_unit_score_unit_id BEFORE INSERT OR UPDATE OF unit_id ON public.score FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_studio_realm_editor_candidate_unit_id ON public.studio_realm_editor_candidate;
CREATE TRIGGER reject_merged_unit_studio_realm_editor_candidate_unit_id BEFORE INSERT OR UPDATE OF unit_id ON public.studio_realm_editor_candidate FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_studio_resource_visit_resource_unit_id ON public.studio_resource_visit;
CREATE TRIGGER reject_merged_unit_studio_resource_visit_resource_unit_id BEFORE INSERT OR UPDATE OF resource_unit_id ON public.studio_resource_visit FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('resource_unit_id');

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
CREATE TRIGGER reject_merged_unit_unit_follow_unit_id BEFORE INSERT OR UPDATE OF unit_id ON public.unit_follow FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');

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
