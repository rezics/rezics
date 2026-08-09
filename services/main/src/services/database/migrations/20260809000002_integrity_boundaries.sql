-- Tighten row-local invariants without scanning existing corpus-scale tables.
-- NOT VALID constraints protect every new or updated row immediately; operators
-- validate existing rows separately after the bounded repair preflight.

ALTER TABLE public.image_object
    ADD CONSTRAINT image_object_metadata_shape_check_v2
    CHECK (
        (
            media_type IS NULL
            AND byte_size IS NULL
            AND width IS NULL
            AND height IS NULL
        ) OR (
            media_type IS NOT NULL
            AND byte_size IS NOT NULL
            AND byte_size > 0
            AND width IS NOT NULL
            AND width > 0
            AND height IS NOT NULL
            AND height > 0
        )
    ) NOT VALID;
ALTER TABLE public.image_object DROP CONSTRAINT image_object_metadata_shape_check;
ALTER TABLE public.image_object
    RENAME CONSTRAINT image_object_metadata_shape_check_v2
    TO image_object_metadata_shape_check;

ALTER TABLE public.content_structure_node
    ADD CONSTRAINT content_structure_node_target_shape_check_v2
    CHECK (
        (
            target_kind IN ('content', 'none')
            AND target_unit_id IS NULL
            AND target_url IS NULL
        ) OR (
            target_kind = 'unit'
            AND target_unit_id IS NOT NULL
            AND target_url IS NULL
        ) OR (
            target_kind = 'external'
            AND target_unit_id IS NULL
            AND target_url IS NOT NULL
            AND target_url ~ '^https://[^[:space:]]+$'
            AND char_length(target_url) <= 2000
        )
    ) NOT VALID;
ALTER TABLE public.content_structure_node
    DROP CONSTRAINT content_structure_node_target_shape_check;
ALTER TABLE public.content_structure_node
    RENAME CONSTRAINT content_structure_node_target_shape_check_v2
    TO content_structure_node_target_shape_check;

ALTER TABLE public.email_outbox
    ADD CONSTRAINT email_outbox_intent_check_v2
    CHECK (
        (
            kind = 'notification'::public.email_outbox_kind
            AND notification_id IS NOT NULL
            AND recipient_email IS NULL
            AND locale IS NULL
            AND action_url IS NULL
        ) OR (
            kind IN (
                'verify_email'::public.email_outbox_kind,
                'reset_password'::public.email_outbox_kind
            )
            AND notification_id IS NULL
            AND (
                (
                    status IN (
                        'pending'::public.email_outbox_status,
                        'processing'::public.email_outbox_status
                    )
                    AND nullif(btrim(recipient_email), '') IS NOT NULL
                    AND nullif(btrim(action_url), '') IS NOT NULL
                    AND locale IS NOT NULL
                    AND locale IN ('zh', 'en', 'ja', 'ko', 'de', 'fr', 'es')
                ) OR (
                    status IN (
                        'accepted'::public.email_outbox_status,
                        'failed'::public.email_outbox_status
                    )
                    AND recipient_email IS NULL
                    AND locale IS NULL
                    AND action_url IS NULL
                )
            )
        )
    ) NOT VALID;
ALTER TABLE public.email_outbox DROP CONSTRAINT email_outbox_intent_check;
ALTER TABLE public.email_outbox
    RENAME CONSTRAINT email_outbox_intent_check_v2 TO email_outbox_intent_check;

ALTER TABLE public.moderation_action
    ADD CONSTRAINT moderation_action_content_license_transition_check_v2
    CHECK (
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
    ) NOT VALID;
ALTER TABLE public.moderation_action
    DROP CONSTRAINT moderation_action_content_license_transition_check;
ALTER TABLE public.moderation_action
    RENAME CONSTRAINT moderation_action_content_license_transition_check_v2
    TO moderation_action_content_license_transition_check;

ALTER TABLE public.unit_ownership_claim
    ADD CONSTRAINT unit_ownership_claim_resolution_shape_check_v2
    CHECK (
        (
            resolution IS NULL
            AND resolved_at IS NULL
            AND resolved_by_profile_id IS NULL
            AND resulting_ownership_id IS NULL
        ) OR (
            resolution IS NOT NULL
            AND resolution = 'approved'
            AND resolved_at IS NOT NULL
            AND resolved_by_profile_id IS NOT NULL
            AND resulting_ownership_id IS NOT NULL
        ) OR (
            resolution IS NOT NULL
            AND resolution IN ('rejected', 'withdrawn', 'superseded')
            AND resolved_at IS NOT NULL
            AND resolved_by_profile_id IS NOT NULL
            AND resulting_ownership_id IS NULL
        )
    ) NOT VALID;
ALTER TABLE public.unit_ownership_claim
    DROP CONSTRAINT unit_ownership_claim_resolution_shape_check;
ALTER TABLE public.unit_ownership_claim
    RENAME CONSTRAINT unit_ownership_claim_resolution_shape_check_v2
    TO unit_ownership_claim_resolution_shape_check;

ALTER TABLE public.unit_localization
    ADD CONSTRAINT unit_localization_avatar_value_check_v2
    CHECK (
        (
            avatar_type IS NULL
            AND avatar_asset_id IS NULL
            AND avatar_emoji IS NULL
            AND avatar_icon_prefix IS NULL
            AND avatar_icon_name IS NULL
        ) OR (
            avatar_type = 'image'
            AND avatar_asset_id IS NOT NULL
            AND avatar_emoji IS NULL
            AND avatar_icon_prefix IS NULL
            AND avatar_icon_name IS NULL
        ) OR (
            avatar_type = 'emoji'
            AND avatar_asset_id IS NULL
            AND avatar_emoji IS NOT NULL
            AND char_length(avatar_emoji) <= 64
            AND avatar_icon_prefix IS NULL
            AND avatar_icon_name IS NULL
        ) OR (
            avatar_type = 'icon'
            AND avatar_asset_id IS NULL
            AND avatar_emoji IS NULL
            AND avatar_icon_prefix IS NOT NULL
            AND avatar_icon_prefix IN ('fas', 'fab')
            AND avatar_icon_name IS NOT NULL
            AND avatar_icon_name ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
            AND char_length(avatar_icon_name) <= 128
        )
    ) NOT VALID;
ALTER TABLE public.unit_localization DROP CONSTRAINT unit_localization_avatar_value_check;
ALTER TABLE public.unit_localization
    RENAME CONSTRAINT unit_localization_avatar_value_check_v2
    TO unit_localization_avatar_value_check;

-- Only the byte ceiling belongs in PostgreSQL. The API owns syntax and its
-- tighter external-input budget. These checks prevent oversized indexed keys
-- from making writes or future B-tree rebuilds fail.
ALTER TABLE public.unit_localization
    ADD CONSTRAINT unit_localization_position_byte_length_check
    CHECK (octet_length("position") <= 1024) NOT VALID;
ALTER TABLE public.unit_alias
    ADD CONSTRAINT unit_alias_position_byte_length_check
    CHECK (octet_length("position") <= 1024) NOT VALID;
ALTER TABLE public.unit_external_link
    ADD CONSTRAINT unit_external_link_position_byte_length_check
    CHECK (octet_length("position") <= 1024) NOT VALID;
ALTER TABLE public.unit_structure_application
    ADD CONSTRAINT unit_structure_application_position_byte_length_check
    CHECK (octet_length("position") <= 1024) NOT VALID;
ALTER TABLE public.realm_pin
    ADD CONSTRAINT realm_pin_position_byte_length_check
    CHECK (octet_length("position") <= 1024) NOT VALID;
ALTER TABLE public.unit_follow
    ADD CONSTRAINT unit_follow_position_byte_length_check
    CHECK (octet_length("position") <= 1024) NOT VALID;
ALTER TABLE public.content_structure_node
    ADD CONSTRAINT content_structure_node_position_byte_length_check
    CHECK (octet_length("position") <= 1024) NOT VALID;
ALTER TABLE public.unit_tag
    ADD CONSTRAINT unit_tag_position_byte_length_check
    CHECK (octet_length("position") <= 1024) NOT VALID;
ALTER TABLE public.profile_realm_tag_subscription
    ADD CONSTRAINT profile_realm_tag_subscription_position_byte_length_check
    CHECK (octet_length("position") <= 1024) NOT VALID;
ALTER TABLE public.realm_unit_tag
    ADD CONSTRAINT realm_unit_tag_position_byte_length_check
    CHECK (octet_length("position") <= 1024) NOT VALID;
ALTER TABLE public.profile_unit_tag
    ADD CONSTRAINT profile_unit_tag_position_byte_length_check
    CHECK (octet_length("position") <= 1024) NOT VALID;
ALTER TABLE public.post_progress_entry
    ADD CONSTRAINT post_progress_entry_position_byte_length_check
    CHECK (octet_length("position") <= 1024) NOT VALID;
ALTER TABLE public.series_release
    ADD CONSTRAINT series_release_position_byte_length_check
    CHECK (octet_length("position") <= 1024) NOT VALID;
ALTER TABLE public.collection_item
    ADD CONSTRAINT collection_item_position_byte_length_check
    CHECK (octet_length("position") <= 1024) NOT VALID;
ALTER TABLE public.post_score
    ADD CONSTRAINT post_score_position_byte_length_check
    CHECK (octet_length("position") <= 1024) NOT VALID;
ALTER TABLE public.credit_attribution
    ADD CONSTRAINT credit_attribution_position_byte_length_check
    CHECK (octet_length("position") <= 1024) NOT VALID;
ALTER TABLE public.subject_association
    ADD CONSTRAINT subject_association_position_byte_length_check
    CHECK (octet_length("position") <= 1024) NOT VALID;

-- Serialize every transition that can add a row to a Unit's active or pinned
-- set, including direct writers that move an existing row to another Unit.
CREATE OR REPLACE FUNCTION public.enforce_unit_reference_limits() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = pg_catalog, public
    AS $$
DECLARE
    active_count integer;
    pinned_count integer;
    entering_active boolean := false;
    entering_pinned boolean := false;
    reference_kind text := TG_ARGV[0];
BEGIN
    IF TG_OP = 'INSERT' THEN
        entering_active := NEW.withdrawn_at IS NULL;
        entering_pinned := NEW.withdrawn_at IS NULL AND NEW.pinned;
    ELSE
        entering_active := NEW.withdrawn_at IS NULL AND (
            OLD.withdrawn_at IS NOT NULL
            OR NEW.unit_id IS DISTINCT FROM OLD.unit_id
        );
        entering_pinned := NEW.withdrawn_at IS NULL AND NEW.pinned AND (
            NOT OLD.pinned
            OR OLD.withdrawn_at IS NOT NULL
            OR NEW.unit_id IS DISTINCT FROM OLD.unit_id
        );
    END IF;

    IF entering_active OR entering_pinned THEN
        PERFORM pg_advisory_xact_lock(
            hashtextextended('unit-reference:' || reference_kind || ':' || NEW.unit_id::text, 0)
        );
    END IF;

    IF entering_active THEN
        EXECUTE format(
            'SELECT count(*) FROM ('
            || 'SELECT 1 FROM public.%I '
            || 'WHERE unit_id = $1 AND withdrawn_at IS NULL AND id <> $2 LIMIT 128'
            || ') AS active_reference',
            TG_TABLE_NAME
        )
        INTO active_count
        USING NEW.unit_id, NEW.id;
        IF active_count >= 128 THEN
            RAISE EXCEPTION 'Unit % already has 128 active % references',
                NEW.unit_id, reference_kind
                USING ERRCODE = '23514', CONSTRAINT = 'unit_reference_active_limit';
        END IF;
    END IF;

    IF entering_pinned THEN
        EXECUTE format(
            'SELECT count(*) FROM ('
            || 'SELECT 1 FROM public.%I '
            || 'WHERE unit_id = $1 AND withdrawn_at IS NULL AND pinned AND id <> $2 LIMIT 16'
            || ') AS pinned_reference',
            TG_TABLE_NAME
        )
        INTO pinned_count
        USING NEW.unit_id, NEW.id;
        IF pinned_count >= 16 THEN
            RAISE EXCEPTION 'Unit % already has 16 pinned % references',
                NEW.unit_id, reference_kind
                USING ERRCODE = '23514', CONSTRAINT = 'unit_reference_pinned_limit';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER unit_alias_reference_limits ON public.unit_alias;
CREATE TRIGGER unit_alias_reference_limits
    BEFORE INSERT OR UPDATE OF unit_id, withdrawn_at, pinned ON public.unit_alias
    FOR EACH ROW EXECUTE FUNCTION public.enforce_unit_reference_limits('alias');

DROP TRIGGER unit_external_link_reference_limits ON public.unit_external_link;
CREATE TRIGGER unit_external_link_reference_limits
    BEFORE INSERT OR UPDATE OF unit_id, withdrawn_at, pinned ON public.unit_external_link
    FOR EACH ROW EXECUTE FUNCTION public.enforce_unit_reference_limits('external_link');
