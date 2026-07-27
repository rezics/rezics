-- Replace role-derived Unit access with ownership plus atomic permission grants.
ALTER TYPE "unit_permission" RENAME TO "unit_permission_legacy";

CREATE TYPE "unit_permission" AS ENUM (
  'unit.read',
  'unit.update',
  'unit.publish',
  'unit.history.restore',
  'unit.access.manage',
  'unit.association.manage',
  'unit.delete',
  'realm.contribute',
  'realm.settings.update',
  'realm.members.read',
  'realm.members.manage',
  'realm.rules.publish',
  'realm.pins.manage',
  'realm.units.moderate',
  'entity.association.credit.request',
  'entity.association.credit.direct',
  'entity.association.subject.request',
  'entity.association.subject.direct'
);

CREATE TABLE "unit_ownership" (
  "id" uuid PRIMARY KEY DEFAULT uuidv7(),
  "unit_id" uuid NOT NULL,
  "profile_id" uuid NOT NULL,
  "assigned_by_profile_id" uuid NOT NULL,
  "revoked_at" timestamptz(3),
  "revoked_by_profile_id" uuid,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "unit_ownership_unit_id_unit_id_fkey"
    FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON DELETE CASCADE,
  CONSTRAINT "unit_ownership_profile_id_profile_id_fkey"
    FOREIGN KEY ("profile_id") REFERENCES "profile" ("id") ON DELETE RESTRICT,
  CONSTRAINT "unit_ownership_assigned_by_profile_id_profile_id_fkey"
    FOREIGN KEY ("assigned_by_profile_id") REFERENCES "profile" ("id") ON DELETE RESTRICT,
  CONSTRAINT "unit_ownership_revoked_by_profile_id_profile_id_fkey"
    FOREIGN KEY ("revoked_by_profile_id") REFERENCES "profile" ("id") ON DELETE RESTRICT,
  CONSTRAINT "unit_ownership_revocation_shape_check"
    CHECK ((revoked_at IS NULL) = (revoked_by_profile_id IS NULL))
);

CREATE UNIQUE INDEX "unit_ownership_active_unit_key"
  ON "unit_ownership" ("unit_id") WHERE revoked_at IS NULL;
CREATE INDEX "unit_ownership_profile_active_idx"
  ON "unit_ownership" ("profile_id", "unit_id") WHERE revoked_at IS NULL;
CREATE INDEX "unit_ownership_assigned_by_idx"
  ON "unit_ownership" ("assigned_by_profile_id");
CREATE INDEX "unit_ownership_revoked_by_idx"
  ON "unit_ownership" ("revoked_by_profile_id");

CREATE TABLE "unit_access_grant" (
  "id" uuid PRIMARY KEY DEFAULT uuidv7(),
  "unit_id" uuid NOT NULL,
  "subject_kind" "unit_access_subject_kind" NOT NULL,
  "profile_id" uuid,
  "realm_id" uuid,
  "permission" "unit_permission" NOT NULL,
  "scope" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "granted_by_profile_id" uuid NOT NULL,
  "expires_at" timestamptz(3),
  "revoked_at" timestamptz(3),
  "revoked_by_profile_id" uuid,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "unit_access_grant_unit_id_unit_id_fkey"
    FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON DELETE CASCADE,
  CONSTRAINT "unit_access_grant_profile_id_profile_id_fkey"
    FOREIGN KEY ("profile_id") REFERENCES "profile" ("id") ON DELETE CASCADE,
  CONSTRAINT "unit_access_grant_realm_id_realm_id_fkey"
    FOREIGN KEY ("realm_id") REFERENCES "realm" ("id") ON DELETE CASCADE,
  CONSTRAINT "unit_access_grant_granted_by_profile_id_profile_id_fkey"
    FOREIGN KEY ("granted_by_profile_id") REFERENCES "profile" ("id") ON DELETE RESTRICT,
  CONSTRAINT "unit_access_grant_revoked_by_profile_id_profile_id_fkey"
    FOREIGN KEY ("revoked_by_profile_id") REFERENCES "profile" ("id") ON DELETE RESTRICT,
  CONSTRAINT "unit_access_grant_subject_shape_check" CHECK (
    (subject_kind = 'profile' AND profile_id IS NOT NULL AND realm_id IS NULL) OR
    (subject_kind = 'realm' AND profile_id IS NULL AND realm_id IS NOT NULL) OR
    (subject_kind = 'authenticated' AND profile_id IS NULL AND realm_id IS NULL)
  ),
  CONSTRAINT "unit_access_grant_scope_check" CHECK (
    cardinality(scope) <= 8 AND (
      cardinality(scope) = 0 OR
      array_to_string(scope, '/') ~ '^[a-z0-9][a-z0-9-]*(/[a-z0-9][a-z0-9-]*)*$'
    )
  ),
  CONSTRAINT "unit_access_grant_expiry_check"
    CHECK (expires_at IS NULL OR expires_at > created_at),
  CONSTRAINT "unit_access_grant_revocation_shape_check"
    CHECK ((revoked_at IS NULL) = (revoked_by_profile_id IS NULL))
);

CREATE UNIQUE INDEX "unit_access_grant_active_profile_scope_key"
  ON "unit_access_grant" ("unit_id", "profile_id", "permission", "scope")
  WHERE revoked_at IS NULL AND subject_kind = 'profile';
CREATE UNIQUE INDEX "unit_access_grant_active_realm_scope_key"
  ON "unit_access_grant" ("unit_id", "realm_id", "permission", "scope")
  WHERE revoked_at IS NULL AND subject_kind = 'realm';
CREATE UNIQUE INDEX "unit_access_grant_active_authenticated_scope_key"
  ON "unit_access_grant" ("unit_id", "permission", "scope")
  WHERE revoked_at IS NULL AND subject_kind = 'authenticated';
CREATE INDEX "unit_access_grant_profile_active_idx"
  ON "unit_access_grant" ("profile_id", "unit_id", "permission")
  WHERE revoked_at IS NULL;
CREATE INDEX "unit_access_grant_realm_active_idx"
  ON "unit_access_grant" ("realm_id", "unit_id", "permission")
  WHERE revoked_at IS NULL;
CREATE INDEX "unit_access_grant_granted_by_idx"
  ON "unit_access_grant" ("granted_by_profile_id");

INSERT INTO "unit_ownership" (
  "unit_id",
  "profile_id",
  "assigned_by_profile_id",
  "created_at",
  "updated_at"
)
SELECT DISTINCT ON (binding.unit_id)
  binding.unit_id,
  binding.profile_id,
  binding.granted_by_profile_id,
  binding.created_at,
  binding.updated_at
FROM "unit_access_binding" binding
WHERE binding.subject_kind = 'profile'
  AND binding.role = 'owner'
  AND binding.revoked_at IS NULL
  AND (binding.expires_at IS NULL OR binding.expires_at > now())
ORDER BY binding.unit_id, binding.created_at DESC, binding.id DESC;

INSERT INTO "unit_access_grant" (
  "unit_id",
  "subject_kind",
  "profile_id",
  "realm_id",
  "permission",
  "scope",
  "granted_by_profile_id",
  "expires_at",
  "created_at",
  "updated_at"
)
SELECT DISTINCT ON (
  binding.unit_id,
  binding.subject_kind,
  binding.profile_id,
  binding.realm_id,
  permission.value,
  binding.scope
)
  binding.unit_id,
  binding.subject_kind,
  binding.profile_id,
  binding.realm_id,
  permission.value::unit_permission,
  binding.scope,
  binding.granted_by_profile_id,
  binding.expires_at,
  binding.created_at,
  binding.updated_at
FROM "unit_access_binding" binding
CROSS JOIN LATERAL unnest(
  CASE binding.role::text
    WHEN 'viewer' THEN ARRAY['unit.read']
    WHEN 'editor' THEN ARRAY['unit.read', 'unit.update']
    WHEN 'publishing_editor' THEN ARRAY['unit.read', 'unit.update', 'unit.publish']
    WHEN 'maintainer' THEN ARRAY[
      'unit.read',
      'unit.update',
      'unit.publish',
      'unit.history.restore',
      'unit.access.manage',
      'unit.association.manage'
    ]
    ELSE ARRAY[]::text[]
  END
) permission(value)
WHERE binding.role <> 'owner'
  AND binding.revoked_at IS NULL
  AND (binding.expires_at IS NULL OR binding.expires_at > now())
ORDER BY
  binding.unit_id,
  binding.subject_kind,
  binding.profile_id,
  binding.realm_id,
  permission.value,
  binding.scope,
  binding.created_at DESC;

-- Every Realm grants its active members the baseline participation permissions.
INSERT INTO "unit_access_grant" (
  "unit_id",
  "subject_kind",
  "realm_id",
  "permission",
  "scope",
  "granted_by_profile_id"
)
SELECT realm.id, 'realm', realm.id, permission.value::unit_permission, ARRAY[]::text[], owner.profile_id
FROM "realm" realm
JOIN "unit_ownership" owner
  ON owner.unit_id = realm.id
  AND owner.revoked_at IS NULL
CROSS JOIN (VALUES ('unit.read'), ('realm.contribute')) permission(value)
WHERE NOT EXISTS (
  SELECT 1
  FROM "unit_access_grant" existing
  WHERE existing.unit_id = realm.id
    AND existing.subject_kind = 'realm'
    AND existing.realm_id = realm.id
    AND existing.permission = permission.value::unit_permission
    AND cardinality(existing.scope) = 0
    AND existing.revoked_at IS NULL
);

-- Preserve administrative Realm roles as explicit Profile grants; memberships remain roleless.
INSERT INTO "unit_access_grant" (
  "unit_id",
  "subject_kind",
  "profile_id",
  "permission",
  "scope",
  "granted_by_profile_id"
)
SELECT
  member.realm_id,
  'profile',
  member.profile_id,
  permission.value::unit_permission,
  ARRAY[]::text[],
  owner.profile_id
FROM "realm_member" member
JOIN "unit_ownership" owner
  ON owner.unit_id = member.realm_id
  AND owner.revoked_at IS NULL
CROSS JOIN LATERAL unnest(
  CASE member.role::text
    WHEN 'moderator' THEN ARRAY[
      'unit.read',
      'realm.contribute',
      'realm.members.read',
      'realm.members.manage',
      'realm.pins.manage',
      'realm.units.moderate'
    ]
    WHEN 'admin' THEN ARRAY[
      'unit.read',
      'unit.update',
      'unit.publish',
      'unit.access.manage',
      'realm.contribute',
      'realm.settings.update',
      'realm.members.read',
      'realm.members.manage',
      'realm.rules.publish',
      'realm.pins.manage',
      'realm.units.moderate'
    ]
    ELSE ARRAY[]::text[]
  END
) permission(value)
WHERE member.state = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM "unit_access_grant" existing
    WHERE existing.unit_id = member.realm_id
      AND existing.subject_kind = 'profile'
      AND existing.profile_id = member.profile_id
      AND existing.permission = permission.value::unit_permission
      AND cardinality(existing.scope) = 0
      AND existing.revoked_at IS NULL
  );

-- Fold direct Realm capability grants into the Unit access model.
INSERT INTO "unit_access_grant" (
  "unit_id",
  "subject_kind",
  "profile_id",
  "permission",
  "scope",
  "granted_by_profile_id",
  "expires_at",
  "created_at",
  "updated_at"
)
SELECT
  capability.realm_id,
  'profile',
  capability.profile_id,
  capability.capability::unit_permission,
  ARRAY[]::text[],
  capability.granted_by_profile_id,
  capability.expires_at,
  capability.created_at,
  capability.updated_at
FROM "capability_grant" capability
WHERE capability.authority = 'realm'
  AND capability.realm_id IS NOT NULL
  AND capability.revoked_at IS NULL
  AND capability.capability IN (
    'realm.contribute',
    'realm.settings.update',
    'realm.members.read',
    'realm.members.manage',
    'realm.rules.publish',
    'realm.pins.manage',
    'realm.units.moderate'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "unit_access_grant" existing
    WHERE existing.unit_id = capability.realm_id
      AND existing.subject_kind = 'profile'
      AND existing.profile_id = capability.profile_id
      AND existing.permission = capability.capability::unit_permission
      AND cardinality(existing.scope) = 0
      AND existing.revoked_at IS NULL
  );

DELETE FROM "capability_grant" WHERE authority = 'realm';

-- Fold Entity association admission into authenticated Unit grants.
INSERT INTO "unit_access_grant" (
  "unit_id",
  "subject_kind",
  "permission",
  "scope",
  "granted_by_profile_id",
  "created_at",
  "updated_at"
)
SELECT
  entity.id,
  'authenticated',
  permission.value::unit_permission,
  ARRAY[]::text[],
  owner.profile_id,
  entity.created_at,
  entity.updated_at
FROM "entity" entity
JOIN "unit_ownership" owner
  ON owner.unit_id = entity.id
  AND owner.revoked_at IS NULL
LEFT JOIN "entity_association_policy" credit
  ON credit.entity_id = entity.id AND credit.kind = 'credit'
LEFT JOIN "entity_association_policy" subject
  ON subject.entity_id = entity.id AND subject.kind = 'subject'
CROSS JOIN LATERAL (
  SELECT value
  FROM unnest(ARRAY[
    CASE COALESCE(credit.mode::text, 'approval')
      WHEN 'open' THEN 'entity.association.credit.request'
      WHEN 'approval' THEN 'entity.association.credit.request'
      ELSE NULL
    END,
    CASE COALESCE(credit.mode::text, 'approval')
      WHEN 'open' THEN 'entity.association.credit.direct'
      ELSE NULL
    END,
    CASE COALESCE(subject.mode::text, 'open')
      WHEN 'open' THEN 'entity.association.subject.request'
      WHEN 'approval' THEN 'entity.association.subject.request'
      ELSE NULL
    END,
    CASE COALESCE(subject.mode::text, 'open')
      WHEN 'open' THEN 'entity.association.subject.direct'
      ELSE NULL
    END
  ]) value
  WHERE value IS NOT NULL
) permission
WHERE NOT EXISTS (
  SELECT 1
  FROM "unit_access_grant" existing
  WHERE existing.unit_id = entity.id
    AND existing.subject_kind = 'authenticated'
    AND existing.permission = permission.value::unit_permission
    AND cardinality(existing.scope) = 0
    AND existing.revoked_at IS NULL
);

-- Recreate invitations with permission sets. Pending roles are expanded atomically.
CREATE TABLE "unit_access_invitation_v2" (
  "id" uuid DEFAULT uuidv7(),
  "unit_id" uuid NOT NULL,
  "invited_profile_id" uuid NOT NULL,
  "permissions" "unit_permission"[] NOT NULL,
  "scope" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "invited_by_profile_id" uuid NOT NULL,
  "expires_at" timestamptz(3) NOT NULL,
  "access_expires_at" timestamptz(3),
  "resolution" "unit_access_invitation_resolution",
  "resolved_at" timestamptz(3),
  "resolved_by_profile_id" uuid,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "unit_access_invitation_v2_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "unit_access_invitation_v2_unit_id_unit_id_fkey"
    FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON DELETE CASCADE,
  CONSTRAINT "unit_access_invitation_v2_invited_profile_id_profile_id_fkey"
    FOREIGN KEY ("invited_profile_id") REFERENCES "profile" ("id") ON DELETE CASCADE,
  CONSTRAINT "unit_access_invitation_v2_invited_by_profile_id_profile_id_fkey"
    FOREIGN KEY ("invited_by_profile_id") REFERENCES "profile" ("id") ON DELETE RESTRICT,
  CONSTRAINT "unit_access_invitation_v2_resolved_by_profile_id_profile_id_fkey"
    FOREIGN KEY ("resolved_by_profile_id") REFERENCES "profile" ("id") ON DELETE RESTRICT,
  CONSTRAINT "unit_access_invitation_scope_check" CHECK (
    cardinality(scope) <= 8 AND (
      cardinality(scope) = 0 OR
      array_to_string(scope, '/') ~ '^[a-z0-9][a-z0-9-]*(/[a-z0-9][a-z0-9-]*)*$'
    )
  ),
  CONSTRAINT "unit_access_invitation_permissions_check"
    CHECK (cardinality(permissions) BETWEEN 1 AND 18),
  CONSTRAINT "unit_access_invitation_profiles_differ_check"
    CHECK (invited_profile_id <> invited_by_profile_id),
  CONSTRAINT "unit_access_invitation_expiry_check"
    CHECK (expires_at > created_at AND (access_expires_at IS NULL OR access_expires_at > created_at)),
  CONSTRAINT "unit_access_invitation_resolution_shape_check" CHECK (
    (resolution IS NULL AND resolved_at IS NULL AND resolved_by_profile_id IS NULL) OR
    (resolution IS NOT NULL AND resolved_at IS NOT NULL AND resolved_by_profile_id IS NOT NULL)
  )
);

INSERT INTO "unit_access_invitation_v2" (
  "id",
  "unit_id",
  "invited_profile_id",
  "permissions",
  "scope",
  "invited_by_profile_id",
  "expires_at",
  "access_expires_at",
  "resolution",
  "resolved_at",
  "resolved_by_profile_id",
  "created_at",
  "updated_at"
)
SELECT
  invitation.id,
  invitation.unit_id,
  invitation.invited_profile_id,
  CASE invitation.role::text
    WHEN 'viewer' THEN ARRAY['unit.read'::unit_permission]
    WHEN 'editor' THEN ARRAY['unit.read'::unit_permission, 'unit.update'::unit_permission]
    WHEN 'publishing_editor' THEN ARRAY[
      'unit.read'::unit_permission,
      'unit.update'::unit_permission,
      'unit.publish'::unit_permission
    ]
    WHEN 'maintainer' THEN ARRAY[
      'unit.read'::unit_permission,
      'unit.update'::unit_permission,
      'unit.publish'::unit_permission,
      'unit.history.restore'::unit_permission,
      'unit.access.manage'::unit_permission,
      'unit.association.manage'::unit_permission
    ]
  END,
  invitation.scope,
  invitation.invited_by_profile_id,
  invitation.expires_at,
  invitation.access_expires_at,
  invitation.resolution,
  invitation.resolved_at,
  invitation.resolved_by_profile_id,
  invitation.created_at,
  invitation.updated_at
FROM "unit_access_invitation" invitation
WHERE invitation.role <> 'owner';

DROP TABLE "unit_access_invitation";
ALTER TABLE "unit_access_invitation_v2" RENAME TO "unit_access_invitation";
ALTER TABLE "unit_access_invitation"
  RENAME CONSTRAINT "unit_access_invitation_v2_pkey" TO "unit_access_invitation_pkey";
ALTER TABLE "unit_access_invitation"
  RENAME CONSTRAINT "unit_access_invitation_v2_unit_id_unit_id_fkey"
  TO "unit_access_invitation_unit_id_unit_id_fkey";
ALTER TABLE "unit_access_invitation"
  RENAME CONSTRAINT "unit_access_invitation_v2_invited_profile_id_profile_id_fkey"
  TO "unit_access_invitation_invited_profile_id_profile_id_fkey";
ALTER TABLE "unit_access_invitation"
  RENAME CONSTRAINT "unit_access_invitation_v2_invited_by_profile_id_profile_id_fkey"
  TO "unit_access_invitation_invited_by_profile_id_profile_id_fkey";
ALTER TABLE "unit_access_invitation"
  RENAME CONSTRAINT "unit_access_invitation_v2_resolved_by_profile_id_profile_id_fkey"
  TO "unit_access_invitation_resolved_by_profile_id_profile_id_fkey";
CREATE INDEX "unit_access_invitation_unit_unresolved_idx"
  ON "unit_access_invitation" ("unit_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST)
  WHERE resolution IS NULL;
CREATE INDEX "unit_access_invitation_profile_unresolved_idx"
  ON "unit_access_invitation" ("invited_profile_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST)
  WHERE resolution IS NULL;
CREATE INDEX "unit_access_invitation_invited_by_idx"
  ON "unit_access_invitation" ("invited_by_profile_id");
CREATE INDEX "unit_access_invitation_resolved_by_idx"
  ON "unit_access_invitation" ("resolved_by_profile_id");

DELETE FROM "unit_access_restriction"
WHERE permission::text = 'unit.protection.manage';
ALTER TABLE "unit_access_restriction"
  ALTER COLUMN "permission" TYPE "unit_permission"
  USING permission::text::unit_permission;

ALTER TABLE "realm_member" DROP COLUMN "role";
CREATE INDEX "realm_member_realm_state_idx"
  ON "realm_member" ("realm_id", "state");

DROP TABLE "unit_access_binding";
DROP TABLE "unit_protection";
DROP TABLE "entity_association_policy";

DROP TYPE "unit_permission_legacy";
DROP TYPE "unit_access_realm_relation";
DROP TYPE "unit_access_role";
DROP TYPE "unit_protection_mode";
DROP TYPE "realm_member_role";
DROP TYPE "entity_association_policy_mode";

-- Keep search visibility and owner filters synchronized with the replacement access tables.
DO $$
DECLARE
  source record;
BEGIN
  FOR source IN SELECT * FROM (VALUES
    ('unit_access_grant'),
    ('unit_ownership')
  ) AS registry(table_name)
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT ON public.%I REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION search_touch_current_statement(''unit_id'')',
      'search_projection_touch_' || source.table_name || '_insert',
      source.table_name
    );
    EXECUTE format(
      'CREATE TRIGGER %I AFTER UPDATE ON public.%I REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION search_touch_current_statement(''unit_id'')',
      'search_projection_touch_' || source.table_name || '_update',
      source.table_name
    );
    EXECUTE format(
      'CREATE TRIGGER %I AFTER DELETE ON public.%I REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION search_touch_current_statement(''unit_id'')',
      'search_projection_touch_' || source.table_name || '_delete',
      source.table_name
    );
  END LOOP;
END
$$;

INSERT INTO "search_unit_projection_source" ("unit_id", "revision", "touched_at")
SELECT "id", 1, clock_timestamp()
FROM "unit"
ON CONFLICT ("unit_id") DO UPDATE
SET "revision" = "search_unit_projection_source"."revision" + 1,
    "touched_at" = EXCLUDED."touched_at";

-- Remove the retired moderation protection commands from the development enum.
DELETE FROM "moderation_action"
WHERE reverses_action_id IN (
  SELECT id FROM "moderation_action" WHERE kind::text IN ('protect', 'unprotect')
);
DELETE FROM "moderation_action" WHERE kind::text IN ('protect', 'unprotect');
ALTER TABLE "moderation_action"
  DROP CONSTRAINT "moderation_action_reversal_check";
ALTER TYPE "moderation_action_kind" RENAME TO "moderation_action_kind_legacy";
CREATE TYPE "moderation_action_kind" AS ENUM (
  'approve',
  'hide',
  'remove',
  'restore',
  'lock_post_targeting',
  'unlock_post_targeting',
  'warning',
  'silence',
  'suspension',
  'ban',
  'rate_limit',
  'trust_restriction',
  'revoke_enforcement',
  'mute_member',
  'remove_member',
  'ban_member',
  'restore_member',
  'escalate',
  'reverse',
  'note'
);
ALTER TABLE "moderation_action"
  ALTER COLUMN "kind" TYPE "moderation_action_kind"
  USING kind::text::moderation_action_kind;
ALTER TABLE "moderation_action"
  ADD CONSTRAINT "moderation_action_reversal_check"
  CHECK ((kind IN ('reverse', 'revoke_enforcement')) = (reverses_action_id IS NOT NULL));
DROP TYPE "moderation_action_kind_legacy";

DELETE FROM "governance_post_binding" WHERE subject_kind::text = 'unit_protection';
ALTER TYPE "governance_note_subject_kind" RENAME TO "governance_note_subject_kind_legacy";
CREATE TYPE "governance_note_subject_kind" AS ENUM (
  'feedback',
  'moderation_case',
  'moderation_action',
  'unit_access_restriction',
  'realm_unit_status_event'
);
ALTER TABLE "governance_post_binding"
  ALTER COLUMN "subject_kind" TYPE "governance_note_subject_kind"
  USING subject_kind::text::governance_note_subject_kind;
DROP TYPE "governance_note_subject_kind_legacy";
