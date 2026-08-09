-- Destructive 1.4.0 cutover for content reports and content governance.
-- Existing content reports, review cases, governance actions, governance notes,
-- and moderation notifications are intentionally discarded. Materialized Unit
-- and Realm Unit states remain authoritative. Account enforcements and their
-- decision identities are preserved in the dedicated action ledger below.

DROP TRIGGER IF EXISTS realm_unit_moderation_stat_initialize ON public.realm_unit;
DROP TRIGGER IF EXISTS realm_unit_report_case_state_maintain ON public.moderation_case;
DROP TRIGGER IF EXISTS realm_unit_report_stat_maintain ON public.realm_unit_report;
DROP FUNCTION IF EXISTS public.initialize_realm_unit_moderation_stat();
DROP FUNCTION IF EXISTS public.maintain_realm_unit_report_case_state();
DROP FUNCTION IF EXISTS public.maintain_realm_unit_report_stat();

CREATE TYPE public.account_enforcement_action_kind AS ENUM ('issue', 'revoke');
CREATE TYPE public.content_governance_action_kind AS ENUM (
    'approve',
    'hide',
    'remove',
    'restore',
    'lock_post_targeting',
    'unlock_post_targeting',
    'invalidate_content_license',
    'restore_content_license',
    'reverse'
);
CREATE TYPE public.content_review_authority AS ENUM ('platform', 'realm');
CREATE TYPE public.content_review_case_state AS ENUM (
    'new',
    'triaged',
    'assigned',
    'actioned',
    'resolved',
    'duplicate',
    'rejected',
    'escalated',
    'reviewing'
);

CREATE TABLE public.account_enforcement_action (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    actor_profile_id uuid NOT NULL,
    target_profile_id uuid NOT NULL,
    kind public.account_enforcement_action_kind NOT NULL,
    enforcement_kind public.enforcement_kind NOT NULL,
    reverses_action_id uuid,
    request_id text,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_enforcement_action_reversal_check CHECK (
        (kind = 'revoke'::public.account_enforcement_action_kind) =
        (reverses_action_id IS NOT NULL)
    ),
    CONSTRAINT account_enforcement_action_not_self_reverse CHECK (
        reverses_action_id IS NULL OR reverses_action_id <> id
    )
);

INSERT INTO public.account_enforcement_action (
    id,
    actor_profile_id,
    target_profile_id,
    kind,
    enforcement_kind,
    reverses_action_id,
    request_id,
    created_at
)
SELECT
    action.id,
    action.actor_profile_id,
    enforcement.profile_id,
    'issue'::public.account_enforcement_action_kind,
    enforcement.kind,
    NULL,
    action.request_id,
    action.created_at
FROM public.account_enforcement AS enforcement
JOIN public.moderation_action AS action
    ON action.id = enforcement.decision_action_id;

INSERT INTO public.account_enforcement_action (
    id,
    actor_profile_id,
    target_profile_id,
    kind,
    enforcement_kind,
    reverses_action_id,
    request_id,
    created_at
)
SELECT
    action.id,
    action.actor_profile_id,
    enforcement.profile_id,
    'revoke'::public.account_enforcement_action_kind,
    enforcement.kind,
    enforcement.decision_action_id,
    action.request_id,
    action.created_at
FROM public.account_enforcement AS enforcement
JOIN public.moderation_action AS action
    ON action.id = enforcement.revocation_action_id
WHERE enforcement.revocation_action_id IS NOT NULL;

ALTER TABLE public.account_enforcement
    DROP CONSTRAINT "account_enforcement_uDabDcwN9p4k_fkey",
    DROP CONSTRAINT "account_enforcement_0u72xwXJHy8M_fkey";
ALTER TABLE public.account_enforcement
    ADD CONSTRAINT "account_enforcement_C7uTNbpwQMws_fkey"
        FOREIGN KEY (decision_action_id)
        REFERENCES public.account_enforcement_action(id) ON DELETE RESTRICT,
    ADD CONSTRAINT "account_enforcement_jOvOMUUe19ze_fkey"
        FOREIGN KEY (revocation_action_id)
        REFERENCES public.account_enforcement_action(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX account_enforcement_action_reverses_key
    ON public.account_enforcement_action (reverses_action_id)
    WHERE reverses_action_id IS NOT NULL;
CREATE INDEX account_enforcement_action_target_created_idx
    ON public.account_enforcement_action (
        target_profile_id,
        created_at DESC NULLS LAST,
        id DESC NULLS LAST
    );
CREATE INDEX account_enforcement_action_actor_created_idx
    ON public.account_enforcement_action (
        actor_profile_id,
        created_at DESC NULLS LAST,
        id DESC NULLS LAST
    );
ALTER TABLE public.account_enforcement_action
    ADD CONSTRAINT account_enforcement_action_actor_profile_id_profile_id_fkey
        FOREIGN KEY (actor_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT,
    ADD CONSTRAINT account_enforcement_action_target_profile_id_profile_id_fkey
        FOREIGN KEY (target_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT,
    ADD CONSTRAINT account_enforcement_action_reverses_fkey
        FOREIGN KEY (reverses_action_id)
        REFERENCES public.account_enforcement_action(id) ON DELETE RESTRICT;

CREATE TEMPORARY TABLE discarded_governance_note (
    post_id uuid PRIMARY KEY
) ON COMMIT DROP;
INSERT INTO discarded_governance_note (post_id)
SELECT post_id
FROM public.governance_post_binding
WHERE subject_kind IN (
    'moderation_case'::public.governance_note_subject_kind,
    'moderation_action'::public.governance_note_subject_kind
);
DELETE FROM public.governance_post_binding
WHERE post_id IN (SELECT post_id FROM discarded_governance_note);
DELETE FROM public.unit
WHERE id IN (SELECT post_id FROM discarded_governance_note);
DELETE FROM public.notification WHERE kind = 'moderation'::public.notification_kind;

ALTER TYPE public.governance_note_subject_kind
    RENAME TO governance_note_subject_kind_legacy;
CREATE TYPE public.governance_note_subject_kind AS ENUM (
    'content_review_case',
    'content_governance_action',
    'account_enforcement_action',
    'unit_access_restriction',
    'realm_unit_status_event'
);
ALTER TABLE public.governance_post_binding
    ALTER COLUMN subject_kind TYPE public.governance_note_subject_kind
    USING subject_kind::text::public.governance_note_subject_kind;
DROP TYPE public.governance_note_subject_kind_legacy;

ALTER TABLE public.realm_unit_status_event
    DROP CONSTRAINT realm_unit_status_event_moderation_action_fkey,
    DROP CONSTRAINT realm_unit_status_event_action_key,
    DROP COLUMN moderation_action_id,
    ADD COLUMN content_governance_action_id uuid,
    ADD CONSTRAINT realm_unit_status_event_content_governance_action_key
        UNIQUE (content_governance_action_id);

DROP TABLE public.platform_unit_report;
DROP TABLE public.realm_unit_report;
DROP TABLE public.realm_unit_moderation_stat;
DROP TABLE public.moderation_action;
DROP TABLE public.moderation_case;
DROP TYPE public.moderation_action_kind;
DROP TYPE public.moderation_authority;
DROP TYPE public.moderation_case_state;
DROP TYPE public.moderation_target_kind;

CREATE TABLE public.content_review_case (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    state public.content_review_case_state
        DEFAULT 'new'::public.content_review_case_state NOT NULL,
    authority public.content_review_authority
        DEFAULT 'platform'::public.content_review_authority NOT NULL,
    realm_id uuid,
    target_unit_id uuid NOT NULL,
    assigned_profile_id uuid,
    duplicate_of_case_id uuid,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_review_case_authority_check CHECK (
        (authority = 'realm'::public.content_review_authority) = (realm_id IS NOT NULL)
    ),
    CONSTRAINT content_review_case_duplicate_state_check CHECK (
        (state = 'duplicate'::public.content_review_case_state) =
        (duplicate_of_case_id IS NOT NULL)
    ),
    CONSTRAINT content_review_case_not_self_duplicate CHECK (
        duplicate_of_case_id IS NULL OR duplicate_of_case_id <> id
    )
);
CREATE INDEX content_review_case_authority_state_created_idx
    ON public.content_review_case (authority, state, created_at, id);
CREATE INDEX content_review_case_authority_created_idx
    ON public.content_review_case (
        authority,
        created_at DESC NULLS LAST,
        id DESC NULLS LAST
    );
CREATE INDEX content_review_case_realm_state_created_idx
    ON public.content_review_case (realm_id, state, created_at, id);
CREATE INDEX content_review_case_realm_created_idx
    ON public.content_review_case (
        realm_id,
        created_at DESC NULLS LAST,
        id DESC NULLS LAST
    );
CREATE INDEX content_review_case_platform_updated_idx
    ON public.content_review_case (
        updated_at DESC NULLS LAST,
        id DESC NULLS LAST
    )
    WHERE authority = 'platform'::public.content_review_authority;
CREATE INDEX content_review_case_platform_state_updated_idx
    ON public.content_review_case (
        state,
        updated_at DESC NULLS LAST,
        id DESC NULLS LAST
    )
    WHERE authority = 'platform'::public.content_review_authority;
CREATE INDEX content_review_case_assignee_state_idx
    ON public.content_review_case (assigned_profile_id, state, created_at, id);
CREATE INDEX content_review_case_target_idx
    ON public.content_review_case (target_unit_id, created_at, id);
CREATE INDEX content_review_case_duplicate_idx
    ON public.content_review_case (duplicate_of_case_id);
CREATE UNIQUE INDEX content_review_case_platform_active_target_key
    ON public.content_review_case (target_unit_id)
    WHERE authority = 'platform'::public.content_review_authority
        AND state IN (
            'new'::public.content_review_case_state,
            'triaged'::public.content_review_case_state,
            'assigned'::public.content_review_case_state,
            'escalated'::public.content_review_case_state,
            'reviewing'::public.content_review_case_state
        );
CREATE UNIQUE INDEX content_review_case_realm_active_target_key
    ON public.content_review_case (realm_id, target_unit_id)
    WHERE authority = 'realm'::public.content_review_authority
        AND state IN (
            'new'::public.content_review_case_state,
            'triaged'::public.content_review_case_state,
            'assigned'::public.content_review_case_state,
            'escalated'::public.content_review_case_state,
            'reviewing'::public.content_review_case_state
        );
ALTER TABLE public.content_review_case
    ADD CONSTRAINT content_review_case_realm_id_realm_id_fkey
        FOREIGN KEY (realm_id) REFERENCES public.realm(id) ON DELETE RESTRICT,
    ADD CONSTRAINT content_review_case_target_unit_id_unit_id_fkey
        FOREIGN KEY (target_unit_id) REFERENCES public.unit(id) ON DELETE RESTRICT,
    ADD CONSTRAINT content_review_case_assigned_profile_id_profile_id_fkey
        FOREIGN KEY (assigned_profile_id) REFERENCES public.profile(id) ON DELETE SET NULL,
    ADD CONSTRAINT content_review_case_duplicate_fkey
        FOREIGN KEY (duplicate_of_case_id)
        REFERENCES public.content_review_case(id) ON DELETE SET NULL;

CREATE TABLE public.content_report (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    reporter_profile_id uuid NOT NULL,
    context_realm_id uuid,
    target_unit_id uuid NOT NULL,
    details text,
    reported_revision_id uuid NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_report_details_not_blank CHECK (
        details IS NULL OR btrim(details) <> ''
    ),
    CONSTRAINT content_report_details_length CHECK (
        details IS NULL OR char_length(details) <= 2000
    )
);
CREATE INDEX content_report_reporter_created_idx
    ON public.content_report (
        reporter_profile_id,
        created_at DESC NULLS LAST,
        id DESC NULLS LAST
    );
CREATE INDEX content_report_context_target_created_idx
    ON public.content_report (
        context_realm_id,
        target_unit_id,
        created_at DESC NULLS LAST,
        id DESC NULLS LAST
    );
CREATE INDEX content_report_target_created_idx
    ON public.content_report (
        target_unit_id,
        created_at DESC NULLS LAST,
        id DESC NULLS LAST
    );
ALTER TABLE public.content_report
    ADD CONSTRAINT content_report_reporter_profile_id_profile_id_fkey
        FOREIGN KEY (reporter_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT,
    ADD CONSTRAINT content_report_context_realm_id_realm_id_fkey
        FOREIGN KEY (context_realm_id) REFERENCES public.realm(id) ON DELETE RESTRICT,
    ADD CONSTRAINT content_report_target_unit_id_unit_id_fkey
        FOREIGN KEY (target_unit_id) REFERENCES public.unit(id) ON DELETE RESTRICT,
    ADD CONSTRAINT content_report_revision_unit_fkey
        FOREIGN KEY (reported_revision_id, target_unit_id)
        REFERENCES public.unit_revision(id, unit_id) ON DELETE RESTRICT;

CREATE TABLE public.content_report_rule (
    report_id uuid,
    rule_source_realm_id uuid NOT NULL,
    rule_revision_id uuid NOT NULL,
    rule_id uuid,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_report_rule_pkey PRIMARY KEY (report_id, rule_id)
);
CREATE INDEX content_report_rule_source_report_idx
    ON public.content_report_rule (rule_source_realm_id, report_id);
CREATE INDEX content_report_rule_rule_report_idx
    ON public.content_report_rule (rule_id, report_id);
ALTER TABLE public.content_report_rule
    ADD CONSTRAINT content_report_rule_report_id_content_report_id_fkey
        FOREIGN KEY (report_id) REFERENCES public.content_report(id) ON DELETE CASCADE,
    ADD CONSTRAINT content_report_rule_rule_source_realm_id_realm_id_fkey
        FOREIGN KEY (rule_source_realm_id) REFERENCES public.realm(id) ON DELETE RESTRICT,
    ADD CONSTRAINT content_report_rule_rule_id_realm_rule_id_fkey
        FOREIGN KEY (rule_id) REFERENCES public.realm_rule(id) ON DELETE RESTRICT,
    ADD CONSTRAINT content_report_rule_revision_realm_fkey
        FOREIGN KEY (rule_source_realm_id, rule_revision_id)
        REFERENCES public.realm_rule_revision(realm_id, id) ON DELETE RESTRICT,
    ADD CONSTRAINT content_report_rule_revision_fkey
        FOREIGN KEY (rule_id, rule_revision_id)
        REFERENCES public.realm_rule(id, revision_id) ON DELETE RESTRICT;

CREATE TABLE public.content_report_referral (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    report_id uuid NOT NULL,
    case_id uuid NOT NULL,
    rule_source_realm_id uuid NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_report_referral_report_source_key
        UNIQUE (report_id, rule_source_realm_id),
    CONSTRAINT content_report_referral_case_report_key UNIQUE (case_id, report_id)
);
CREATE INDEX content_report_referral_case_created_idx
    ON public.content_report_referral (
        case_id,
        created_at DESC NULLS LAST,
        id DESC NULLS LAST
    );
CREATE INDEX content_report_referral_source_created_idx
    ON public.content_report_referral (
        rule_source_realm_id,
        created_at DESC NULLS LAST,
        id DESC NULLS LAST
    );
CREATE INDEX content_report_referral_report_idx
    ON public.content_report_referral (report_id, case_id);
ALTER TABLE public.content_report_referral
    ADD CONSTRAINT content_report_referral_report_id_content_report_id_fkey
        FOREIGN KEY (report_id) REFERENCES public.content_report(id) ON DELETE CASCADE,
    ADD CONSTRAINT content_report_referral_case_id_content_review_case_id_fkey
        FOREIGN KEY (case_id) REFERENCES public.content_review_case(id) ON DELETE RESTRICT,
    ADD CONSTRAINT content_report_referral_rule_source_realm_id_realm_id_fkey
        FOREIGN KEY (rule_source_realm_id) REFERENCES public.realm(id) ON DELETE RESTRICT;

CREATE TABLE public.content_review_case_report_counter (
    case_id uuid,
    bucket smallint,
    count integer DEFAULT 0 NOT NULL,
    CONSTRAINT content_review_case_report_counter_pkey PRIMARY KEY (case_id, bucket),
    CONSTRAINT content_review_case_report_counter_bucket_check CHECK (bucket BETWEEN 0 AND 255),
    CONSTRAINT content_review_case_report_counter_count_check CHECK (count >= 0)
);
ALTER TABLE public.content_review_case_report_counter
    ADD CONSTRAINT "content_review_case_report_counter_KrgxK8G8OThO_fkey"
        FOREIGN KEY (case_id) REFERENCES public.content_review_case(id) ON DELETE CASCADE;

CREATE TABLE public.content_governance_action (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    case_id uuid NOT NULL,
    actor_profile_id uuid NOT NULL,
    kind public.content_governance_action_kind NOT NULL,
    resulting_post_targeting_locked boolean,
    content_license_id uuid,
    previous_content_license_status public.unit_content_license_status,
    resulting_content_license_status public.unit_content_license_status,
    reverses_action_id uuid,
    previous_state text,
    resulting_state text,
    previous_post_targeting_locked boolean,
    request_id text,
    idempotency_key text,
    request_fingerprint text,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_governance_action_state_outcome_check CHECK (
        (previous_state IS NULL) = (resulting_state IS NULL)
    ),
    CONSTRAINT content_governance_action_post_targeting_lock_outcome_check CHECK (
        (previous_post_targeting_locked IS NULL) =
        (resulting_post_targeting_locked IS NULL)
    ),
    CONSTRAINT content_governance_action_single_outcome_check CHECK (
        num_nonnulls(
            previous_state,
            previous_post_targeting_locked,
            previous_content_license_status
        ) <= 1
    ),
    CONSTRAINT content_governance_action_kind_outcome_check CHECK (
        (
            kind IN ('approve', 'hide', 'remove', 'restore')
            AND previous_state IS NOT NULL
        ) OR (
            kind IN ('lock_post_targeting', 'unlock_post_targeting')
            AND previous_post_targeting_locked IS NOT NULL
        ) OR (
            kind IN ('invalidate_content_license', 'restore_content_license')
            AND previous_content_license_status IS NOT NULL
        ) OR (
            kind = 'reverse'
            AND num_nonnulls(previous_state, previous_post_targeting_locked) = 1
        )
    ),
    CONSTRAINT content_governance_action_content_license_transition_check CHECK (
        (
            kind = 'invalidate_content_license'
            AND content_license_id IS NOT NULL
            AND previous_content_license_status IS NOT NULL
            AND previous_content_license_status = 'active'
            AND resulting_content_license_status IS NOT NULL
            AND resulting_content_license_status = 'invalidated'
        ) OR (
            kind = 'restore_content_license'
            AND content_license_id IS NOT NULL
            AND previous_content_license_status IS NOT NULL
            AND previous_content_license_status = 'invalidated'
            AND resulting_content_license_status IS NOT NULL
            AND resulting_content_license_status = 'active'
        ) OR (
            kind NOT IN ('invalidate_content_license', 'restore_content_license')
            AND content_license_id IS NULL
            AND previous_content_license_status IS NULL
            AND resulting_content_license_status IS NULL
        )
    ),
    CONSTRAINT content_governance_action_request_fingerprint_check CHECK (
        request_fingerprint IS NULL OR request_fingerprint ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT content_governance_action_not_self_reverse CHECK (
        reverses_action_id IS NULL OR reverses_action_id <> id
    ),
    CONSTRAINT content_governance_action_reversal_check CHECK (
        (kind IN ('reverse', 'restore_content_license')) = (reverses_action_id IS NOT NULL)
    )
);
CREATE UNIQUE INDEX content_governance_action_actor_case_idempotency_key
    ON public.content_governance_action (actor_profile_id, case_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
CREATE INDEX content_governance_action_case_created_idx
    ON public.content_governance_action (
        case_id,
        created_at DESC NULLS LAST,
        id DESC NULLS LAST
    );
CREATE INDEX content_governance_action_actor_created_idx
    ON public.content_governance_action (
        actor_profile_id,
        created_at DESC NULLS LAST,
        id DESC NULLS LAST
    );
CREATE UNIQUE INDEX content_governance_action_reverses_key
    ON public.content_governance_action (reverses_action_id)
    WHERE reverses_action_id IS NOT NULL;
CREATE INDEX content_governance_action_content_license_created_idx
    ON public.content_governance_action (
        content_license_id,
        created_at DESC NULLS LAST,
        id DESC NULLS LAST
    );
ALTER TABLE public.content_governance_action
    ADD CONSTRAINT content_governance_action_case_id_content_review_case_id_fkey
        FOREIGN KEY (case_id) REFERENCES public.content_review_case(id) ON DELETE RESTRICT,
    ADD CONSTRAINT content_governance_action_actor_profile_id_profile_id_fkey
        FOREIGN KEY (actor_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT,
    ADD CONSTRAINT content_governance_action_reverses_fkey
        FOREIGN KEY (reverses_action_id)
        REFERENCES public.content_governance_action(id) ON DELETE RESTRICT,
    ADD CONSTRAINT content_governance_action_content_license_fkey
        FOREIGN KEY (content_license_id)
        REFERENCES public.unit_content_license(id) ON DELETE RESTRICT;

CREATE TABLE public.content_governance_action_rule (
    action_id uuid,
    rule_source_realm_id uuid NOT NULL,
    rule_revision_id uuid NOT NULL,
    rule_id uuid,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_governance_action_rule_pkey PRIMARY KEY (action_id, rule_id)
);
CREATE INDEX content_governance_action_rule_source_action_idx
    ON public.content_governance_action_rule (rule_source_realm_id, action_id);
CREATE INDEX content_governance_action_rule_rule_action_idx
    ON public.content_governance_action_rule (rule_id, action_id);
ALTER TABLE public.content_governance_action_rule
    ADD CONSTRAINT "content_governance_action_rule_2PSu5EriqVij_fkey"
        FOREIGN KEY (action_id) REFERENCES public.content_governance_action(id) ON DELETE CASCADE,
    ADD CONSTRAINT "content_governance_action_rule_wNXrlBJvo563_fkey"
        FOREIGN KEY (rule_source_realm_id) REFERENCES public.realm(id) ON DELETE RESTRICT,
    ADD CONSTRAINT content_governance_action_rule_rule_id_realm_rule_id_fkey
        FOREIGN KEY (rule_id) REFERENCES public.realm_rule(id) ON DELETE RESTRICT,
    ADD CONSTRAINT content_governance_action_rule_revision_realm_fkey
        FOREIGN KEY (rule_source_realm_id, rule_revision_id)
        REFERENCES public.realm_rule_revision(realm_id, id) ON DELETE RESTRICT,
    ADD CONSTRAINT content_governance_action_rule_revision_fkey
        FOREIGN KEY (rule_id, rule_revision_id)
        REFERENCES public.realm_rule(id, revision_id) ON DELETE RESTRICT;

ALTER TABLE public.realm_unit_status_event
    ADD CONSTRAINT realm_unit_status_event_content_governance_action_fkey
        FOREIGN KEY (content_governance_action_id)
        REFERENCES public.content_governance_action(id) ON DELETE RESTRICT;
