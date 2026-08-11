-- Notification read-all is a per-recipient watermark, not a history rewrite.
-- The three nullable fields form one cursor so existing rows require no backfill
-- and the cutover does not scan the corpus-scale notification relation.

ALTER TABLE public.notification_recipient_stat
    ADD COLUMN read_through_created_at timestamp(3) with time zone,
    ADD COLUMN read_through_id uuid,
    ADD COLUMN read_through_at timestamp(3) with time zone;

ALTER TABLE public.notification_recipient_stat
    ADD CONSTRAINT notification_recipient_stat_read_through_shape_check
    CHECK (
        (
            read_through_created_at IS NULL
            AND read_through_id IS NULL
            AND read_through_at IS NULL
        ) OR (
            read_through_created_at IS NOT NULL
            AND read_through_id IS NOT NULL
            AND read_through_at IS NOT NULL
        )
    ) NOT VALID,
    ADD CONSTRAINT notification_recipient_stat_read_through_time_check
    CHECK (
        read_through_at IS NULL
        OR read_through_at >= read_through_created_at
    ) NOT VALID;

-- Delivery and read-all serialize on a transaction-scoped recipient lock. The
-- advisory lock is acquired before the row exists, avoiding an inverted row
-- lock order with a concurrent delete. A delayed insert whose transaction
-- timestamp predates the current watermark is moved just beyond that watermark,
-- so a notification committed after read-all remains unread.
CREATE OR REPLACE FUNCTION public.prepare_notification_recipient_state()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    boundary_created_at timestamp(3) with time zone;
    boundary_id uuid;
BEGIN
    PERFORM pg_advisory_xact_lock(
        hashtextextended('notification-recipient:' || NEW.recipient_profile_id::text, 0)
    );

    INSERT INTO public.notification_recipient_stat (profile_id)
    VALUES (NEW.recipient_profile_id)
    ON CONFLICT (profile_id) DO NOTHING;

    SELECT read_through_created_at, read_through_id
    INTO boundary_created_at, boundary_id
    FROM public.notification_recipient_stat
    WHERE profile_id = NEW.recipient_profile_id;

    IF NEW.in_app_visible
        AND NEW.read_at IS NULL
        AND boundary_created_at IS NOT NULL
        AND (
            NEW.created_at < boundary_created_at
            OR (NEW.created_at = boundary_created_at AND NEW.id <= boundary_id)
        )
    THEN
        NEW.created_at := greatest(
            clock_timestamp(),
            boundary_created_at + interval '1 millisecond'
        );
        NEW.updated_at := greatest(NEW.updated_at, NEW.created_at);
    END IF;
    RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS notification_recipient_state_prepare ON public.notification;
CREATE TRIGGER notification_recipient_state_prepare
BEFORE INSERT ON public.notification
FOR EACH ROW EXECUTE FUNCTION public.prepare_notification_recipient_state();

-- The aggregate counts only notifications above the recipient watermark.
-- Recipient rows are locked in UUID order before a move is accounted for,
-- preventing two cross-recipient updates from taking opposite lock orders.
CREATE OR REPLACE FUNCTION public.maintain_notification_recipient_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    old_unread boolean := false;
    new_unread boolean := false;
    old_boundary_created_at timestamp(3) with time zone;
    old_boundary_id uuid;
    new_boundary_created_at timestamp(3) with time zone;
    new_boundary_id uuid;
    old_delta bigint := 0;
    new_delta bigint := 0;
    old_profile_id uuid;
    new_profile_id uuid;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        old_profile_id := OLD.recipient_profile_id;
        INSERT INTO public.notification_recipient_stat (profile_id)
        VALUES (old_profile_id)
        ON CONFLICT (profile_id) DO NOTHING;
    END IF;
    IF TG_OP <> 'DELETE' THEN
        new_profile_id := NEW.recipient_profile_id;
        INSERT INTO public.notification_recipient_stat (profile_id)
        VALUES (new_profile_id)
        ON CONFLICT (profile_id) DO NOTHING;
    END IF;

    PERFORM 1
    FROM public.notification_recipient_stat
    WHERE profile_id IN (old_profile_id, new_profile_id)
    ORDER BY profile_id
    FOR UPDATE;

    IF TG_OP <> 'INSERT' THEN
        SELECT read_through_created_at, read_through_id
        INTO old_boundary_created_at, old_boundary_id
        FROM public.notification_recipient_stat
        WHERE profile_id = OLD.recipient_profile_id;
        old_unread := OLD.in_app_visible
            AND OLD.read_at IS NULL
            AND (
                old_boundary_created_at IS NULL
                OR OLD.created_at > old_boundary_created_at
                OR (OLD.created_at = old_boundary_created_at AND OLD.id > old_boundary_id)
            );
        old_delta := CASE WHEN old_unread THEN -1 ELSE 0 END;
    END IF;

    IF TG_OP <> 'DELETE' THEN
        SELECT read_through_created_at, read_through_id
        INTO new_boundary_created_at, new_boundary_id
        FROM public.notification_recipient_stat
        WHERE profile_id = NEW.recipient_profile_id;
        new_unread := NEW.in_app_visible
            AND NEW.read_at IS NULL
            AND (
                new_boundary_created_at IS NULL
                OR NEW.created_at > new_boundary_created_at
                OR (NEW.created_at = new_boundary_created_at AND NEW.id > new_boundary_id)
            );
        new_delta := CASE WHEN new_unread THEN 1 ELSE 0 END;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.recipient_profile_id = NEW.recipient_profile_id THEN
        IF old_delta + new_delta <> 0 THEN
            UPDATE public.notification_recipient_stat
            SET unread_count = unread_count + old_delta + new_delta,
                updated_at = clock_timestamp()
            WHERE profile_id = NEW.recipient_profile_id;
        END IF;
    ELSE
        IF old_delta <> 0 THEN
            UPDATE public.notification_recipient_stat
            SET unread_count = unread_count + old_delta,
                updated_at = clock_timestamp()
            WHERE profile_id = OLD.recipient_profile_id;
        END IF;
        IF new_delta <> 0 THEN
            UPDATE public.notification_recipient_stat
            SET unread_count = unread_count + new_delta,
                updated_at = clock_timestamp()
            WHERE profile_id = NEW.recipient_profile_id;
        END IF;
    END IF;
    RETURN coalesce(NEW, OLD);
END
$$;

DROP TRIGGER IF EXISTS notification_recipient_stat_maintain ON public.notification;
CREATE TRIGGER notification_recipient_stat_maintain
AFTER INSERT OR DELETE OR UPDATE OF
    recipient_profile_id,
    in_app_visible,
    read_at,
    created_at
ON public.notification
FOR EACH ROW EXECUTE FUNCTION public.maintain_notification_recipient_stat();
