-- Reassign the fixed REZICS brand image from its obsolete Zone meaning to the
-- official community Realm. This touches one image object and the bounded set
-- of localizations for one fixed Realm; fresh installations create the final
-- state after migrations and therefore have nothing to cut over here.

DO $official_realm_avatar_cutover$
DECLARE
    official_realm_id CONSTANT uuid := '019b76da-a800-7300-8000-000000000001';
    fixed_avatar_asset_id CONSTANT uuid := '019b76da-a800-7800-8000-000000000001';
    fixed_avatar_object_id CONSTANT uuid := '019b76da-a800-7810-8000-000000000001';
    cutover_timestamp timestamp(3) with time zone := clock_timestamp();
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.realm
        WHERE id = official_realm_id
    ) THEN
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.image_asset
        WHERE id = fixed_avatar_asset_id
            AND status = 'ready'
            AND access = 'public'
            AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Official Realm avatar image asset is unavailable'
            USING ERRCODE = '23503';
    END IF;

    UPDATE public.image_object
    SET width = 800,
        height = 800,
        updated_at = cutover_timestamp
    WHERE id = fixed_avatar_object_id
        AND asset_id = fixed_avatar_asset_id
        AND storage_key = 'bootstrap/image-objects/official-zone-avatar/original'
        AND media_type = 'image/png'
        AND byte_size > 0;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Official Realm avatar image object is unavailable or invalid'
            USING ERRCODE = '23514';
    END IF;

    UPDATE public.unit_localization
    SET avatar_type = 'image',
        avatar_asset_id = fixed_avatar_asset_id,
        avatar_emoji = NULL,
        avatar_icon_prefix = NULL,
        avatar_icon_name = NULL,
        updated_at = cutover_timestamp
    WHERE unit_id = official_realm_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Official Realm has no localization to receive its avatar'
            USING ERRCODE = '23503';
    END IF;
END
$official_realm_avatar_cutover$;
