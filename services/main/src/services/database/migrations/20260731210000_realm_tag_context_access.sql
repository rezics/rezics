-- atlas:txmode none

-- Realm Tag voting policy and Tag Context relationships are independent from
-- Realm taxonomy governance.
ALTER TYPE "unit_permission" ADD VALUE 'realm.tag-voting.update' AFTER 'realm.tags.manage';
--> statement-breakpoint
ALTER TYPE "unit_permission" ADD VALUE 'realm.tag-contexts.manage' AFTER 'realm.tag-voting.update';
--> statement-breakpoint
ALTER TYPE "platform_capability" ADD VALUE 'realm.tag-voting.update' AFTER 'realm.tags.manage';
--> statement-breakpoint
ALTER TYPE "platform_capability" ADD VALUE 'realm.tag-contexts.manage' AFTER 'realm.tag-voting.update';
--> statement-breakpoint

ALTER TABLE "unit_access_invitation"
  DROP CONSTRAINT "unit_access_invitation_permissions_check",
  ADD CONSTRAINT "unit_access_invitation_permissions_check"
    CHECK (
      cardinality("permissions") BETWEEN 1 AND 24
      AND array_position("permissions", 'unit.ownership.transfer'::"unit_permission") IS NULL
      AND array_position("permissions", 'unit.delete'::"unit_permission") IS NULL
    );
--> statement-breakpoint

-- A Realm subject is a userset. Existing Realm subjects represented active
-- members; the new relation also supports the Realm's dynamic access managers.
CREATE TYPE "realm_access_subject_relation" AS ENUM ('member', 'access_manager');
--> statement-breakpoint

ALTER TABLE "unit_access_grant"
  ADD COLUMN "realm_relation" "realm_access_subject_relation";
ALTER TABLE "unit_access_restriction"
  ADD COLUMN "realm_relation" "realm_access_subject_relation";
--> statement-breakpoint

UPDATE "unit_access_grant"
SET "realm_relation" = 'member'
WHERE "subject_kind" = 'realm';
UPDATE "unit_access_restriction"
SET "realm_relation" = 'member'
WHERE "subject_kind" = 'realm';
--> statement-breakpoint

DROP INDEX "unit_access_grant_active_realm_scope_key";
DROP INDEX "unit_access_restriction_active_realm_scope_key";
ALTER TABLE "unit_access_grant"
  DROP CONSTRAINT "unit_access_grant_subject_shape_check",
  ADD CONSTRAINT "unit_access_grant_subject_shape_check" CHECK (
    (
      "subject_kind" = 'profile'
      AND "profile_id" IS NOT NULL
      AND "realm_id" IS NULL
      AND "realm_relation" IS NULL
    ) OR (
      "subject_kind" = 'realm'
      AND "profile_id" IS NULL
      AND "realm_id" IS NOT NULL
      AND "realm_relation" IS NOT NULL
    ) OR (
      "subject_kind" = 'authenticated'
      AND "profile_id" IS NULL
      AND "realm_id" IS NULL
      AND "realm_relation" IS NULL
    )
  );
ALTER TABLE "unit_access_restriction"
  DROP CONSTRAINT "unit_access_restriction_subject_shape_check",
  ADD CONSTRAINT "unit_access_restriction_subject_shape_check" CHECK (
    (
      "subject_kind" = 'profile'
      AND "profile_id" IS NOT NULL
      AND "realm_id" IS NULL
      AND "realm_relation" IS NULL
    ) OR (
      "subject_kind" = 'realm'
      AND "profile_id" IS NULL
      AND "realm_id" IS NOT NULL
      AND "realm_relation" IS NOT NULL
    )
  );
CREATE UNIQUE INDEX "unit_access_grant_active_realm_scope_key"
  ON "unit_access_grant" (
    "unit_id",
    "realm_id",
    "realm_relation",
    "permission",
    "scope"
  )
  WHERE "revoked_at" IS NULL AND "subject_kind" = 'realm';
CREATE UNIQUE INDEX "unit_access_restriction_active_realm_scope_key"
  ON "unit_access_restriction" (
    "unit_id",
    "realm_id",
    "realm_relation",
    "permission",
    "scope"
  )
  WHERE "revoked_at" IS NULL AND "subject_kind" = 'realm';
--> statement-breakpoint

-- Realm participation is member-scoped by default. Public visibility controls
-- reading; it no longer makes every signed-in Profile a Realm contributor.
INSERT INTO "unit_access_grant" (
  "unit_id",
  "subject_kind",
  "realm_id",
  "realm_relation",
  "permission",
  "scope",
  "granted_by_profile_id"
)
SELECT
  target_realm."id",
  'realm',
  target_realm."id",
  'member',
  permission."value"::"unit_permission",
  ARRAY[]::text[],
  owner."profile_id"
FROM "realm" AS target_realm
INNER JOIN "unit_ownership" AS owner
  ON owner."unit_id" = target_realm."id"
  AND owner."revoked_at" IS NULL
CROSS JOIN (
  VALUES ('realm.units.create'), ('realm.post.replies.create')
) AS permission("value")
WHERE NOT EXISTS (
  SELECT 1
  FROM "unit_access_grant" AS existing
  WHERE existing."unit_id" = target_realm."id"
    AND existing."subject_kind" = 'realm'
    AND existing."realm_id" = target_realm."id"
    AND existing."realm_relation" = 'member'
    AND existing."permission" = permission."value"::"unit_permission"
    AND cardinality(existing."scope") = 0
    AND existing."revoked_at" IS NULL
);
--> statement-breakpoint

UPDATE "unit_access_grant" AS existing
SET
  "revoked_at" = now(),
  "revoked_by_profile_id" = owner."profile_id",
  "updated_at" = now()
FROM "realm" AS target_realm
INNER JOIN "unit_ownership" AS owner
  ON owner."unit_id" = target_realm."id"
  AND owner."revoked_at" IS NULL
WHERE existing."unit_id" = target_realm."id"
  AND existing."subject_kind" = 'authenticated'
  AND existing."permission" IN (
    'realm.units.create'::"unit_permission",
    'realm.post.replies.create'::"unit_permission"
  )
  AND existing."revoked_at" IS NULL;
