-- Canonical current definitions for independent Unit license grants.
--
-- Grant facts are immutable. Offering end is write-once. Recognition may move
-- only between recognized and invalidated, and only while the offering is open.

CREATE OR REPLACE FUNCTION public.guard_unit_license_grant_mutation() RETURNS trigger
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
