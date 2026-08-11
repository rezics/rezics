-- Unit identity merge is an irreversible control-plane operation. Acceptance is
-- small and atomic; corpus-scale reference convergence is leased, retryable,
-- and processed in bounded batches by the main worker.

ALTER TYPE public.platform_capability
    ADD VALUE IF NOT EXISTS 'unit.merge.propose' BEFORE 'unit.ownership.override';
ALTER TYPE public.platform_capability
    ADD VALUE IF NOT EXISTS 'unit.merge.review' BEFORE 'unit.ownership.override';
ALTER TYPE public.platform_capability
    ADD VALUE IF NOT EXISTS 'unit.merge' BEFORE 'unit.ownership.override';

CREATE TYPE public.unit_merge_request_mode AS ENUM ('reviewed', 'privileged_direct');
CREATE TYPE public.unit_merge_request_state AS ENUM (
    'pending_review',
    'accepted',
    'rejected',
    'expired',
    'superseded',
    'executing',
    'completed',
    'failed'
);
CREATE TYPE public.unit_merge_review_decision AS ENUM ('approve', 'reject');
CREATE TYPE public.unit_merge_operation_state AS ENUM (
    'pending',
    'processing',
    'retry_wait',
    'completed',
    'failed'
);
CREATE TYPE public.unit_merge_operation_phase AS ENUM (
    'variant_graph',
    'slug_addresses',
    'slug_scopes',
    'aliases',
    'external_links',
    'external_link_sources',
    'software_requirements',
    'software_requirement_platforms',
    'unit_reactions',
    'unit_shares',
    'unit_follows',
    'scores',
    'collection_items',
    'unit_tags',
    'realm_tag_votes',
    'profile_unit_tags',
    'realm_pins',
    'realm_units',
    'realm_unit_tags',
    'post_subjects',
    'association_proposal_sources',
    'association_proposal_targets',
    'credit_sources',
    'credit_targets',
    'subject_sources',
    'subject_entities',
    'release_parents',
    'series_releases',
    'poll_options',
    'content_nodes_content',
    'content_nodes_target',
    'structure_members',
    'structure_edges_parent',
    'structure_edges_child',
    'structure_applications',
    'progress_entries',
    'progress_snapshots',
    'notification_subjects',
    'derived_state',
    'finalize'
);

CREATE TABLE public.unit_merge_request (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    source_unit_id uuid NOT NULL,
    target_unit_id uuid NOT NULL,
    unit_kind text NOT NULL,
    mode public.unit_merge_request_mode NOT NULL,
    state public.unit_merge_request_state NOT NULL,
    proposer_profile_id uuid NOT NULL,
    idempotency_key text NOT NULL,
    override_of_request_id uuid,
    reason_code public.governance_reason_code NOT NULL,
    note text,
    policy_version smallint NOT NULL,
    required_approvals smallint NOT NULL,
    veto_enabled boolean NOT NULL,
    self_review_forbidden boolean NOT NULL,
    manifest_version smallint NOT NULL,
    source_updated_at timestamp(3) with time zone NOT NULL,
    target_updated_at timestamp(3) with time zone NOT NULL,
    source_graph_revision bigint NOT NULL,
    target_graph_revision bigint NOT NULL,
    graph_plan jsonb NOT NULL,
    request_fingerprint text NOT NULL,
    expires_at timestamp(3) with time zone NOT NULL,
    accepted_at timestamp(3) with time zone,
    rejected_at timestamp(3) with time zone,
    superseded_at timestamp(3) with time zone,
    completed_at timestamp(3) with time zone,
    failed_at timestamp(3) with time zone,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unit_merge_request_source_fkey FOREIGN KEY (source_unit_id)
        REFERENCES public.unit (id) ON DELETE RESTRICT,
    CONSTRAINT unit_merge_request_target_fkey FOREIGN KEY (target_unit_id)
        REFERENCES public.unit (id) ON DELETE RESTRICT,
    CONSTRAINT unit_merge_request_proposer_fkey FOREIGN KEY (proposer_profile_id)
        REFERENCES public.profile (id) ON DELETE RESTRICT,
    CONSTRAINT unit_merge_request_override_of_fkey FOREIGN KEY (override_of_request_id)
        REFERENCES public.unit_merge_request (id) ON DELETE RESTRICT,
    CONSTRAINT unit_merge_request_kind_check
        CHECK (unit_kind IN ('book', 'software', 'media', 'entity')),
    CONSTRAINT unit_merge_request_not_self_check CHECK (source_unit_id <> target_unit_id),
    CONSTRAINT unit_merge_request_policy_version_check CHECK (policy_version > 0),
    CONSTRAINT unit_merge_request_required_approvals_check CHECK (required_approvals > 0),
    CONSTRAINT unit_merge_request_manifest_version_check CHECK (manifest_version > 0),
    CONSTRAINT unit_merge_request_graph_revision_check
        CHECK (source_graph_revision >= 0 AND target_graph_revision >= 0),
    CONSTRAINT unit_merge_request_graph_plan_check CHECK (
        jsonb_typeof(graph_plan) = 'object'
        AND graph_plan->>'version' = '1'
        AND graph_plan->>'sourceRole' IN ('standalone', 'variant', 'main')
        AND graph_plan->>'targetRole' IN ('standalone', 'variant', 'main')
        AND graph_plan->>'action' IN (
            'none',
            'detach_source',
            'reparent_source_variants_to_target',
            'reparent_source_variants_to_target_main',
            'promote_target_from_source'
        )
    ),
    CONSTRAINT unit_merge_request_fingerprint_check
        CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
    CONSTRAINT unit_merge_request_note_check CHECK (note IS NULL OR btrim(note) <> ''),
    CONSTRAINT unit_merge_request_idempotency_key_check
        CHECK (btrim(idempotency_key) <> '' AND char_length(idempotency_key) <= 200),
    CONSTRAINT unit_merge_request_expiry_check CHECK (expires_at > created_at),
    CONSTRAINT unit_merge_request_direct_state_check CHECK (
        mode <> 'privileged_direct'::public.unit_merge_request_mode
        OR state <> 'pending_review'::public.unit_merge_request_state
    )
);

CREATE INDEX unit_merge_request_state_id_idx
    ON public.unit_merge_request (state, id DESC);
CREATE INDEX unit_merge_request_source_created_idx
    ON public.unit_merge_request (source_unit_id, created_at DESC, id DESC);
CREATE INDEX unit_merge_request_target_created_idx
    ON public.unit_merge_request (target_unit_id, created_at DESC, id DESC);
CREATE INDEX unit_merge_request_proposer_created_idx
    ON public.unit_merge_request (proposer_profile_id, created_at DESC, id DESC);
ALTER TABLE public.unit_merge_request
    ADD CONSTRAINT unit_merge_request_proposer_idempotency_key
    UNIQUE (proposer_profile_id, idempotency_key);
CREATE INDEX unit_merge_request_pending_expiry_idx
    ON public.unit_merge_request (expires_at, id)
    WHERE state = 'pending_review'::public.unit_merge_request_state;
CREATE UNIQUE INDEX unit_merge_request_active_source_key
    ON public.unit_merge_request (source_unit_id)
    WHERE state IN (
        'pending_review'::public.unit_merge_request_state,
        'accepted'::public.unit_merge_request_state,
        'executing'::public.unit_merge_request_state,
        'failed'::public.unit_merge_request_state
    );
CREATE UNIQUE INDEX unit_merge_request_override_of_key
    ON public.unit_merge_request (override_of_request_id)
    WHERE override_of_request_id IS NOT NULL;

CREATE TABLE public.unit_merge_review (
    request_id uuid NOT NULL,
    reviewer_profile_id uuid NOT NULL,
    decision public.unit_merge_review_decision NOT NULL,
    note text,
    request_fingerprint text NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unit_merge_review_pkey PRIMARY KEY (request_id, reviewer_profile_id),
    CONSTRAINT unit_merge_review_request_fkey FOREIGN KEY (request_id)
        REFERENCES public.unit_merge_request (id) ON DELETE RESTRICT,
    CONSTRAINT unit_merge_review_reviewer_fkey FOREIGN KEY (reviewer_profile_id)
        REFERENCES public.profile (id) ON DELETE RESTRICT,
    CONSTRAINT unit_merge_review_note_check CHECK (note IS NULL OR btrim(note) <> ''),
    CONSTRAINT unit_merge_review_fingerprint_check
        CHECK (request_fingerprint ~ '^[0-9a-f]{64}$')
);

CREATE INDEX unit_merge_review_request_decision_idx
    ON public.unit_merge_review (request_id, decision, created_at, reviewer_profile_id);
CREATE INDEX unit_merge_review_reviewer_created_idx
    ON public.unit_merge_review (reviewer_profile_id, created_at DESC, request_id);

CREATE TABLE public.unit_merge_redirect (
    source_unit_id uuid PRIMARY KEY,
    target_unit_id uuid NOT NULL,
    max_depth smallint DEFAULT 1 NOT NULL,
    request_id uuid NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unit_merge_redirect_source_fkey FOREIGN KEY (source_unit_id)
        REFERENCES public.unit (id) ON DELETE RESTRICT,
    CONSTRAINT unit_merge_redirect_target_fkey FOREIGN KEY (target_unit_id)
        REFERENCES public.unit (id) ON DELETE RESTRICT,
    CONSTRAINT unit_merge_redirect_request_fkey FOREIGN KEY (request_id)
        REFERENCES public.unit_merge_request (id) ON DELETE RESTRICT,
    CONSTRAINT unit_merge_redirect_request_key UNIQUE (request_id),
    CONSTRAINT unit_merge_redirect_not_self_check CHECK (source_unit_id <> target_unit_id),
    CONSTRAINT unit_merge_redirect_max_depth_check CHECK (max_depth BETWEEN 1 AND 32)
);

CREATE INDEX unit_merge_redirect_target_depth_idx
    ON public.unit_merge_redirect (target_unit_id, max_depth DESC, source_unit_id);

CREATE TABLE public.unit_merge_graph_guard (
    unit_id uuid PRIMARY KEY,
    revision bigint DEFAULT 0 NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unit_merge_graph_guard_unit_fkey FOREIGN KEY (unit_id)
        REFERENCES public.unit (id) ON DELETE CASCADE,
    CONSTRAINT unit_merge_graph_guard_revision_check CHECK (revision >= 0)
);

CREATE TABLE public.unit_merge_operation (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    request_id uuid NOT NULL,
    source_unit_id uuid NOT NULL,
    target_unit_id uuid NOT NULL,
    state public.unit_merge_operation_state DEFAULT 'pending' NOT NULL,
    phase public.unit_merge_operation_phase DEFAULT 'variant_graph' NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    processed_rows bigint DEFAULT 0 NOT NULL,
    available_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    lease_token uuid,
    lease_expires_at timestamp(3) with time zone,
    last_error_code text,
    last_error_message text,
    started_at timestamp(3) with time zone,
    completed_at timestamp(3) with time zone,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unit_merge_operation_request_fkey FOREIGN KEY (request_id)
        REFERENCES public.unit_merge_request (id) ON DELETE RESTRICT,
    CONSTRAINT unit_merge_operation_source_fkey FOREIGN KEY (source_unit_id)
        REFERENCES public.unit (id) ON DELETE RESTRICT,
    CONSTRAINT unit_merge_operation_target_fkey FOREIGN KEY (target_unit_id)
        REFERENCES public.unit (id) ON DELETE RESTRICT,
    CONSTRAINT unit_merge_operation_request_key UNIQUE (request_id),
    CONSTRAINT unit_merge_operation_source_key UNIQUE (source_unit_id),
    CONSTRAINT unit_merge_operation_not_self_check CHECK (source_unit_id <> target_unit_id),
    CONSTRAINT unit_merge_operation_attempt_check CHECK (attempt_count >= 0),
    CONSTRAINT unit_merge_operation_processed_rows_check CHECK (processed_rows >= 0),
    CONSTRAINT unit_merge_operation_lease_check CHECK (
        (state = 'processing'::public.unit_merge_operation_state) =
        (lease_expires_at IS NOT NULL AND lease_token IS NOT NULL)
    ),
    CONSTRAINT unit_merge_operation_error_check CHECK (
        (last_error_code IS NULL) = (last_error_message IS NULL)
    )
);

CREATE INDEX unit_merge_operation_claim_idx
    ON public.unit_merge_operation (available_at, created_at, id)
    WHERE state IN (
        'pending'::public.unit_merge_operation_state,
        'retry_wait'::public.unit_merge_operation_state
    );
CREATE INDEX unit_merge_operation_expired_lease_idx
    ON public.unit_merge_operation (lease_expires_at, created_at, id)
    WHERE state = 'processing'::public.unit_merge_operation_state;
CREATE INDEX unit_merge_operation_target_state_idx
    ON public.unit_merge_operation (target_unit_id, state, created_at, id);

CREATE TABLE public.unit_merge_graph_lock (
    unit_id uuid PRIMARY KEY,
    operation_id uuid NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unit_merge_graph_lock_unit_fkey FOREIGN KEY (unit_id)
        REFERENCES public.unit (id) ON DELETE RESTRICT,
    CONSTRAINT unit_merge_graph_lock_operation_fkey FOREIGN KEY (operation_id)
        REFERENCES public.unit_merge_operation (id) ON DELETE RESTRICT
);

CREATE INDEX unit_merge_graph_lock_operation_idx
    ON public.unit_merge_graph_lock (operation_id, unit_id);

CREATE OR REPLACE FUNCTION public.maintain_unit_merge_graph_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    affected_unit_id uuid;
BEGIN
    FOR affected_unit_id IN
        SELECT DISTINCT value
        FROM unnest(ARRAY[
            CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.variant_unit_id END,
            CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.main_unit_id END,
            CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.variant_unit_id END,
            CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.main_unit_id END
        ]) AS ids(value)
        WHERE value IS NOT NULL
        ORDER BY value
    LOOP
        INSERT INTO public.unit_merge_graph_guard (unit_id, revision, updated_at)
        VALUES (affected_unit_id, 1, clock_timestamp())
        ON CONFLICT (unit_id) DO UPDATE
        SET revision = public.unit_merge_graph_guard.revision + 1,
            updated_at = excluded.updated_at;
    END LOOP;
    RETURN coalesce(NEW, OLD);
END;
$$;

CREATE TRIGGER unit_merge_graph_guard_maintain
AFTER INSERT OR DELETE OR UPDATE OF variant_unit_id, main_unit_id
ON public.unit_variant
FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_merge_graph_guard();

CREATE OR REPLACE FUNCTION public.protect_unit_merge_graph_lock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    active_operation_id uuid := nullif(current_setting('rezics.unit_merge_operation_id', true), '')::uuid;
    locked_unit_id uuid;
    affected_unit_id uuid;
BEGIN
    -- Use the same sorted advisory-lock namespace as merge preflight. A graph
    -- mutation that starts before acceptance is therefore observed by the
    -- manifest; one that starts after acceptance waits and then sees the lock.
    FOR affected_unit_id IN
        SELECT DISTINCT value
        FROM unnest(ARRAY[
            CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.variant_unit_id END,
            CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.main_unit_id END,
            CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.variant_unit_id END,
            CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.main_unit_id END
        ]) AS ids(value)
        WHERE value IS NOT NULL
        ORDER BY value
    LOOP
        PERFORM pg_advisory_xact_lock(
            hashtextextended('unit-merge:' || affected_unit_id::text, 0)
        );
    END LOOP;

    SELECT graph_lock.unit_id
    INTO locked_unit_id
    FROM public.unit_merge_graph_lock AS graph_lock
    WHERE graph_lock.unit_id IN (
        CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.variant_unit_id END,
        CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.main_unit_id END,
        CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.variant_unit_id END,
        CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.main_unit_id END
    )
      AND graph_lock.operation_id IS DISTINCT FROM active_operation_id
    ORDER BY graph_lock.unit_id
    LIMIT 1;
    IF locked_unit_id IS NOT NULL THEN
        RAISE EXCEPTION 'Unit % Variant graph is locked by an accepted merge', locked_unit_id
            USING ERRCODE = '23514', CONSTRAINT = 'unit_merge_graph_locked';
    END IF;
    RETURN coalesce(NEW, OLD);
END;
$$;

CREATE TRIGGER a_unit_merge_graph_lock_protect
BEFORE INSERT OR DELETE OR UPDATE OF variant_unit_id, main_unit_id
ON public.unit_variant
FOR EACH ROW EXECUTE FUNCTION public.protect_unit_merge_graph_lock();

CREATE OR REPLACE FUNCTION public.validate_unit_merge_redirect()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    affected_unit_id uuid;
    upstream_depth smallint;
BEGIN
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
$$;

CREATE TRIGGER unit_merge_redirect_validate
BEFORE INSERT
ON public.unit_merge_redirect
FOR EACH ROW EXECUTE FUNCTION public.validate_unit_merge_redirect();

CREATE OR REPLACE FUNCTION public.resolve_canonical_unit_id(input_unit_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
STRICT
SET search_path = pg_catalog, public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.validate_unit_merge_review()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    merge_request public.unit_merge_request%ROWTYPE;
BEGIN
    SELECT * INTO merge_request
    FROM public.unit_merge_request
    WHERE id = NEW.request_id;
    IF merge_request.self_review_forbidden
       AND merge_request.proposer_profile_id = NEW.reviewer_profile_id THEN
        RAISE EXCEPTION 'Unit merge proposer cannot review their own request'
            USING ERRCODE = '23514', CONSTRAINT = 'unit_merge_review_self_forbidden';
    END IF;
	IF merge_request.request_fingerprint <> NEW.request_fingerprint THEN
        RAISE EXCEPTION 'Unit merge review fingerprint is stale'
            USING ERRCODE = '23514', CONSTRAINT = 'unit_merge_review_fingerprint_stale';
	END IF;
	RETURN NEW;
END;
$$;

CREATE TRIGGER unit_merge_review_validate
BEFORE INSERT ON public.unit_merge_review
FOR EACH ROW EXECUTE FUNCTION public.validate_unit_merge_review();

CREATE OR REPLACE FUNCTION public.reject_unit_merge_immutable_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	RAISE EXCEPTION '% rows are immutable', TG_TABLE_NAME
		USING ERRCODE = '23514', CONSTRAINT = TG_TABLE_NAME || '_immutable';
END;
$$;

CREATE TRIGGER unit_merge_review_immutable
BEFORE UPDATE OR DELETE ON public.unit_merge_review
FOR EACH ROW EXECUTE FUNCTION public.reject_unit_merge_immutable_mutation();
CREATE TRIGGER unit_merge_redirect_immutable
BEFORE UPDATE OR DELETE ON public.unit_merge_redirect
FOR EACH ROW EXECUTE FUNCTION public.reject_unit_merge_immutable_mutation();

-- Alias and alias-vote movement would otherwise rebuild the same Search
-- document once per moved row. Merge phases suppress those row-triggered
-- rebuilds and perform one authoritative target rebuild during finalization.
CREATE OR REPLACE FUNCTION public.refresh_unit_search_document_from_unit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF nullif(current_setting('rezics.unit_merge_operation_id', true), '') IS NOT NULL THEN
        RETURN NULL;
    END IF;
	PERFORM public.refresh_unit_search_document(NEW.id);
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_unit_search_document_from_dependency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF nullif(current_setting('rezics.unit_merge_operation_id', true), '') IS NOT NULL THEN
        RETURN NULL;
    END IF;
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        PERFORM public.refresh_unit_search_document(OLD.unit_id);
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE')
       AND (TG_OP = 'INSERT' OR NEW.unit_id IS DISTINCT FROM OLD.unit_id) THEN
        PERFORM public.refresh_unit_search_document(NEW.unit_id);
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_unit_search_document_from_alias_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    target_alias_id uuid;
    target_unit_id uuid;
BEGIN
    IF nullif(current_setting('rezics.unit_merge_operation_id', true), '') IS NOT NULL THEN
        RETURN NULL;
    END IF;
    target_alias_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.alias_id ELSE NEW.alias_id END;
    SELECT unit_id INTO target_unit_id
    FROM public.unit_alias
    WHERE id = target_alias_id;
    IF FOUND THEN
        PERFORM public.refresh_unit_search_document(target_unit_id);
	END IF;
	RETURN NULL;
END;
$$;

-- Application write paths resolve canonical Unit IDs before creating live
-- references. This database guard closes the finalization race and prevents a
-- stale client from adding a new reference to an already merged identity after
-- its worker phase has drained.
CREATE OR REPLACE FUNCTION public.reject_merged_unit_reference()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    referenced_unit_id uuid;
BEGIN
    referenced_unit_id := NULLIF(to_jsonb(NEW) ->> TG_ARGV[0], '')::uuid;
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
$$;

DO $$
DECLARE
    reference text[];
    reference_table text;
    reference_column text;
BEGIN
    FOREACH reference SLICE 1 IN ARRAY ARRAY[
        ARRAY['unit_variant', 'main_unit_id'],
        ARRAY['unit_variant', 'variant_unit_id'],
        ARRAY['unit_slug_address', 'target_unit_id'],
        ARRAY['unit_slug_address', 'scope_unit_id'],
        ARRAY['unit_alias', 'unit_id'],
        ARRAY['unit_external_link', 'unit_id'],
        ARRAY['unit_external_link', 'source_entity_id'],
        ARRAY['software_requirement', 'software_id'],
        ARRAY['software_requirement', 'platform_entity_id'],
        ARRAY['unit_reaction', 'unit_id'],
        ARRAY['unit_share', 'unit_id'],
        ARRAY['unit_follow', 'unit_id'],
        ARRAY['score', 'unit_id'],
        ARRAY['collection_item', 'unit_id'],
        ARRAY['unit_tag', 'unit_id'],
        ARRAY['realm_tag_vote', 'unit_id'],
        ARRAY['profile_unit_tag', 'unit_id'],
        ARRAY['realm_pin', 'unit_id'],
        ARRAY['realm_unit', 'unit_id'],
        ARRAY['realm_unit_tag', 'unit_id'],
        ARRAY['post', 'subject_unit_id'],
        ARRAY['unit_association_proposal', 'source_unit_id'],
        ARRAY['unit_association_proposal', 'target_unit_id'],
        ARRAY['credit_attribution', 'source_unit_id'],
        ARRAY['credit_attribution', 'credited_unit_id'],
        ARRAY['subject_association', 'unit_id'],
        ARRAY['subject_association', 'entity_id'],
        ARRAY['release', 'parent_unit_id'],
        ARRAY['series_release', 'release_unit_id'],
        ARRAY['poll_option', 'target_unit_id'],
        ARRAY['content_structure_node', 'content_unit_id'],
        ARRAY['content_structure_node', 'target_unit_id'],
        ARRAY['unit_structure_member', 'member_unit_id'],
        ARRAY['unit_structure_edge', 'parent_unit_id'],
        ARRAY['unit_structure_edge', 'child_unit_id'],
        ARRAY['unit_structure_application', 'unit_id'],
        ARRAY['unit_structure_application_vote', 'unit_id'],
        ARRAY['unit_progress_entry', 'unit_id'],
        ARRAY['unit_progress', 'unit_id'],
        ARRAY['notification', 'subject_unit_id'],
        ARRAY['recommendation_exclusion', 'unit_id'],
        ARRAY['studio_resource_visit', 'resource_unit_id'],
        ARRAY['studio_work_relation', 'resource_unit_id'],
        ARRAY['studio_work_relation', 'authorization_unit_id'],
        ARRAY['unit_best_score', 'unit_id'],
        ARRAY['unit_search_document', 'unit_id']
    ]::text[][] LOOP
        reference_table := reference[1];
        reference_column := reference[2];
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF %I ON public.%I '
            'FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference(%L)',
            'reject_merged_unit_' || reference_table || '_' || reference_column,
            reference_column,
            reference_table,
            reference_column
		);
	END LOOP;
END;
$$;
