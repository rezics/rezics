-- The bootstrap administrator is contractually granted the complete platform
-- policy. Existing installations predate the Unit-merge capability labels, so
-- reconcile only that single bounded principal after the enum migration has
-- committed. Ordinary administrator grants remain unchanged and least-privilege.

SELECT pg_advisory_xact_lock(hashtextextended('platform-access-grants'::text, 0));

DO $bootstrap_unit_merge_access$
DECLARE
    bootstrap_profile_id CONSTANT uuid := '019b76da-a800-7200-8000-000000000004';
    desired_capability public.platform_capability;
    current_grant_id uuid;
    current_grant_expires_at timestamp(3) with time zone;
    created_grant_id uuid;
    migration_timestamp timestamp(3) with time zone := clock_timestamp();
BEGIN
    -- Fresh databases install the bootstrap graph after schema migration.
    IF NOT EXISTS (
        SELECT 1
        FROM public.profile
        WHERE id = bootstrap_profile_id
    ) THEN
        RETURN;
    END IF;

    FOREACH desired_capability IN ARRAY ARRAY[
        'unit.merge.propose',
        'unit.merge.review',
        'unit.merge'
    ]::public.platform_capability[]
    LOOP
        current_grant_id := NULL;
        current_grant_expires_at := NULL;

        SELECT existing_grant.id, existing_grant.expires_at
        INTO current_grant_id, current_grant_expires_at
        FROM public.platform_capability_grant AS existing_grant
        WHERE existing_grant.profile_id = bootstrap_profile_id
            AND existing_grant.capability = desired_capability
            AND existing_grant.revoked_at IS NULL
        LIMIT 1;

        IF current_grant_id IS NOT NULL AND current_grant_expires_at IS NULL THEN
            CONTINUE;
        END IF;

        IF current_grant_id IS NOT NULL THEN
            UPDATE public.platform_capability_grant
            SET revoked_at = migration_timestamp,
                revoked_by_profile_id = bootstrap_profile_id,
                updated_at = migration_timestamp
            WHERE id = current_grant_id;
        END IF;

        INSERT INTO public.platform_capability_grant (
            profile_id,
            capability,
            granted_by_profile_id,
            created_at,
            updated_at
        ) VALUES (
            bootstrap_profile_id,
            desired_capability,
            bootstrap_profile_id,
            migration_timestamp,
            migration_timestamp
        )
        RETURNING id INTO created_grant_id;

        INSERT INTO public.audit_event (
            category,
            outcome,
            actor_kind,
            actor_profile_id,
            actor_credential_kind,
            authority_kind,
            action,
            target_kind,
            target_id,
            details,
            created_at
        ) VALUES (
            'system_event',
            'succeeded',
            'profile',
            bootstrap_profile_id,
            'bootstrap',
            'platform',
            'platform.access.bootstrap',
            'profile',
            bootstrap_profile_id,
            jsonb_strip_nulls(jsonb_build_object(
                'capability', desired_capability::text,
                'grantId', created_grant_id,
                'replacedGrantId', current_grant_id,
                'source', 'migration'
            )),
            migration_timestamp
        );
    END LOOP;
END
$bootstrap_unit_merge_access$;
