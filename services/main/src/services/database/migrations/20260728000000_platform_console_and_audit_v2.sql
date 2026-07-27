-- Replace the legacy mixed-authority capability table with an append-only
-- lifecycle for platform capability grants.
DELETE FROM "capability_grant"
WHERE "authority" <> 'platform'::"capability_authority" OR "realm_id" IS NOT NULL;

UPDATE "capability_grant"
SET "capability" = 'platform.access.manage'
WHERE "capability" = 'platform.grants.manage';

ALTER TABLE "capability_grant" DROP CONSTRAINT "capability_grant_identity_key";
ALTER TABLE "capability_grant" DROP CONSTRAINT "capability_grant_authority_check";
ALTER TABLE "capability_grant" DROP CONSTRAINT "capability_grant_capability_not_blank";
ALTER TABLE "capability_grant" DROP CONSTRAINT "capability_grant_revocation_check";
ALTER TABLE "capability_grant" DROP CONSTRAINT "capability_grant_expiry_check";
ALTER TABLE "capability_grant" DROP CONSTRAINT "capability_grant_realm_id_realm_id_fkey";
DROP INDEX "capability_grant_profile_expiry_idx";
DROP INDEX "capability_grant_realm_idx";
DROP INDEX "capability_grant_granted_by_idx";
DROP INDEX "capability_grant_revoked_by_idx";

UPDATE "capability_grant"
SET "capability" = 'realm.rules.update'
WHERE "capability" = 'realm.rules.publish';

UPDATE "capability_grant"
SET "capability" = 'platform.development_preview.access'
WHERE "capability" IN ('unit.content_structure.preview', 'unit.zone.preview');

WITH duplicate_active_grants AS (
	SELECT
		"id",
		row_number() OVER (
			PARTITION BY "profile_id", "capability"
			ORDER BY "created_at" DESC, "id" DESC
		) AS position
	FROM "capability_grant"
	WHERE "revoked_at" IS NULL
)
UPDATE "capability_grant" AS current_grant
SET
	"revoked_at" = now(),
	"revoked_by_profile_id" = current_grant."granted_by_profile_id",
	"updated_at" = now()
FROM duplicate_active_grants duplicate
WHERE duplicate."id" = current_grant."id" AND duplicate.position > 1;

ALTER TABLE "capability_grant" DROP COLUMN "authority";
ALTER TABLE "capability_grant" DROP COLUMN "realm_id";
ALTER TABLE "capability_grant" RENAME TO "platform_capability_grant";
ALTER TABLE "platform_capability_grant"
	RENAME CONSTRAINT "capability_grant_pkey" TO "platform_capability_grant_pkey";
ALTER TABLE "platform_capability_grant"
	RENAME CONSTRAINT "capability_grant_profile_id_profile_id_fkey"
	TO "platform_capability_grant_profile_id_profile_id_fkey";
ALTER TABLE "platform_capability_grant"
	RENAME CONSTRAINT "capability_grant_granted_by_profile_id_profile_id_fkey"
	TO "platform_capability_grant_granted_by_profile_id_profile_id_fkey";
ALTER TABLE "platform_capability_grant"
	RENAME CONSTRAINT "capability_grant_revoked_by_profile_id_profile_id_fkey"
	TO "platform_capability_grant_revoked_by_profile_id_profile_id_fkey";

CREATE TYPE "platform_capability" AS ENUM (
	'platform.access.read',
	'platform.access.manage',
	'platform.audit.read',
	'entity.associations.override',
	'unit.edit',
	'platform.development_preview.access',
	'unit.ownership.transfer',
	'unit.slug.manage',
	'unit.slug.namespace.manage',
	'unit.slug.redirect.release',
	'platform.api_token_policy.manage',
	'platform.moderate',
	'platform.suppress',
	'realm.contribute',
	'realm.units.create',
	'realm.post.replies.create',
	'realm.settings.update',
	'realm.members.read',
	'realm.members.manage',
	'realm.rules.update',
	'realm.pins.manage',
	'realm.units.moderate'
);

ALTER TABLE "platform_capability_grant"
	ALTER COLUMN "capability" TYPE "platform_capability"
	USING "capability"::"platform_capability";

ALTER TABLE "platform_capability_grant"
	ADD CONSTRAINT "platform_capability_grant_revocation_check"
	CHECK (("revoked_at" IS NULL) = ("revoked_by_profile_id" IS NULL));
ALTER TABLE "platform_capability_grant"
	ADD CONSTRAINT "platform_capability_grant_expiry_check"
	CHECK ("expires_at" IS NULL OR "expires_at" > "created_at");

CREATE UNIQUE INDEX "platform_capability_grant_active_key"
	ON "platform_capability_grant" ("profile_id", "capability")
	WHERE "revoked_at" IS NULL;
CREATE INDEX "platform_capability_grant_profile_expiry_idx"
	ON "platform_capability_grant" ("profile_id", "expires_at");
CREATE INDEX "platform_capability_grant_granted_by_idx"
	ON "platform_capability_grant" ("granted_by_profile_id");
CREATE INDEX "platform_capability_grant_revoked_by_idx"
	ON "platform_capability_grant" ("revoked_by_profile_id");

DROP TYPE "capability_authority";

-- Audit v2 preserves old records while making actor, authority, outcome, and
-- target semantics explicit. The append-only trigger is restored afterwards.
DROP TRIGGER "audit_event_append_only" ON "audit_event";

CREATE TYPE "audit_event_category" AS ENUM (
	'admin_activity',
	'policy_denied',
	'system_event'
);
CREATE TYPE "audit_event_outcome" AS ENUM ('succeeded', 'denied', 'failed');
CREATE TYPE "audit_actor_kind" AS ENUM ('profile', 'system');
CREATE TYPE "audit_credential_kind" AS ENUM ('session', 'api_token', 'bootstrap', 'system');
CREATE TYPE "audit_authority_kind" AS ENUM ('platform', 'realm', 'unit');

ALTER TABLE "audit_event" DROP CONSTRAINT "audit_event_action_check";
ALTER TABLE "audit_event" DROP CONSTRAINT "audit_event_subject_check";
ALTER TABLE "audit_event" DROP CONSTRAINT "audit_event_metadata_json_object_check";
DROP INDEX "audit_event_subject_idx";

ALTER TABLE "audit_event" RENAME COLUMN "decision_code" TO "reason_code";
ALTER TABLE "audit_event" RENAME COLUMN "subject_kind" TO "target_kind";
ALTER TABLE "audit_event" RENAME COLUMN "subject_id" TO "target_id";
ALTER TABLE "audit_event" RENAME COLUMN "subject_path" TO "target_path";
ALTER TABLE "audit_event" RENAME COLUMN "metadata" TO "details";
ALTER TABLE "audit_event" ALTER COLUMN "reason_code" DROP NOT NULL;

ALTER TABLE "audit_event" ADD COLUMN "schema_version" integer;
ALTER TABLE "audit_event" ADD COLUMN "category" "audit_event_category";
ALTER TABLE "audit_event" ADD COLUMN "outcome" "audit_event_outcome";
ALTER TABLE "audit_event" ADD COLUMN "actor_kind" "audit_actor_kind";
ALTER TABLE "audit_event" ADD COLUMN "actor_credential_kind" "audit_credential_kind";
ALTER TABLE "audit_event" ADD COLUMN "actor_credential_id" text;
ALTER TABLE "audit_event" ADD COLUMN "authority_kind" "audit_authority_kind";
ALTER TABLE "audit_event" ADD COLUMN "authority_id" uuid;
ALTER TABLE "audit_event" ADD COLUMN "trace_id" text;

UPDATE "audit_event"
SET
	"schema_version" = 2,
	"category" = CASE
		WHEN "reason_code" = 'denied' THEN 'policy_denied'::"audit_event_category"
		ELSE 'admin_activity'::"audit_event_category"
	END,
	"outcome" = CASE
		WHEN "reason_code" = 'denied' THEN 'denied'::"audit_event_outcome"
		ELSE 'succeeded'::"audit_event_outcome"
	END,
	"actor_kind" = CASE
		WHEN "actor_profile_id" IS NULL THEN 'system'::"audit_actor_kind"
		ELSE 'profile'::"audit_actor_kind"
	END,
	"actor_credential_kind" = CASE
		WHEN "actor_profile_id" IS NULL THEN 'system'::"audit_credential_kind"
		ELSE 'session'::"audit_credential_kind"
	END,
	"authority_kind" = CASE
		WHEN "action" LIKE 'realm.%' THEN 'realm'::"audit_authority_kind"
		WHEN "action" LIKE 'unit.%' OR "action" LIKE 'revision.%'
			THEN 'unit'::"audit_authority_kind"
		ELSE 'platform'::"audit_authority_kind"
	END,
	"authority_id" = CASE
		WHEN "action" LIKE 'realm.%'
			THEN COALESCE(NULLIF("details"->>'realmId', '')::uuid, "target_id")
		WHEN "action" LIKE 'unit.%' OR "action" LIKE 'revision.%' THEN "target_id"
		ELSE NULL
	END,
	"reason_code" = NULLIF("reason_code", 'allowed');

ALTER TABLE "audit_event" ALTER COLUMN "schema_version" SET DEFAULT 2;
ALTER TABLE "audit_event" ALTER COLUMN "schema_version" SET NOT NULL;
ALTER TABLE "audit_event" ALTER COLUMN "category" SET NOT NULL;
ALTER TABLE "audit_event" ALTER COLUMN "outcome" SET NOT NULL;
ALTER TABLE "audit_event" ALTER COLUMN "actor_kind" SET NOT NULL;
ALTER TABLE "audit_event" ALTER COLUMN "actor_credential_kind" SET NOT NULL;
ALTER TABLE "audit_event" ALTER COLUMN "authority_kind" SET NOT NULL;

ALTER TABLE "audit_event"
	ADD CONSTRAINT "audit_event_schema_version_check" CHECK ("schema_version" > 0);
ALTER TABLE "audit_event"
	ADD CONSTRAINT "audit_event_action_check" CHECK (btrim("action") <> '');
ALTER TABLE "audit_event"
	ADD CONSTRAINT "audit_event_actor_check"
	CHECK (("actor_kind" = 'profile'::"audit_actor_kind") = ("actor_profile_id" IS NOT NULL));
ALTER TABLE "audit_event"
	ADD CONSTRAINT "audit_event_authority_check"
	CHECK (("authority_kind" = 'platform'::"audit_authority_kind") = ("authority_id" IS NULL));
ALTER TABLE "audit_event"
	ADD CONSTRAINT "audit_event_target_check"
	CHECK ("target_kind" IS NOT NULL OR ("target_id" IS NULL AND "target_path" IS NULL));
ALTER TABLE "audit_event"
	ADD CONSTRAINT "audit_event_details_json_object_check"
	CHECK ("details" IS NULL OR jsonb_typeof("details") = 'object');

CREATE INDEX "audit_event_category_created_at_idx"
	ON "audit_event" ("category", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST);
CREATE INDEX "audit_event_authority_created_at_idx"
	ON "audit_event" ("authority_kind", "authority_id", "created_at" DESC NULLS LAST);
CREATE INDEX "audit_event_target_idx" ON "audit_event" ("target_kind", "target_id");
CREATE INDEX "audit_event_trace_idx" ON "audit_event" ("trace_id");

CREATE TRIGGER "audit_event_append_only"
	BEFORE UPDATE OR DELETE ON "audit_event"
	FOR EACH ROW EXECUTE FUNCTION "reject_immutable_history_mutation"();

ALTER TABLE "api_access_policy" DROP CONSTRAINT "api_access_policy_kind_check";
UPDATE "api_access_policy" SET "kind" = 'privileged' WHERE "kind" = 'staff_trusted';
ALTER TABLE "api_access_policy"
	ADD CONSTRAINT "api_access_policy_kind_check"
	CHECK ("kind" IN ('standard', 'privileged'));
