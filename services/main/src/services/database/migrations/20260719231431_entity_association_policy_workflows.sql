-- Replace the development-only association policy enum with the final workflow modes.
-- PostgreSQL enum values cannot be removed in place, so recreate the type and map the
-- superseded owner-only policy to the approval workflow.
ALTER TYPE "entity_association_policy_mode" RENAME TO "entity_association_policy_mode_legacy";

CREATE TYPE "entity_association_policy_mode" AS ENUM (
  'open',
  'approval',
  'invite_only',
  'closed'
);

ALTER TABLE "entity_association_policy"
  ALTER COLUMN "mode" DROP DEFAULT,
  ALTER COLUMN "mode" TYPE "entity_association_policy_mode"
    USING (
      CASE "mode"::text
        WHEN 'owner_only' THEN 'approval'
        ELSE "mode"::text
      END
    )::"entity_association_policy_mode",
  ALTER COLUMN "mode" SET DEFAULT 'open';

DROP TYPE "entity_association_policy_mode_legacy";
