-- The moderation action enum values were committed by the preceding revision
-- so PostgreSQL can safely use them in the constraints below.
CREATE TYPE "unit_content_license_status" AS ENUM ('active', 'invalidated');
--> statement-breakpoint

DROP TRIGGER "unit_content_license_immutable" ON "unit_content_license";
--> statement-breakpoint
DROP INDEX "unit_content_license_unit_key";
--> statement-breakpoint

ALTER TABLE "unit_content_license"
  ADD COLUMN "status" "unit_content_license_status" NOT NULL DEFAULT 'active';
--> statement-breakpoint

CREATE UNIQUE INDEX "unit_content_license_active_unit_key"
  ON "unit_content_license" ("unit_id")
  WHERE "status" = 'active';
--> statement-breakpoint
CREATE INDEX "unit_content_license_unit_granted_at_idx"
  ON "unit_content_license" ("unit_id", "granted_at" DESC NULLS LAST);
--> statement-breakpoint

CREATE FUNCTION "guard_unit_content_license_mutation"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'unit_content_license history is immutable';
  END IF;

  IF ROW(
    NEW."id",
    NEW."unit_id",
    NEW."granted_by_profile_id",
    NEW."reference_license_slug",
    NEW."granted_at"
  ) IS DISTINCT FROM ROW(
    OLD."id",
    OLD."unit_id",
    OLD."granted_by_profile_id",
    OLD."reference_license_slug",
    OLD."granted_at"
  ) THEN
    RAISE EXCEPTION 'unit_content_license grant facts are immutable';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER "unit_content_license_guard_mutation"
BEFORE UPDATE OR DELETE ON "unit_content_license"
FOR EACH ROW
EXECUTE FUNCTION "guard_unit_content_license_mutation"();
--> statement-breakpoint

CREATE TRIGGER "search_projection_touch_unit_content_license_update"
AFTER UPDATE ON "unit_content_license"
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
FOR EACH STATEMENT
EXECUTE FUNCTION "search_touch_current_statement"('unit_id');
--> statement-breakpoint

ALTER TABLE "moderation_action"
  DROP CONSTRAINT "moderation_action_single_outcome_check",
  DROP CONSTRAINT "moderation_action_reversal_check",
  ADD COLUMN "content_license_id" uuid,
  ADD COLUMN "previous_content_license_status" "unit_content_license_status",
  ADD COLUMN "resulting_content_license_status" "unit_content_license_status",
  ADD CONSTRAINT "moderation_action_content_license_fkey"
    FOREIGN KEY ("content_license_id")
    REFERENCES "unit_content_license" ("id")
    ON DELETE RESTRICT,
  ADD CONSTRAINT "moderation_action_single_outcome_check"
    CHECK (
      num_nonnulls(
        "previous_state",
        "previous_post_targeting_locked",
        "previous_content_license_status"
      ) <= 1
    ),
  ADD CONSTRAINT "moderation_action_content_license_transition_check"
    CHECK (
      (
        "kind" = 'invalidate_content_license'
        AND "content_license_id" IS NOT NULL
        AND "previous_content_license_status" = 'active'
        AND "resulting_content_license_status" = 'invalidated'
      )
      OR (
        "kind" = 'restore_content_license'
        AND "content_license_id" IS NOT NULL
        AND "previous_content_license_status" = 'invalidated'
        AND "resulting_content_license_status" = 'active'
      )
      OR (
        "kind" NOT IN ('invalidate_content_license', 'restore_content_license')
        AND "content_license_id" IS NULL
        AND "previous_content_license_status" IS NULL
        AND "resulting_content_license_status" IS NULL
      )
    ),
  ADD CONSTRAINT "moderation_action_reversal_check"
    CHECK (
      (
        "kind" IN ('reverse', 'revoke_enforcement', 'restore_content_license')
      ) = ("reverses_action_id" IS NOT NULL)
    );
--> statement-breakpoint

CREATE INDEX "moderation_action_content_license_created_at_idx"
  ON "moderation_action" (
    "content_license_id",
    "created_at" DESC NULLS LAST,
    "id" DESC NULLS LAST
  );
