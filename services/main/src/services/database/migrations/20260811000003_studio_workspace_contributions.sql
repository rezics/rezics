-- Studio is current explicit editor access; historical participation belongs to History.
-- This is a breaking persisted-contract cutover. API and worker traffic must be paused
-- while the two derived projections are backfilled and the old mixed relation is dropped.

CREATE TABLE public.profile_resource_participation (
    profile_id uuid NOT NULL,
    resource_unit_id uuid NOT NULL,
    created_resource_at timestamp(3) with time zone,
    first_contributed_at timestamp(3) with time zone,
    last_contributed_at timestamp(3) with time zone,
    contribution_count bigint DEFAULT 0 NOT NULL,
    last_participated_at timestamp(3) with time zone NOT NULL,
    projection_updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profile_resource_participation_pkey
        PRIMARY KEY (profile_id, resource_unit_id),
    CONSTRAINT profile_resource_participation_source_check
        CHECK (created_resource_at IS NOT NULL OR first_contributed_at IS NOT NULL),
    CONSTRAINT profile_resource_participation_contribution_shape_check CHECK (
        (
            contribution_count = 0
            AND first_contributed_at IS NULL
            AND last_contributed_at IS NULL
        ) OR (
            contribution_count > 0
            AND first_contributed_at IS NOT NULL
            AND last_contributed_at IS NOT NULL
            AND first_contributed_at <= last_contributed_at
        )
    ),
    CONSTRAINT profile_resource_participation_last_at_check CHECK (
        last_participated_at = greatest(created_resource_at, last_contributed_at)
    ),
    CONSTRAINT profile_resource_participation_profile_id_profile_id_fkey
        FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE,
    CONSTRAINT profile_resource_participation_resource_unit_id_unit_id_fkey
        FOREIGN KEY (resource_unit_id) REFERENCES public.unit(id) ON DELETE CASCADE
);

CREATE TABLE public.studio_profile_editor_candidate (
    profile_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    owner_since timestamp(3) with time zone,
    direct_grant_since timestamp(3) with time zone,
    direct_grant_last_at timestamp(3) with time zone,
    relevant_at timestamp(3) with time zone NOT NULL,
    valid_until timestamp(3) with time zone,
    projection_updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT studio_profile_editor_candidate_pkey PRIMARY KEY (profile_id, unit_id),
    CONSTRAINT studio_profile_editor_candidate_source_check CHECK (
        owner_since IS NOT NULL OR direct_grant_since IS NOT NULL
    ),
    CONSTRAINT studio_profile_editor_candidate_relevant_at_check CHECK (
        relevant_at = greatest(owner_since, direct_grant_last_at)
    ),
    CONSTRAINT studio_profile_editor_candidate_direct_grant_time_check CHECK (
        (
            direct_grant_since IS NULL
            AND direct_grant_last_at IS NULL
        ) OR (
            direct_grant_since IS NOT NULL
            AND direct_grant_last_at IS NOT NULL
            AND direct_grant_since <= direct_grant_last_at
        )
    ),
    CONSTRAINT studio_profile_editor_candidate_validity_check CHECK (
        valid_until IS NULL OR direct_grant_since IS NOT NULL
    ),
    CONSTRAINT studio_profile_editor_candidate_profile_id_profile_id_fkey
        FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE,
    CONSTRAINT studio_profile_editor_candidate_unit_id_unit_id_fkey
        FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE
);

CREATE TABLE public.studio_realm_editor_candidate (
    realm_id uuid NOT NULL,
    realm_relation public.realm_access_subject_relation NOT NULL,
    unit_id uuid NOT NULL,
    grant_since timestamp(3) with time zone NOT NULL,
    relevant_at timestamp(3) with time zone NOT NULL,
    valid_until timestamp(3) with time zone,
    projection_updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT studio_realm_editor_candidate_pkey
        PRIMARY KEY (realm_id, realm_relation, unit_id),
    CONSTRAINT studio_realm_editor_candidate_time_check CHECK (grant_since <= relevant_at),
    CONSTRAINT studio_realm_editor_candidate_realm_id_realm_id_fkey
        FOREIGN KEY (realm_id) REFERENCES public.realm(id) ON DELETE CASCADE,
    CONSTRAINT studio_realm_editor_candidate_unit_id_unit_id_fkey
        FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE
);

-- Refresh one Profile/Unit candidate from authoritative ownership and direct grants.
CREATE OR REPLACE FUNCTION public.refresh_studio_profile_editor_candidate(
    candidate_profile_id uuid,
    candidate_unit_id uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    current_owner_since timestamp(3) with time zone;
    current_direct_since timestamp(3) with time zone;
    current_direct_last_at timestamp(3) with time zone;
    current_direct_valid_until timestamp(3) with time zone;
    has_non_expiring_direct boolean;
BEGIN
    IF candidate_profile_id IS NULL OR candidate_unit_id IS NULL THEN
        RETURN;
    END IF;

    SELECT min(ownership.created_at)
    INTO current_owner_since
    FROM public.unit_ownership AS ownership
    WHERE ownership.profile_id = candidate_profile_id
      AND ownership.unit_id = candidate_unit_id
      AND ownership.revoked_at IS NULL;

    SELECT
        min(access_grant.created_at),
        max(access_grant.created_at),
        bool_or(access_grant.expires_at IS NULL),
        max(access_grant.expires_at)
    INTO
        current_direct_since,
        current_direct_last_at,
        has_non_expiring_direct,
        current_direct_valid_until
    FROM public.unit_access_grant AS access_grant
    WHERE access_grant.subject_kind = 'profile'::public.unit_access_subject_kind
      AND access_grant.profile_id = candidate_profile_id
      AND access_grant.unit_id = candidate_unit_id
      AND access_grant.permission = 'unit.update'::public.unit_permission
      AND access_grant.revoked_at IS NULL;

    IF current_owner_since IS NULL AND current_direct_since IS NULL THEN
        DELETE FROM public.studio_profile_editor_candidate
        WHERE profile_id = candidate_profile_id
          AND unit_id = candidate_unit_id;
        RETURN;
    END IF;

    INSERT INTO public.studio_profile_editor_candidate (
        profile_id,
        unit_id,
        owner_since,
        direct_grant_since,
        direct_grant_last_at,
        relevant_at,
        valid_until,
        projection_updated_at
    ) VALUES (
        candidate_profile_id,
        candidate_unit_id,
        current_owner_since,
        current_direct_since,
        current_direct_last_at,
        greatest(current_owner_since, current_direct_last_at),
        CASE
            WHEN current_owner_since IS NOT NULL OR coalesce(has_non_expiring_direct, false)
                THEN NULL
            ELSE current_direct_valid_until
        END,
        clock_timestamp()
    )
    ON CONFLICT (profile_id, unit_id) DO UPDATE SET
        owner_since = excluded.owner_since,
        direct_grant_since = excluded.direct_grant_since,
        direct_grant_last_at = excluded.direct_grant_last_at,
        relevant_at = excluded.relevant_at,
        valid_until = excluded.valid_until,
        projection_updated_at = excluded.projection_updated_at;
END
$$;

-- Refresh one Realm-relation/Unit candidate without fanning out Realm members.
CREATE OR REPLACE FUNCTION public.refresh_studio_realm_editor_candidate(
    candidate_realm_id uuid,
    candidate_realm_relation public.realm_access_subject_relation,
    candidate_unit_id uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    current_grant_since timestamp(3) with time zone;
    current_grant_last_at timestamp(3) with time zone;
    current_valid_until timestamp(3) with time zone;
    has_non_expiring_grant boolean;
BEGIN
    IF candidate_realm_id IS NULL
        OR candidate_realm_relation IS NULL
        OR candidate_unit_id IS NULL
    THEN
        RETURN;
    END IF;

    SELECT
        min(access_grant.created_at),
        max(access_grant.created_at),
        bool_or(access_grant.expires_at IS NULL),
        max(access_grant.expires_at)
    INTO
        current_grant_since,
        current_grant_last_at,
        has_non_expiring_grant,
        current_valid_until
    FROM public.unit_access_grant AS access_grant
    WHERE access_grant.subject_kind = 'realm'::public.unit_access_subject_kind
      AND access_grant.realm_id = candidate_realm_id
      AND access_grant.realm_relation = candidate_realm_relation
      AND access_grant.unit_id = candidate_unit_id
      AND access_grant.permission = 'unit.update'::public.unit_permission
      AND access_grant.revoked_at IS NULL;

    IF current_grant_since IS NULL THEN
        DELETE FROM public.studio_realm_editor_candidate
        WHERE realm_id = candidate_realm_id
          AND realm_relation = candidate_realm_relation
          AND unit_id = candidate_unit_id;
        RETURN;
    END IF;

    INSERT INTO public.studio_realm_editor_candidate (
        realm_id,
        realm_relation,
        unit_id,
        grant_since,
        relevant_at,
        valid_until,
        projection_updated_at
    ) VALUES (
        candidate_realm_id,
        candidate_realm_relation,
        candidate_unit_id,
        current_grant_since,
        current_grant_last_at,
        CASE
            WHEN coalesce(has_non_expiring_grant, false) THEN NULL
            ELSE current_valid_until
        END,
        clock_timestamp()
    )
    ON CONFLICT (realm_id, realm_relation, unit_id) DO UPDATE SET
        grant_since = excluded.grant_since,
        relevant_at = excluded.relevant_at,
        valid_until = excluded.valid_until,
        projection_updated_at = excluded.projection_updated_at;
END
$$;

CREATE OR REPLACE FUNCTION public.maintain_studio_editor_candidate_from_ownership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF TG_OP <> 'INSERT' THEN
        PERFORM public.refresh_studio_profile_editor_candidate(OLD.profile_id, OLD.unit_id);
    END IF;
    IF TG_OP <> 'DELETE' THEN
        PERFORM public.refresh_studio_profile_editor_candidate(NEW.profile_id, NEW.unit_id);
    END IF;
    RETURN coalesce(NEW, OLD);
END
$$;

CREATE OR REPLACE FUNCTION public.maintain_studio_editor_candidate_from_grant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF TG_OP <> 'INSERT' AND OLD.permission = 'unit.update'::public.unit_permission THEN
        IF OLD.subject_kind = 'profile'::public.unit_access_subject_kind THEN
            PERFORM public.refresh_studio_profile_editor_candidate(OLD.profile_id, OLD.unit_id);
        ELSIF OLD.subject_kind = 'realm'::public.unit_access_subject_kind THEN
            PERFORM public.refresh_studio_realm_editor_candidate(
                OLD.realm_id,
                OLD.realm_relation,
                OLD.unit_id
            );
        END IF;
    END IF;
    IF TG_OP <> 'DELETE' AND NEW.permission = 'unit.update'::public.unit_permission THEN
        IF NEW.subject_kind = 'profile'::public.unit_access_subject_kind THEN
            PERFORM public.refresh_studio_profile_editor_candidate(NEW.profile_id, NEW.unit_id);
        ELSIF NEW.subject_kind = 'realm'::public.unit_access_subject_kind THEN
            PERFORM public.refresh_studio_realm_editor_candidate(
                NEW.realm_id,
                NEW.realm_relation,
                NEW.unit_id
            );
        END IF;
    END IF;
    RETURN coalesce(NEW, OLD);
END
$$;

CREATE TRIGGER studio_editor_candidate_from_ownership
AFTER INSERT OR DELETE OR UPDATE OF
    profile_id,
    unit_id,
    revoked_at,
    created_at
ON public.unit_ownership
FOR EACH ROW EXECUTE FUNCTION public.maintain_studio_editor_candidate_from_ownership();

CREATE TRIGGER studio_editor_candidate_from_grant
AFTER INSERT OR DELETE OR UPDATE OF
    unit_id,
    subject_kind,
    profile_id,
    realm_id,
    realm_relation,
    permission,
    expires_at,
    revoked_at,
    created_at
ON public.unit_access_grant
FOR EACH ROW EXECUTE FUNCTION public.maintain_studio_editor_candidate_from_grant();

-- Backfill the compact History projection from the old rebuildable evidence table.
INSERT INTO public.profile_resource_participation (
    profile_id,
    resource_unit_id,
    created_resource_at,
    first_contributed_at,
    last_contributed_at,
    contribution_count,
    last_participated_at
)
SELECT
    relation.profile_id,
    relation.resource_unit_id,
    min(relation.first_at) FILTER (WHERE relation.relation = 'created'),
    min(relation.first_at) FILTER (WHERE relation.relation = 'contributed'),
    max(relation.last_at) FILTER (WHERE relation.relation = 'contributed'),
    coalesce(
        sum(relation.activity_count) FILTER (WHERE relation.relation = 'contributed'),
        0
    )::bigint,
    max(relation.last_at)
FROM public.studio_work_relation AS relation
GROUP BY relation.profile_id, relation.resource_unit_id;

-- Backfill current access candidates. Expired grants are omitted; trigger refreshes
-- retain future-expiring rows and the read path applies valid_until plus live grants.
WITH editor_source AS (
    SELECT
        ownership.profile_id,
        ownership.unit_id,
        ownership.created_at AS owner_since,
        NULL::timestamptz AS direct_grant_since,
        NULL::timestamptz AS direct_grant_last_at,
        ownership.created_at AS relevant_at,
        true AS non_expiring,
        NULL::timestamptz AS expires_at
    FROM public.unit_ownership AS ownership
    WHERE ownership.revoked_at IS NULL

    UNION ALL

    SELECT
        access_grant.profile_id,
        access_grant.unit_id,
        NULL,
        access_grant.created_at,
        access_grant.created_at,
        access_grant.created_at,
        access_grant.expires_at IS NULL,
        access_grant.expires_at
    FROM public.unit_access_grant AS access_grant
    WHERE access_grant.subject_kind = 'profile'::public.unit_access_subject_kind
      AND access_grant.profile_id IS NOT NULL
      AND access_grant.permission = 'unit.update'::public.unit_permission
      AND access_grant.revoked_at IS NULL
      AND (access_grant.expires_at IS NULL OR access_grant.expires_at > now())
)
INSERT INTO public.studio_profile_editor_candidate (
    profile_id,
    unit_id,
    owner_since,
    direct_grant_since,
    direct_grant_last_at,
    relevant_at,
    valid_until
)
SELECT
    profile_id,
    unit_id,
    min(owner_since),
    min(direct_grant_since),
    max(direct_grant_last_at),
    max(relevant_at),
    CASE WHEN bool_or(non_expiring) THEN NULL ELSE max(expires_at) END
FROM editor_source
GROUP BY profile_id, unit_id;

INSERT INTO public.studio_realm_editor_candidate (
    realm_id,
    realm_relation,
    unit_id,
    grant_since,
    relevant_at,
    valid_until
)
SELECT
    access_grant.realm_id,
    access_grant.realm_relation,
    access_grant.unit_id,
    min(access_grant.created_at),
    max(access_grant.created_at),
    CASE
        WHEN bool_or(access_grant.expires_at IS NULL) THEN NULL
        ELSE max(access_grant.expires_at)
    END
FROM public.unit_access_grant AS access_grant
WHERE access_grant.subject_kind = 'realm'::public.unit_access_subject_kind
  AND access_grant.realm_id IS NOT NULL
  AND access_grant.realm_relation IS NOT NULL
  AND access_grant.permission = 'unit.update'::public.unit_permission
  AND access_grant.revoked_at IS NULL
  AND (access_grant.expires_at IS NULL OR access_grant.expires_at > now())
GROUP BY access_grant.realm_id, access_grant.realm_relation, access_grant.unit_id;

CREATE INDEX profile_resource_participation_profile_recent_idx
    ON public.profile_resource_participation (
        profile_id,
        last_participated_at DESC NULLS LAST,
        resource_unit_id DESC NULLS LAST
    );
CREATE INDEX profile_resource_participation_profile_created_idx
    ON public.profile_resource_participation (
        profile_id,
        created_resource_at DESC NULLS LAST,
        resource_unit_id DESC NULLS LAST
    ) WHERE created_resource_at IS NOT NULL;
CREATE INDEX profile_resource_participation_profile_contributed_idx
    ON public.profile_resource_participation (
        profile_id,
        last_contributed_at DESC NULLS LAST,
        resource_unit_id DESC NULLS LAST
    ) WHERE last_contributed_at IS NOT NULL;
CREATE INDEX profile_resource_participation_resource_idx
    ON public.profile_resource_participation (resource_unit_id, profile_id);

CREATE INDEX studio_profile_editor_candidate_profile_recent_idx
    ON public.studio_profile_editor_candidate (
        profile_id,
        relevant_at DESC NULLS LAST,
        unit_id DESC NULLS LAST
    );
CREATE INDEX studio_profile_editor_candidate_unit_idx
    ON public.studio_profile_editor_candidate (unit_id, profile_id);
CREATE INDEX studio_profile_editor_candidate_expiry_idx
    ON public.studio_profile_editor_candidate (valid_until, profile_id, unit_id)
    WHERE valid_until IS NOT NULL;
CREATE INDEX studio_realm_editor_candidate_subject_recent_idx
    ON public.studio_realm_editor_candidate (
        realm_id,
        realm_relation,
        relevant_at DESC NULLS LAST,
        unit_id DESC NULLS LAST
    );
CREATE INDEX studio_realm_editor_candidate_unit_idx
    ON public.studio_realm_editor_candidate (unit_id, realm_id, realm_relation);
CREATE INDEX studio_realm_editor_candidate_expiry_idx
    ON public.studio_realm_editor_candidate (
        valid_until,
        realm_id,
        realm_relation,
        unit_id
    ) WHERE valid_until IS NOT NULL;

CREATE TRIGGER reject_merged_unit_profile_resource_participation_resource_unit_id
BEFORE INSERT OR UPDATE OF resource_unit_id ON public.profile_resource_participation
FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('resource_unit_id');
CREATE TRIGGER reject_merged_unit_studio_profile_editor_candidate_unit_id
BEFORE INSERT OR UPDATE OF unit_id ON public.studio_profile_editor_candidate
FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');
CREATE TRIGGER reject_merged_unit_studio_realm_editor_candidate_unit_id
BEFORE INSERT OR UPDATE OF unit_id ON public.studio_realm_editor_candidate
FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');

DROP TABLE public.studio_work_relation;
