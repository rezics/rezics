-- Refresh one Auth/Unit candidate from authoritative ownership and direct grants.
CREATE OR REPLACE FUNCTION public.refresh_studio_auth_editor_candidate(
    candidate_auth_user_id uuid,
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
    IF candidate_auth_user_id IS NULL OR candidate_unit_id IS NULL THEN
        RETURN;
    END IF;

    PERFORM 1 FROM public.users WHERE id = candidate_auth_user_id AND erased_at IS NULL FOR SHARE;
    IF NOT FOUND THEN
      DELETE FROM public.studio_auth_editor_candidate WHERE auth_user_id = candidate_auth_user_id AND unit_id = candidate_unit_id;
      RETURN;
    END IF;
    SELECT min(ownership.created_at)
    INTO current_owner_since
    FROM public.unit_ownership AS ownership
    JOIN public.auth_entity binding ON binding.entity_id = ownership.profile_id
    WHERE binding.auth_user_id = candidate_auth_user_id
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
    WHERE access_grant.subject_kind = 'auth'::public.unit_access_subject_kind
      AND access_grant.auth_user_id = candidate_auth_user_id
      AND access_grant.unit_id = candidate_unit_id
      AND access_grant.permission = 'unit.update'::public.unit_permission
      AND access_grant.revoked_at IS NULL;

    IF current_owner_since IS NULL AND current_direct_since IS NULL THEN
        DELETE FROM public.studio_auth_editor_candidate
        WHERE auth_user_id = candidate_auth_user_id
          AND unit_id = candidate_unit_id;
        RETURN;
    END IF;

    INSERT INTO public.studio_auth_editor_candidate (
        auth_user_id,
        unit_id,
        owner_since,
        direct_grant_since,
        direct_grant_last_at,
        relevant_at,
        valid_until,
        projection_updated_at
    ) VALUES (
        candidate_auth_user_id,
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
    ON CONFLICT (auth_user_id, unit_id) DO UPDATE SET
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
        PERFORM public.refresh_studio_auth_editor_candidate((SELECT auth_user_id FROM public.auth_entity WHERE entity_id = OLD.profile_id), OLD.unit_id);
    END IF;
    IF TG_OP <> 'DELETE' THEN
        PERFORM public.refresh_studio_auth_editor_candidate((SELECT auth_user_id FROM public.auth_entity WHERE entity_id = NEW.profile_id), NEW.unit_id);
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
        IF OLD.subject_kind = 'auth'::public.unit_access_subject_kind THEN
            PERFORM public.refresh_studio_auth_editor_candidate(OLD.auth_user_id, OLD.unit_id);
        ELSIF OLD.subject_kind = 'realm'::public.unit_access_subject_kind THEN
            PERFORM public.refresh_studio_realm_editor_candidate(
                OLD.realm_id,
                OLD.realm_relation,
                OLD.unit_id
            );
        END IF;
    END IF;
    IF TG_OP <> 'DELETE' AND NEW.permission = 'unit.update'::public.unit_permission THEN
        IF NEW.subject_kind = 'auth'::public.unit_access_subject_kind THEN
            PERFORM public.refresh_studio_auth_editor_candidate(NEW.auth_user_id, NEW.unit_id);
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

DROP TRIGGER IF EXISTS studio_editor_candidate_from_ownership ON public.unit_ownership;
CREATE TRIGGER studio_editor_candidate_from_ownership
AFTER INSERT OR DELETE OR UPDATE OF
    profile_id,
    unit_id,
    revoked_at,
    created_at
ON public.unit_ownership
FOR EACH ROW EXECUTE FUNCTION public.maintain_studio_editor_candidate_from_ownership();

DROP TRIGGER IF EXISTS studio_editor_candidate_from_grant ON public.unit_access_grant;
CREATE TRIGGER studio_editor_candidate_from_grant
AFTER INSERT OR DELETE OR UPDATE OF
    unit_id,
    subject_kind,
    auth_user_id,
    realm_id,
    realm_relation,
    permission,
    expires_at,
    revoked_at,
    created_at
ON public.unit_access_grant
FOR EACH ROW EXECUTE FUNCTION public.maintain_studio_editor_candidate_from_grant();


DROP FUNCTION IF EXISTS public.refresh_studio_profile_editor_candidate(uuid, uuid);
