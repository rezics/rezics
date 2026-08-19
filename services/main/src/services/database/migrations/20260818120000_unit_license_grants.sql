-- atlas:txmode file
SET LOCAL search_path = public;

-- This unreleased contract is cut over atomically during a maintenance window.
-- The retired single-license column has roughly 400,000 candidate Units,
-- so its current values are imported in one set operation before the column is
-- removed. No old/new application compatibility window is retained.

DO $unit_content_license_must_be_empty$
BEGIN
    IF EXISTS (SELECT 1 FROM public.unit_content_license LIMIT 1) THEN
        RAISE EXCEPTION
            'unit_content_license must be empty before the unified license cutover';
    END IF;
END
$unit_content_license_must_be_empty$;

ALTER TABLE public.content_governance_action
    DROP CONSTRAINT content_governance_action_kind_outcome_check,
    DROP CONSTRAINT content_governance_action_content_license_transition_check,
    DROP CONSTRAINT content_governance_action_reversal_check;

ALTER TYPE public.unit_content_license_status RENAME TO unit_license_recognition_status;
ALTER TYPE public.unit_license_recognition_status RENAME VALUE 'active' TO 'recognized';

ALTER TYPE public.content_governance_action_kind
    RENAME VALUE 'invalidate_content_license' TO 'invalidate_license';
ALTER TYPE public.content_governance_action_kind
    RENAME VALUE 'restore_content_license' TO 'restore_license';

ALTER TYPE public.platform_capability
    RENAME VALUE 'unit.content_license.manage' TO 'unit.license.manage';

DROP TRIGGER unit_content_license_guard_mutation ON public.unit_content_license;
DROP FUNCTION public.guard_unit_content_license_mutation();

DROP INDEX public.unit_content_license_active_unit_key;
DROP INDEX public.unit_content_license_reference_slug_idx;
DROP INDEX public.unit_content_license_unit_granted_at_idx;
DROP INDEX public.unit_content_license_granted_by_idx;

ALTER TABLE public.unit_content_license
    DROP CONSTRAINT unit_content_license_reference_slug_check;

ALTER TABLE public.unit_content_license RENAME TO unit_license_grant;
ALTER TABLE public.unit_license_grant
    RENAME CONSTRAINT unit_content_license_pkey TO unit_license_grant_pkey;
ALTER TABLE public.unit_license_grant
    RENAME CONSTRAINT unit_content_license_unit_id_unit_id_fkey
    TO unit_license_grant_unit_id_unit_id_fkey;
ALTER TABLE public.unit_license_grant
    RENAME CONSTRAINT unit_content_license_granted_by_profile_id_profile_id_fkey
    TO unit_license_grant_granted_by_profile_id_profile_id_fkey;
ALTER TABLE public.unit_license_grant
    RENAME COLUMN reference_license_slug TO license_id;
ALTER TABLE public.unit_license_grant
    RENAME COLUMN status TO recognition_status;

ALTER TABLE public.unit_license_grant
    ADD COLUMN offering_ended_at timestamp(3) with time zone,
    ADD COLUMN offering_ended_by_profile_id uuid,
    ALTER COLUMN granted_by_profile_id DROP NOT NULL,
    ALTER COLUMN recognition_status SET DEFAULT 'recognized'::public.unit_license_recognition_status;

ALTER TABLE public.unit_license_grant
    ADD CONSTRAINT unit_license_grant_offering_ended_by_profile_id_profile_id_fkey
        FOREIGN KEY (offering_ended_by_profile_id)
        REFERENCES public.profile(id) ON DELETE RESTRICT;

ALTER TABLE public.unit_license_grant
	ADD CONSTRAINT unit_license_grant_offering_end_check
		CHECK (
            (
                offering_ended_at IS NULL
                AND offering_ended_by_profile_id IS NULL
            ) OR (
                offering_ended_at IS NOT NULL
                AND offering_ended_by_profile_id IS NOT NULL
            )
		) NOT VALID;

CREATE FUNCTION public.guard_unit_license_grant_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'unit_license_grant history is immutable';
  END IF;

  IF ROW(
    NEW.id,
    NEW.unit_id,
    NEW.license_id,
    NEW.granted_by_profile_id,
    NEW.granted_at
  ) IS DISTINCT FROM ROW(
    OLD.id,
    OLD.unit_id,
    OLD.license_id,
    OLD.granted_by_profile_id,
    OLD.granted_at
  ) THEN
    RAISE EXCEPTION 'unit_license_grant grant facts are immutable';
  END IF;

  IF OLD.offering_ended_at IS NOT NULL
     AND ROW(NEW.offering_ended_at, NEW.offering_ended_by_profile_id)
         IS DISTINCT FROM ROW(OLD.offering_ended_at, OLD.offering_ended_by_profile_id)
  THEN
    RAISE EXCEPTION 'unit_license_grant offering end is terminal';
  END IF;

  IF OLD.offering_ended_at IS NULL
     AND NEW.offering_ended_at IS NOT NULL
     AND NEW.offering_ended_by_profile_id IS NULL
  THEN
    RAISE EXCEPTION 'unit_license_grant offering end requires an actor';
  END IF;

  IF OLD.offering_ended_at IS NULL
     AND NEW.offering_ended_at IS NULL
     AND NEW.offering_ended_by_profile_id IS DISTINCT FROM OLD.offering_ended_by_profile_id
  THEN
    RAISE EXCEPTION 'unit_license_grant offering end cannot be rewritten';
  END IF;

  IF NEW.recognition_status IS DISTINCT FROM OLD.recognition_status THEN
    IF OLD.offering_ended_at IS NOT NULL THEN
      RAISE EXCEPTION 'unit_license_grant recognition cannot change after offering end';
    END IF;
    IF NOT (
      (OLD.recognition_status = 'recognized' AND NEW.recognition_status = 'invalidated')
      OR (OLD.recognition_status = 'invalidated' AND NEW.recognition_status = 'recognized')
    ) THEN
      RAISE EXCEPTION 'unit_license_grant recognition transition is not allowed';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER unit_license_grant_guard_mutation
    BEFORE DELETE OR UPDATE ON public.unit_license_grant
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_unit_license_grant_mutation();

ALTER TABLE public.content_governance_action
    DROP CONSTRAINT content_governance_action_content_license_fkey;

ALTER TABLE public.content_governance_action
    RENAME COLUMN content_license_id TO license_grant_id;
ALTER TABLE public.content_governance_action
    RENAME COLUMN previous_content_license_status TO previous_recognition_status;
ALTER TABLE public.content_governance_action
    RENAME COLUMN resulting_content_license_status TO resulting_recognition_status;

ALTER INDEX public.content_governance_action_content_license_created_idx
    RENAME TO content_governance_action_license_grant_created_idx;

ALTER TABLE public.content_governance_action
    ADD CONSTRAINT content_governance_action_license_grant_fkey
        FOREIGN KEY (license_grant_id)
        REFERENCES public.unit_license_grant(id) ON DELETE RESTRICT;

ALTER TABLE public.content_governance_action
    ADD CONSTRAINT content_governance_action_kind_outcome_check CHECK (
        (
            kind IN ('approve', 'hide', 'remove', 'restore')
            AND previous_state IS NOT NULL
        ) OR (
            kind IN ('lock_post_targeting', 'unlock_post_targeting')
            AND previous_post_targeting_locked IS NOT NULL
        ) OR (
            kind IN ('invalidate_license', 'restore_license')
            AND previous_recognition_status IS NOT NULL
        ) OR (
            kind = 'reverse'
            AND num_nonnulls(previous_state, previous_post_targeting_locked) = 1
        )
    ),
    ADD CONSTRAINT content_governance_action_license_grant_transition_check CHECK (
        (
            kind = 'invalidate_license'
            AND license_grant_id IS NOT NULL
            AND previous_recognition_status IS NOT NULL
            AND previous_recognition_status = 'recognized'
            AND resulting_recognition_status IS NOT NULL
            AND resulting_recognition_status = 'invalidated'
        ) OR (
            kind = 'restore_license'
            AND license_grant_id IS NOT NULL
            AND previous_recognition_status IS NOT NULL
            AND previous_recognition_status = 'invalidated'
            AND resulting_recognition_status IS NOT NULL
            AND resulting_recognition_status = 'recognized'
        ) OR (
            kind NOT IN ('invalidate_license', 'restore_license')
            AND license_grant_id IS NULL
            AND previous_recognition_status IS NULL
            AND resulting_recognition_status IS NULL
        )
    ),
    ADD CONSTRAINT content_governance_action_reversal_check CHECK (
        (kind IN ('reverse', 'restore_license')) = (reverses_action_id IS NOT NULL)
    );

ALTER TABLE public.profile_preference
    ADD COLUMN default_licenses text[] NOT NULL DEFAULT '{}'::text[];

UPDATE public.profile_preference
SET default_licenses = ARRAY[default_license]
WHERE default_license IS NOT NULL;

ALTER TABLE public.profile_preference
	DROP CONSTRAINT profile_preference_default_license_check,
	DROP COLUMN default_license;

-- The retired column records only the current declaration, not its original
-- actor or selection time. Import that declaration as a cutover-time grant and
-- leave the unknown legacy grantor null instead of inventing ownership history.
INSERT INTO public.unit_license_grant (
    unit_id,
    license_id,
    granted_by_profile_id,
    granted_at,
    recognition_status
)
SELECT
    unit.id,
    unit.license,
    NULL,
    transaction_timestamp(),
    'recognized'
FROM public.unit
WHERE unit.license IS NOT NULL;

CREATE UNIQUE INDEX unit_license_grant_open_unit_license_key
    ON public.unit_license_grant (unit_id, license_id)
    WHERE offering_ended_at IS NULL;

CREATE INDEX unit_license_grant_unit_granted_at_idx
    ON public.unit_license_grant (unit_id, granted_at DESC NULLS LAST);

CREATE INDEX unit_license_grant_effective_license_unit_idx
    ON public.unit_license_grant (license_id, unit_id)
    WHERE offering_ended_at IS NULL
      AND recognition_status = 'recognized';

ALTER TABLE public.unit_license_grant
	VALIDATE CONSTRAINT unit_license_grant_offering_end_check;

ALTER TABLE public.unit DROP COLUMN license;

ANALYZE public.unit_license_grant;
