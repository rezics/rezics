-- atlas:txmode none

ALTER TYPE "unit_permission" RENAME VALUE 'unit.publish' TO 'unit.status.update';
ALTER TYPE "unit_permission" RENAME VALUE 'realm.rules.publish' TO 'realm.rules.update';
ALTER TYPE "unit_permission" ADD VALUE 'realm.units.create' AFTER 'realm.contribute';
ALTER TYPE "unit_permission" ADD VALUE 'realm.post.replies.create' AFTER 'realm.units.create';

ALTER TABLE "unit_access_invitation"
  DROP CONSTRAINT "unit_access_invitation_permissions_check",
  ADD CONSTRAINT "unit_access_invitation_permissions_check"
  CHECK (
    cardinality("permissions") >= 1
    AND cardinality("permissions") <= 20
  );

CREATE TYPE "realm_rule_acknowledgement_mode" AS ENUM (
  'explicit',
  'implicit_on_follow'
);

ALTER TABLE "realm_rule_revision"
  ADD COLUMN "acknowledgement_mode" "realm_rule_acknowledgement_mode"
  DEFAULT 'explicit' NOT NULL;

INSERT INTO "unit_access_grant" (
  "unit_id",
  "subject_kind",
  "permission",
  "scope",
  "granted_by_profile_id"
)
SELECT
  realm_record."id",
  'authenticated',
  permission."value",
  ARRAY[]::text[],
  ownership."profile_id"
FROM "realm" AS realm_record
INNER JOIN "unit" AS realm_unit
  ON realm_unit."id" = realm_record."id"
INNER JOIN "unit_ownership" AS ownership
  ON ownership."unit_id" = realm_record."id"
  AND ownership."revoked_at" IS NULL
CROSS JOIN unnest(
  ARRAY[
    'realm.units.create',
    'realm.post.replies.create'
  ]::unit_permission[]
) AS permission("value")
WHERE realm_unit."visibility" = 'public'
  AND realm_unit."deleted_at" IS NULL
ON CONFLICT ("unit_id", "permission", "scope")
WHERE "revoked_at" IS NULL AND "subject_kind" = 'authenticated'
DO NOTHING;
